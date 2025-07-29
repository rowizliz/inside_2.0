# Hướng dẫn khắc phục lỗi Upload Ảnh/Video

## 1. Cập nhật Firebase Storage Security Rules

Vào Firebase Console và thực hiện các bước sau:

1. Truy cập [Firebase Console](https://console.firebase.google.com)
2. Chọn project "test-simple-123"
3. Vào **Storage** từ menu bên trái
4. Click vào tab **Rules**
5. Thay thế rules hiện tại bằng:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{allPaths=**} {
      // Cho phép user đã đăng nhập đọc và ghi
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 100 * 1024 * 1024 // Max 100MB
        && request.resource.contentType.matches('(image|video)/.*');
    }
  }
}
```

6. Click **Publish** để lưu thay đổi

## 2. Cấu hình CORS cho Firebase Storage (nếu cần)

Nếu vẫn gặp lỗi CORS, thực hiện các bước sau:

1. Cài đặt Google Cloud SDK nếu chưa có:
   ```bash
   # macOS
   brew install google-cloud-sdk
   ```

2. Đăng nhập vào Google Cloud:
   ```bash
   gcloud auth login
   ```

3. Set project:
   ```bash
   gcloud config set project test-simple-123
   ```

4. Apply CORS configuration:
   ```bash
   gsutil cors set cors.json gs://test-simple-123.appspot.com
   ```

## 3. Các cải tiến đã thêm vào code

### ✅ Validation file
- Kiểm tra định dạng file (chỉ cho phép ảnh và video)
- Giới hạn kích thước: 50MB cho ảnh, 100MB cho video
- Hiển thị kích thước file trong preview

### ✅ Error handling
- Xử lý các lỗi Firebase Storage cụ thể
- Hiển thị thông báo lỗi thân thiện với người dùng
- Clear error khi user thử lại

### ✅ Metadata
- Thêm metadata khi upload (user ID, timestamp)
- Tạo filename unique với user ID và timestamp

## 4. Test Upload

1. Đăng nhập vào app
2. Thử upload một ảnh nhỏ (< 5MB) trước
3. Kiểm tra console log nếu có lỗi
4. Nếu thành công, thử với video

## 5. Troubleshooting

### Lỗi "storage/unauthorized"
- Kiểm tra lại Security Rules
- Đảm bảo user đã đăng nhập
- Kiểm tra token authentication còn hạn

### Lỗi CORS
- Apply CORS configuration như hướng dẫn ở bước 2
- Clear browser cache
- Thử ở incognito mode

### Lỗi "net::ERR_FAILED"
- Kiểm tra kết nối internet
- Kiểm tra Firebase project còn active
- Kiểm tra quota Firebase Storage

## 6. Monitoring

Theo dõi upload trong Firebase Console:
1. Storage > Files: Xem các file đã upload
2. Storage > Usage: Kiểm tra dung lượng sử dụng
3. Firestore > Data: Xem các post đã tạo

## Support

Nếu vẫn gặp vấn đề, kiểm tra:
- Browser Console (F12)
- Network tab để xem request details
- Firebase Console > Storage > Usage logs
