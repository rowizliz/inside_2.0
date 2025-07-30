import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon, SpeakerWaveIcon } from '@heroicons/react/24/solid';

const VoicePlayer = ({ audioUrl, isOwn = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const timerRef = useRef(null);

  // Format thời gian
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Phát/dừng audio
  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          // Đảm bảo audio context được resume trước khi play
          if (audioRef.current.readyState >= 2) {
            await audioRef.current.play();
          } else {
            setError('Audio chưa sẵn sàng, vui lòng thử lại');
          }
        }
      } catch (error) {
        console.error('Error playing audio:', error);
        setError('Không thể phát audio, vui lòng thử lại');
      }
    }
  };

  // Thay đổi volume
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Thay đổi thời gian phát
  const handleTimeChange = (e) => {
    const newTime = parseFloat(e.target.value);
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
    };
  }, []);

  return (
    <div className={`flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 p-3 sm:p-4 rounded-lg ${isOwn ? 'bg-blue-500/20' : 'bg-gray-700/50'}`}>
      {/* Play/Pause Button - Mobile optimized */}
      <button
        onClick={togglePlay}
        className={`p-3 sm:p-2 rounded-full transition-colors shadow-lg ${
          isOwn 
            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
            : 'bg-gray-600 hover:bg-gray-500 text-white'
        }`}
        disabled={error}
      >
        {isPlaying ? <PauseIcon className="w-5 h-5 sm:w-4 sm:h-4" /> : <PlayIcon className="w-5 h-5 sm:w-4 sm:h-4" />}
      </button>

      <div className="flex-1 w-full space-y-2 sm:space-y-1">
        {/* Progress bar - Mobile optimized */}
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleTimeChange}
            className="flex-1 h-2 sm:h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, ${isOwn ? '#3b82f6' : '#6b7280'} 0%, ${isOwn ? '#3b82f6' : '#6b7280'} ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`
            }}
          />
          <span className="text-xs text-gray-400 min-w-[40px] text-center">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Volume control - Hidden on mobile to save space */}
        <div className="hidden sm:flex items-center space-x-2">
          <SpeakerWaveIcon className="w-3 h-3 text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>

      {/* Waveform visualization - Mobile optimized */}
      <div className="flex items-center space-x-1">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`w-1 sm:w-0.5 rounded-full transition-all duration-300 ${
              isPlaying && i < (currentTime / duration) * 20
                ? isOwn ? 'bg-blue-300' : 'bg-gray-300'
                : isOwn ? 'bg-blue-500/30' : 'bg-gray-500/30'
            }`}
            style={{
              height: `${Math.random() * 20 + 8}px`
            }}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-400 text-xs mt-2 text-center">
          {error}
        </div>
      )}

      {/* Hidden audio element with mobile-optimized attributes */}
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
          setCurrentTime(0);
        }}
        onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
        onError={(e) => {
          console.error('Audio error:', e);
          setError('Không thể tải audio');
        }}
        onCanPlay={() => setError(null)}
      />
    </div>
  );
};

export default VoicePlayer; 