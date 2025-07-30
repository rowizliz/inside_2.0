import React, { useState, useEffect } from 'react';
import { PencilIcon, CameraIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';
import Post from './Post';

// Hàm resize ảnh về 250x250, trả về Promise<Blob>
function resizeImageTo250(file) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 250;
      canvas.height = 250;
      const ctx = canvas.getContext('2d');
      // Vẽ ảnh vào canvas, căn giữa, crop vuông nếu cần
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (img.width > img.height) {
        sx = (img.width - img.height) / 2;
        sw = sh = img.height;
      } else if (img.height > img.width) {
        sy = (img.height - img.width) / 2;
        sw = sh = img.width;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 250, 250);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Resize failed'));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = reject;
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UserProfile({ userId, onBack }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const { currentUser, updateCurrentUserProfile } = useAuth();

  const isOwnProfile = currentUser && currentUser.id === userId;

  useEffect(() => {
    fetchUserData();
    fetchUserPosts();
  }, [userId]);

  const fetchUserData = async () => {
    try {
      // Get user data from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        return;
      }

      if (profileData) {
        setUser({
          id: profileData.id,
          displayName: profileData.display_name || 'Unknown User',
          email: currentUser?.email || 'user@example.com',
          avatar_url: profileData.avatar_url || currentUser?.user_metadata?.avatar_url || currentUser?.avatar_url || null,
          bio: profileData.bio || ''
        });
        setBio(profileData.bio || '');
      } else {
        // Fallback for users without profile
        setUser({
          id: userId,
          displayName: 'User ' + userId.slice(0, 8),
          email: 'user@example.com',
          avatar_url: null,
          bio: 'Chưa có thông tin giới thiệu.'
        });
        setBio('Chưa có thông tin giới thiệu.');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_uid', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      setPosts(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Resize về 250x250
      try {
        const resizedBlob = await resizeImageTo250(file);
        const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });
        setAvatar(resizedFile);
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => setAvatarPreview(e.target.result);
        reader.readAsDataURL(resizedFile);
      } catch (err) {
        alert('Lỗi resize ảnh: ' + err.message);
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      let avatarUrl = user.avatar_url;

      // Upload avatar if changed
      if (avatar) {
        // Chuẩn hóa displayName hoặc fallback sang email nếu displayName không hợp lệ
        let rawName = user.displayName;
        if (!rawName || rawName === 'Unknown User') {
          rawName = user.email || currentUser?.email || 'user';
        }
        let safeName = rawName
          .toLowerCase()
          .normalize('NFD').replace(/\p{Diacritic}/gu, '') // bỏ dấu tiếng Việt
          .replace(/[^a-z0-9_]/g, '_'); // chỉ giữ chữ, số, _
        const fileName = `avatar_${safeName}`;
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatar, { upsert: true }); // overwrite file cũ

        if (error) {
          console.error('Error uploading avatar:', error);
          alert('Lỗi upload avatar lên bucket avatars. Hãy kiểm tra bucket và policy!');
          return;
        }

        // Lấy signed URL với thời hạn 10.000 năm
        const expireSeconds = 10000 * 365 * 24 * 60 * 60; // 10.000 năm
        const { data: urlData, error: urlError } = await supabase.storage
          .from('avatars')
          .createSignedUrl(fileName, expireSeconds);
        if (urlError) {
          console.error('Error creating signed URL:', urlError);
          alert('Lỗi tạo signed URL cho avatar!');
          return;
        }
        avatarUrl = urlData.signedUrl;
      }

      // Update profile in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: currentUser.id,
          display_name: user.displayName,
          bio: bio,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        });

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return;
      }

      // Gọi lại fetchUserData để lấy avatar_url mới nhất từ database
      await fetchUserData();

      // Đồng bộ context user toàn app
      if (updateCurrentUserProfile) {
        updateCurrentUserProfile({
          display_name: user.displayName,
          avatar_url: avatarUrl,
          bio: bio
        });
      }

      setIsEditing(false);
      setAvatar(null);
      setAvatarPreview(null);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
  };

  const getDisplayName = () => {
    if (!user) return 'User';
    if (!user.displayName || user.displayName === 'Unknown User') {
      return user.email || 'User';
    }
    return user.displayName;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Profile Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <div className="flex items-start space-x-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : user && user.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt="Avatar" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user?.displayName?.charAt(0) || 'U'
                )}
              </div>
              
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 rounded-full p-1 cursor-pointer transition-colors">
                  <CameraIcon className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">
                {getDisplayName()}
              </h2>
              
              {isEditing ? (
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Viết gì đó về bản thân..."
                  className="w-full bg-gray-800 text-white placeholder-gray-400 rounded-lg p-3 resize-none"
                  rows="3"
                />
              ) : (
                <p className="text-gray-300 mb-4">
                  {user?.bio || 'Chưa có thông tin giới thiệu.'}
                </p>
              )}

              {isOwnProfile && (
                <div className="flex space-x-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveProfile}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setBio(user.bio || '');
                          setAvatar(null);
                          setAvatarPreview(null);
                        }}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Hủy
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center space-x-2"
                    >
                      <PencilIcon className="w-4 h-4" />
                      <span>Chỉnh sửa</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{posts.length}</div>
              <div className="text-gray-400 text-sm">Bài viết</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-gray-400 text-sm">Người theo dõi</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-gray-400 text-sm">Đang theo dõi</div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white mb-4">Bài viết</h3>
          
          {posts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Chưa có bài viết nào.</p>
            </div>
          ) : (
            posts.map(post => (
              <Post key={post.id} post={post} onPostDeleted={handlePostDeleted} />
            ))
          )}
        </div>
      </div>
    </div>
  );
} 