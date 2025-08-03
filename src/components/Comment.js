import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';
import { HeartIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { CameraIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';

export default function Comment({ postId, comments, onCommentAdded }) {
  const [newComment, setNewComment] = useState('');
  const { currentUser } = useAuth();
  const [avatars, setAvatars] = useState({});
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [modalMedia, setModalMedia] = useState(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  useEffect(() => {
    async function fetchProfiles() {
      if (!comments || comments.length === 0) return;
      const uids = [...new Set(comments.filter(c => !!c.author_uid).map(c => c.author_uid))];
      if (uids.length === 0) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', uids);
      if (!error && data) {
        const newAvatars = {};
        const nameMap = {};
        data.forEach(profile => {
          newAvatars[profile.id] = profile.avatar_url || null;
          nameMap[profile.id] = profile.display_name || null;
        });
        setAvatars(prev => ({ ...prev, ...newAvatars }));
        // Cập nhật display_name động cho mảng comments đầu vào thông qua callback
        if (onCommentAdded) {
          const updated = comments.map(c => ({
            ...c,
            author_avatar_url: c.author_avatar_url || newAvatars[c.author_uid] || c.author_avatar_url,
            author_display_name: nameMap[c.author_uid] || c.author_display_name
          }));
          onCommentAdded(updated);
        }
      }
    }
    fetchProfiles();
    // eslint-disable-next-line
  }, [comments]);

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if ((!newComment.trim() && !mediaFile) || !currentUser) return;
    let media_url = null;
    let media_type = null;
    try {
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop();
        const filePath = `comment-media/${currentUser.id}_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('comment-media')
          .upload(filePath, mediaFile, { upsert: true });
        if (uploadError) {
          alert('Lỗi upload file: ' + uploadError.message);
          return;
        }
        // Lấy signed URL 10.000 năm
        const expireSeconds = 10000 * 365 * 24 * 60 * 60;
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from('comment-media')
          .createSignedUrl(filePath, expireSeconds);
        if (signedError || !signedUrlData?.signedUrl) {
          alert('Lỗi tạo signed URL: ' + (signedError?.message || 'Không lấy được signed URL'));
          return;
        }
        media_url = signedUrlData.signedUrl;
        media_type = mediaFile.type;
      }
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          content: newComment.trim(),
          author_uid: currentUser.id,
          author_display_name: currentUser.displayName,
          author_email: currentUser.email,
          author_avatar_url: currentUser.avatar_url,
          likes: 0,
          media_url,
          media_type
        });
      if (error) {
        console.error('Error adding comment:', error);
        return;
      }
      setNewComment('');
      setMediaFile(null);
      setMediaPreview(null);
      // Realtime sẽ tự động update comments
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Gửi comment thoại
  const handleVoiceRecorded = async (audioBlob) => {
    if (!currentUser) return;

    try {
      // Tạo file từ blob
      const fileName = `voice-comments/${currentUser.id}_${Date.now()}.wav`;
      const file = new File([audioBlob], fileName, { type: 'audio/wav' });

      // Upload lên Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-comments')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Lỗi upload comment thoại: ' + uploadError.message);
        return;
      }

      // Tạo signed URL
      const expireSeconds = 10000 * 365 * 24 * 60 * 60; // 10.000 năm
      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from('voice-comments')
        .createSignedUrl(fileName, expireSeconds);

      if (signedError || !signedUrlData?.signedUrl) {
        console.error('Signed URL error:', signedError);
        throw new Error('Could not get signed URL for voice comment');
      }

      // Lưu comment vào database
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          content: '🎤 Comment thoại',
          author_uid: currentUser.id,
          author_display_name: currentUser.displayName,
          author_email: currentUser.email,
          author_avatar_url: currentUser.avatar_url,
          likes: 0,
          media_url: signedUrlData.signedUrl,
          media_type: 'audio/wav'
        });

      if (error) {
        console.error('Error sending voice comment:', error);
        alert('Lỗi gửi comment thoại: ' + error.message);
        return;
      }

      setShowVoiceRecorder(false);

    } catch (error) {
      console.error('Error in handleVoiceRecorded:', error);
      alert('Lỗi gửi comment thoại: ' + error.message);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!currentUser) return;

    try {
      // Kiểm tra xem user đã like comment này chưa
      const { data: existingLike, error: checkError } = await supabase
        .from('comment_likes')
        .select('*')
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking like:', checkError);
        return;
      }

      if (existingLike) {
        // Unlike
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUser.id);

        await supabase
          .from('comments')
          .update({ likes: comments.find(c => c.id === commentId)?.likes - 1 || 0 })
          .eq('id', commentId);
      } else {
        // Like
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: currentUser.id
          });

        await supabase
          .from('comments')
          .update({ likes: (comments.find(c => c.id === commentId)?.likes || 0) + 1 })
          .eq('id', commentId);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!currentUser) return;

    try {
      // Get comment data before deleting to access media_url
      const { data: commentData, error: fetchError } = await supabase
        .from('comments')
        .select('*')
        .eq('id', commentId)
        .eq('author_uid', currentUser.id)
        .single();

      if (fetchError) {
        console.error('Error fetching comment:', fetchError);
        return;
      }

      // Delete media file from storage if exists
      if (commentData.media_url && !commentData.media_url.startsWith('data:')) {
        try {
          console.log('=== DEBUG: Comment Delete ===');
          console.log('Comment data:', commentData);
          console.log('Media URL:', commentData.media_url);
          console.log('Media type:', commentData.media_type);
          
          // Extract filename from Supabase Storage URL
          let fileName;
          
          if (commentData.media_url.includes('/storage/v1/object/public/comment-media/')) {
            // Public URL format: https://.../storage/v1/object/public/comment-media/filename
            fileName = commentData.media_url.split('/storage/v1/object/public/comment-media/')[1];
            console.log('Found public comment-media URL, fileName:', fileName);
          } else if (commentData.media_url.includes('/storage/v1/object/sign/comment-media/')) {
            // Signed URL format: https://.../storage/v1/object/sign/comment-media/filename
            fileName = commentData.media_url.split('/storage/v1/object/sign/comment-media/')[1];
            // Remove query parameters if any
            fileName = fileName.split('?')[0];
            console.log('Found signed comment-media URL, fileName:', fileName);
          } else if (commentData.media_url.includes('/storage/v1/object/public/voice-comments/')) {
            // Voice comments URL format
            fileName = commentData.media_url.split('/storage/v1/object/public/voice-comments/')[1];
            fileName = fileName.split('?')[0];
            console.log('Found public voice-comments URL, fileName:', fileName);
          } else if (commentData.media_url.includes('/storage/v1/object/sign/voice-comments/')) {
            // Signed voice comments URL format
            fileName = commentData.media_url.split('/storage/v1/object/sign/voice-comments/')[1];
            fileName = fileName.split('?')[0];
            console.log('Found signed voice-comments URL, fileName:', fileName);
          } else {
            // Fallback: get last part of URL
            fileName = commentData.media_url.split('/').pop();
            fileName = fileName.split('?')[0]; // Remove query parameters
            console.log('Using fallback method, fileName:', fileName);
          }
          
          // Remove bucket prefix if present
          if (fileName && (fileName.startsWith('comment-media/') || fileName.startsWith('voice-comments/'))) {
            fileName = fileName.split('/').slice(1).join('/');
            console.log('Removed bucket prefix, new fileName:', fileName);
          }
          
          // Additional fallback: try to extract from any storage URL
          if (!fileName || fileName.length < 10) {
            console.log('Fallback fileName too short, trying alternative method');
            const urlParts = commentData.media_url.split('/');
            for (let i = 0; i < urlParts.length; i++) {
              if (urlParts[i] === 'comment-media' || urlParts[i] === 'voice-comments') {
                if (i + 1 < urlParts.length) {
                  fileName = urlParts[i + 1];
                  fileName = fileName.split('?')[0];
                  console.log('Found fileName using alternative method:', fileName);
                  break;
                }
              }
            }
          }
          
          // Decode URL encoding
          fileName = decodeURIComponent(fileName);
          console.log('Decoded fileName:', fileName);
          
          // Determine bucket based on media type
          let bucketName = 'comment-media';
          if (commentData.media_type === 'audio/wav') {
            bucketName = 'voice-comments';
          }
          console.log('Using bucket:', bucketName);
          
          console.log('Attempting to delete file:', fileName, 'from bucket:', bucketName);
          
          // First, try to list files to check permissions
          const { data: listData, error: listError } = await supabase.storage
            .from(bucketName)
            .list();
          
          if (listError) {
            console.error('Error listing files (permission issue?):', listError);
          } else {
            console.log('Files in bucket:', listData);
          }
          
          console.log('About to delete file with exact parameters:');
          console.log('- fileName:', fileName);
          console.log('- bucketName:', bucketName);
          console.log('- Current user:', currentUser.id);
          
          // Try with just filename first
          let { error: deleteFileError } = await supabase.storage
            .from(bucketName)
            .remove([fileName]);
          
          // If that fails, try with full path
          if (deleteFileError) {
            console.log('First attempt failed, trying with full path...');
            const fullPath = `${bucketName}/${fileName}`;
            console.log('Trying with full path:', fullPath);
            
            const { error: deleteFileError2 } = await supabase.storage
              .from(bucketName)
              .remove([fullPath]);
              
            if (deleteFileError2) {
              console.error('❌ Both attempts failed');
              deleteFileError = deleteFileError2;
            } else {
              console.log('✅ Success with full path method');
              deleteFileError = null;
            }
          }
          
          if (deleteFileError) {
            console.error('❌ Error deleting comment media file:', deleteFileError);
            console.error('❌ File name attempted:', fileName);
            console.error('❌ Bucket attempted:', bucketName);
            console.error('❌ Error details:', deleteFileError.message);
            console.error('❌ Error code:', deleteFileError.statusCode);
          } else {
            console.log('✅ Comment media file deleted successfully:', fileName);
            console.log('✅ From bucket:', bucketName);
          }
        } catch (fileError) {
          console.error('Error deleting comment file:', fileError);
        }
      } else {
        console.log('No media URL found or data URL, skipping file deletion');
      }

      // Delete comment likes
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId);

      // Delete the comment
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('author_uid', currentUser.id); // Chỉ author mới được delete

      if (error) {
        console.error('Error deleting comment:', error);
        return;
      }

      console.log('Comment deleted from database successfully');
      
      // Manual update comments list to remove the deleted comment
      if (onCommentAdded) {
        const updatedComments = comments.filter(comment => comment.id !== commentId);
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
      {showVoiceRecorder ? (
        <div className="flex justify-center">
          <div className="w-full max-w-sm sm:max-w-md">
            <VoiceRecorder 
              onVoiceRecorded={handleVoiceRecorded}
              onCancel={() => setShowVoiceRecorder(false)}
            />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitComment} className="mb-3">
          <div className="flex justify-center">
            <div className="flex items-center space-x-2 w-full max-w-sm sm:max-w-md bg-gray-800 rounded-full px-3 py-2">
              <label className="cursor-pointer flex-shrink-0">
                <CameraIcon className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaChange} />
              </label>
              
              <button
                type="button"
                onClick={() => setShowVoiceRecorder(true)}
                className="p-1 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0"
              >
                <MicrophoneIcon className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
              </button>
              
              {mediaPreview && (
                <div className="relative flex-shrink-0">
                  {mediaFile && mediaFile.type.startsWith('image/') ? (
                    <img src={mediaPreview} alt="preview" className="w-8 h-8 object-cover rounded-lg" />
                  ) : (
                    <video src={mediaPreview} className="w-8 h-8 rounded-lg" controls />
                  )}
                  <button 
                    type="button" 
                    onClick={() => { setMediaFile(null); setMediaPreview(null); }} 
                    className="absolute -top-1 -right-1 bg-black bg-opacity-60 rounded-full p-0.5 text-white text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
              
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Viết bình luận..."
                className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none min-w-0"
                style={{ fontSize: '16px' }}
              />
              
              <button
                type="submit"
                disabled={!newComment.trim() && !mediaFile}
                className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                Gửi
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Comments List */}
      {comments && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment) => {
            const isLiked = comment.liked_by?.includes(currentUser?.id);
            const canDelete = currentUser && comment.author_uid === currentUser.id;
            
            return (
              <div key={comment.id} className="flex space-x-2">
                <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {avatars[comment.author_uid] || comment.author_avatar_url ? (
                    <img
                      src={avatars[comment.author_uid] || comment.author_avatar_url}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    (comment.author_display_name || '').charAt(0) || 'U'
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
                    {/* Hiển thị text trên ảnh nếu có */}
                    {comment.content && (
                      <div className="text-sm text-gray-300 text-left mb-2">
                        {comment.content}
                      </div>
                    )}
                    {/* Hiển thị media nếu có */}
                    {comment.media_url && comment.media_type && comment.media_type.startsWith('image/') && (
                      <img
                        src={comment.media_url}
                        alt="media"
                        className="rounded-xl mb-2 max-w-xs max-h-60 object-contain cursor-pointer"
                        onClick={() => setModalMedia({ url: comment.media_url, type: comment.media_type })}
                      />
                    )}
                    {comment.media_url && comment.media_type && comment.media_type.startsWith('video/') && (
                      <video
                        src={comment.media_url}
                        controls
                        className="rounded-xl mb-2 max-w-xs max-h-60 cursor-pointer"
                        onClick={() => setModalMedia({ url: comment.media_url, type: comment.media_type })}
                      />
                    )}
                    {/* Hiển thị comment thoại */}
                    {comment.media_url && comment.media_type && comment.media_type === 'audio/wav' && (
                      <VoicePlayer audioUrl={comment.media_url} isOwn={false} />
                    )}
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
      {modalMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={() => setModalMedia(null)}>
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            {modalMedia.type.startsWith('image/') ? (
              <img src={modalMedia.url} alt="media" className="max-w-[90vw] max-h-[90vh] object-contain" />
            ) : (
              <video src={modalMedia.url} controls className="max-w-[90vw] max-h-[90vh]" />
            )}
            <button
              className="absolute top-2 right-2 bg-black bg-opacity-60 text-white close-button"
              onClick={() => setModalMedia(null)}
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
} 