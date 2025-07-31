import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';
import { resumeAudioContext } from '../utils/audioContext';

const VoicePlayer = ({ audioUrl, isOwn = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);


  const audioRef = useRef(null);
  const timerRef = useRef(null);

  // Tính progress percentage
  const progress = (duration > 0 && isFinite(duration) && isFinite(currentTime)) ? (currentTime / duration) * 100 : 0;

  // Format thời gian
  const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Khởi tạo audio context cho mobile
  const initAudioContext = async () => {
    try {
      await resumeAudioContext();
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  };

  // Phát/dừng audio
  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        // Khởi tạo audio context trước khi play
        await initAudioContext();
        
        if (isPlaying) {
          audioRef.current.pause();
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
        }
      } catch (error) {
        console.error('Error playing audio:', error);
        setError('Không thể phát audio, vui lòng thử lại');
      }
    }
  };

  // Handle seek
  const handleSeek = (e) => {
    const newProgress = parseFloat(e.target.value);
    const newTime = (newProgress / 100) * duration;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Update timer
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isPlaying]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      // Không đóng audioContext ở đây
    };
  }, []);

  return (
    <div className="bg-gray-800/50 rounded-xl p-2 sm:p-3 w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto">
      <div className="flex flex-col space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-gray-300">Voice Message</span>
          </div>
          <span className="text-xs text-gray-400">{formatTime(duration)}</span>
        </div>

        {/* Audio Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePlay}
            className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          >
            {isPlaying ? (
              <PauseIcon className="w-3 h-3 text-white" />
            ) : (
              <PlayIcon className="w-3 h-3 text-white ml-0.5" />
            )}
          </button>

          {/* Progress Bar */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <div className="w-full bg-gray-600 rounded-full h-1">
                <div 
                  className="bg-red-500 h-1 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Time Display */}
          <div className="text-xs text-gray-400 flex-shrink-0 min-w-0">
            <span>{formatTime(currentTime)}</span>
          </div>
        </div>

        {/* Waveform Visualization */}
        <div className="flex items-center justify-center space-x-0.5 h-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className={`w-0.5 rounded-full transition-all duration-200 ${
                isPlaying && i < Math.floor(progress / 12.5) 
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
        onLoadedMetadata={() => {
          const duration = audioRef.current.duration;
          if (isFinite(duration) && !isNaN(duration) && duration > 0) {
            setDuration(duration);
          } else {
            setDuration(0);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={() => {
          const currentTime = audioRef.current.currentTime;
          if (isFinite(currentTime) && !isNaN(currentTime)) {
            setCurrentTime(currentTime);
          }
        }}
        onError={(e) => {
          console.error('Audio error:', e);
          setError('Không thể tải audio');
        }}
        onCanPlay={() => setError(null)}
        onLoadStart={() => setError(null)}
      />
    </div>
  );
};

export default VoicePlayer; 