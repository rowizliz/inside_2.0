import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';
import CreatePost from '../components/CreatePost';
import Post from '../components/Post';
import Chat from '../components/Chat';
import UserProfile from '../components/UserProfile';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState(() => {
    // Lấy activeView từ localStorage khi khởi tạo
    const savedView = localStorage.getItem('inside-active-view');
    return savedView || 'feed';
  }); // 'feed' | 'chat' | 'profileMenu' | 'profile'
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(() => {
    // Lấy showProfile từ localStorage khi khởi tạo
    const savedShowProfile = localStorage.getItem('inside-show-profile');
    return savedShowProfile === 'true';
  });
  const [profileUserId, setProfileUserId] = useState(() => {
    // Lấy profileUserId từ localStorage khi khởi tạo
    const savedProfileUserId = localStorage.getItem('inside-profile-user-id');
    return savedProfileUserId || null;
  });
  const [unreadCounts, setUnreadCounts] = useState({});
  const { currentUser, logout } = useAuth();

  // Function để update activeView và lưu vào localStorage
  const updateActiveView = (newView) => {
    setActiveView(newView);
    localStorage.setItem('inside-active-view', newView);
  };

  // Function để update showProfile và lưu vào localStorage
  const updateShowProfile = (show) => {
    setShowProfile(show);
    localStorage.setItem('inside-show-profile', show.toString());
  };

  // Function để update profileUserId và lưu vào localStorage
  const updateProfileUserId = (userId) => {
    setProfileUserId(userId);
    if (userId) {
      localStorage.setItem('inside-profile-user-id', userId);
    } else {
      localStorage.removeItem('inside-profile-user-id');
    }
  };

  // Hàm fetch số message chưa đọc cho user
  async function fetchUnreadCounts() {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('message_reads')
      .select('message_id, status, message_id!inner(channel_id)')
      .eq('user_id', currentUser.id)
      .eq('status', 'delivered');
    if (!error && data) {
      const counts = {};
      data.forEach(row => {
        const channelId = row.message_id.channel_id;
        counts[channelId] = (counts[channelId] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  }

  // Gọi khi đăng nhập thành công hoặc chuyển tab
  useEffect(() => { fetchUnreadCounts(); }, [currentUser]);

  // Gọi khi có message mới (realtime)
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('unread-messages-home')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        await fetchUnreadCounts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
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

    fetchPosts();

    // Set up real-time subscription
    const subscription = supabase
      .channel('posts')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'posts' }, 
        (payload) => {
          console.log('Real-time event:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            console.log('New post inserted:', payload.new);
            setPosts(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            console.log('Post deleted:', payload.old);
            setPosts(prev => prev.filter(post => post.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            console.log('Post updated:', payload.new);
            setPosts(prev => prev.map(post => 
              post.id === payload.new.id ? payload.new : post
            ));
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handlePostDeleted = (postId) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
  };

  const handlePostCreated = async () => {
    // Fallback: fetch latest posts if real-time doesn't work
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const newPost = data[0];
        // Check if post already exists
        setPosts(prev => {
          const exists = prev.some(post => post.id === newPost.id);
          if (!exists) {
            return [newPost, ...prev];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error fetching latest post:', error);
    }
  };

  const handleOpenProfile = (userId = currentUser.id) => {
    updateProfileUserId(userId);
    updateShowProfile(true);
  };

  const handleBackFromProfile = () => {
    updateShowProfile(false);
    updateProfileUserId(null);
  };

  // Menu popup logic
  const handleProfileMenuClick = () => setShowProfileMenu((v) => !v);
  const handleProfileMenuClose = () => setShowProfileMenu(false);
  const handleProfileClick = () => {
    setShowProfileMenu(false);
    updateProfileUserId(currentUser.id);
    updateShowProfile(true);
  };
  const handleSettingsClick = () => {
    setShowProfileMenu(false);
    // TODO: Hiện trang cài đặt nếu có
    alert('Chức năng Cài đặt đang phát triển!');
  };
  const handleLogoutClick = async () => {
    setShowProfileMenu(false);
    // Clear localStorage khi logout
    localStorage.removeItem('inside-active-view');
    localStorage.removeItem('inside-show-profile');
    localStorage.removeItem('inside-profile-user-id');
    await logout();
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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo Inside */}
            <button
              className="text-xl font-bold text-white hover:opacity-80 transition"
              onClick={() => { updateActiveView('feed'); updateShowProfile(false); }}
            >
              Inside
            </button>
            <div className="flex items-center space-x-4">
              {/* Nút chat - ẩn khi đang ở trang chat */}
              {activeView !== 'chat' && (
                <button
                  onClick={() => { updateActiveView('chat'); updateShowProfile(false); }}
                  className="p-2 rounded-full hover:bg-gray-800 transition-colors relative"
                  title="Chat"
                >
                  <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
                  {/* Badge số tin nhắn chưa đọc, nếu có */}
                  {Object.values(unreadCounts).reduce((a, b) => a + b, 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold animate-pulse">
                      {Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
                    </span>
                  )}
                </button>
              )}
              {/* Nút profile/avatar */}
              <div className="relative">
                <button
                  onClick={handleProfileMenuClick}
                  className="flex items-center space-x-2 hover:bg-gray-800 rounded-full p-2 transition-colors"
                >
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
                </button>
                {/* Popup menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#23232a] rounded-xl shadow-lg py-2 z-50 border border-gray-800">
                    <button
                      onClick={handleProfileClick}
                      className="w-full text-left px-4 py-2 text-white hover:bg-gray-800 rounded-t-xl"
                    >
                      Trang cá nhân
                    </button>
                    <button
                      onClick={handleSettingsClick}
                      className="w-full text-left px-4 py-2 text-white hover:bg-gray-800"
                    >
                      Cài đặt
                    </button>
                    <button
                      onClick={handleLogoutClick}
                      className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-800 rounded-b-xl"
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {showProfile ? (
        <UserProfile 
          userId={profileUserId} 
          onBack={handleBackFromProfile}
        />
      ) : (
        <>
          {activeView === 'feed' && (
            <div className="max-w-2xl mx-auto">
              <CreatePost onPostCreated={handlePostCreated} />
              {/* Posts Feed */}
              <div className="divide-y divide-gray-800">
                {posts.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-400">Chưa có bài đăng nào. Hãy là người đầu tiên chia sẻ!</p>
                  </div>
                ) : (
                  posts.map(post => (
                    <Post 
                      key={post.id} 
                      post={post} 
                      onPostDeleted={handlePostDeleted}
                      onUserClick={handleOpenProfile}
                    />
                  ))
                )}
              </div>
            </div>
          )}
          {activeView === 'chat' && (
            <div className="h-[calc(100vh-80px)]">
              <Chat unreadCounts={unreadCounts} setUnreadCounts={setUnreadCounts} fetchUnreadCounts={fetchUnreadCounts} />
            </div>
          )}
        </>
      )}
    </div>
  );
} 