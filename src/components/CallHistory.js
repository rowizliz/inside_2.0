import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';
import { PhoneIcon, VideoCameraIcon, ClockIcon } from '@heroicons/react/24/outline';

const CallHistory = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchCallHistory();
    }
  }, [isOpen, currentUser]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('call_history')
        .select(`
          *,
          caller:caller_id(id, email, raw_user_meta_data),
          receiver:receiver_id(id, email, raw_user_meta_data)
        `)
        .or(`caller_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching call history:', error);
        return;
      }

      setCallHistory(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 48) {
      return 'Hôm qua';
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  const getCallerName = (call, user) => {
    if (call.caller_id === user.id) {
      return call.receiver?.raw_user_meta_data?.display_name || call.receiver?.email || 'Unknown';
    } else {
      return call.caller?.raw_user_meta_data?.display_name || call.caller?.email || 'Unknown';
    }
  };

  const getCallIcon = (callType) => {
    return callType === 'video' ? (
      <VideoCameraIcon className="w-4 h-4" />
    ) : (
      <PhoneIcon className="w-4 h-4" />
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'answered':
        return 'text-green-500';
      case 'missed':
        return 'text-red-500';
      case 'declined':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'answered':
        return 'Đã trả lời';
      case 'missed':
        return 'Nhỡ';
      case 'declined':
        return 'Từ chối';
      default:
        return 'Không xác định';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <ClockIcon className="w-6 h-6 text-white" />
            <h3 className="text-white font-semibold text-lg">Lịch sử cuộc gọi</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors close-button"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : callHistory.length === 0 ? (
            <div className="text-center py-8">
              <ClockIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Chưa có cuộc gọi nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {callHistory.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {/* Call Icon */}
                  <div className="flex-shrink-0">
                    {getCallIcon(call.call_type)}
                  </div>

                  {/* Call Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium truncate">
                        {getCallerName(call, currentUser)}
                      </p>
                      <span className={`text-sm ${getStatusColor(call.status)}`}>
                        {getStatusText(call.status)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <span>{formatDate(call.created_at)}</span>
                        {call.duration && (
                          <>
                            <span>•</span>
                            <span>{formatDuration(call.duration)}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {call.call_type === 'video' ? 'Video' : 'Audio'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallHistory; 