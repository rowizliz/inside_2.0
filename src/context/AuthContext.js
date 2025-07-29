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

      // Đảm bảo session được lưu
      if (data.session) {
        console.log('Login successful, session created');
        // Refresh session ngay sau khi login
        await supabase.auth.getSession();
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

  // Thêm hàm timeout cho fetchUserProfile
  async function fetchUserProfileWithTimeout(user, ms = 5000) {
    return Promise.race([
      fetchUserProfile(user),
      new Promise((_, reject) => setTimeout(() => reject(new Error('fetchUserProfile timeout')), ms))
    ]);
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
    
    // BỎ QUA HOÀN TOÀN fetch profile, chỉ lấy user từ session
    const timeoutId = setTimeout(() => {
      console.log('AuthProvider: Timeout reached, forcing loading to false');
      setLoading(false);
    }, 5000);

    // Hàm refresh session định kỳ
    const refreshSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session refresh error:', error);
          return;
        }
        if (session) {
          console.log('Session refreshed successfully');
        }
      } catch (err) {
        console.error('Error refreshing session:', err);
      }
    };

    // Refresh session mỗi 30 phút
    const refreshInterval = setInterval(refreshSession, 30 * 60 * 1000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session:', session);
      clearTimeout(timeoutId);
      try {
        if (session?.user) {
          await fetchUserProfileWithTimeout(session.user);
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Error in fetchUserProfile:', err);
        setCurrentUser(null);
      }
      setLoading(false);
    }).catch(error => {
      console.error('Error getting session:', error);
      clearTimeout(timeoutId);
      setCurrentUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session);
        try {
          if (session?.user) {
            await fetchUserProfileWithTimeout(session.user);
          } else {
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('Error in fetchUserProfile:', err);
          setCurrentUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      clearInterval(refreshInterval);
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
