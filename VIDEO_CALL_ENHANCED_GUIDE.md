# 🎥 Enhanced Video Call Testing Guide

## Tính năng mới đã được thêm vào:

### ✨ Cải tiến chính:
- **Simple-peer phiên bản mới nhất** với cấu hình tối ưu
- **Signaling server Socket.IO** ổn định và đáng tin cậy
- **Auto-reconnection** khi mất kết nối
- **Connection quality monitoring** theo thời gian thực
- **Adaptive media settings** dựa trên chất lượng kết nối
- **Screen sharing** với khả năng chuyển đổi mượt mà
- **In-call chat** với UI hiện đại
- **Advanced settings panel** để tùy chỉnh chất lượng

### 🛠️ Cách test:

#### 1. Khởi động Signaling Server:
```bash
# Chạy script tự động
./start-signaling-server.sh

# Hoặc chạy thủ công
cd signaling-server-new
npm start
```

#### 2. Khởi động React App:
```bash
npm start
```

#### 3. Test Video Call:

**Bước 1: Mở 2 tab/cửa sổ browser**
- Tab 1: http://localhost:3001 (User A)
- Tab 2: http://localhost:3001 (User B)

**Bước 2: Đăng nhập 2 users khác nhau**

**Bước 3: Bắt đầu video call**
- User A gọi User B
- Kiểm tra camera/mic permissions
- Chờ kết nối WebRTC

**Bước 4: Test các tính năng:**

✅ **Basic Controls:**
- Bật/tắt camera (📹/📷)
- Bật/tắt mic (🎤/🔇)
- Kết thúc cuộc gọi (📞)

✅ **Screen Sharing:**
- Click nút chia sẻ màn hình (🖥️)
- Chọn màn hình/cửa sổ để chia sẻ
- Kiểm tra video chuyển từ camera sang screen
- Click lại để dừng chia sẻ

✅ **In-call Chat:**
- Click nút chat (💬)
- Gửi tin nhắn giữa 2 users
- Kiểm tra notification badge
- Test real-time messaging

✅ **Settings Panel:**
- Click nút settings (⚙️)
- Thay đổi chất lượng video (Low/Medium/High)
- Thay đổi chất lượng audio
- Bật/tắt echo cancellation, noise suppression
- Thay đổi bandwidth settings

✅ **Connection Quality:**
- Kiểm tra indicator chất lượng kết nối
- Test trong điều kiện mạng yếu
- Kiểm tra auto-reconnection

### 🔧 Troubleshooting:

#### Lỗi thường gặp:

**1. "Permission denied" cho camera/mic:**
```
Giải pháp: Cho phép truy cập camera/mic trong browser settings
Chrome: Settings > Privacy > Site Settings > Camera/Microphone
```

**2. "Connection failed":**
```
Kiểm tra:
- Signaling server có đang chạy không (port 3000)
- Firewall có block không
- Network connectivity
```

**3. "Peer connection error":**
```
Thử:
- Refresh browser
- Clear browser cache
- Kiểm tra console logs
```

**4. Screen sharing không hoạt động:**
```
Yêu cầu:
- HTTPS hoặc localhost
- Browser hỗ trợ getDisplayMedia API
- Permissions cho screen capture
```

### 📊 Monitoring:

#### Health Check Endpoints:
- **Health**: http://localhost:3000/health
- **Stats**: http://localhost:3000/stats

#### Console Logs để theo dõi:
```javascript
// Browser Console
🎥 Starting enhanced video call...
✅ Got local stream with tracks: ['video', 'audio']
📡 Connecting to signaling server...
✅ Socket connected to signaling server
🔗 Creating peer connection - initiator: true
✅ Peer connection established
📺 Received remote stream with tracks: ['video', 'audio']
```

#### Server Logs:
```
🚀 Signaling server running on port 3000
🔌 New connection: abc123
👤 User user1 wants to join room user1-user2
✅ User user1 joined room user1-user2
📡 Relaying signal from user1 in room user1-user2
```

### 🎯 Performance Tips:

1. **Cho kết nối chậm:**
   - Chọn video quality "Low"
   - Tắt một số audio enhancements
   - Sử dụng bandwidth "low"

2. **Cho chất lượng tốt nhất:**
   - Chọn video quality "High"
   - Bật tất cả audio enhancements
   - Sử dụng bandwidth "high"

3. **Tiết kiệm CPU:**
   - Giảm frame rate
   - Sử dụng resolution thấp hơn
   - Tắt noise suppression nếu không cần

### 🚀 Production Deployment:

#### Signaling Server:
```bash
# Deploy to cloud service (Railway, Heroku, etc.)
# Update CORS origins in signaling-server.js
# Set environment variables
```

#### React App:
```bash
# Update socket connection URL in VideoCall.js
# Build for production
npm run build
```

### 📝 Notes:

- Tính năng này yêu cầu HTTPS trong production
- WebRTC hoạt động tốt nhất với symmetric NAT
- Có thể cần TURN server cho một số network configurations
- Test trên nhiều browsers khác nhau (Chrome, Firefox, Safari)
