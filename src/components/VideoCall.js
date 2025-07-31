import React, { useRef, useEffect, useState } from 'react';
import 'webrtc-adapter';

export default function VideoCall({ signalingChannel, onClose, isCaller, remoteUserId, localUserId }) {
  const localVideo = useRef();
  const remoteMediaRef = useRef();
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceLog, setDeviceLog] = useState('');
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('connecting');
  const [isRinging, setIsRinging] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [iceConnectionState, setIceConnectionState] = useState('new');
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  
  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const handlerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const lastHeartbeatRef = useRef(Date.now());

  // Ringtone audio - Sử dụng audio context để tạo tone đơn giản
  useEffect(() => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.5);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);
    
    ringtoneRef.current = { audioContext, oscillator, gainNode };
    
    return () => {
      if (ringtoneRef.current) {
        try {
          ringtoneRef.current.oscillator.stop();
          ringtoneRef.current.audioContext.close();
        } catch (e) {
          console.warn('Error closing audio context:', e);
        }
        ringtoneRef.current = null;
      }
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    if (isConnected) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isConnected]);

  // Heartbeat mechanism
  useEffect(() => {
    if (isConnected && signalingChannel) {
      heartbeatIntervalRef.current = setInterval(() => {
        const now = Date.now();
        if (now - lastHeartbeatRef.current > 10000) { // 10 seconds timeout
          console.log('Heartbeat timeout, attempting reconnection...');
          attemptReconnection();
          return;
        }
        
        // Send heartbeat
        try {
          signalingChannel.send({
            type: 'heartbeat',
            from: localUserId,
            to: remoteUserId,
            timestamp: now
          });
        } catch (err) {
          console.warn('Heartbeat send error:', err);
        }
      }, 5000); // Send heartbeat every 5 seconds
    } else {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isConnected, signalingChannel, localUserId, remoteUserId]);

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Hàm để play audio một cách an toàn
  const playAudioSafely = async (audioElement) => {
    if (!audioElement) return;
    
    try {
      if (audioElement.srcObject) {
        await audioElement.play();
        console.log('✅ Audio đã được play thành công');
      }
    } catch (err) {
      console.warn('Autoplay bị chặn, cần user interaction:', err);
      const playOnInteraction = () => {
        audioElement.play().catch(e => console.warn('Play error:', e));
        document.removeEventListener('click', playOnInteraction);
        document.removeEventListener('touchstart', playOnInteraction);
      };
      document.addEventListener('click', playOnInteraction);
      document.addEventListener('touchstart', playOnInteraction);
    }
  };

  // Start/Stop ringtone với audio context
  const startRinging = () => {
    if (ringtoneRef.current && ringtoneRef.current.audioContext.state === 'suspended') {
      ringtoneRef.current.audioContext.resume();
    }
    
    if (ringtoneRef.current) {
      try {
        const { audioContext } = ringtoneRef.current;
        
        const playTone = () => {
          if (isRinging) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.frequency.setValueAtTime(800, audioContext.currentTime);
            osc.frequency.setValueAtTime(600, audioContext.currentTime + 0.5);
            osc.frequency.setValueAtTime(800, audioContext.currentTime + 1);
            
            gain.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);
            
            osc.start();
            osc.stop(audioContext.currentTime + 2);
            
            setTimeout(playTone, 2000);
          }
        };
        
        playTone();
        setIsRinging(true);
        console.log('🔔 Ringtone started');
      } catch (err) {
        console.warn('Ringtone error:', err);
      }
    }
  };

  const stopRinging = () => {
    setIsRinging(false);
    console.log('🔕 Ringtone stopped');
  };

  // Reconnection logic với exponential backoff
  const attemptReconnection = () => {
    if (connectionAttempts < 5) {
      const delay = Math.min(2000 * Math.pow(2, connectionAttempts), 30000); // Max 30s
      console.log(`🔄 Attempting reconnection ${connectionAttempts + 1}/5 in ${delay}ms`);
      setConnectionAttempts(prev => prev + 1);
      setCallStatus('connecting');
      
      // Cleanup existing connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      // Retry with exponential backoff
      reconnectTimeoutRef.current = setTimeout(() => {
        initializeCall();
      }, delay);
    } else {
      setError('Không thể kết nối sau nhiều lần thử. Vui lòng thử lại sau.');
      setCallStatus('failed');
    }
  };

  // Add pending candidates when remote description is set
  const addPendingCandidates = async () => {
    if (peerConnectionRef.current && pendingCandidatesRef.current.length > 0) {
      console.log(`Adding ${pendingCandidatesRef.current.length} pending candidates`);
      for (const candidate of pendingCandidatesRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Error adding pending candidate:', err);
        }
      }
      pendingCandidatesRef.current = [];
    }
  };

  const initializeCall = async () => {
    try {
      // Bắt đầu ringtone
      if (isCaller) {
        setCallStatus('ringing');
        startRinging();
      } else {
        setCallStatus('ringing');
        startRinging();
      }

        const permission = await navigator.permissions.query({ name: 'camera' });
        console.log('Camera permission state:', permission.state);

        const deviceList = await navigator.mediaDevices.enumerateDevices();
        setDevices(deviceList);
        setDeviceLog(JSON.stringify(deviceList, null, 2));
        console.log('Danh sách thiết bị:', deviceList);
        
        const hasVideoDevice = deviceList.some(device => device.kind === 'videoinput' && device.deviceId);
        const hasAudioDevice = deviceList.some(device => device.kind === 'audioinput' && device.deviceId);
        
        console.log('Có video device:', hasVideoDevice);
        console.log('Có audio device:', hasAudioDevice);

        if (!hasVideoDevice && !hasAudioDevice) {
          throw new Error('Không tìm thấy camera hoặc microphone');
        }

        const tryGetUserMedia = async (constraints) => {
          console.log('Thử getUserMedia với constraints:', constraints);
          return navigator.mediaDevices.getUserMedia(constraints);
        };

        let localStream;
        
        if (hasVideoDevice) {
          try {
          localStream = await tryGetUserMedia({ 
            video: { 
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 60 },
              facingMode: 'user'
            }, 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 2
            }
          });
            console.log('✅ Lấy được video + audio stream');
          } catch (err) {
            console.log('❌ Lỗi video + audio, thử chỉ audio...');
            if (hasAudioDevice) {
            localStream = await tryGetUserMedia({ 
              video: false, 
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 2
              }
            });
              setIsAudioOnly(true);
              console.log('✅ Lấy được audio-only stream');
            } else {
              throw err;
            }
          }
        } else if (hasAudioDevice) {
        localStream = await tryGetUserMedia({ 
          video: false, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2
          }
        });
          setIsAudioOnly(true);
          console.log('✅ Lấy được audio-only stream');
        } else {
          throw new Error('Không có thiết bị audio/video nào khả dụng');
        }

        localStreamRef.current = localStream;
        if (localVideo.current && !isAudioOnly) {
          localVideo.current.srcObject = localStream;
        }

      // Cải thiện RTCPeerConnection configuration với TURN servers
        const configuration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Free TURN servers (có thể thay thế bằng TURN server riêng)
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all',
        sdpSemantics: 'unified-plan'
        };

        console.log('Tạo RTCPeerConnection với config:', configuration);
        const peerConnection = new RTCPeerConnection(configuration);
        peerConnectionRef.current = peerConnection;

        // Thêm local stream vào peer connection
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });

        const signalHandler = async (msg) => {
        if (!peerConnection || peerConnection.connectionState === 'closed') {
            console.log('Peer connection đã đóng, bỏ qua signal');
            return;
          }
          
          if (msg.type === 'signal' && msg.from === remoteUserId) {
            try {
              console.log('Nhận signal từ:', msg.from, 'type:', msg.data.type);
              
              if (msg.data.type === 'offer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data));
              await addPendingCandidates();
              
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                signalingChannel.send({
                  type: 'signal',
                  to: remoteUserId,
                  from: localUserId,
                  data: answer
                });
              } else if (msg.data.type === 'answer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data));
              await addPendingCandidates();
              } else if (msg.data.type === 'ice-candidate') {
              if (peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
              } else {
                console.log('Remote description chưa sẵn sàng, lưu candidate');
                pendingCandidatesRef.current.push(msg.data.candidate);
              }
            }
          } catch (err) {
            console.error('Lỗi khi xử lý signal:', err);
          }
        } else if (msg.type === 'heartbeat' && msg.from === remoteUserId) {
          lastHeartbeatRef.current = Date.now();
          console.log('Received heartbeat from:', msg.from);
          }
        };

        handlerRef.current = signalHandler;
        signalingChannel.on('signal', signalHandler);
      signalingChannel.on('heartbeat', signalHandler);

      // ICE candidate handler với retry logic
        peerConnection.onicecandidate = (event) => {
        if (!peerConnection || peerConnection.connectionState === 'closed') {
            return;
          }
          
          if (event.candidate) {
            try {
              console.log('Gửi ICE candidate đến:', remoteUserId);
              signalingChannel.send({
                type: 'signal',
                to: remoteUserId,
                from: localUserId,
                data: {
                  type: 'ice-candidate',
                  candidate: event.candidate
                }
              });
            } catch (err) {
              console.error('Lỗi khi gửi ICE candidate:', err);
            }
          }
        };

        peerConnection.ontrack = (event) => {
        console.log('Nhận remote stream:', event.streams[0]);
        
        const stream = event.streams[0];
        setRemoteStream(stream);
        
          if (remoteMediaRef.current) {
          remoteMediaRef.current.srcObject = stream;
          
          if (isAudioOnly) {
            console.log('Audio-only mode, thử play audio...');
            setTimeout(() => {
              playAudioSafely(remoteMediaRef.current);
            }, 100);
          } else {
            if (typeof remoteMediaRef.current.play === 'function') {
              remoteMediaRef.current.play().catch(e => console.warn('Video autoplay error:', e));
            }
          }
        }
      };

        peerConnection.onconnectionstatechange = () => {
          console.log('Connection state:', peerConnection.connectionState);
          
          if (peerConnection.connectionState === 'connected') {
            setIsConnected(true);
          setCallStatus('connected');
          stopRinging();
          setConnectionAttempts(0); // Reset attempts on success
          lastHeartbeatRef.current = Date.now();
          if (isAudioOnly && remoteMediaRef.current) {
            setTimeout(() => {
              playAudioSafely(remoteMediaRef.current);
            }, 500);
          }
        } else if (peerConnection.connectionState === 'disconnected') {
          setIsConnected(false);
          setCallStatus('connecting');
          console.log('Connection lost, attempting reconnection...');
          setTimeout(() => {
            if (peerConnection.connectionState === 'disconnected') {
              attemptReconnection();
            }
          }, 3000);
        } else if (peerConnection.connectionState === 'failed') {
          setIsConnected(false);
          setCallStatus('failed');
          setError('Kết nối thất bại');
          stopRinging();
          attemptReconnection();
        }
      };

        peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log('ICE connection state:', state);
        setIceConnectionState(state);
        
        if (state === 'connected' || state === 'completed') {
          setConnectionQuality('good');
        } else if (state === 'checking') {
          setConnectionQuality('checking');
        } else if (state === 'failed') {
          setConnectionQuality('poor');
          console.log('ICE connection failed, attempting reconnection...');
          setTimeout(() => {
            if (peerConnection.iceConnectionState === 'failed') {
              attemptReconnection();
            }
          }, 2000);
        }
      };

      peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', peerConnection.iceGatheringState);
      };

        if (isCaller) {
          try {
            console.log('Tạo offer...');
          const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: !isAudioOnly
          });
            await peerConnection.setLocalDescription(offer);
            
            signalingChannel.send({
              type: 'signal',
              to: remoteUserId,
              from: localUserId,
              data: offer
            });
          } catch (err) {
            console.error('Lỗi khi tạo offer:', err);
            setError('Lỗi tạo cuộc gọi: ' + err.message);
          setCallStatus('failed');
        }
        }

        setIsLoading(false);

      } catch (err) {
        console.error('❌ Lỗi khởi tạo call:', err);
        setError('Không thể truy cập camera/mic: ' + err.name + ' - ' + err.message);
        setIsLoading(false);
      setCallStatus('failed');
      stopRinging();
      }
    };

  useEffect(() => {
    initializeCall();

    return () => {
      console.log('VideoCall component unmounting, cleanup...');
      stopRinging();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      if (handlerRef.current && signalingChannel.off) {
        signalingChannel.off('signal', handlerRef.current);
        signalingChannel.off('heartbeat', handlerRef.current);
      }
      
      if (peerConnectionRef.current) {
        console.log('Closing peer connection...');
        peerConnectionRef.current.close();
      }
      
      if (localStreamRef.current) {
        console.log('Stopping stream tracks...');
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCaller, remoteUserId, localUserId, signalingChannel]);

  useEffect(() => {
    if (remoteStream && remoteMediaRef.current) {
      remoteMediaRef.current.srcObject = remoteStream;
      
      if (isAudioOnly) {
        setTimeout(() => {
          playAudioSafely(remoteMediaRef.current);
        }, 200);
      }
    }
  }, [remoteStream, isAudioOnly]);

  const handleClose = () => {
    console.log('User clicked close button');
    stopRinging();
    onClose();
  };

  const handlePlayAudio = () => {
    if (remoteMediaRef.current && isAudioOnly) {
      playAudioSafely(remoteMediaRef.current);
    }
  };

  const handleAnswer = () => {
    setCallStatus('connecting');
    stopRinging();
  };

  const handleReject = () => {
    stopRinging();
    onClose();
  };

  const getConnectionQualityColor = () => {
    switch (connectionQuality) {
      case 'good': return 'bg-green-400';
      case 'checking': return 'bg-yellow-400';
      case 'poor': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getConnectionQualityText = () => {
    switch (connectionQuality) {
      case 'good': return 'Tốt';
      case 'checking': return 'Đang kiểm tra';
      case 'poor': return 'Kém';
      default: return 'Không xác định';
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center z-50">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl flex flex-col items-center border border-white/20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-blue-300 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <div className="text-white text-lg font-semibold mt-6">Đang khởi tạo cuộc gọi...</div>
          <div className="text-blue-200 text-sm mt-2">Vui lòng chờ trong giây lát</div>
        </div>
      </div>
    );
  }

  // Incoming call screen
  if (callStatus === 'ringing' && !isCaller) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center z-50">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl flex flex-col items-center border border-white/20 max-w-sm w-full mx-4">
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center animate-pulse">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
              </svg>
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-white text-xl font-bold mb-2">Cuộc gọi đến</div>
            <div className="text-green-200 text-sm mb-6">Từ người dùng khác</div>
            
            <div className="flex gap-4">
              <button 
                onClick={handleAnswer}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-semibold transition-all duration-200 transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                </svg>
                Trả lời
              </button>
              <button 
                onClick={handleReject}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-semibold transition-all duration-200 transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
                Từ chối
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main call interface
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center z-50">
      <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl border border-white/20 max-w-4xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`}></div>
            <div className="text-white">
              <div className="font-semibold">
                {isConnected ? 'Đã kết nối' : callStatus === 'ringing' ? 'Đang gọi...' : 'Đang kết nối...'}
              </div>
              {isConnected && <div className="text-sm text-gray-300">{formatDuration(callDuration)}</div>}
              {connectionAttempts > 0 && <div className="text-xs text-yellow-300">Thử kết nối lại: {connectionAttempts}/5</div>}
              {isConnected && (
                <div className="flex items-center space-x-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${getConnectionQualityColor()}`}></div>
                  <span className="text-gray-300">Chất lượng: {getConnectionQualityText()}</span>
                </div>
              )}
            </div>
          </div>
          
          <button 
            onClick={handleClose}
            className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full transition-all duration-200 transform hover:scale-110"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        {/* Video/Audio Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {!isAudioOnly ? (
          <>
              {/* Local Video */}
              <div className="relative">
                <div className="text-white text-sm mb-2 font-medium">Bạn</div>
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video 
                    ref={localVideo} 
                    autoPlay 
                    muted 
                    playsInline 
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    Local
                  </div>
                </div>
              </div>

              {/* Remote Video */}
              <div className="relative">
                <div className="text-white text-sm mb-2 font-medium">Người gọi</div>
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video 
                    ref={remoteMediaRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    Remote
                  </div>
                </div>
              </div>
          </>
        ) : (
            /* Audio Only Mode */
            <div className="col-span-1 lg:col-span-2">
              <div className="text-center">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0010 2a7 7 0 00-1 13.93V17a1 1 0 11-2 0v-3.07A7.001 7.001 0 010 10a1 1 0 012 0 5 5 0 0010 0 1 1 0 012 0 7.001 7.001 0 00-1 3.93V17a1 1 0 11-2 0v-3.07z" clipRule="evenodd"/>
                  </svg>
            </div>
                
                <div className="text-white text-lg font-semibold mb-2">Cuộc gọi âm thanh</div>
                <div className="text-gray-300 text-sm mb-4">Đang kết nối âm thanh...</div>
                
            <audio
              ref={remoteMediaRef}
              autoPlay
              controls
                  className="w-full max-w-md mx-auto"
                  style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}
                  onLoadedMetadata={handlePlayAudio}
            />
        
        {isConnected && (
                  <button 
                    onClick={handlePlayAudio}
                    className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-medium transition-all duration-200 transform hover:scale-105"
                  >
                    🔊 Phát âm thanh
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-4">
            <div className="text-red-300 font-medium mb-2">Lỗi kết nối</div>
            <div className="text-red-200 text-sm">{error}</div>
            <div className="text-xs text-red-300 mt-2">
              <b>Hướng dẫn:</b>
              <br/>• Thử trên Chrome/Safari thay vì Cốc Cốc
              <br/>• Tắt chế độ Incognito
              <br/>• Cho phép quyền camera/mic
              <br/>• Kiểm tra System Preferences → Security & Privacy → Camera
              <br/>• Nếu không có audio, click nút "Phát âm thanh"
            </div>
          </div>
        )}

        {/* Call Controls */}
        <div className="flex justify-center space-x-4">
          <button 
            onClick={handleClose}
            className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-semibold transition-all duration-200 transform hover:scale-105 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
            Kết thúc
          </button>
        </div>
      </div>
    </div>
  );
}
