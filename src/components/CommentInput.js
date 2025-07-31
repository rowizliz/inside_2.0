import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';
import { CameraIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import VoiceRecorder from './VoiceRecorder';
import { generateFilename, getFileExtension } from '../utils/fileUtils';

export default function CommentInput({ postId, onCommentAdded }) {
  const [newComment, setNewComment] = useState('');
  const { currentUser } = useAuth();
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

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
        const fileExtension = getFileExtension(mediaFile.name, mediaFile.type);
        const fileName = generateFilename(currentUser.displayName, fileExtension);
        const filePath = `comment-media/${fileName}`;
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

  const handleVoiceRecorded = async (audioBlob) => {
    if (!currentUser) return;

    try {
      // Tạo file từ blob với format tên mới
      const fileName = generateFilename(currentUser.displayName, '.wav');
      const filePath = `voice-comments/${fileName}`;
      const file = new File([audioBlob], fileName, { type: 'audio/wav' });

      // Upload lên Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-comments')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Lỗi upload comment thoại: ' + uploadError.message);
        return;
      }

      // Tạo signed URL
      const expireSeconds = 10000 * 365 * 24 * 60 * 60; // 10.000 năm
      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from('voice-comments')
        .createSignedUrl(filePath, expireSeconds);

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

  return (
    <div className="mt-3">
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
    </div>
  );
} 