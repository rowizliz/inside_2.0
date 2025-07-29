import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';
import { HeartIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

export default function Comment({ postId, comments, onCommentAdded }) {
  const [newComment, setNewComment] = useState('');
  const { currentUser } = useAuth();
  const [avatars, setAvatars] = useState({});

  useEffect(() => {
    async function fetchAvatars() {
      const missing = comments.filter(c => !c.author_avatar_url && c.author_uid && !avatars[c.author_uid]);
      if (missing.length === 0) return;
      const uids = [...new Set(missing.map(c => c.author_uid))];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', uids);
      if (data) {
        const newAvatars = {};
        data.forEach(profile => {
          newAvatars[profile.id] = profile.avatar_url;
        });
        setAvatars(prev => ({ ...prev, ...newAvatars }));
      }
    }
    fetchAvatars();
    // eslint-disable-next-line
  }, [comments]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;

    try {
      const newCommentObj = {
        id: Date.now(),
        content: newComment.trim(),
        author_uid: currentUser.id,
        author_display_name: currentUser.displayName,
        author_email: currentUser.email,
        author_avatar_url: currentUser.avatar_url, // Thêm dòng này
        created_at: new Date().toISOString(),
        likes: 0,
        liked_by: []
      };

      const updatedComments = [...comments, newCommentObj];

      const { error } = await supabase
        .from('posts')
        .update({ comments: updatedComments })
        .eq('id', postId);

      if (error) {
        console.error('Error adding comment:', error);
        return;
      }

      setNewComment('');
      
      if (onCommentAdded) {
        onCommentAdded(updatedComments);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!currentUser) return;

    try {
      const updatedComments = comments.map(comment => {
        if (comment.id === commentId) {
          const isLiked = comment.liked_by?.includes(currentUser.id);
          if (isLiked) {
            // Unlike
            return {
              ...comment,
              likes: comment.likes - 1,
              liked_by: comment.liked_by?.filter(id => id !== currentUser.id) || []
            };
          } else {
            // Like
            return {
              ...comment,
              likes: comment.likes + 1,
              liked_by: [...(comment.liked_by || []), currentUser.id]
            };
          }
        }
        return comment;
      });

      const { error } = await supabase
        .from('posts')
        .update({ comments: updatedComments })
        .eq('id', postId);

      if (error) {
        console.error('Error liking comment:', error);
        return;
      }

      if (onCommentAdded) {
        onCommentAdded(updatedComments);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!currentUser) return;

    try {
      const updatedComments = comments.filter(comment => comment.id !== commentId);

      const { error } = await supabase
        .from('posts')
        .update({ comments: updatedComments })
        .eq('id', postId);

      if (error) {
        console.error('Error deleting comment:', error);
        return;
      }

      if (onCommentAdded) {
        onCommentAdded(updatedComments);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - commentTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Vừa xong';
    if (diffInMinutes < 60) return `${diffInMinutes} phút`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} giờ`;
    return `${Math.floor(diffInMinutes / 1440)} ngày`;
  };

  return (
    <div className="mt-3">
      {/* Comment Input - Luôn hiển thị */}
      <form onSubmit={handleSubmitComment} className="mb-3">
        <div className="flex space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {currentUser?.avatar_url ? (
              <img 
                src={currentUser.avatar_url} 
                alt="Avatar" 
                className="w-full h-full rounded-full object-cover" 
              />
            ) : (
              currentUser?.displayName?.charAt(0) || 'U'
            )}
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Viết bình luận..."
              className="w-full bg-gray-800 border border-gray-700 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Gửi
          </button>
        </div>
      </form>

      {/* Comments List */}
      {comments && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment) => {
            const isLiked = comment.liked_by?.includes(currentUser?.id);
            const canDelete = currentUser && comment.author_uid === currentUser.id;
            
            return (
              <div key={comment.id} className="flex space-x-2">
                <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {comment.author_avatar_url || avatars[comment.author_uid] ? (
                    <img 
                      src={comment.author_avatar_url || avatars[comment.author_uid]} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover" 
                    />
                  ) : (
                    comment.author_display_name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-800 rounded-2xl px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white text-left">
                        {comment.author_display_name || 'Unknown'}
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-500/10"
                          title="Xóa bình luận"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-300 text-left">
                      {comment.content}
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-xs">
                      <span className="text-gray-500">
                        {formatTimeAgo(comment.created_at)}
                      </span>
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        className={`flex items-center space-x-1 transition-colors ${
                          isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                        }`}
                      >
                        {isLiked ? (
                          <HeartSolidIcon className="w-3 h-3" />
                        ) : (
                          <HeartIcon className="w-3 h-3" />
                        )}
                        <span>{comment.likes || 0}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 