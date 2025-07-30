import React, { useState, useEffect } from 'react';
import { HeartIcon, ChatBubbleLeftIcon, ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';
import Comment from './Comment';
import VoicePlayer from './VoicePlayer';

export default function Post({ post, onPostDeleted, onUserClick }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [comments, setComments] = useState(post.comments || []);
  const [showAllComments, setShowAllComments] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const { currentUser } = useAuth();
  const [authorAvatar, setAuthorAvatar] = useState(post.author_avatar_url || null);

  // Định nghĩa fetchComments ở ngoài để dùng lại
  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setComments(data);
    }
  }

  // Check if current user has liked this post
  useEffect(() => {
    const checkIfLiked = async () => {
      if (!currentUser) return;
      
      const { data, error } = await supabase
        .from('post_likes')
        .select('*')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .single();

      if (!error && data) {
        setLiked(true);
      }
    };

    checkIfLiked();
  }, [post.id, currentUser]);

  // Realtime subscription cho post likes và comments
  useEffect(() => {
    const channel = supabase.channel(`post-${post.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'post_likes' },
        (payload) => {
          console.log('Post likes realtime:', payload);
          if (payload.new && payload.new.post_id === post.id) {
            if (payload.eventType === 'INSERT') {
              setLikes(prev => prev + 1);
              if (payload.new.user_id === currentUser?.id) {
                setLiked(true);
              }
            } else if (payload.eventType === 'DELETE') {
              setLikes(prev => Math.max(0, prev - 1));
              if (payload.old.user_id === currentUser?.id) {
                setLiked(false);
              }
            }
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        (payload) => {
          console.log('Comments realtime:', payload);
          if (
            (payload.new && payload.new.post_id === post.id) ||
            (payload.eventType === 'DELETE' && payload.old && payload.old.post_id === post.id)
          ) {
            // Luôn fetch lại toàn bộ comment khi có thay đổi
            fetchComments();
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'comment_likes' },
        (payload) => {
          console.log('Comment likes realtime:', payload);
          if (payload.new && payload.new.comment_id) {
            const comment = comments.find(c => c.id === payload.new.comment_id);
            if (comment) {
              if (payload.eventType === 'INSERT') {
                setComments(prev => prev.map(c =>     
                  c.id === payload.new.comment_id 
                    ? { ...c, likes: (c.likes || 0) + 1 }
                    : c
                ));
              } else if (payload.eventType === 'DELETE') {
                setComments(prev => prev.map(c => 
                  c.id === payload.old.comment_id 
                    ? { ...c, likes: Math.max(0, (c.likes || 0) - 1) }
                    : c
                ));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id, currentUser?.id]);

  // Fetch comments khi load lại trang
  useEffect(() => {
    fetchComments();
  }, [post.id]);

  useEffect(() => {
    async function fetchAuthorAvatar() {
      if (!authorAvatar && post.author_uid) {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', post.author_uid)
          .single();
        if (data) {
          setAuthorAvatar(data.avatar_url || post.author_user_metadata?.avatar_url || null);
        }
      }
    }
    fetchAuthorAvatar();
    // eslint-disable-next-line
  }, [post.author_uid]);

  const handleLike = async () => {
    if (!currentUser) return;

    try {
    if (liked) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id);

        // Update post likes count
        await supabase
          .from('posts')
          .update({ likes: likes - 1 })
          .eq('id', post.id);

      setLikes(likes - 1);
        setLiked(false);
    } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({
            post_id: post.id,
            user_id: currentUser.id
          });

        // Update post likes count
        await supabase
          .from('posts')
          .update({ likes: likes + 1 })
          .eq('id', post.id);

      setLikes(likes + 1);
        setLiked(true);
      }
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || post.author_uid !== currentUser.id) return;

    try {
      // Delete media file from storage if exists
      if (post.media_url && !post.media_url.startsWith('data:')) {
        try {
          // Extract filename from Supabase Storage URL
          let fileName;
          
          if (post.media_url.includes('/storage/v1/object/public/posts/')) {
            // Public URL format: https://.../storage/v1/object/public/posts/filename
            fileName = post.media_url.split('/storage/v1/object/public/posts/')[1];
          } else if (post.media_url.includes('/storage/v1/object/sign/posts/')) {
            // Signed URL format: https://.../storage/v1/object/sign/posts/filename
            fileName = post.media_url.split('/storage/v1/object/sign/posts/')[1];
            // Remove query parameters if any
            fileName = fileName.split('?')[0];
          } else {
            // Fallback: get last part of URL
            fileName = post.media_url.split('/').pop();
            fileName = fileName.split('?')[0]; // Remove query parameters
          }
          
          // Decode URL encoding
          fileName = decodeURIComponent(fileName);
          
          console.log('Deleting media file:', fileName);
          console.log('Original URL:', post.media_url);
          
          const { error: deleteFileError } = await supabase.storage
            .from('posts')
            .remove([fileName]);
          
          if (deleteFileError) {
            console.error('Error deleting media file:', deleteFileError);
            console.error('File name attempted:', fileName);
          } else {
            console.log('Media file deleted successfully:', fileName);
          }
        } catch (fileError) {
          console.error('Error deleting file:', fileError);
        }
      }

      // Delete post likes
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id);

      // Delete the post
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) {
        console.error('Error deleting post:', error);
        return;
      }

      // Notify parent component
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCommentAdded = (newComments) => {
    setComments(newComments);
  };

  const handleImageModalOpen = () => {
    setShowImageModal(true);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleImageModalClose = () => {
    setShowImageModal(false);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleImageMouseDown = (e) => {
    if (imageZoom > 1) {
      const startX = e.clientX - imagePosition.x;
      const startY = e.clientY - imagePosition.y;
      
      const handleMouseMove = (e) => {
        setImagePosition({
          x: e.clientX - startX,
          y: e.clientY - startY
        });
      };
      
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setImageZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  // Sắp xếp comments theo yêu cầu: cũ nhất + nhiều tim + mới nhất
  const getSortedComments = () => {
    if (!comments || comments.length === 0) return [];

    // Nếu có ít hơn 3 comments, hiển thị tất cả
    if (comments.length < 3) {
      return comments;
    }

    // Sắp xếp theo likes để tìm comment nhiều tim nhất
    const sortedByLikes = [...comments].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    const mostLiked = sortedByLikes[0];
    const oldest = comments[0]; // Comment đầu tiên (cũ nhất)
    const newest = comments[comments.length - 1]; // Comment cuối cùng (mới nhất)

    const selectedComments = [];
    const addedIds = new Set();

    // Luôn thêm comment đầu tiên (cũ nhất)
    if (oldest) {
      selectedComments.push(oldest);
      addedIds.add(oldest.id);
    }

    // Thêm comment nhiều tim nhất hoặc mới nhất
    if (mostLiked && !addedIds.has(mostLiked.id)) {
      selectedComments.push(mostLiked);
      addedIds.add(mostLiked.id);
    } else if (newest && !addedIds.has(newest.id)) {
      selectedComments.push(newest);
      addedIds.add(newest.id);
    }

    // Nếu vẫn chưa đủ 2 comments, thêm comment nhiều tim thứ 2
    if (selectedComments.length < 2 && sortedByLikes.length > 1) {
      const secondMostLiked = sortedByLikes[1];
      if (secondMostLiked && !addedIds.has(secondMostLiked.id)) {
        selectedComments.push(secondMostLiked);
      }
    }

    return selectedComments.slice(0, 2);
  };

  const displayComments = showAllComments ? comments : getSortedComments();

  return (
    <div className="border-b border-gray-800 p-4 hover:bg-gray-900/50 transition-colors">
      <div className="flex space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {authorAvatar ? (
              <img 
                src={authorAvatar} 
                alt="Avatar" 
                className="w-full h-full rounded-full object-cover" 
              />
            ) : (
              post.author_display_name?.charAt(0) || 'U'
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onUserClick && onUserClick(post.author_uid)}
                className="font-semibold text-white hover:text-blue-400 transition-colors"
              >
                {post.author_display_name || 'Unknown'}
              </button>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500 text-sm">
                {new Date(post.created_at).toLocaleDateString('vi-VN')}
            </span>
            </div>
            
            {/* Delete button - chỉ hiển thị cho tác giả */}
            {currentUser && post.author_uid === currentUser.id && (
              <button
                onClick={handleDeletePost}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-500/10"
                title="Xóa bài viết"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Text content */}
          <p className="text-white mb-3 leading-relaxed">{post.content}</p>

          {/* Media */}
          {post.media_url && (
            <div className="mb-3">
              {post.media_type?.startsWith('image/') ? (
                <div>
                <img 
                    src={post.media_url} 
                  alt="Post media" 
                    className="rounded-2xl max-w-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    crossOrigin={post.media_url.startsWith('data:') ? undefined : "anonymous"}
                    onClick={handleImageModalOpen}
                    onError={(e) => {
                      console.error('Image failed to load:', post.media_url);
                      e.target.style.display = 'none';
                      // Show error message
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'text-red-500 text-sm mt-2';
                      errorDiv.textContent = 'Không thể tải ảnh. URL: ' + post.media_url;
                      e.target.parentNode.appendChild(errorDiv);
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully:', post.media_url);
                    }}
                  />
                </div>
              ) : post.media_type?.startsWith('video/') ? (
                <video 
                  src={post.media_url} 
                  controls 
                  className="rounded-2xl max-w-full max-h-96"
                  crossOrigin={post.media_url.startsWith('data:') ? undefined : "anonymous"}
                  onError={(e) => {
                    console.error('Video failed to load:', post.media_url);
                    e.target.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Video loaded successfully:', post.media_url);
                  }}
                />
              ) : post.media_type === 'audio/wav' ? (
                <VoicePlayer audioUrl={post.media_url} isOwn={false} />
              ) : (
                <div className="text-gray-400 text-sm">
                  Media type not supported: {post.media_type}
                </div>
              )}
            </div>
          )}

          {/* Facebook-style Action Bar */}
          <div className="border-t border-gray-800 pt-3 mt-3">
            {/* Like/Comment/Share Buttons */}
            <div className="flex justify-between">
            <button
              onClick={handleLike}
                className={`flex-1 flex items-center justify-center space-x-1 md:space-x-2 px-1 md:px-4 py-2 rounded-lg transition-colors ${
                  liked 
                    ? 'text-red-500 bg-red-500/10' 
                    : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                }`}
            >
              {liked ? (
                  <HeartSolidIcon className="w-4 h-4 md:w-5 md:h-5" />
              ) : (
                  <HeartIcon className="w-4 h-4 md:w-5 md:h-5" />
              )}
                <span className="text-xs md:text-sm font-medium">Thích</span>
              </button>

              <button className="flex-1 flex items-center justify-center space-x-1 md:space-x-2 px-1 md:px-4 py-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors">
                <ChatBubbleLeftIcon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium">Bình luận</span>
            </button>

              <button className="flex-1 flex items-center justify-center space-x-1 md:space-x-2 px-1 md:px-4 py-2 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-500/10 transition-colors">
                <ArrowUpTrayIcon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-medium">Chia sẻ</span>
              </button>
            </div>

            {/* Like Count */}
            {likes > 0 && (
              <div className="flex items-center space-x-1 mt-2 text-sm text-gray-400">
                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <HeartSolidIcon className="w-2 h-2 text-white" />
                </div>
                <span>{likes} người thích</span>
              </div>
            )}

            {/* Comments Count */}
            {comments.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                {comments.length} bình luận
              </div>
            )}
          </div>

          {/* Comments Section - Luôn hiển thị */}
          <div className="mt-3 pt-3 border-t border-gray-800">
            <Comment 
              postId={post.id} 
              comments={comments} 
              onCommentAdded={handleCommentAdded}
            />
            
            {/* Show all comments button */}
            {comments && comments.length >= 3 && (
              <button
                onClick={() => setShowAllComments(!showAllComments)}
                className="mt-2 text-blue-500 hover:text-blue-400 text-sm transition-colors"
              >
                {showAllComments 
                  ? 'Ẩn bớt bình luận' 
                  : `Xem tất cả ${comments.length} bình luận`
                }
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && post.media_url && post.media_type?.startsWith('image/') && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={handleImageModalClose}
        >
          {/* Zoom Controls */}
          <div className="absolute top-4 left-4 flex space-x-2 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              className="text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
              title="Phóng to"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              className="text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
              title="Thu nhỏ"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10h-6" />
              </svg>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              className="text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
              title="Reset zoom"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={handleImageModalClose}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors z-10"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          {/* Zoom Info */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white bg-black/50 rounded-full px-3 py-1 text-sm z-10">
            {Math.round(imageZoom * 100)}%
          </div>

          {/* Image Container */}
          <div 
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            onWheel={handleWheel}
          >
            <img 
              src={post.media_url} 
              alt="Post media" 
              className="max-w-none transition-transform duration-200 ease-out"
              style={{
                transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
                cursor: imageZoom > 1 ? 'grab' : 'default',
              }}
              onMouseDown={handleImageMouseDown}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
} 