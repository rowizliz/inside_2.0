import React, { useState } from 'react';
import { PhotoIcon, VideoCameraIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';

export default function CreatePost({ onPostCreated }) {
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !mediaFile) return;

    setLoading(true);
    try {
      let mediaUrl = null;
      let mediaType = null;

      if (mediaFile) {
        console.log('Uploading file:', mediaFile.name, mediaFile.type);
        
        try {
          // Upload file to Supabase Storage
          // Tạo tên file ngắn gọn và an toàn
          const fileExtension = mediaFile.name.split('.').pop() || 'jpg';
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 8);
          const fileName = `${timestamp}_${randomId}.${fileExtension}`;
          
          console.log('Uploading to bucket: posts, filename:', fileName);
          
          const { data, error } = await supabase.storage
            .from('posts')
            .upload(fileName, mediaFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) {
            console.error('Upload error details:', error);
            throw new Error(`Upload failed: ${error.message}`);
          }

          console.log('Upload successful:', data);

          // Get signed URL với thời hạn 10.000 năm
          const { data: signedUrlData, error: signedError } = await supabase.storage
            .from('posts')
            .createSignedUrl(fileName, 315360000000); // 10.000 năm (10.000 * 365 * 24 * 60 * 60 * 1000)
          
          console.log('Signed URL result:', signedUrlData);
          
          if (signedError || !signedUrlData?.signedUrl) {
            console.error('Signed URL error:', signedError);
            // Fallback to public URL
            const { data: urlData } = supabase.storage
              .from('posts')
              .getPublicUrl(fileName);
            
            if (!urlData.publicUrl) {
              throw new Error('Could not get URL for uploaded file');
            }
            mediaUrl = urlData.publicUrl;
          } else {
            mediaUrl = signedUrlData.signedUrl;
          }
        
        mediaType = mediaFile.type;
          
          console.log('Final Media URL:', mediaUrl);
        } catch (uploadError) {
          console.error('Upload failed:', uploadError);
          alert(`Lỗi upload ảnh: ${uploadError.message}`);
          setLoading(false);
          return;
        }
      }

      // Insert post into Supabase database
      const postData = {
        content: content.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        author_uid: currentUser.id,
        author_display_name: currentUser.displayName,
        author_email: currentUser.email,
        likes: 0,
        comments: []
      };

      console.log('Inserting post data:', postData);

      const { error: insertError } = await supabase
        .from('posts')
        .insert(postData);

      if (insertError) {
        console.error('Insert error details:', insertError);
        throw new Error(`Post creation failed: ${insertError.message}`);
      }

      console.log('Post created successfully');

      setContent('');
      setMediaFile(null);
      setMediaPreview(null);
      
      // Add small delay to ensure database is updated
      setTimeout(() => {
        if (onPostCreated) {
          onPostCreated();
        }
      }, 500);
    } catch (error) {
      console.error('Error creating post:', error);
      alert(`Lỗi: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="border-b border-gray-800 p-4">
      <form onSubmit={handleSubmit}>
        <div className="flex space-x-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
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
          </div>

          {/* Content */}
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Chia sẻ điều gì đó..."
              className="w-full bg-transparent text-white placeholder-gray-400 resize-none outline-none text-lg"
              rows="3"
            />

            {/* Media Preview */}
            {mediaPreview && (
              <div className="relative mb-3">
                {mediaFile?.type?.startsWith('image/') ? (
                  <img 
                    src={mediaPreview} 
                    alt="Preview" 
                    className="rounded-2xl max-w-full max-h-96 object-cover"
                  />
                ) : mediaFile?.type?.startsWith('video/') ? (
                  <video 
                    src={mediaPreview} 
                    controls 
                    className="rounded-2xl max-w-full max-h-96"
                  />
                ) : null}
                
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3">
              <div className="flex items-center space-x-4">
                <label className="cursor-pointer text-blue-400 hover:text-blue-300 transition-colors">
                  <PhotoIcon className="w-5 h-5" />
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                
                <label className="cursor-pointer text-green-400 hover:text-green-300 transition-colors">
                  <VideoCameraIcon className="w-5 h-5" />
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || (!content.trim() && !mediaFile)}
                className="bg-blue-500 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang đăng...' : 'Đăng'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
} 