import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';
import { HeartIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { CameraIcon } from '@heroicons/react/24/outline';

export default function Comment({ postId, comments, onCommentAdded }) {
  const [newComment, setNewComment] = useState('');
  const { currentUser } = useAuth();
  const [avatars, setAvatars] = useState({});
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [modalMedia, setModalMedia] = useState(null);

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
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('author_uid', currentUser.id); // Chỉ author mới được delete

      if (error) {
        console.error('Error deleting comment:', error);
        return;
      }

      // Realtime sẽ tự động update comments
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
        <div className="flex space-x-2 items-center">
          <label className="cursor-pointer">
            <CameraIcon className="w-5 h-5 text-gray-400 hover:text-blue-500" />
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaChange} />
          </label>
          {mediaPreview && (
            <div className="relative">
              {mediaFile && mediaFile.type.startsWith('image/') ? (
                <img src={mediaPreview} alt="preview" className="w-10 h-10 object-cover rounded-lg mr-2" />
              ) : (
                <video src={mediaPreview} className="w-10 h-10 rounded-lg mr-2" controls />
              )}
              <button type="button" onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-0 right-0 bg-black bg-opacity-60 rounded-full p-1 text-white">&times;</button>
            </div>
          )}
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Viết bình luận..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!newComment.trim() && !mediaFile}
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
              className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full p-2 text-xl"
              onClick={() => setModalMedia(null)}
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
} 