# 📞 Hướng dẫn sử dụng Video/Audio Call

## 🎯 Tính năng đã hoàn thành

### ✅ **1. Giao diện Video Call**
- Modal video call với giao diện đẹp
- Hiển thị video local và remote
- Nút toggle video/audio
- Nút kết thúc cuộc gọi
- Hiển thị trạng thái cuộc gọi

### ✅ **2. Lịch sử cuộc gọi**
- Bảng `call_history` trong Supabase
- Lưu thông tin: người gọi, người nhận, loại cuộc gọi, trạng thái, thời lượng
- Component `CallHistory` để xem lịch sử
- Nút hiển thị lịch sử trong chat

### ✅ **3. Tích hợp vào Chat**
- Nút video call và audio call trong chat header
- Chỉ hiển thị cho direct chat
- Tích hợp với hệ thống user hiện có

## 🚧 Tính năng cần hoàn thiện

### 🔄 **1. Signaling Server (WebSocket/Socket.io)**
```javascript
// Cần tạo server để:
- Kết nối WebSocket giữa các user
- Chuyển tiếp offer/answer giữa peers
- Chuyển tiếp ICE candidates
- Quản lý trạng thái cuộc gọi
```

### 🔄 **2. TURN Servers**
```javascript
// Thêm vào WebRTC configuration:
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Cần thêm TURN servers cho NAT traversal
  { urls: 'turn:your-turn-server.com:3478', username: 'username', credential: 'password' }
]
```

### 🔄 **3. Call Notifications**
```javascript
// Thông báo cuộc gọi đến:
- Push notifications
- Sound alerts
- In-app notifications
- Call screen overlay
```

### 🔄 **4. Call Controls**
```javascript
// Thêm các tính năng:
- Hold call
- Mute/unmute
- Switch camera
- Screen sharing
- Call recording
```

## 📋 Các bước tiếp theo

### 1. **Tạo Signaling Server**
```bash
# Tạo thư mục server
mkdir video-call-server
cd video-call-server

# Khởi tạo Node.js project
npm init -y

# Cài đặt dependencies
npm install express socket.io cors dotenv
```

### 2. **Cấu hình TURN Server**
```bash
# Sử dụng coturn hoặc Twilio TURN
# Cấu hình trong .env:
TURN_SERVER_URL=your-turn-server.com
TURN_USERNAME=username
TURN_PASSWORD=password
```

### 3. **Tích hợp với React App**
```javascript
// Trong VideoCall.js:
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

// Kết nối signaling
socket.emit('join', { userId: currentUser.id });
socket.on('offer', handleOffer);
socket.on('answer', handleAnswer);
socket.on('ice-candidate', handleIceCandidate);
```

## 🎯 Kết quả hiện tại

### ✅ **Đã hoàn thành:**
1. ✅ Giao diện video call đẹp và responsive
2. ✅ Lưu lịch sử cuộc gọi vào database
3. ✅ Hiển thị lịch sử cuộc gọi
4. ✅ Tích hợp nút call vào chat
5. ✅ Xử lý media streams (video/audio)
6. ✅ Toggle video/audio controls

### 🔄 **Đang phát triển:**
1. 🔄 Signaling server để kết nối peers
2. 🔄 TURN servers cho NAT traversal
3. 🔄 Call notifications
4. 🔄 Advanced call controls

## 🚀 Cách sử dụng hiện tại

1. **Mở chat với user khác**
2. **Click nút video/audio call** trong header
3. **Xem lịch sử cuộc gọi** bằng nút đồng hồ
4. **Test giao diện** (chưa có kết nối thực)

## 📝 Ghi chú

- Hiện tại chỉ có giao diện, chưa có kết nối thực
- Cần signaling server để hoàn thiện tính năng
- Database `call_history` đã sẵn sàng để lưu dữ liệu
- Tất cả UI/UX đã được thiết kế và implement

---

**Trạng thái:** 70% hoàn thành (UI/UX + Database)  
**Tiếp theo:** Signaling Server + TURN Servers 