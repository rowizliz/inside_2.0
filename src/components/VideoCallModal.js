import React, { useRef, useEffect, useState } from 'react';
import { useCallManager } from '../context/CallManager';
import {
  PhoneIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  CameraIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon
} from '@heroicons/react/24/solid';

const VideoCallModal = () => {
  const {
    activeCall,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    endCall,
    toggleVideo,
    toggleAudio
  } = useCallManager();
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const containerRef = useRef(null);
  
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState('00:00');
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isFlipCamera, setIsFlipCamera] = useState(false);
  
  // Timer để ẩn controls
  useEffect(() => {
    let hideTimer;
    
    const resetHideTimer = () => {
      setShowControls(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (activeCall?.status === 'connected') {
          setShowControls(false);
        }
      }, 3000);
    };
    
    // Reset timer khi di chuyển chuột
    const handleMouseMove = () => resetHideTimer();
    const handleTouchStart = () => resetHideTimer();
    
    if (activeCall?.status === 'connected') {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchstart', handleTouchStart);
      resetHideTimer();
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchstart', handleTouchStart);
      clearTimeout(hideTimer);
    };
  }, [activeCall?.status]);
  
  // Cập nhật video streams
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);
  
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);
  
  // Tính thời gian cuộc gọi
  useEffect(() => {
    if (activeCall?.status === 'connected' && activeCall.startTime) {
      const interval = setInterval(() => {
        const duration = Math.floor((new Date() - new Date(activeCall.startTime)) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        setCallDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [activeCall]);
  
  // Xử lý fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Chuyển đổi camera (mobile)
  const flipCamera = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error('No video track found');
        return;
      }
      
      try {
        // Get current facing mode
        const settings = videoTrack.getSettings();
        const currentFacingMode = settings.facingMode || 'user';
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacingMode },
          audio: true
        });
        
        // Replace video track in local stream
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        // Update local stream
        localStream.removeTrack(videoTrack);
        localStream.addTrack(newVideoTrack);
        videoTrack.stop();
        
        setIsFlipCamera(!isFlipCamera);
      } catch (error) {
        console.error('Error flipping camera:', error);
      }
    }
  };
  
  if (!activeCall) return null;
  
  const isConnecting = activeCall.status === 'connecting' || activeCall.status === 'calling';
  const isConnected = activeCall.status === 'connected';
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[9998] bg-black"
    >
      {/* Remote video (full screen) */}
      <div className="absolute inset-0">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-semibold">
                {activeCall.targetUser?.avatar_url ? (
                  <img 
                    src={activeCall.targetUser.avatar_url} 
                    alt={activeCall.targetUser.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  activeCall.targetUser?.name?.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <h3 className="text-white text-2xl font-medium mb-2">
                {activeCall.targetUser?.name || 'Unknown'}
              </h3>
              <p className="text-gray-400">
                {isConnecting ? 'Đang kết nối...' : 'Đang chờ video...'}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Local video (Picture-in-Picture) */}
      <div className={`absolute top-4 right-4 transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="relative w-32 h-48 md:w-40 md:h-60 rounded-2xl overflow-hidden shadow-2xl">
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${isFlipCamera ? 'scale-x-[-1]' : ''}`}
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <VideoCameraSlashIcon className="w-8 h-8 text-gray-600" />
            </div>
          )}
          
          {/* Mute indicator */}
          {!isAudioEnabled && (
            <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1">
              <SpeakerXMarkIcon className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </div>
      
      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between">
          {/* Call info */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h4 className="text-white font-medium">
                {activeCall.targetUser?.name || 'Unknown'}
              </h4>
              <div className="flex items-center gap-2 text-sm">
                {isConnected && (
                  <>
                    <span className="text-green-400">{callDuration}</span>
                    <span className="text-gray-400">•</span>
                  </>
                )}
                <span className="text-green-400">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-2 bg-current rounded-full" />
                    <div className="w-1 h-3 bg-current rounded-full" />
                    <div className="w-1 h-4 bg-current rounded-full" />
                  </div>
                </span>
              </div>
            </div>
          </div>
          
          {/* Additional controls */}
          <div className="flex items-center gap-2">
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition-colors"
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="w-5 h-5 text-white" />
              ) : (
                <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-4">
            {/* Flip camera (mobile only) */}
            {navigator.mediaDevices?.enumerateDevices && (
              <button
                onClick={flipCamera}
                className="p-4 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition-all transform hover:scale-110 active:scale-95"
              >
                <CameraIcon className="w-6 h-6 text-white" />
              </button>
            )}
            
            {/* Toggle video */}
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full backdrop-blur transition-all transform hover:scale-110 active:scale-95 ${
                isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-black'
              }`}
            >
              {isVideoEnabled ? (
                <VideoCameraIcon className="w-6 h-6" />
              ) : (
                <VideoCameraSlashIcon className="w-6 h-6" />
              )}
            </button>
            
            {/* Toggle audio */}
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full backdrop-blur transition-all transform hover:scale-110 active:scale-95 ${
                isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-black'
              }`}
            >
              {isAudioEnabled ? (
                <MicrophoneIcon className="w-6 h-6" />
              ) : (
                <SpeakerXMarkIcon className="w-6 h-6" />
              )}
            </button>
            
            {/* End call */}
            <button
              onClick={endCall}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all transform hover:scale-110 active:scale-95"
            >
              <PhoneIcon className="w-6 h-6 text-white rotate-135" />
            </button>
            
            {/* Speaker */}
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={`p-4 rounded-full backdrop-blur transition-all transform hover:scale-110 active:scale-95 ${
                isSpeakerOn ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <SpeakerWaveIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Connection status overlay */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
            <p className="text-white text-lg">Đang kết nối...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallModal;