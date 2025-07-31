import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon, PlayIcon, PauseIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { generateFilename } from '../utils/fileUtils';
import { resumeAudioContext } from '../utils/audioContext';

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

  // Khởi tạo audio context cho mobile
  const initAudioContext = async () => {
    try {
      await resumeAudioContext();
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  };

  // Bắt đầu ghi âm
  const startRecording = async () => {
    try {
      setError(null);
      
      // Khởi tạo audio context trước khi ghi âm
      await initAudioContext();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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
        // Khởi tạo audio context trước khi play
        await initAudioContext();
        
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          clearInterval(playbackTimerRef.current);
        } else {
          // Đảm bảo audio context được resume trước khi play
          await resumeAudioContext();
          
          if (audioRef.current.readyState >= 2) {
            await audioRef.current.play();
          } else {
            // Nếu audio chưa sẵn sàng, load lại
            audioRef.current.load();
            await audioRef.current.play();
          }
          
          setIsPlaying(true);
          playbackTimerRef.current = setInterval(() => {
            setPlaybackTime(audioRef.current.currentTime);
          }, 100);
        }
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
      // Không đóng audioContext ở đây vì có thể được dùng lại
    };
  }, [audioUrl]);

  return (
    <div className="bg-gray-800/50 rounded-xl p-3 w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto">
      <div className="flex flex-col space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-xs font-medium text-gray-300">Voice Recorder</span>
          </div>
          <span className="text-xs text-gray-400">{formatTime(recordingTime)}</span>
        </div>

        {/* Recording Controls */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isRecording ? (
              <StopIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            ) : (
              <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            )}
          </button>

          {audioBlob && (
            <>
              <button
                onClick={playAudio}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <PauseIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                ) : (
                  <PlayIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white ml-0.5" />
                )}
              </button>

              <button
                onClick={sendVoiceMessage}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors"
              >
                <PaperAirplaneIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </button>
            </>
          )}

          <button
            onClick={cancelRecording}
            className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-500 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="text-white text-sm sm:text-lg font-bold">×</span>
          </button>
        </div>

        {/* Progress Bar */}
        {isRecording && (
          <div className="w-full bg-gray-600 rounded-full h-1">
            <div 
              className="bg-red-500 h-1 rounded-full transition-all duration-100"
              style={{ width: `${(recordingTime / 60) * 100}%` }}
            ></div>
          </div>
        )}

        {/* Waveform Visualization */}
        <div className="flex items-center justify-center space-x-0.5 h-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className={`w-0.5 rounded-full transition-all duration-200 ${
                isRecording && i < Math.floor((recordingTime / 60) * 8)
                  ? 'bg-red-500 h-3' 
                  : 'bg-gray-500 h-2'
              }`}
            ></div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-red-400 text-xs text-center">
            {error}
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
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
          setError('Không thể phát audio');
        }}
        onCanPlay={() => setError(null)}
        onLoadStart={() => setError(null)}
      />
    </div>
  );
};

export default VoiceRecorder; 