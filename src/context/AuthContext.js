import React, { createContext, useContext, useEffect, useState } from 'react';
import supabase from '../supabase';
import LoadingScreen from '../components/LoadingScreen';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, displayName, avatarUrl) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          avatar_url: avatarUrl || null
        }
      }
    });
    if (error) throw error;
    // Đồng bộ avatar_url vào profiles ngay sau đăng ký
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        bio: ''
      });
    }
    return data;
  }

  async function login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Login error:', error);
        throw error;
      }

      if (data.session) {
        console.log('Login successful, session created');
        // Đảm bảo session được lưu
        console.log('Saving session to localStorage...');
        localStorage.setItem('inside-app-auth', JSON.stringify(data.session));
      }

      return data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const fetchUserProfile = async (user) => {
    try {
      console.log('Fetching profile for user:', user.id);
      // Get profile data from profiles table
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        console.log('Profile not found, creating new profile for user:', user.id);
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            display_name: user.user_metadata?.display_name || user.email,
            bio: '',
            avatar_url: user.user_metadata?.avatar_url || null
          });
        if (insertError) {
          console.error('Error creating profile:', insertError);
          // Fallback to basic user data
          const userWithDisplayName = {
            ...user,
            displayName: user.user_metadata?.display_name || user.email,
            avatar_url: user.user_metadata?.avatar_url || null,
            bio: ''
          };
          setCurrentUser(userWithDisplayName);
          return;
        }
        // Use the newly created profile
        const userWithProfile = {
          ...user,
          displayName: user.user_metadata?.display_name || user.email,
          avatar_url: user.user_metadata?.avatar_url || null,
          bio: ''
        };
        setCurrentUser(userWithProfile);
        return;
      }
      if (error) {
        console.error('Error fetching profile:', error);
        // Fallback to basic user data
        const userWithDisplayName = {
          ...user,
          displayName: user.user_metadata?.display_name || user.email,
          avatar_url: user.user_metadata?.avatar_url || null,
          bio: ''
        };
        setCurrentUser(userWithDisplayName);
        return;
      }
      // Combine user data with profile data
      const userWithProfile = {
        ...user,
        displayName: profileData?.display_name || user.user_metadata?.display_name || user.email,
        avatar_url: profileData?.avatar_url || user.user_metadata?.avatar_url || null,
        bio: profileData?.bio || ''
      };
      setCurrentUser(userWithProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Fallback to basic user data
      const userWithDisplayName = {
        ...user,
        displayName: user.user_metadata?.display_name || user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
        bio: ''
      };
      setCurrentUser(userWithDisplayName);
    }
  };

  // Thêm hàm timeout cho fetchUserProfile - tăng timeout lên 15 giây
  async function fetchUserProfileWithTimeout(user, ms = 15000) {
    try {
      return await Promise.race([
        fetchUserProfile(user),
        new Promise((_, reject) => setTimeout(() => reject(new Error('fetchUserProfile timeout')), ms))
      ]);
    } catch (error) {
      console.warn('fetchUserProfile timeout, using basic user data:', error);
      // Thay vì set currentUser thành null, sử dụng basic user data
      const basicUser = {
        ...user,
        displayName: user.user_metadata?.display_name || user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
        bio: ''
      };
      setCurrentUser(basicUser);
      return basicUser;
    }
  }

  // Hàm cập nhật profile user trong context (dùng sau khi update profile/avatar)
  const updateCurrentUserProfile = (profile) => {
    setCurrentUser((prev) => ({
      ...prev,
      displayName: profile.display_name || prev.displayName,
      avatar_url: profile.avatar_url || prev.avatar_url,
      bio: profile.bio || prev.bio
    }));
  };



  useEffect(() => {
    console.log('AuthProvider: Setting up auth listener');
    
    // Debug: Kiểm tra localStorage
    const storedSession = localStorage.getItem('inside-app-auth');
    console.log('Stored session in localStorage:', storedSession ? 'exists' : 'not found');
    
    // Thử restore session từ localStorage nếu có
    if (storedSession) {
      try {
        const parsedSession = JSON.parse(storedSession);
        console.log('Parsed stored session:', parsedSession);
        
        // Kiểm tra xem session có còn hợp lệ không
        if (parsedSession.expires_at && parsedSession.expires_at * 1000 > Date.now()) {
          console.log('Stored session is still valid, setting user...');
          const basicUser = {
            ...parsedSession.user,
            displayName: parsedSession.user.user_metadata?.display_name || parsedSession.user.email,
            avatar_url: parsedSession.user.user_metadata?.avatar_url || null,
            bio: ''
          };
          setCurrentUser(basicUser);
          setLoading(false);
          return; // Thoát sớm nếu đã có session hợp lệ
        } else {
          console.log('Stored session expired, removing...');
          localStorage.removeItem('inside-app-auth');
        }
      } catch (error) {
        console.error('Error parsing stored session:', error);
        localStorage.removeItem('inside-app-auth');
      }
    }
    
    // Timeout để tránh loading vô hạn
    const timeoutId = setTimeout(() => {
      console.log('AuthProvider: Timeout reached, forcing loading to false');
      setLoading(false);
    }, 10000); // Tăng timeout lên 10 giây

    // Lấy session ban đầu
    const initializeAuth = async () => {
      try {
        // Thử lấy session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Initial session:', session);
        console.log('Session user:', session?.user);
        console.log('Session expires_at:', session?.expires_at);
        
        if (sessionError) {
          console.error('Session error:', sessionError);
        }
        
        // Nếu không có session, thử lấy user
        if (!session?.user) {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          console.log('Fallback user:', user);
          if (userError) {
            console.error('User error:', userError);
          }
          
          if (user) {
            // Tạo session giả từ user
            const fakeSession = { user };
            await handleUserSession(fakeSession);
          } else {
            setCurrentUser(null);
          }
        } else {
          await handleUserSession(session);
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    const handleUserSession = async (session) => {
      try {
        if (session?.user) {
          await fetchUserProfileWithTimeout(session.user);
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Error in fetchUserProfile:', err);
        // Không set currentUser thành null nếu có session
        if (session?.user) {
          const basicUser = {
            ...session.user,
            displayName: session.user.user_metadata?.display_name || session.user.email,
            avatar_url: session.user.user_metadata?.avatar_url || null,
            bio: ''
          };
          setCurrentUser(basicUser);
        } else {
          setCurrentUser(null);
        }
      }
    };
    
    initializeAuth();

    // Lắng nghe thay đổi auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session);
        await handleUserSession(session);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    logout,
    updateCurrentUserProfile
  };

  console.log('AuthProvider render:', { currentUser, loading });

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 
