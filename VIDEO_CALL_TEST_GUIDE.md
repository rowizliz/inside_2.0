# Hướng dẫn Test Video Call

## 🎯 Tình trạng hiện tại

Tính năng video call đã được cải thiện với:
- ✅ Debug logging chi tiết
- ✅ Realtime test components
- ✅ Simple video call implementation
- ✅ Cải thiện signaling channel

## 🧪 Cách test

### 1. Test Realtime Connection
1. Mở ứng dụng tại `http://localhost:3000`
2. Đăng nhập vào hệ thống
3. Vào phần Chat
4. Kiểm tra component "Realtime Test" ở góc trên bên phải
5. Gửi test message để kiểm tra Supabase Realtime hoạt động

### 2. Test Video Call Signaling
1. Mở component "Video Call Test" ở góc dưới bên trái
2. Copy User ID của bạn
3. Mở tab browser khác (hoặc incognito)
4. Đăng nhập với user khác
5. Paste User ID vào "Remote user ID"
6. Test các signal: Call Request, Offer, Answer

### 3. Test Video Call thực tế
1. Tạo chat riêng với user khác
2. Click nút video call (📹) trong header chat
3. Kiểm tra debug log trong video call interface
4. Cho phép quyền camera/microphone khi được hỏi

## 🔧 Debug Information

### Console Logs
Kiểm tra browser console để xem:
- `📡 Channel subscription status`
- `📤 Sending signal`
- `📥 Received event`
- `[VideoCall] Debug messages`

### Common Issues

#### 1. Realtime không hoạt động
- Kiểm tra Supabase project settings
- Đảm bảo Realtime được enable
- Kiểm tra network connection

#### 2. Video call không kết nối
- Cho phép quyền camera/microphone
- Kiểm tra STUN/TURN servers
- Thử trên Chrome/Safari thay vì browser khác

#### 3. Signaling không hoạt động
- Kiểm tra Supabase Realtime status
- Xem console logs cho errors
- Đảm bảo cả 2 users đều online

## 🛠️ Troubleshooting

### Nếu video call vẫn không hoạt động:

1. **Kiểm tra browser permissions:**
   ```
   Chrome: Settings > Privacy and security > Site Settings > Camera/Microphone
   Safari: Preferences > Websites > Camera/Microphone
   ```

2. **Test với 2 tabs cùng browser:**
   - Tab 1: User A
   - Tab 2: User B (incognito mode)
   - Tạo chat riêng và test video call

3. **Kiểm tra network:**
   - Tắt VPN nếu có
   - Thử trên mạng khác
   - Kiểm tra firewall settings

4. **Fallback to WebSocket server:**
   - Chạy signaling server: `node signaling-server.js`
   - Cập nhật code để sử dụng WebSocket thay vì Supabase

## 📝 Next Steps

Nếu test thành công:
- [ ] Chuyển về VideoCall component đầy đủ
- [ ] Thêm group video call
- [ ] Cải thiện UI/UX
- [ ] Thêm screen sharing

Nếu vẫn có vấn đề:
- [ ] Sử dụng WebSocket signaling server
- [ ] Kiểm tra Supabase configuration
- [ ] Test với TURN server riêng
