import React, { useRef, useEffect, useState } from 'react';

export default function SimpleVideoCall({ signalingChannel, onClose, isCaller, remoteUserId, localUserId }) {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [callStatus, setCallStatus] = useState('initializing');
  const [debugLog, setDebugLog] = useState([]);
  
  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  // Debug logging
  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SimpleVideoCall ${timestamp}] ${message}`);
    setDebugLog(prev => [...prev.slice(-5), `${timestamp}: ${message}`]);
  };

  // Initialize call
  const initializeCall = async () => {
    try {
      addDebugLog(`Starting call - isCaller: ${isCaller}, remoteUserId: ${remoteUserId}`);
      
      if (!signalingChannel) {
        throw new Error('Signaling channel not available');
      }

      setCallStatus('getting-media');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }
      
      addDebugLog('Got local media stream');
      setCallStatus('creating-connection');

      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      peerConnectionRef.current = peerConnection;

      // Add local stream
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        addDebugLog('Received remote stream');
        if (remoteVideo.current) {
          remoteVideo.current.srcObject = event.streams[0];
        }
      };

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        addDebugLog(`Connection state: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'connected') {
          setIsConnected(true);
          setCallStatus('connected');
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          addDebugLog('Sending ICE candidate');
          signalingChannel.send({
            type: 'ice-candidate',
            from: localUserId,
            to: remoteUserId,
            candidate: event.candidate
          });
        }
      };

      // Handle signaling
      const handleSignal = (data) => {
        addDebugLog(`Received signal: ${data.type} from ${data.from}`);
        
        if (data.from !== remoteUserId) return;

        if (data.type === 'offer') {
          handleOffer(data);
        } else if (data.type === 'answer') {
          handleAnswer(data);
        } else if (data.type === 'ice-candidate') {
          handleIceCandidate(data);
        }
      };

      // Register signal handler
      signalingChannel.on('signal', handleSignal);

      if (isCaller) {
        // Create and send offer
        addDebugLog('Creating offer');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        signalingChannel.send({
          type: 'offer',
          from: localUserId,
          to: remoteUserId,
          sdp: offer.sdp
        });
        
        setCallStatus('calling');
      } else {
        setCallStatus('waiting-for-offer');
      }

    } catch (err) {
      addDebugLog(`Error: ${err.message}`);
      setError(err.message);
      setCallStatus('failed');
    }
  };

  const handleOffer = async (data) => {
    try {
      const peerConnection = peerConnectionRef.current;
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: data.sdp
      }));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      signalingChannel.send({
        type: 'answer',
        from: localUserId,
        to: remoteUserId,
        sdp: answer.sdp
      });
      
      addDebugLog('Sent answer');
    } catch (err) {
      addDebugLog(`Error handling offer: ${err.message}`);
    }
  };

  const handleAnswer = async (data) => {
    try {
      const peerConnection = peerConnectionRef.current;
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: data.sdp
      }));
      addDebugLog('Set remote description from answer');
    } catch (err) {
      addDebugLog(`Error handling answer: ${err.message}`);
    }
  };

  const handleIceCandidate = async (data) => {
    try {
      const peerConnection = peerConnectionRef.current;
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      addDebugLog('Added ICE candidate');
    } catch (err) {
      addDebugLog(`Error adding ICE candidate: ${err.message}`);
    }
  };

  useEffect(() => {
    initializeCall();
    
    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold">Simple Video Call</h3>
          <button 
            onClick={onClose}
            className="text-white hover:text-red-400"
          >
            ✕ Close
          </button>
        </div>
        
        <div className="mb-4">
          <div className="text-white text-sm">Status: {callStatus}</div>
          {isConnected && <div className="text-green-400 text-sm">✅ Connected!</div>}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-white text-sm mb-2">Local Video</div>
            <video 
              ref={localVideo} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-48 bg-gray-700 rounded"
            />
          </div>
          <div>
            <div className="text-white text-sm mb-2">Remote Video</div>
            <video 
              ref={remoteVideo} 
              autoPlay 
              playsInline 
              className="w-full h-48 bg-gray-700 rounded"
            />
          </div>
        </div>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded p-3 mb-4">
            <div className="text-red-300 text-sm">Error: {error}</div>
          </div>
        )}
        
        <div className="bg-gray-700 p-3 rounded max-h-32 overflow-y-auto">
          <div className="text-gray-300 text-sm mb-2">Debug Log:</div>
          {debugLog.map((log, idx) => (
            <div key={idx} className="text-xs text-gray-400 font-mono">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
