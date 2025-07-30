import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatBubbleLeftRightIcon, 
  PaperAirplaneIcon, 
  PlusIcon, 
  UserGroupIcon,
  PencilIcon,
  CameraIcon,
  MicrophoneIcon,
  TrashIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';

export default function Chat({ unreadCounts, setUnreadCounts, fetchUnreadCounts }) {
  const [channels, setChannels] = useState([]);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUserList, setShowUserList] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const { currentUser } = useAuth();
  const messagesEndRef = useRef(null);
  const [avatars, setAvatars] = useState({});
  const [audioContext, setAudioContext] = useState(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] = useState('luxury');
  const [latestMessages, setLatestMessages] = useState({}); // Lưu tin nhắn mới nhất cho mỗi kênh
  const [currentUserInfo, setCurrentUserInfo] = useState(null);
  const [channelUserInfos, setChannelUserInfos] = useState({});
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showChatDetail, setShowChatDetail] = useState(false); // State để quản lý hiển thị chat detail
  const [showMobileChatList, setShowMobileChatList] = useState(false); // State để toggle chat list ở mobile
  // State lưu số tin nhắn chưa đọc cho từng kênh
  // const [unreadCounts, setUnreadCounts] = useState({}); // Bỏ state cục bộ unreadCounts, dùng props
  // Thêm hàm kiểm tra đã xem cho từng message
  const [seenStatus, setSeenStatus] = useState({});

  // --- STATE PHÂN TRANG ---
  const [messageLimit, setMessageLimit] = useState(30);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Audio setup
  useEffect(() => {
    const initAudio = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContext();
        setAudioContext(context);
      } catch (error) {
        console.error('Error initializing audio context:', error);
      }
    };

    const handleUserInteraction = () => {
      if (!audioContext) {
        initAudio();
        setHasUserInteracted(true);
      }
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [audioContext]);

  // Fetch channels
  const fetchChannels = async () => {
    try {
      setLoading(true);
      console.log('Fetching channels...');
      
      // Lấy tất cả channels mà current user là member
      const { data, error } = await supabase
        .from('chat_channels')
        .select(`
          *,
          chat_channel_members!inner(user_id)
        `)
        .eq('chat_channel_members.user_id', currentUser.id);

      if (error) {
        console.error('Error fetching channels:', error);
        setError('Lỗi tải kênh chat: ' + error.message);
        return;
      }

      console.log('Fetched channels:', data);
      
      // Lấy thêm thông tin members cho mỗi channel
      const channelsWithMembers = await Promise.all(
        data.map(async (channel) => {
          const { data: members, error: membersError } = await supabase
            .from('chat_channel_members')
            .select('user_id')
            .eq('channel_id', channel.id);

          if (membersError) {
            console.error('Error fetching members for channel:', channel.id, membersError);
            return channel;
          }

          return {
            ...channel,
            chat_channel_members: members || []
          };
        })
      );

      console.log('Channels with members:', channelsWithMembers);
      
      // Log chi tiết từng channel
      channelsWithMembers.forEach((channel, index) => {
        console.log(`Channel ${index + 1}:`, {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          members: channel.chat_channel_members
        });
      });

      setChannels(channelsWithMembers || []);
      
      // Set default channel nếu chưa có
      if (!currentChannel && channelsWithMembers && channelsWithMembers.length > 0) {
        const directChannel = channelsWithMembers.find(channel => channel.type === 'direct');
        const firstChannel = channelsWithMembers[0];
        setCurrentChannel(directChannel || firstChannel);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Lỗi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Tạo kênh chat chung mặc định
  const createDefaultChannel = async () => {
    try {
      // Tạo kênh chat chung
      const { data: channelData, error: channelError } = await supabase
        .from('chat_channels')
        .insert({
          name: 'Chat Chung',
          type: 'group',
          created_by: currentUser.id
        })
        .select()
        .single();

      if (channelError) {
        console.error('Error creating default channel:', channelError);
        return;
      }

      // Thêm user vào kênh
      const { error: memberError } = await supabase
        .from('chat_channel_members')
        .insert({
          channel_id: channelData.id,
          user_id: currentUser.id
        });

      if (memberError) {
        console.error('Error adding user to channel:', memberError);
        return;
      }

      // Set channel
      setChannels([channelData]);
      setCurrentChannel(channelData);
    } catch (error) {
      console.error('Error creating default channel:', error);
    }
  };

  // Tạo kênh chat riêng với user
  const createDirectChannel = async (targetUser) => {
    try {
      console.log('Creating direct channel with user:', targetUser);
      console.log('Target user ID:', targetUser.id);
      console.log('Target user display_name:', targetUser.display_name);
      
      // Kiểm tra xem đã có kênh chat riêng với user này chưa
      const { data: existingChannels, error: checkError } = await supabase
        .from('chat_channels')
        .select(`
          *,
          chat_channel_members(user_id)
        `)
        .eq('type', 'direct');

      if (checkError) {
        console.error('Error checking existing channels:', checkError);
        alert('Lỗi kiểm tra kênh: ' + checkError.message);
        return;
      }

      console.log('Existing direct channels:', existingChannels);

      // Tìm kênh chat riêng có cả 2 user (chỉ tìm type='direct')
      // QUAN TRỌNG: Tìm theo user ID, không phải display_name
      const existingChannel = existingChannels?.find(channel => {
        const memberIds = channel.chat_channel_members?.map(member => member.user_id) || [];
        console.log('Channel members:', memberIds, 'Looking for:', currentUser.id, targetUser.id);
        return memberIds.includes(currentUser.id) && memberIds.includes(targetUser.id);
      });

      // Nếu đã có kênh chat riêng, chuyển đến kênh đó
      if (existingChannel) {
        console.log('Found existing direct channel:', existingChannel);
        setCurrentChannel(existingChannel);
        // Update user info ngay khi tìm thấy existing channel
        await updateCurrentUserInfo(existingChannel);
        setShowUserList(false);
        alert('Đã mở kênh chat riêng với ' + (targetUser.display_name || targetUser.email));
        return;
      }

      console.log('No existing channel found, creating new one...');

      // Tạo kênh chat riêng mới
      const { data: channelData, error: channelError } = await supabase
        .from('chat_channels')
        .insert({
          name: `Chat với ${targetUser.display_name || targetUser.email}`,
          type: 'direct',
          created_by: currentUser.id
        })
        .select()
        .single();

      if (channelError) {
        console.error('Error creating direct channel:', channelError);
        alert('Lỗi tạo kênh: ' + channelError.message);
        return;
      }

      console.log('Created new direct channel:', channelData);
      alert('Đã tạo kênh chat riêng thành công!');
      
      // Thêm cả 2 user vào kênh
      const { error: membersError } = await supabase
        .from('chat_channel_members')
        .insert([
          {
            channel_id: channelData.id,
            user_id: currentUser.id
          },
          {
            channel_id: channelData.id,
            user_id: targetUser.id
          }
        ]);

      if (membersError) {
        console.error('Error adding members to direct channel:', membersError);
        alert('Lỗi thêm thành viên: ' + membersError.message);
        return;
      }

      console.log('Successfully added members to direct channel');
      
      // Set current channel và update user info ngay lập tức
      setCurrentChannel(channelData);
      await updateCurrentUserInfo(channelData);
      
      // Reset form và fetch channels
      setNewChannelName('');
      setSelectedUsers([]);
      setShowUserList(false);
      await fetchChannels();
      await fetchLatestMessages();
    } catch (error) {
      console.error('Error creating direct channel:', error);
      alert('Lỗi tạo kênh: ' + error.message);
    }
  };

  // Tạo group chat
  const createGroupChannel = async () => {
    if (!newChannelName.trim() || selectedUsers.length === 0) return;

    try {
      // Tạo group chat mới (luôn tạo mới, không kiểm tra trùng)
      const { data: channelData, error: channelError } = await supabase
        .from('chat_channels')
        .insert({
          name: newChannelName.trim(),
          type: 'group',
          created_by: currentUser.id
        })
        .select()
        .single();

      if (channelError) {
        console.error('Error creating group channel:', channelError);
        return;
      }

      console.log('Created new group channel:', channelData);

      // Thêm tất cả thành viên vào group (bao gồm cả người tạo)
      const members = [currentUser.id, ...selectedUsers];
      const { error: membersError } = await supabase
        .from('chat_channel_members')
        .insert(
          members.map(userId => ({
            channel_id: channelData.id,
            user_id: userId
          }))
        );

      if (membersError) {
        console.error('Error adding members to group channel:', membersError);
        return;
      }

      // Reset form
      setNewChannelName('');
      setSelectedUsers([]);
      setShowCreateChannel(false);
      
      // Refresh danh sách kênh và chuyển đến kênh mới
      await fetchChannels();
      setCurrentChannel(channelData);
    } catch (error) {
      console.error('Error creating group channel:', error);
    }
  };

  // Dọn dẹp kênh duplicate
  const cleanupDuplicateChannels = async () => {
    try {
      console.log('Cleaning up duplicate channels...');
      
      // Lấy tất cả kênh chat riêng
      const { data: allChannels, error: fetchError } = await supabase
        .from('chat_channels')
        .select(`
          *,
          chat_channel_members(user_id)
        `)
        .eq('type', 'direct');

      if (fetchError) {
        console.error('Error fetching channels:', fetchError);
        return;
      }

      // Nhóm kênh theo cặp user
      const channelGroups = {};
      allChannels.forEach(channel => {
        const memberIds = channel.chat_channel_members?.map(member => member.user_id) || [];
        if (memberIds.length === 2) {
          const sortedIds = memberIds.sort();
          const key = `${sortedIds[0]}-${sortedIds[1]}`;
          if (!channelGroups[key]) {
            channelGroups[key] = [];
          }
          channelGroups[key].push(channel);
        }
      });

      // Xóa kênh duplicate, giữ lại kênh đầu tiên
      for (const [key, channels] of Object.entries(channelGroups)) {
        if (channels.length > 1) {
          console.log(`Found ${channels.length} duplicate channels for key: ${key}`);
          
          // Giữ lại kênh đầu tiên, xóa các kênh còn lại
          const channelsToDelete = channels.slice(1);
          
          for (const channelToDelete of channelsToDelete) {
            console.log(`Deleting duplicate channel: ${channelToDelete.id}`);
            
            // Xóa tin nhắn
            await supabase
              .from('chat_messages')
              .delete()
              .eq('channel_id', channelToDelete.id);
            
            // Xóa thành viên
            await supabase
              .from('chat_channel_members')
              .delete()
              .eq('channel_id', channelToDelete.id);
            
            // Xóa kênh
            await supabase
              .from('chat_channels')
              .delete()
              .eq('id', channelToDelete.id);
          }
        }
      }

      console.log('Cleanup completed');
      alert('Đã dọn dẹp xong các kênh duplicate!');
      
      // Refresh danh sách kênh
      await fetchChannels();
    } catch (error) {
      console.error('Error cleaning up duplicate channels:', error);
      alert('Lỗi dọn dẹp: ' + error.message);
    }
  };

  // Xóa kênh chat
  const deleteChannel = async (channelId) => {
    try {
      console.log('Attempting to delete channel:', channelId);
      
      // Kiểm tra quyền xóa (chỉ người tạo mới được xóa)
      const channelToDelete = channels.find(ch => ch.id === channelId);
      if (!channelToDelete) {
        alert('Không tìm thấy kênh để xóa!');
        return;
      }

      if (channelToDelete.created_by !== currentUser.id) {
        alert('Bạn không có quyền xóa kênh này!');
        return;
      }

      // Xóa tất cả tin nhắn trong kênh
      console.log('Deleting messages...');
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('channel_id', channelId);

      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        alert('Lỗi xóa tin nhắn: ' + messagesError.message);
        return;
      }

      console.log('Messages deleted successfully');

      // Xóa tất cả thành viên trong kênh
      console.log('Deleting members...');
      const { error: membersError } = await supabase
        .from('chat_channel_members')
        .delete()
        .eq('channel_id', channelId);

      if (membersError) {
        console.error('Error deleting members:', membersError);
        alert('Lỗi xóa thành viên: ' + membersError.message);
        return;
      }

      console.log('Members deleted successfully');

      // Xóa kênh
      console.log('Deleting channel...');
      const { error: channelError } = await supabase
        .from('chat_channels')
        .delete()
        .eq('id', channelId);

      if (channelError) {
        console.error('Error deleting channel:', channelError);
        alert('Lỗi xóa kênh: ' + channelError.message);
        return;
      }

      console.log('Channel deleted successfully');
      alert('Đã xóa kênh thành công!');
      
      // Refresh danh sách kênh
      await fetchChannels();
      
      // Nếu đang ở kênh bị xóa, chuyển về null
      if (currentChannel?.id === channelId) {
        setCurrentChannel(null);
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      alert('Lỗi xóa kênh: ' + error.message);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      console.log('Fetching ALL users from profiles...');
      console.log('Current user ID:', currentUser.id);
      
      // Fetch tất cả users từ bảng profiles (trừ current user)
      // Chỉ select các cột có thật: id, display_name, bio, avatar_url
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, display_name, bio, avatar_url')
        .neq('id', currentUser.id)
        .order('display_name', { ascending: true });

      if (error) {
        console.error('Error fetching profiles:', error);
        alert('Lỗi fetch profiles: ' + error.message);
        setUsers([]);
        return;
      }

      console.log('All profiles fetched:', profiles);
      
      // Hiển thị tất cả users (không filter)
      if (!profiles || profiles.length === 0) {
        console.log('No profiles found in database');
        alert('Không có users nào trong database!');
        setUsers([]);
        return;
      }

      console.log(`Found ${profiles.length} users in database`);
      
      // Hiển thị tất cả users, không filter
      setUsers(profiles);
      
      // Log thông tin từng user
      profiles.forEach((user, index) => {
        console.log(`User ${index + 1}:`, {
          id: user.id,
          display_name: user.display_name,
          bio: user.bio,
          avatar_url: user.avatar_url
        });
      });
      
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Lỗi: ' + error.message);
      setUsers([]);
    }
  };

  // --- FETCH MESSAGES PHÂN TRANG ---
  const fetchMessages = async (channelId, limit = 30, offset = 0, append = false) => {
    if (!channelId) return;
    try {
      const { data, error, count } = await supabase
        .from('messages')
        .select('id, channel_id, content, author_uid, author_display_name, author_avatar_url, created_at', { count: 'exact' })
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }
      // Đảo ngược để hiển thị từ cũ đến mới
      const newMessages = (data || []).reverse();
      if (append) {
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
      }
      // Kiểm tra còn tin nhắn cũ không
      if (count !== null && offset + limit >= count) {
        setHasMoreMessages(false);
      } else {
        setHasMoreMessages(true);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Create new channel
  const createChannel = async () => {
    if (!newChannelName.trim() || selectedUsers.length === 0) return;

    try {
      // Create channel
      const { data: channelData, error: channelError } = await supabase
        .from('chat_channels')
        .insert({
          name: newChannelName.trim(),
          type: selectedUsers.length === 1 ? 'direct' : 'group',
          created_by: currentUser.id
        })
        .select()
        .single();

      if (channelError) {
        console.error('Error creating channel:', channelError);
        return;
      }

      // Add members
      const members = [currentUser.id, ...selectedUsers];
      const { error: membersError } = await supabase
        .from('chat_channel_members')
        .insert(
          members.map(userId => ({
            channel_id: channelData.id,
            user_id: userId
          }))
        );

      if (membersError) {
        console.error('Error adding members:', membersError);
        return;
      }

      // Reset form
      setNewChannelName('');
      setSelectedUsers([]);
      setShowCreateChannel(false);
      
      // Refresh channels
      await fetchChannels();
      
      // Switch to new channel
      setCurrentChannel(channelData);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChannel) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
        content: newMessage.trim(),
          channel_id: currentChannel.id,
          author_uid: currentUser.id,
          author_display_name: currentUser.display_name,
          author_avatar_url: currentUser.avatar_url
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      console.log('Message sent:', data);
      
      // Cập nhật tin nhắn mới nhất
      updateLatestMessage(currentChannel.id, data);
      
      setNewMessage('');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Hàm phát âm thanh êm dịu khi có tin nhắn mới
  const playNotificationSound = () => {
    console.log('playNotificationSound called:', { audioContext: !!audioContext, hasUserInteracted, soundEnabled });
    if (!audioContext || !hasUserInteracted || !soundEnabled) {
      console.log('Sound not played:', { audioContext: !!audioContext, hasUserInteracted, soundEnabled });
      return;
    }
    try {
      const ctx = audioContext;
      const now = ctx.currentTime;
      // Tạo oscillator với sóng sine, tần số thấp, fade out nhanh
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.linearRampToValueAtTime(660, now + 0.12); // lên nhẹ
      osc.frequency.linearRampToValueAtTime(520, now + 0.25); // xuống nhẹ
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.0, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  // Test real-time function
  const testRealtime = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          channel_id: currentChannel.id,
          content: 'Test real-time message - ' + new Date().toLocaleTimeString(),
          author_uid: currentUser.id,
          author_display_name: currentUser.displayName,
          author_email: currentUser.email,
          author_avatar_url: currentUser.avatar_url || null
        });

      if (error) {
        console.error('Error sending test message:', error);
        alert('Lỗi gửi tin nhắn test: ' + error.message);
      } else {
        console.log('Test message sent successfully');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Update user info cho tất cả channels
  const updateAllChannelUserInfos = async () => {
    const newChannelUserInfos = {};
    
    for (const channel of channels) {
      if (channel.type === 'direct') {
        const otherUser = await getOtherUserInDirectChat(channel);
        newChannelUserInfos[channel.id] = otherUser;
      }
    }
    
    setChannelUserInfos(newChannelUserInfos);
  };

  // Update user info khi channel thay đổi
  const updateCurrentUserInfo = async (channel) => {
    console.log('=== DEBUG updateCurrentUserInfo ===');
    console.log('Channel:', channel);
    console.log('Channel type:', channel.type);
    console.log('Channel members:', channel.chat_channel_members);
    console.log('Current user ID:', currentUser.id);
    console.log('Users array:', users);
    
    if (!channel) {
      console.log('No channel, setting currentUserInfo to null');
      setCurrentUserInfo(null);
      return;
    }

    if (channel.type === 'direct') {
      console.log('Direct channel, fetching other user...');
      const otherUser = await getOtherUserInDirectChat(channel);
      console.log('Other user found:', otherUser);
      console.log('Setting currentUserInfo to:', otherUser);
      setCurrentUserInfo(otherUser);
    } else {
      console.log('Group channel, setting currentUserInfo to null');
      setCurrentUserInfo(null);
    }
  };

  // Real-time subscription
  useEffect(() => {
    if (!currentChannel) return;

    fetchMessages(currentChannel.id, 30, 0, false); // Fetch 30 messages khi channel thay đổi
    updateCurrentUserInfo(currentChannel); // Update user info khi channel thay đổi

    const channel = supabase.channel(`messages-${currentChannel.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Real-time message update:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new.channel_id === currentChannel.id) {
            // Luôn fetch lại messages để đồng bộ mọi phía
            fetchMessages(currentChannel.id, 30, 0, false); // Fetch 30 messages mới nhất
            // Cập nhật tin nhắn mới nhất
            updateLatestMessage(currentChannel.id, payload.new);
            if (payload.new.author_uid !== currentUser?.id) {
              playNotificationSound();
            }
          } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            // Refresh toàn bộ tin nhắn nếu có update/delete
            fetchMessages(currentChannel.id, 30, 0, false); // Fetch 30 messages mới nhất
            fetchLatestMessages();
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription for channel:', currentChannel.id);
      supabase.removeChannel(channel);
    };
  }, [currentChannel?.id, currentUser?.id]);

  // Initial load
  useEffect(() => {
    fetchChannels();
    fetchUsers();
    fetchLatestMessages();
  }, [currentUser]);

  // Timeout để tránh stuck loading
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.log('Loading timeout, setting loading to false');
        setLoading(false);
        setError('Đã timeout, vui lòng thử lại');
      }, 10000); // 10 giây

      return () => clearTimeout(timeout);
    }
  }, [loading]);

  // Update channel user infos khi channels thay đổi
  useEffect(() => {
    if (channels.length > 0) {
      updateAllChannelUserInfos();
    }
  }, [channels]);

  // Đặt ref cho container scroll
  const messagesContainerRef = useRef(null);
  const prevMessagesLength = useRef(0);

  const scrollToBottom = (behavior = 'auto') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (
      messagesContainerRef.current &&
      (
        prevMessagesLength.current === 0 || // Mở chat mới
        messages.length > prevMessagesLength.current // Có tin nhắn mới ở cuối
      ) &&
      !isLoadingMore // Không phải đang load thêm tin nhắn cũ
    ) {
      scrollToBottom('auto'); // hoặc 'smooth' nếu muốn mượt
    }
    prevMessagesLength.current = messages.length;
  }, [messages, currentChannel, isLoadingMore]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group messages
  const groupedMessages = [];
  let lastUid = null;
  let group = [];
  messages.forEach((msg, idx) => {
    if (msg.author_uid !== lastUid) {
      if (group.length > 0) groupedMessages.push(group);
      group = [msg];
      lastUid = msg.author_uid;
    } else {
      group.push(msg);
    }
    if (idx === messages.length - 1 && group.length > 0) groupedMessages.push(group);
  });

  // Lấy thông tin user khác trong chat riêng
  const getOtherUserInDirectChat = async (channel) => {
    if (channel.type !== 'direct') return null;
    
    console.log('=== DEBUG getOtherUserInDirectChat ===');
    console.log('Channel:', channel);
    console.log('Channel type:', channel.type);
    console.log('Channel members:', channel.chat_channel_members);
    console.log('Current user ID:', currentUser.id);
    console.log('Users array length:', users.length);
    console.log('Users array:', users);
    
    // Tìm user khác trong kênh chat riêng
    const otherUser = channel.chat_channel_members?.find(member => member.user_id !== currentUser.id);
    
    if (otherUser) {
      console.log('Found other user ID:', otherUser.user_id);
      
      // Thử tìm trong users array trước
      const userFromArray = users.find(u => u.id === otherUser.user_id);
      if (userFromArray) {
        console.log('Found user in users array:', userFromArray);
        return userFromArray;
      }
      
      console.log('User not found in array, fetching from database...');
      
      // Nếu không có trong array, fetch từ database
      try {
        const { data: userData, error } = await supabase
          .from('profiles')
          .select('id, display_name, bio, avatar_url')
          .eq('id', otherUser.user_id)
          .single();

        if (error) {
          console.error('Error fetching user:', error);
          return null;
        }

        console.log('Fetched user from database:', userData);
        return userData;
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    }
    
    console.log('No other user found in channel');
    return null;
  };

  // Lấy tên hiển thị cho kênh chat riêng
  const getDirectChannelDisplayName = async (channel) => {
    if (channel.type !== 'direct') return channel.name;
    
    const otherUser = await getOtherUserInDirectChat(channel);
    if (otherUser) {
      return otherUser.display_name || otherUser.email || 'Unknown';
    }
    
    // Fallback: lấy từ tên kênh nếu không tìm thấy user
    const channelName = channel.name;
    if (channelName.startsWith('Chat với ')) {
      return channelName.replace('Chat với ', '');
    }
    
    return channelName;
  };

  // Lấy avatar cho kênh chat riêng
  const getDirectChannelAvatar = async (channel) => {
    if (channel.type !== 'direct') return null;
    
    const otherUser = await getOtherUserInDirectChat(channel);
    if (otherUser) {
      return otherUser.avatar_url || null;
    }
    
    return null;
  };

  // Lấy danh sách thành viên trong group
  const getGroupMembers = (channel) => {
    if (channel.type !== 'group') return [];
    return channel.chat_channel_members?.map(member => {
      return users.find(u => u.id === member.user_id);
    }).filter(Boolean) || [];
  };

  // Dọn dẹp kênh chat duplicate dựa trên user ID
  const cleanupDuplicateChannelsByUserId = async () => {
    try {
      console.log('Cleaning up duplicate channels by user ID...');
      
      // Lấy tất cả kênh chat riêng
      const { data: allChannels, error: fetchError } = await supabase
        .from('chat_channels')
        .select(`
          *,
          chat_channel_members(user_id)
        `)
        .eq('type', 'direct');

      if (fetchError) {
        console.error('Error fetching channels:', fetchError);
        return;
      }

      console.log('All direct channels:', allChannels);

      // Nhóm kênh theo cặp user ID (không phải display_name)
      const channelGroups = {};
      allChannels.forEach(channel => {
        const memberIds = channel.chat_channel_members?.map(member => member.user_id) || [];
        if (memberIds.length === 2) {
          // Sắp xếp user IDs để tạo key duy nhất
          const sortedIds = memberIds.sort();
          const key = `${sortedIds[0]}-${sortedIds[1]}`;
          if (!channelGroups[key]) {
            channelGroups[key] = [];
          }
          channelGroups[key].push(channel);
        }
      });

      // Xóa kênh duplicate và cập nhật tên
      for (const [key, channels] of Object.entries(channelGroups)) {
        if (channels.length > 1) {
          console.log(`Found ${channels.length} duplicate channels for key: ${key}`);
          
          // Giữ lại kênh đầu tiên, xóa các kênh còn lại
          const channelsToDelete = channels.slice(1);
          
          for (const channelToDelete of channelsToDelete) {
            console.log(`Deleting duplicate channel: ${channelToDelete.id}`);
            
            // Xóa tin nhắn
            await supabase
              .from('messages')
              .delete()
              .eq('channel_id', channelToDelete.id);
            
            // Xóa thành viên
            await supabase
              .from('chat_channel_members')
              .delete()
              .eq('channel_id', channelToDelete.id);
            
            // Xóa kênh
            await supabase
              .from('chat_channels')
              .delete()
              .eq('id', channelToDelete.id);
          }

          // Cập nhật tên kênh còn lại
          const remainingChannel = channels[0];
          const otherUserId = remainingChannel.chat_channel_members?.find(member => member.user_id !== currentUser.id)?.user_id;
          
          if (otherUserId) {
            // Fetch thông tin user hiện tại
            const { data: userData } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', otherUserId)
              .single();

            if (userData) {
              const newName = `Chat với ${userData.display_name}`;
              await supabase
                .from('chat_channels')
                .update({ name: newName })
                .eq('id', remainingChannel.id);
              
              console.log(`Updated channel name to: ${newName}`);
            }
          }
        }
      }

      console.log('Cleanup completed');
      alert('Đã dọn dẹp kênh chat duplicate!');
      
      // Refresh danh sách kênh
      await fetchChannels();
    } catch (error) {
      console.error('Error cleaning up duplicate channels:', error);
      alert('Lỗi dọn dẹp: ' + error.message);
    }
  };

  // Dọn dẹp và đồng bộ kênh chat riêng
  const syncDirectChannels = async () => {
    try {
      console.log('Syncing direct channels...');
      
      // Lấy tất cả kênh chat riêng
      const { data: allChannels, error: fetchError } = await supabase
        .from('chat_channels')
        .select(`
          *,
          chat_channel_members(user_id)
        `)
        .eq('type', 'direct');

      if (fetchError) {
        console.error('Error fetching channels:', fetchError);
        return;
      }

      console.log('All direct channels:', allChannels);

      // Nhóm kênh theo cặp user
      const channelGroups = {};
      allChannels.forEach(channel => {
        const memberIds = channel.chat_channel_members?.map(member => member.user_id) || [];
        if (memberIds.length === 2) {
          const sortedIds = memberIds.sort();
          const key = `${sortedIds[0]}-${sortedIds[1]}`;
          if (!channelGroups[key]) {
            channelGroups[key] = [];
          }
          channelGroups[key].push(channel);
        }
      });

      // Xóa kênh duplicate và cập nhật tên
      for (const [key, channels] of Object.entries(channelGroups)) {
        if (channels.length > 1) {
          console.log(`Found ${channels.length} duplicate channels for key: ${key}`);
          
          // Giữ lại kênh đầu tiên, xóa các kênh còn lại
          const channelsToDelete = channels.slice(1);
          
          for (const channelToDelete of channelsToDelete) {
            console.log(`Deleting duplicate channel: ${channelToDelete.id}`);
            
            // Xóa tin nhắn
            await supabase
              .from('messages')
              .delete()
              .eq('channel_id', channelToDelete.id);
            
            // Xóa thành viên
            await supabase
              .from('chat_channel_members')
              .delete()
              .eq('channel_id', channelToDelete.id);
            
            // Xóa kênh
            await supabase
              .from('chat_channels')
              .delete()
              .eq('id', channelToDelete.id);
          }
        }
      }

      // Cập nhật tên kênh để đồng bộ
      for (const [key, channels] of Object.entries(channelGroups)) {
        if (channels.length > 0) {
          const channel = channels[0];
          const otherUser = channel.chat_channel_members?.find(member => member.user_id !== currentUser.id);
          if (otherUser) {
            const user = users.find(u => u.id === otherUser.user_id);
            if (user) {
              const newName = `Chat với ${user.display_name || user.email}`;
              if (channel.name !== newName) {
                console.log(`Updating channel name from "${channel.name}" to "${newName}"`);
                await supabase
                  .from('chat_channels')
                  .update({ name: newName })
                  .eq('id', channel.id);
              }
            }
          }
        }
      }

      console.log('Sync completed');
      alert('Đã đồng bộ xong các kênh chat riêng!');
      
      // Refresh danh sách kênh
      await fetchChannels();
    } catch (error) {
      console.error('Error syncing direct channels:', error);
      alert('Lỗi đồng bộ: ' + error.message);
    }
  };

  // Lấy tin nhắn mới nhất cho kênh
  const getLatestMessage = (channelId) => {
    return latestMessages[channelId] || null;
  };

  // Cập nhật tin nhắn mới nhất cho kênh
  const updateLatestMessage = (channelId, message) => {
    setLatestMessages(prev => ({
      ...prev,
      [channelId]: message
    }));
  };

  // Fetch tin nhắn mới nhất cho tất cả kênh
  const fetchLatestMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching latest messages:', error);
        return;
      }

      // Nhóm tin nhắn theo channel_id
      const latestByChannel = {};
      data.forEach(msg => {
        if (!latestByChannel[msg.channel_id] || 
            new Date(msg.created_at) > new Date(latestByChannel[msg.channel_id].created_at)) {
          latestByChannel[msg.channel_id] = msg;
        }
      });

      setLatestMessages(latestByChannel);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Tạo user thật để test
  const createRealUser = async () => {
    try {
      console.log('Creating real user...');
      
      const realUser = {
        id: 'real-user-' + Date.now(),
        display_name: 'Nguyễn Văn A',
        bio: 'Xin chào mọi người!',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
      };

      const { error } = await supabase
        .from('profiles')
        .insert(realUser);

      if (error) {
        console.error('Error creating real user:', error);
        alert('Lỗi tạo user: ' + error.message);
      } else {
        console.log('Real user created successfully');
        alert('Đã tạo user thật thành công!');
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Lỗi: ' + error.message);
    }
  };

  // Test tạo user với avatar

  // Fetch số message chưa đọc cho user khi load hoặc khi có thay đổi
  async function fetchUnreadCounts() {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('message_reads')
      .select('message_id, status, message_id!inner(channel_id)')
      .eq('user_id', currentUser.id)
      .eq('status', 'delivered');
    if (!error && data) {
      // Đếm số chưa đọc theo channel_id
      const counts = {};
      data.forEach(row => {
        const channelId = row.message_id.channel_id;
        counts[channelId] = (counts[channelId] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  }

  useEffect(() => { fetchUnreadCounts(); }, [currentUser, setUnreadCounts]);

  // Khi có tin nhắn mới đến (realtime), fetch lại số chưa đọc
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('unread-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new;
        if (msg.author_uid !== currentUser.id) {
          // Nếu không phải kênh đang mở, vẫn fetch lại số chưa đọc
          await fetchUnreadCounts();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, currentChannel]);

  // Khi user mở kênh chat, đánh dấu tất cả message_reads của user đó trong kênh thành 'seen'
  const handleChannelClick = async (channel) => {
    setCurrentChannel(channel);
    setShowChatDetail(true); // Hiển thị chat detail
    await updateCurrentUserInfo(channel);
    if (window.innerWidth < 768) setShowMobileChat(true);
    // Lấy tất cả message_id trong kênh
    const { data: msgIds } = await supabase
      .from('messages')
      .select('id')
      .eq('channel_id', channel.id);
    if (msgIds && msgIds.length > 0) {
      const ids = msgIds.map(m => m.id);
      await supabase
        .from('message_reads')
        .update({ status: 'seen', updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .eq('status', 'delivered')
        .in('message_id', ids);
      // Sau khi update, gọi fetchUnreadCounts từ Home để badge luôn realtime
      if (fetchUnreadCounts) await fetchUnreadCounts();
    } else {
      setUnreadCounts(prev => ({ ...prev, [channel.id]: 0 }));
    }
  };

  // Sắp xếp channels theo latestMessages (tin nhắn mới nhất lên trên)
  const sortedChannels = [...channels].sort((a, b) => {
    const aMsg = latestMessages[a.id];
    const bMsg = latestMessages[b.id];
    if (!aMsg && !bMsg) return 0;
    if (!aMsg) return 1;
    if (!bMsg) return -1;
    return new Date(bMsg.created_at) - new Date(aMsg.created_at);
  });

  // Fetch trạng thái đã xem cho messages trong kênh hiện tại
  useEffect(() => {
    async function fetchSeenStatus() {
      if (!currentChannel || messages.length === 0) return;
      const ids = messages.map(m => m.id);
      const { data, error } = await supabase
        .from('message_reads')
        .select('message_id, status')
        .in('message_id', ids);
      if (!error && data) {
        // Đếm số user đã seen cho từng message
        const statusMap = {};
        data.forEach(row => {
          if (!statusMap[row.message_id]) statusMap[row.message_id] = { seen: 0, delivered: 0 };
          if (row.status === 'seen') statusMap[row.message_id].seen++;
          else if (row.status === 'delivered') statusMap[row.message_id].delivered++;
        });
        setSeenStatus(statusMap);
      }
    }
    fetchSeenStatus();
  }, [currentChannel, messages]);

  // Trước khi render danh sách messages
  console.log('Messages state before render:', messages);

  // --- LOAD THÊM KHI SCROLL LÊN ĐẦU ---
  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
      setIsLoadingMore(true);
      const newLimit = messageLimit + 30;
      fetchMessages(currentChannel.id, 30, messageLimit, true);
      setMessageLimit(newLimit);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg mb-2">Đang tải chat...</div>
          <div className="text-gray-400 text-sm mb-4">Vui lòng chờ trong giây lát</div>
          <button
            onClick={() => {
              setLoading(false);
              setError('Đã timeout, vui lòng thử lại');
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Bỏ qua loading
          </button>
        </div>
      </div>
    );
  }

  if (error) {
  return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Có lỗi xảy ra</div>
          <div className="text-gray-400 text-sm mb-4">{error}</div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchChannels();
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Thử lại
          </button>
          </div>
      </div>
    );
  }

  return (
    <>
      {/* Chat List View - Hiển thị khi chưa vào chat detail */}
      {!showChatDetail && (
        <div className="w-full h-full bg-[#0a0a0a] flex">
          {/* Sidebar */}
          <div className="w-full bg-[#18181b] flex flex-col">
            {/* Navigation Buttons */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowUserList(!showUserList)}
                  className={`flex-1 bg-gray-900 text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-colors text-sm font-medium shadow ${showUserList ? 'ring-2 ring-blue-400' : ''}`}
                >
                  Người dùng ({users.length})
                </button>
                <button
                  onClick={() => setShowCreateChannel(!showCreateChannel)}
                  className={`flex-1 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-500 transition-colors text-sm font-medium shadow ${showCreateChannel ? 'ring-2 ring-blue-400' : ''}`}
                >
                  + Nhóm
                </button>
              </div>
            </div>
            
            {/* Chat List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1">
              {sortedChannels.map((channel, idx) => {
                const isActive = currentChannel && channel.id === currentChannel.id;
                let info = null;
                if (channel.type === 'direct') {
                  info = channelUserInfos[channel.id];
                } else if (channel.type === 'group') {
                  const members = channel.chat_channel_members || [];
                  if (members.length > 0) {
                    info = {
                      avatar_url: members[0].avatar_url,
                      display_name: members[0].display_name
                    };
                  }
                }
                const latestMsg = latestMessages[channel.id];
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleChannelClick(channel)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-blue-900/60' : 'hover:bg-gray-800/80'} group`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white overflow-hidden">
                      {info?.avatar_url ? (
                        <img src={info.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        (info?.display_name || channel.name || 'U').charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start justify-center">
                      <div className="text-white font-medium truncate text-left w-full">
                        {info?.display_name || channel.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-400 truncate text-left w-full flex items-center">
                        {latestMsg ? latestMsg.content : 'Chưa có tin nhắn'}
                        {unreadCounts[channel.id] > 0 && (
                          <span className="ml-2 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold animate-pulse">
                            {unreadCounts[channel.id]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Chat Detail View - Hiển thị khi vào chat */}
      {showChatDetail && currentChannel && (
        <div className="w-full h-full bg-[#23232a] flex flex-col">
          {/* Chat Header với nút Back */}
          <div className="bg-[#23232a] border-b border-gray-800 p-4 flex-shrink-0 flex items-center">
            <button 
              onClick={() => setShowChatDetail(false)}
              className="mr-3 p-2 rounded-full hover:bg-gray-800 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white overflow-hidden">
                {currentChannel.type === 'direct' ? (
                  currentUserInfo?.avatar_url ? (
                    <img src={currentUserInfo.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    (currentUserInfo?.display_name || currentUserInfo?.email || 'U').charAt(0)
                  )
                ) : (
                  // Xóa icon chat cho group chat vì chưa có function
                  null
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg">
                  {currentChannel.type === 'direct' 
                    ? (currentUserInfo?.display_name || currentUserInfo?.email || 'Unknown')
                    : currentChannel.name
                  }
                </h3>
                <p className="text-gray-400 text-sm">
                  {currentChannel.type === 'direct' ? '💬 Chat riêng' : '👥 Group chat'}
                </p>
              </div>
            </div>
            {/* Nút toggle chat list cho mobile */}
            <button
              onClick={() => setShowMobileChatList(!showMobileChatList)}
              className="p-2 rounded-full hover:bg-gray-800 transition-colors md:hidden"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
            </button>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar bg-[#23232a]" onScroll={handleScroll} ref={messagesContainerRef}>
            <div className="space-y-4">
              {isLoadingMore && (
                <div className="text-center text-xs text-gray-400 mb-2">Đang tải thêm tin nhắn...</div>
              )}
              {messages.map((msg, idx) => {
                const isOwn = msg.author_uid === currentUser?.id;
                return (
                  <div key={msg.id + '-' + idx} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}> 
                    <div className="flex flex-col max-w-[70%]">
                      <div className={`px-4 py-2 rounded-2xl shadow ${isOwn ? 'bg-blue-500 text-white' : 'bg-gray-700 text-white'} text-sm break-words message-bubble`}>{msg.content}</div>
                      <div className={`text-xs text-gray-500 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>{new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input */}
          <div className="flex-shrink-0 p-4 bg-[#23232a] border-t border-gray-800">
            <form onSubmit={handleSendMessage} className="flex space-x-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 bg-gray-900 text-white placeholder-gray-400 rounded-full px-4 py-3 outline-none border border-gray-700 focus:border-blue-500 shadow text-sm"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow text-sm"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Chat List Overlay */}
      {showMobileChatList && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden">
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-[#18181b] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-bold">Chat List</h3>
              <button
                onClick={() => setShowMobileChatList(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            
            {/* Navigation Buttons */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowUserList(!showUserList)}
                  className={`flex-1 bg-gray-700 text-white px-4 py-2 rounded-full hover:bg-gray-600 transition-colors text-sm font-medium shadow ${showUserList ? 'ring-2 ring-gray-400' : ''}`}
                >
                  👥 Users
                </button>
                <button
                  onClick={() => setShowCreateChannel(!showCreateChannel)}
                  className={`flex-1 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-500 transition-colors text-sm font-medium shadow ${showCreateChannel ? 'ring-2 ring-blue-400' : ''}`}
                >
                  + Nhóm
                </button>
              </div>
            </div>
            
            {/* Chat List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1">
              {sortedChannels.map((channel, idx) => {
                const isActive = currentChannel && channel.id === currentChannel.id;
                let info = null;
                if (channel.type === 'direct') {
                  info = channelUserInfos[channel.id];
                } else if (channel.type === 'group') {
                  const members = channel.chat_channel_members || [];
                  if (members.length > 0) {
                    info = {
                      avatar_url: members[0].avatar_url,
                      display_name: members[0].display_name
                    };
                  }
                }
                const latestMsg = latestMessages[channel.id];
                return (
                  <div
                    key={channel.id}
                    onClick={() => { handleChannelClick(channel); setShowMobileChatList(false); }}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-blue-900/60' : 'hover:bg-gray-800/80'} group`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white overflow-hidden">
                      {info?.avatar_url ? (
                        <img src={info.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        (info?.display_name || channel.name || 'U').charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start justify-center">
                      <div className="text-white font-medium truncate text-left w-full">
                        {info?.display_name || channel.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-400 truncate text-left w-full flex items-center">
                        {latestMsg ? latestMsg.content : 'Chưa có tin nhắn'}
                        {unreadCounts[channel.id] > 0 && (
                          <span className="ml-2 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold animate-pulse">
                            {unreadCounts[channel.id]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showUserList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-sm mx-auto bg-[#23232a] rounded-2xl shadow-2xl p-5 relative animate-fadeIn">
            <button onClick={() => setShowUserList(false)} className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl font-bold">×</button>
            <h3 className="text-white font-semibold mb-3 text-lg text-center">Chat riêng với người dùng</h3>
            <div className="text-gray-400 text-sm mb-3 text-center">Chọn user để bắt đầu chat riêng:</div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-gray-800">
              {users.length === 0 ? (
                <div className="text-gray-400 text-sm text-center py-6">Không có users nào. Đang tải...</div>
              ) : (
                users.map(user => (
                  <div 
                    key={user.id} 
                    onClick={() => { createDirectChannel(user); setShowUserList(false); }}
                    className="flex items-center space-x-3 py-3 px-2 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        (user.display_name || user.email || 'U').charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{user.display_name || 'Unknown'}</div>
                      <div className="text-gray-400 text-xs truncate">{user.bio || 'No bio'}</div>
                    </div>
                    <div className="text-gray-400 text-xs whitespace-nowrap">Chat riêng</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {showCreateChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-sm mx-auto bg-[#23232a] rounded-2xl shadow-2xl p-5 relative animate-fadeIn">
            <button onClick={() => setShowCreateChannel(false)} className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl font-bold">×</button>
            <h3 className="text-white font-semibold mb-3 text-lg text-center">Tạo group chat mới</h3>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Tên group chat..."
              className="w-full bg-gray-800 text-white placeholder-gray-400 rounded-lg px-3 py-2 mb-3 outline-none border border-gray-700"
            />
            <div className="max-h-32 overflow-y-auto mb-3 custom-scrollbar">
              <div className="text-gray-400 text-sm mb-2">Chọn thành viên cho group:</div>
              {users.map(user => (
                <label key={user.id} className="flex items-center space-x-2 text-white mb-2">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span>{user.display_name || user.email}</span>
                </label>
              ))}
            </div>
            <div className="flex space-x-2 justify-center">
              <button
                onClick={createGroupChannel}
                disabled={!newChannelName.trim() || selectedUsers.length === 0}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                Tạo Group
              </button>
              <button
                onClick={() => {
                  setShowCreateChannel(false);
                  setNewChannelName('');
                  setSelectedUsers([]);
                }}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 