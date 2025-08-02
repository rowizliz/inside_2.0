import React from 'react';
import IncomingCallNotification from './IncomingCallNotification';
import VideoCallModal from './VideoCallModal';
import { useCallManager } from '../context/CallManager';

const GlobalCallListener = () => {
  const { incomingCall, activeCall } = useCallManager();

  return (
    <>
      {/* Hiển thị thông báo cuộc gọi đến */}
      {incomingCall && <IncomingCallNotification />}
      
      {/* Hiển thị modal video call khi có cuộc gọi active */}
      {activeCall && <VideoCallModal />}
    </>
  );
};

export default GlobalCallListener;