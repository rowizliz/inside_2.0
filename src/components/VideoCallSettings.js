import React, { useState, useEffect } from 'react';

const VideoCallSettings = ({ onSettingsChange, currentSettings }) => {
  const [settings, setSettings] = useState({
    videoQuality: 'medium',
    audioQuality: 'high',
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    bandwidth: 'auto',
    ...currentSettings
  });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  // Removed unused variables to fix ESLint warnings

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '60px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          cursor: 'pointer',
          fontSize: '18px'
        }}
        title="Cài đặt"
      >
        ⚙️
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      backgroundColor: 'white',
      borderRadius: '10px',
      padding: '20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: '300px',
      zIndex: 1001
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0 }}>Cài đặt cuộc gọi</h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
          Chất lượng video:
        </label>
        <select
          value={settings.videoQuality}
          onChange={(e) => handleSettingChange('videoQuality', e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '5px',
            border: '1px solid #ddd'
          }}
        >
          <option value="low">Thấp (320p, 15fps)</option>
          <option value="medium">Trung bình (480p, 24fps)</option>
          <option value="high">Cao (720p, 30fps)</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
          Chất lượng âm thanh:
        </label>
        <select
          value={settings.audioQuality}
          onChange={(e) => handleSettingChange('audioQuality', e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '5px',
            border: '1px solid #ddd'
          }}
        >
          <option value="low">Thấp (16kHz, Mono)</option>
          <option value="medium">Trung bình (44kHz, Mono)</option>
          <option value="high">Cao (48kHz, Stereo)</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
          Băng thông:
        </label>
        <select
          value={settings.bandwidth}
          onChange={(e) => handleSettingChange('bandwidth', e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '5px',
            border: '1px solid #ddd'
          }}
        >
          <option value="auto">Tự động</option>
          <option value="low">Thấp (tiết kiệm data)</option>
          <option value="high">Cao (chất lượng tốt nhất)</option>
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={settings.echoCancellation}
            onChange={(e) => handleSettingChange('echoCancellation', e.target.checked)}
          />
          Khử tiếng vọng
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={settings.noiseSuppression}
            onChange={(e) => handleSettingChange('noiseSuppression', e.target.checked)}
          />
          Khử tạp âm
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={settings.autoGainControl}
            onChange={(e) => handleSettingChange('autoGainControl', e.target.checked)}
          />
          Tự động điều chỉnh âm lượng
        </label>
      </div>

      <div style={{
        fontSize: '12px',
        color: '#666',
        backgroundColor: '#f8f9fa',
        padding: '10px',
        borderRadius: '5px'
      }}>
        💡 Tip: Chọn chất lượng thấp hơn nếu kết nối không ổn định
      </div>
    </div>
  );
};

export default VideoCallSettings;
