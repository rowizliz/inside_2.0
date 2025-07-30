import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/solid';

const VoiceRecorder = ({ onVoiceRecorded, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRef = useRef(null);
  const playbackTimerRef = useRef(null);

  // Bắt đầu ghi âm
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Timer cho thời gian ghi âm
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Lỗi khi bắt đầu ghi âm:', error);
      setError('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
    }
  };

  // Dừng ghi âm
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  // Phát lại audio
  const playAudio = async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        
        playbackTimerRef.current = setInterval(() => {
          setPlaybackTime(audioRef.current.currentTime);
        }, 100);
      } catch (error) {
        console.error('Error playing audio:', error);
        setError('Không thể phát audio, vui lòng thử lại');
      }
    }
  };

  // Dừng phát lại
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      clearInterval(playbackTimerRef.current);
    }
  };

  // Gửi tin nhắn thoại
  const sendVoiceMessage = () => {
    if (audioBlob) {
      onVoiceRecorded(audioBlob);
      // Reset state
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
      setPlaybackTime(0);
      setDuration(0);
      setIsPlaying(false);
      setError(null);
    }
  };

  // Hủy ghi âm
  const cancelRecording = () => {
    if (isRecording) {
      stopRecording();
    }
    if (audioBlob) {
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
      setPlaybackTime(0);
      setDuration(0);
      setError(null);
    }
    onCancel();
  };

  // Format thời gian
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {!audioBlob ? (
        // Ghi âm mới - Mobile optimized
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="bg-red-500 hover:bg-red-600 text-white p-4 sm:p-3 rounded-full transition-colors shadow-lg"
            >
              <MicrophoneIcon className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-gray-600 hover:bg-gray-700 text-white p-4 sm:p-3 rounded-full transition-colors shadow-lg"
            >
              <StopIcon className="w-6 h-6" />
            </button>
          )}
          
          <div className="flex-1 w-full">
            <div className="text-sm text-gray-300 mb-2 text-center sm:text-left">
              {isRecording ? 'Đang ghi âm...' : 'Nhấn để ghi âm'}
            </div>
            {isRecording && (
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <div className="flex-1 bg-gray-700 rounded-full h-3 sm:h-2">
                  <div className="bg-red-500 h-3 sm:h-2 rounded-full animate-pulse" style={{ width: '30%' }}></div>
                </div>
                <span className="text-xs text-gray-400">{formatTime(recordingTime)}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={cancelRecording}
            className="text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg"
          >
            Hủy
          </button>
        </div>
      ) : (
        // Phát lại và gửi - Mobile optimized
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={isPlaying ? pauseAudio : playAudio}
              className="bg-blue-500 hover:bg-blue-600 text-white p-3 sm:p-2 rounded-full transition-colors shadow-lg"
              disabled={error}
            >
              {isPlaying ? <PauseIcon className="w-5 h-5 sm:w-4 sm:h-4" /> : <PlayIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
            </button>
            
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 mb-2">
                <div className="flex-1 bg-gray-700 rounded-full h-3 sm:h-2">
                  <div 
                    className="bg-blue-500 h-3 sm:h-2 rounded-full transition-all"
                    style={{ width: `${duration > 0 ? (playbackTime / duration) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-400 text-center sm:text-left">
                  {formatTime(playbackTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <button
              onClick={sendVoiceMessage}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 sm:py-2 px-4 rounded-lg transition-colors"
            >
              Gửi tin nhắn thoại
            </button>
            <button
              onClick={cancelRecording}
              className="px-4 py-3 sm:py-2 text-gray-400 hover:text-white transition-colors rounded-lg"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="text-red-400 text-xs mt-3 text-center">
          {error}
        </div>
      )}
      
      {/* Hidden audio element with mobile-optimized attributes */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          playsInline
          controls={false}
          onLoadedMetadata={() => setDuration(audioRef.current.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setPlaybackTime(0);
            clearInterval(playbackTimerRef.current);
          }}
          onTimeUpdate={() => setPlaybackTime(audioRef.current.currentTime)}
          onError={(e) => {
            console.error('Audio error:', e);
            setError('Không thể tải audio');
          }}
          onCanPlay={() => setError(null)}
        />
      )}
    </div>
  );
};

export default VoiceRecorder; 