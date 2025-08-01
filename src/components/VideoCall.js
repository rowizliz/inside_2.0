import React, { useRef, useEffect, useState } from 'react';
import 'webrtc-adapter';

export default function VideoCall({ signalingChannel, onClose, isCaller, remoteUserId, localUserId }) {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const remoteAudio = useRef();
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
  const [debugLog, setDebugLog] = useState([]);
  
  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const handlerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const lastHeartbeatRef = useRef(Date.now());
  const callTimeoutRef = useRef(null);

  // Debug logging function
  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[VideoCall ${timestamp}] ${message}`);
    setDebugLog(prev => [...prev.slice(-10), `${timestamp}: ${message}`]);
  };

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

            // Lưu timeout ID để có thể clear khi cần
            const timeoutId = setTimeout(playTone, 2000);
            if (ringtoneRef.current) {
              ringtoneRef.current.timeoutId = timeoutId;
            }
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

    // Clear timeout để dừng việc lặp lại ringtone
    if (ringtoneRef.current && ringtoneRef.current.timeoutId) {
      clearTimeout(ringtoneRef.current.timeoutId);
      ringtoneRef.current.timeoutId = null;
    }

    // Dừng tất cả oscillators đang chạy
    if (ringtoneRef.current && ringtoneRef.current.audioContext) {
      try {
        // Suspend audio context để dừng tất cả âm thanh
        if (ringtoneRef.current.audioContext.state === 'running') {
          ringtoneRef.current.audioContext.suspend();
        }
      } catch (err) {
        console.warn('Error stopping ringtone:', err);
      }
    }

    console.log('🔕 Ringtone stopped');
  };

  // Hàm cleanup toàn diện
  const cleanupCall = () => {
    console.log('🧹 Starting comprehensive cleanup...');

    // Stop ringtone
    stopRinging();

    // Clear timeouts and intervals
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Stop all local stream tracks
    if (localStreamRef.current) {
      console.log('🛑 Stopping local stream tracks...');
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind} - ${track.label}`);
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Stop remote stream tracks
    if (remoteStream) {
      console.log('🛑 Stopping remote stream tracks...');
      remoteStream.getTracks().forEach(track => {
        console.log(`Stopping remote track: ${track.kind} - ${track.label}`);
        track.stop();
      });
    }

    // Clear video elements
    if (localVideo.current) {
      localVideo.current.srcObject = null;
      localVideo.current.pause();
    }

    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
      remoteVideo.current.pause();
    }

    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
      remoteAudio.current.pause();
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      console.log('🔌 Closing peer connection...');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Remove signaling handlers
    if (handlerRef.current && signalingChannel && signalingChannel.off) {
      signalingChannel.off('signal', handlerRef.current);
      signalingChannel.off('heartbeat', handlerRef.current);
      handlerRef.current = null;
    }

    // Reset states
    setIsConnected(false);
    setCallStatus('ended');
    setConnectionAttempts(0);
    setError(null);

    console.log('✅ Cleanup completed');
  };

  // Cải thiện reconnection logic với cleanup tốt hơn
  const attemptReconnection = async () => {
    if (connectionAttempts >= 5) {
      setError('Không thể kết nối sau nhiều lần thử. Vui lòng thử lại sau.');
      setCallStatus('failed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 15000); // Max 15s
    console.log(`🔄 Attempting reconnection ${connectionAttempts + 1}/5 in ${delay}ms`);
    addDebugLog(`Reconnection attempt ${connectionAttempts + 1}/5 in ${delay}ms`);

    setConnectionAttempts(prev => prev + 1);
    setCallStatus('reconnecting');

    try {
      // Cleanup existing connection hoàn toàn
      if (peerConnectionRef.current) {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Clear pending candidates
      pendingCandidatesRef.current = [];

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, delay));

      // Reinitialize connection
      await initializePeerConnection();

      // Restart the call process
      if (isCaller) {
        // Reinitialize as caller
        await initializeCall();
      }

    } catch (error) {
      console.error('Reconnection failed:', error);
      addDebugLog(`Reconnection failed: ${error.message}`);

      // Try again if we haven't exceeded max attempts
      if (connectionAttempts < 4) {
        setTimeout(() => attemptReconnection(), 2000);
      } else {
        setError('Kết nối thất bại hoàn toàn. Vui lòng thử lại.');
        setCallStatus('failed');
      }
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
      addDebugLog(`Initializing call - isCaller: ${isCaller}, remoteUserId: ${remoteUserId}, localUserId: ${localUserId}`);
      addDebugLog(`Signaling channel: ${signalingChannel ? 'Available' : 'Missing'}`);

      // Kiểm tra signaling channel
      if (!signalingChannel) {
        throw new Error('Signaling channel is not available');
      }

      // Kiểm tra signaling channel có method send không
      if (typeof signalingChannel.send !== 'function') {
        throw new Error('Signaling channel does not have send method');
      }

      // Thiết lập timeout để tự động cleanup nếu call không thành công sau 60 giây
      callTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Call timeout - cleaning up after 60 seconds');
        setError('Cuộc gọi hết thời gian chờ');
        cleanupCall();
        onClose();
      }, 60000);

      // Bắt đầu ringtone
      if (isCaller) {
        setCallStatus('ringing');
        startRinging();
        addDebugLog('Started ringing for caller');
      } else {
        setCallStatus('ringing');
        startRinging();
        addDebugLog('Started ringing for receiver');
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
          // Đảm bảo local video được play
          localVideo.current.play().catch(e => console.warn('Local video autoplay error:', e));
        }

      // Cải thiện RTCPeerConnection configuration với TURN servers
        const configuration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // Thêm nhiều STUN servers khác
            { urls: 'stun:stun.services.mozilla.com' },
            { urls: 'stun:stun.ekiga.net' },
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
            },
            // Thêm TURN server khác
            {
              urls: 'turn:relay1.expressturn.com:3478',
              username: 'efJBIBF0YQAB8KAAAB',
              credential: 'sTunLuCZNIrQQjqb'
            }
          ],
          iceCandidatePoolSize: 20,
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
          addDebugLog(`Received signal: ${JSON.stringify(msg)}`);

          if (!peerConnection || peerConnection.connectionState === 'closed') {
            addDebugLog('Peer connection closed, ignoring signal');
            return;
          }

          // Handle different signal types
          if (msg.type === 'offer' && msg.from === remoteUserId) {
            try {
              addDebugLog('Processing offer from: ' + msg.from);
              await peerConnection.setRemoteDescription(new RTCSessionDescription(msg));
              await addPendingCandidates();

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);

              addDebugLog('Sending answer to: ' + remoteUserId);
              signalingChannel.send({
                type: 'answer',
                to: remoteUserId,
                from: localUserId,
                sdp: answer.sdp
              });
            } catch (err) {
              addDebugLog('Error processing offer: ' + err.message);
              setError('Lỗi xử lý offer: ' + err.message);
            }
          } else if (msg.type === 'answer' && msg.from === remoteUserId) {
            try {
              addDebugLog('Processing answer from: ' + msg.from);
              await peerConnection.setRemoteDescription(new RTCSessionDescription(msg));
              await addPendingCandidates();
            } catch (err) {
              addDebugLog('Error processing answer: ' + err.message);
              setError('Lỗi xử lý answer: ' + err.message);
            }
          } else if (msg.type === 'ice-candidate' && msg.from === remoteUserId) {
            try {
              if (peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
                addDebugLog('Added ICE candidate');
              } else {
                addDebugLog('Remote description not ready, queuing candidate');
                pendingCandidatesRef.current.push(msg.candidate);
              }
            } catch (err) {
              addDebugLog('Error adding ICE candidate: ' + err.message);
            }
          } else if (msg.type === 'heartbeat' && msg.from === remoteUserId) {
            lastHeartbeatRef.current = Date.now();
            addDebugLog('Received heartbeat from: ' + msg.from);
          }
        };

        handlerRef.current = signalHandler;

        // Register for all signal types
        const signalHandlerWrapper = signalingChannel.on('signal', signalHandler);
        const heartbeatHandlerWrapper = signalingChannel.on('heartbeat', signalHandler);

        addDebugLog('Signal handlers registered');

      // ICE candidate handler với retry logic
        peerConnection.onicecandidate = (event) => {
          if (!peerConnection || peerConnection.connectionState === 'closed') {
            return;
          }

          if (event.candidate) {
            try {
              addDebugLog('Sending ICE candidate to: ' + remoteUserId);
              signalingChannel.send({
                type: 'ice-candidate',
                to: remoteUserId,
                from: localUserId,
                candidate: event.candidate
              });
            } catch (err) {
              addDebugLog('Error sending ICE candidate: ' + err.message);
            }
          } else {
            addDebugLog('ICE gathering completed');
          }
        };

        peerConnection.ontrack = (event) => {
        console.log('Nhận remote stream:', event.streams[0]);
        
        const stream = event.streams[0];
        console.log('🎥 Received remote stream:', stream);
        console.log('🎥 Stream tracks:', stream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
        setRemoteStream(stream);

        // Set stream cho cả video và audio elements
        if (remoteVideo.current) {
          console.log('🎥 Setting remote video srcObject');
          remoteVideo.current.srcObject = stream;
          if (!isAudioOnly) {
            remoteVideo.current.play().catch(e => console.warn('Video autoplay error:', e));
          }
        }

        if (remoteAudio.current) {
          console.log('🔊 Setting remote audio srcObject');
          remoteAudio.current.srcObject = stream;
          if (isAudioOnly) {
            console.log('Audio-only mode, thử play audio...');
            setTimeout(() => {
              playAudioSafely(remoteAudio.current);
            }, 100);
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

            // Clear call timeout khi kết nối thành công
            if (callTimeoutRef.current) {
              clearTimeout(callTimeoutRef.current);
              callTimeoutRef.current = null;
            }

            if (isAudioOnly && remoteAudio.current) {
              setTimeout(() => {
                playAudioSafely(remoteAudio.current);
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

          // Nếu đã thử reconnect nhiều lần, cleanup hoàn toàn
          if (connectionAttempts >= 5) {
            console.log('Max reconnection attempts reached, cleaning up...');
            setTimeout(() => {
              cleanupCall();
              onClose();
            }, 3000);
          } else {
            attemptReconnection();
          }
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
            addDebugLog('Creating offer...');
            const offer = await peerConnection.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: !isAudioOnly
            });
            await peerConnection.setLocalDescription(offer);

            addDebugLog('Sending offer to: ' + remoteUserId);
            signalingChannel.send({
              type: 'offer',
              to: remoteUserId,
              from: localUserId,
              sdp: offer.sdp
            });
          } catch (err) {
            addDebugLog('Error creating offer: ' + err.message);
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

    // Cleanup khi user đóng tab/browser
    const handleBeforeUnload = () => {
      cleanupCall();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('VideoCall component unmounting...');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupCall();
    };
  }, [isCaller, remoteUserId, localUserId, signalingChannel]);

  useEffect(() => {
    if (remoteStream) {
      // Set stream cho video element
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = remoteStream;
        if (!isAudioOnly) {
          remoteVideo.current.play().catch(e => console.warn('Video autoplay error:', e));
        }
      }

      // Set stream cho audio element
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = remoteStream;
        if (isAudioOnly) {
          setTimeout(() => {
            playAudioSafely(remoteAudio.current);
          }, 200);
        }
      }
    }
  }, [remoteStream, isAudioOnly]);

  // Enhanced connection monitoring
  useEffect(() => {
    if (callStatus === 'connected' && signalingChannel) {
      const connectionMonitor = setInterval(() => {
        // Check WebRTC connection state
        if (peerConnectionRef.current) {
          const state = peerConnectionRef.current.iceConnectionState;
          if (state === 'disconnected' || state === 'failed') {
            console.warn('WebRTC connection unstable, attempting recovery...');
            addDebugLog(`WebRTC state: ${state}, attempting recovery`);
            attemptReconnection();
          }
        }

        // Check signaling channel connection
        if (signalingChannel && typeof signalingChannel.connected !== 'undefined' && !signalingChannel.connected) {
          console.warn('Signaling channel disconnected, attempting reconnection...');
          addDebugLog('Signaling channel disconnected');
          // Attempt to reconnect signaling channel if it has a connect method
          if (typeof signalingChannel.connect === 'function') {
            signalingChannel.connect();
          }
        }
      }, 3000); // Check every 3 seconds

      return () => clearInterval(connectionMonitor);
    }
  }, [callStatus, signalingChannel, attemptReconnection]);

  const handleClose = () => {
    console.log('User clicked close button');
    cleanupCall();
    onClose();
  };

  const handlePlayAudio = () => {
    if (remoteAudio.current && isAudioOnly) {
      playAudioSafely(remoteAudio.current);
    }
  };

  // Hàm khởi tạo peer connection
  const initializePeerConnection = async () => {
    try {
      const configuration = {
        iceServers: [
          // Google STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Thêm STUN servers khác để backup
          { urls: 'stun:stun.services.mozilla.com' },
          { urls: 'stun:stun.ekiga.net' },
          // TURN servers miễn phí cho NAT traversal
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
        iceCandidatePoolSize: 30,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all',
        sdpSemantics: 'unified-plan'
      };

      console.log('Tạo RTCPeerConnection với config:', configuration);
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Thêm local stream vào peer connection nếu có
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          console.log(`Adding track to peer connection: ${track.kind}`);
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

      // Setup event handlers
      // Enhanced ICE candidate handler với retry logic
      peerConnection.onicecandidate = (event) => {
        if (!peerConnection || peerConnection.connectionState === 'closed') {
          return;
        }

        if (event.candidate) {
          console.log('Sending ICE candidate:', event.candidate);
          addDebugLog(`Sending ICE candidate: ${event.candidate.candidate}`);

          // Retry logic cho ICE candidate sending
          const sendCandidate = (retries = 3) => {
            try {
              signalingChannel.send({
                type: 'ice-candidate',
                candidate: event.candidate,
                to: remoteUserId,
                from: localUserId
              });
            } catch (err) {
              addDebugLog('Error sending ICE candidate: ' + err.message);

              if (retries > 0) {
                setTimeout(() => sendCandidate(retries - 1), 1000);
              } else {
                // Store failed candidate for later retry
                pendingCandidatesRef.current.push(event.candidate);
              }
            }
          };

          sendCandidate();
        } else {
          console.log('ICE gathering completed');
          addDebugLog('ICE gathering completed');

          // Retry sending any pending candidates
          if (pendingCandidatesRef.current.length > 0) {
            addDebugLog(`Retrying ${pendingCandidatesRef.current.length} pending candidates`);
            pendingCandidatesRef.current.forEach(candidate => {
              try {
                signalingChannel.send({
                  type: 'ice-candidate',
                  candidate,
                  to: remoteUserId,
                  from: localUserId
                });
              } catch (error) {
                console.error('Error retrying candidate:', error);
              }
            });
            pendingCandidatesRef.current = [];
          }
        }
      };

      peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        addDebugLog(`Received remote track: ${event.track.kind}`);

        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];

          if (remoteVideo.current) {
            remoteVideo.current.srcObject = event.streams[0];
            remoteVideo.current.play().catch(e => console.warn('Remote video autoplay error:', e));
          }

          if (remoteAudio.current && isAudioOnly) {
            remoteAudio.current.srcObject = event.streams[0];
            playAudioSafely(remoteAudio.current);
          }
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state changed:', peerConnection.connectionState);
        addDebugLog(`Connection state: ${peerConnection.connectionState}`);

        if (peerConnection.connectionState === 'connected') {
          setCallStatus('connected');
          setConnectionQuality('good');
        } else if (peerConnection.connectionState === 'disconnected') {
          setCallStatus('disconnected');
          setConnectionQuality('poor');
        } else if (peerConnection.connectionState === 'failed') {
          setCallStatus('failed');
          setError('Kết nối thất bại');
        }
      };

      // Cải thiện ICE connection state handling với auto-reconnect
      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log('ICE connection state:', state);
        addDebugLog(`ICE connection state: ${state}`);
        setIceConnectionState(state);

        switch (state) {
          case 'checking':
            setConnectionQuality('checking');
            setCallStatus('connecting');
            break;
          case 'connected':
          case 'completed':
            setConnectionQuality('good');
            setCallStatus('connected');
            setConnectionAttempts(0); // Reset attempts on success
            break;
          case 'disconnected':
            setConnectionQuality('poor');
            setCallStatus('reconnecting');
            addDebugLog('Connection disconnected, attempting to reconnect...');
            // Thử reconnect sau 2 giây
            setTimeout(() => {
              if (peerConnection.iceConnectionState === 'disconnected') {
                peerConnection.restartIce();
              }
            }, 2000);
            break;
          case 'failed':
            setConnectionQuality('poor');
            setCallStatus('failed');
            addDebugLog('ICE connection failed, attempting full reconnection...');

            // Thử reconnect với delay tăng dần
            const attempts = connectionAttempts + 1;
            setConnectionAttempts(attempts);

            if (attempts < 5) {
              const delay = Math.min(1000 * Math.pow(2, attempts), 10000); // Exponential backoff
              setTimeout(() => {
                attemptReconnection();
              }, delay);
            } else {
              setError('Không thể kết nối. Vui lòng thử lại sau.');
            }
            break;
          case 'closed':
            setCallStatus('ended');
            break;
        }
      };

      // Setup signal handler nếu chưa có
      if (!handlerRef.current) {
        const signalHandler = async (msg) => {
          addDebugLog(`Received signal: ${JSON.stringify(msg)}`);

          if (!peerConnection || peerConnection.connectionState === 'closed') {
            addDebugLog('Peer connection closed, ignoring signal');
            return;
          }

          // Handle different signal types
          if (msg.type === 'offer' && msg.from === remoteUserId) {
            try {
              addDebugLog('Processing offer from: ' + msg.from);
              await peerConnection.setRemoteDescription(new RTCSessionDescription(msg));
              await addPendingCandidates();

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);

              addDebugLog('Sending answer to: ' + remoteUserId);
              signalingChannel.send({
                type: 'answer',
                to: remoteUserId,
                from: localUserId,
                sdp: answer.sdp
              });
            } catch (err) {
              addDebugLog('Error processing offer: ' + err.message);
              setError('Lỗi xử lý offer: ' + err.message);
            }
          } else if (msg.type === 'answer' && msg.from === remoteUserId) {
            try {
              addDebugLog('Processing answer from: ' + msg.from);
              await peerConnection.setRemoteDescription(new RTCSessionDescription(msg));
              await addPendingCandidates();
            } catch (err) {
              addDebugLog('Error processing answer: ' + err.message);
              setError('Lỗi xử lý answer: ' + err.message);
            }
          } else if (msg.type === 'ice-candidate' && msg.from === remoteUserId) {
            try {
              if (msg.candidate) {
                addDebugLog('Adding ICE candidate from: ' + msg.from);
                await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
              }
            } catch (err) {
              addDebugLog('Error adding ICE candidate: ' + err.message);
            }
          } else if (msg.type === 'heartbeat' && msg.from === remoteUserId) {
            lastHeartbeatRef.current = Date.now();
            addDebugLog('Heartbeat received from: ' + msg.from);
          }
        };

        handlerRef.current = signalHandler;
        signalingChannel.on('signal', signalHandler);
        signalingChannel.on('heartbeat', signalHandler);
        addDebugLog('Signal handlers registered for answer');
      }

    } catch (error) {
      console.error('❌ Error initializing peer connection:', error);
      throw error;
    }
  };

  const handleAnswer = async () => {
    console.log('📞 User answered the call');
    addDebugLog('User clicked answer button');
    setCallStatus('connecting');
    stopRinging();

    try {
      // Nếu chưa có local stream, khởi tạo
      if (!localStreamRef.current) {
        console.log('🎥 Getting user media for answer...');
        const constraints = {
          video: !isAudioOnly ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          } : false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;

        if (localVideo.current && !isAudioOnly) {
          localVideo.current.srcObject = stream;
          localVideo.current.play().catch(e => console.warn('Local video autoplay error:', e));
        }
      }

      // Nếu chưa có peer connection, tạo mới
      if (!peerConnectionRef.current) {
        console.log('🔗 Creating peer connection for answer...');
        await initializePeerConnection();
      }

      // Thêm local stream vào peer connection
      if (localStreamRef.current && peerConnectionRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      }

      // Tạo answer và gửi qua WebSocket
      console.log('📤 Creating and sending answer...');
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Gửi answer qua signaling channel
      if (signalingChannel) {
        signalingChannel.send({
          type: 'answer',
          to: remoteUserId,
          from: localUserId,
          sdp: answer.sdp
        });
        console.log('📤 Answer sent successfully');
      } else {
        throw new Error('Signaling channel not available');
      }

    } catch (error) {
      console.error('❌ Error answering call:', error);
      setError('Không thể trả lời cuộc gọi: ' + error.message);
      setCallStatus('failed');
      stopRinging();
    }
  };

  const handleReject = () => {
    cleanupCall();
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
                    onLoadedMetadata={() => console.log('📹 Local video metadata loaded')}
                    onCanPlay={() => console.log('📹 Local video can play')}
                    onPlay={() => console.log('📹 Local video started playing')}
                    onError={(e) => console.error('📹 Local video error:', e)}
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
                    ref={remoteVideo}
                    autoPlay
                    playsInline
                    className="w-full h-64 object-cover"
                    onLoadedMetadata={() => console.log('🎥 Remote video metadata loaded')}
                    onCanPlay={() => console.log('🎥 Remote video can play')}
                    onPlay={() => console.log('🎥 Remote video started playing')}
                    onError={(e) => console.error('🎥 Remote video error:', e)}
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
                <div className={`relative w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  iceConnectionState === 'connected' ? 'animate-pulse' : ''
                }`}>
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0010 2a7 7 0 00-1 13.93V17a1 1 0 11-2 0v-3.07A7.001 7.001 0 010 10a1 1 0 012 0 5 5 0 0010 0 1 1 0 012 0 7.001 7.001 0 00-1 3.93V17a1 1 0 11-2 0v-3.07z" clipRule="evenodd"/>
                  </svg>
                  {/* Connection indicator */}
                  {iceConnectionState === 'connected' && (
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
                
                <div className="text-white text-xl font-semibold mb-2">Cuộc gọi âm thanh</div>
                <div className="text-gray-300 text-sm mb-6">
                  {iceConnectionState === 'connected' ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Đã kết nối - Chất lượng: {connectionQuality === 'good' ? 'Tốt' : connectionQuality === 'poor' ? 'Kém' : 'Đang kiểm tra'}</span>
                    </div>
                  ) : iceConnectionState === 'connecting' || iceConnectionState === 'checking' ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span>Đang kết nối...</span>
                    </div>
                  ) : iceConnectionState === 'disconnected' ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span>Mất kết nối - Đang thử lại...</span>
                    </div>
                  ) : iceConnectionState === 'failed' ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span>Kết nối thất bại - Đang khôi phục...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span>Đang thiết lập kết nối...</span>
                    </div>
                  )}
                </div>
                
            <audio
              ref={remoteAudio}
              autoPlay
              controls
                  className="w-full max-w-md mx-auto"
                  style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}
                  onLoadedMetadata={() => {
                    console.log('🔊 Remote audio metadata loaded');
                    handlePlayAudio();
                  }}
                  onCanPlay={() => console.log('🔊 Remote audio can play')}
                  onPlay={() => console.log('🔊 Remote audio started playing')}
                  onError={(e) => console.error('🔊 Remote audio error:', e)}
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

        {/* Debug Log - Chỉ hiển thị trong development */}
        {process.env.NODE_ENV === 'development' && debugLog.length > 0 && (
          <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
            <div className="text-gray-300 font-medium mb-2 text-sm">Debug Log:</div>
            {debugLog.map((log, idx) => (
              <div key={idx} className="text-xs text-gray-400 font-mono">{log}</div>
            ))}
          </div>
        )}

        {/* Call Controls */}
        <div className="flex justify-center space-x-6">
          <button
            onClick={handlePlayAudio}
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105"
            title="Phát âm thanh test"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.824L4.5 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.5l3.883-3.824z" clipRule="evenodd"/>
              <path d="M14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.828 1 1 0 010-1.415z"/>
            </svg>
          </button>

          <button
            onClick={handleClose}
            className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105"
            title="Kết thúc cuộc gọi"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
