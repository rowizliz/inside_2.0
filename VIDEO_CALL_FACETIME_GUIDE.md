# Hướng dẫn Hệ thống Gọi Video giống FaceTime

## 🎯 Tổng quan

Hệ thống gọi video đã được nâng cấp với giao diện và trải nghiệm giống FaceTime, bao gồm:

- **Giao diện đẹp mắt** với hiệu ứng blur background
- **Thông báo cuộc gọi đến** toàn màn hình
- **Âm thanh chuông** và vibration trên mobile
- **Auto-hide controls** khi không sử dụng
- **Hiển thị thời gian cuộc gọi** và chất lượng kết nối
- **Picture-in-Picture** cho video local
- **Chuyển đổi camera** trên mobile

## 📦 Các Components Chính

### 1. **CallManager Context** (`src/context/CallManager.js`)
- Quản lý trạng thái cuộc gọi toàn cục
- Xử lý WebRTC connections
- Quản lý âm thanh chuông
- Kết nối với signaling server

### 2. **IncomingCallNotification** (`src/components/IncomingCallNotification.js`)
- UI thông báo cuộc gọi đến giống FaceTime
- Hiển thị avatar và tên người gọi
- Nút Accept/Decline với animations
- Vibration trên mobile

### 3. **VideoCallModal** (`src/components/VideoCallModal.js`)
- Giao diện video call toàn màn hình
- Auto-hide controls sau 3 giây
- Hiển thị thời gian và chất lượng cuộc gọi
- Hỗ trợ fullscreen mode
- Picture-in-Picture cho local video

### 4. **GlobalCallListener** (`src/components/GlobalCallListener.js`)
- Lắng nghe cuộc gọi đến trên toàn app
- Tự động hiển thị IncomingCallNotification
- Tự động mở VideoCallModal khi có cuộc gọi

## 🚀 Cách sử dụng

### 1. Cài đặt dependencies
```bash
# Frontend
npm install socket.io-client simple-peer

# Signaling server
cd signaling-server-new
npm install
```

### 2. Thêm âm thanh
Tạo các file âm thanh trong `public/sounds/`:
- `ringtone.mp3` - Nhạc chuông khi có cuộc gọi
- `connected.mp3` - Âm thanh khi kết nối thành công
- `busy.mp3` - Âm thanh khi bận/từ chối
- `ended.mp3` - Âm thanh khi kết thúc cuộc gọi

### 3. Khởi động servers
```bash
# Terminal 1: Signaling server
cd signaling-server-new
npm start

# Terminal 2: React app
npm start
```

### 4. Gọi video trong Chat
- Mở chat với một người dùng
- Click vào nút video call (📹) ở header
- Đợi người kia chấp nhận cuộc gọi

## 🎨 Tùy chỉnh giao diện

### CSS Variables
Các biến CSS có thể tùy chỉnh trong `src/styles/VideoCall.css`:

```css
:root {
  --call-primary-color: #007AFF;
  --call-danger-color: #FF3B30;
  --call-success-color: #34C759;
  --control-blur: 20px;
  --control-bg: rgba(255, 255, 255, 0.1);
}
```

### Animations
- `pulse-ring` - Hiệu ứng sóng khi có cuộc gọi
- `shake` - Rung avatar khi đang đổ chuông
- `fade-in` - Hiển thị mượt mà
- `slide-up` - Trượt lên từ dưới

## 🔧 Cấu hình

### Signaling Server
Cập nhật URL trong `src/context/CallManager.js`:
```javascript
const socket = io('http://localhost:3000', {
  // Thay đổi thành URL production
});
```

### ICE Servers
Thêm TURN servers cho production:
```javascript
config: {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:your-turn-server.com', 
      username: 'username',
      credential: 'password' 
    }
  ]
}
```

## 📱 Responsive Design

- **Desktop**: Video full screen với controls ở dưới
- **Tablet**: Tương tự desktop với controls nhỏ hơn
- **Mobile**: 
  - Local video nhỏ hơn (80x120px)
  - Controls nhỏ gọn
  - Hỗ trợ chuyển đổi camera trước/sau

## 🔊 Âm thanh

### Tắt/bật âm thanh
```javascript
// Trong Chat component
setSoundEnabled(!soundEnabled);
```

### Tùy chỉnh ringtone
Thay file `public/sounds/ringtone.mp3` bằng file khác

## 🐛 Debug

### Kiểm tra kết nối
1. Mở browser console
2. Xem logs với prefix:
   - 🔌 - Socket connections
   - 📞 - Call events
   - 📡 - WebRTC signals
   - ✅ - Success events
   - ❌ - Errors

### Test local
1. Mở 2 browser tabs
2. Login với 2 accounts khác nhau
3. Tạo chat giữa 2 accounts
4. Test gọi video

## 🚧 Known Issues

1. **Safari**: Cần enable WebRTC trong Develop menu
2. **Firefox**: Có thể cần cấp quyền camera/mic riêng
3. **Mobile browsers**: Một số browser không hỗ trợ đầy đủ WebRTC

## 🔮 Tính năng sắp tới

- [ ] Screen sharing
- [ ] Recording cuộc gọi
- [ ] Virtual backgrounds
- [ ] Live captions
- [ ] Group video calls
- [ ] Call history trong Supabase

## 📞 API Reference

### CallManager Methods

```javascript
const { 
  startOutgoingCall,    // Bắt đầu cuộc gọi
  acceptIncomingCall,   // Chấp nhận cuộc gọi
  rejectIncomingCall,   // Từ chối cuộc gọi
  endCall,              // Kết thúc cuộc gọi
  toggleVideo,          // Bật/tắt video
  toggleAudio,          // Bật/tắt audio
} = useCallManager();
```

### Events

- `incoming-call` - Có cuộc gọi đến
- `call-accepted` - Cuộc gọi được chấp nhận
- `call-rejected` - Cuộc gọi bị từ chối
- `call-ended` - Cuộc gọi kết thúc
- `signal` - WebRTC signaling

## 💡 Tips

1. **Chất lượng video**: Tự động điều chỉnh theo bandwidth
2. **Echo cancellation**: Đã được bật mặc định
3. **Noise suppression**: Có thể enable trong constraints
4. **Auto-gain control**: Giúp ổn định âm lượng

---

Đã phát triển bởi team với ❤️ để mang lại trải nghiệm gọi video tốt nhất!