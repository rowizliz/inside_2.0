import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon, SpeakerWaveIcon } from '@heroicons/react/24/solid';

const VoicePlayer = ({ audioUrl, isOwn = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const audioRef = useRef(null);
  const timerRef = useRef(null);

  // Format thời gian
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Phát/dừng audio
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
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
    <div className={`flex items-center space-x-3 p-3 rounded-lg ${isOwn ? 'bg-blue-500/20' : 'bg-gray-700/50'}`}>
      <button
        onClick={togglePlay}
        className={`p-2 rounded-full transition-colors ${
          isOwn 
            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
            : 'bg-gray-600 hover:bg-gray-500 text-white'
        }`}
      >
        {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
      </button>

      <div className="flex-1 space-y-1">
        {/* Progress bar */}
        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleTimeChange}
            className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, ${isOwn ? '#3b82f6' : '#6b7280'} 0%, ${isOwn ? '#3b82f6' : '#6b7280'} ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`
            }}
          />
          <span className="text-xs text-gray-400 min-w-[40px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Volume control */}
        <div className="flex items-center space-x-2">
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

      {/* Waveform visualization */}
      <div className="flex items-center space-x-1">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`w-0.5 rounded-full transition-all duration-300 ${
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

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={() => setDuration(audioRef.current.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
      />
    </div>
  );
};

export default VoicePlayer; 