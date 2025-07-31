# Hướng dẫn Deploy Signaling Server

## Bước 1: Chuẩn bị files

Tạo một thư mục mới cho signaling server với 2 files:

### signaling-server.js
```js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const users = {};

wss.on('connection', function connection(ws) {
  console.log('New WebSocket connection');
  
  ws.on('message', function incoming(message) {
    let data;
    try {
      data = JSON.parse(message);
      console.log('Received message:', data.type, 'from:', data.userId || 'unknown');
    } catch (e) {
      console.error('Error parsing message:', e);
      return;
    }

    // Đăng ký userId cho mỗi kết nối
    if (data.type === 'register' && data.userId) {
      ws.userId = data.userId;
      users[data.userId] = ws;
      console.log('User registered:', data.userId);
      console.log('Active users:', Object.keys(users));
      return;
    }

    // Gửi signaling message tới user đích
    if (data.to && users[data.to]) {
      console.log('Forwarding message to:', data.to);
      users[data.to].send(JSON.stringify({ ...data, from: ws.userId }));
    } else if (data.to) {
      console.log('User not found:', data.to);
    }
  });

  ws.on('close', function () {
    if (ws.userId && users[ws.userId]) {
      delete users[ws.userId];
      console.log('User disconnected:', ws.userId);
      console.log('Active users:', Object.keys(users));
    }
  });

  ws.on('error', function (error) {
    console.error('WebSocket error:', error);
  });
});

console.log('WebSocket signaling server running on port', process.env.PORT || 8080);
```

### package.json
```json
{
  "name": "signaling-server",
  "version": "1.0.0",
  "main": "signaling-server.js",
  "scripts": {
    "start": "node signaling-server.js"
  },
  "dependencies": {
    "ws": "^8.14.2"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
```

## Bước 2: Deploy lên Cyclic (Miễn phí)

### Cách 1: Deploy trực tiếp từ GitHub

1. Tạo repo mới trên GitHub
2. Push 2 files trên vào repo
3. Vào [Cyclic](https://www.cyclic.sh/)
4. Đăng ký tài khoản (có thể dùng GitHub)
5. Click "Link Your Own"
6. Chọn repo vừa tạo
7. Deploy

### Cách 2: Deploy trực tiếp từ Cyclic

1. Vào [Cyclic](https://www.cyclic.sh/)
2. Click "Deploy Your Own"
3. Tạo app mới
4. Copy/paste code từ signaling-server.js
5. Thêm dependency "ws" trong package.json
6. Deploy

## Bước 3: Lấy URL WebSocket

Sau khi deploy thành công, bạn sẽ có URL dạng:
- `https://your-app-name.cyclic.app`

WebSocket URL sẽ là:
- `wss://your-app-name.cyclic.app`

## Bước 4: Cập nhật client

Trong file `src/components/VideoCall.js`, thay đổi:

```js
const SIGNALING_SERVER_URL = 'wss://your-app-name.cyclic.app';
```

## Bước 5: Test

1. Build lại app React
2. Mở 2 tab khác nhau với 2 tài khoản khác nhau
3. Thử gọi video call
4. Kiểm tra console để xem log WebSocket

## Troubleshooting

### Nếu WebSocket không kết nối được:
- Kiểm tra URL có đúng không
- Kiểm tra CORS nếu cần
- Thử dùng `https://` thay vì `wss://` (một số nền tảng tự chuyển đổi)

### Nếu deploy lỗi:
- Đảm bảo package.json có đúng dependency "ws"
- Đảm bảo Node.js version >= 14
- Kiểm tra log deploy để debug

## Các nền tảng miễn phí khác

Ngoài Cyclic, bạn có thể dùng:
- [Render](https://render.com/) - Free tier
- [Railway](https://railway.app/) - Free tier  
- [Glitch](https://glitch.com/) - Free
- [Heroku](https://heroku.com/) - Có free tier nhưng giới hạn 