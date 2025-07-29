# Hướng dẫn Enable Firebase Storage

## Bước 1: Enable Firebase Storage trong Console

1. Vào [Firebase Console](https://console.firebase.google.com)
2. Chọn project "test-simple-123"
3. Click vào **Build** > **Storage** từ menu bên trái
4. Nếu Storage chưa được enable, click **"Get Started"**
5. Chọn location gần nhất (ví dụ: asia-southeast1)
6. Click **"Done"**

## Bước 2: Cập nhật Security Rules

Sau khi enable Storage, vào tab **Rules** và thay thế bằng:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // Cho phép đọc công khai
      allow read: if true;
      // Chỉ cho phép user đã đăng nhập upload
      allow write: if request.auth != null;
    }
  }
}
```

Click **Publish** để lưu.

## Bước 3: Test Upload với Rules đơn giản

Nếu vẫn lỗi, thử với rules tạm thời này (CHỈ ĐỂ TEST):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **CẢNH BÁO**: Rules này cho phép mọi người upload. Chỉ dùng để test!

## Bước 4: Kiểm tra Quota

1. Vào **Project Settings** > **Usage and billing**
2. Kiểm tra xem có vượt quota không
3. Firebase Free tier cho phép:
   - 5GB storage
   - 1GB/day download
   - 20K/day upload operations

## Bước 5: Debug trong Browser

1. Mở Chrome DevTools (F12)
2. Vào tab **Network**
3. Thử upload file
4. Tìm request failed và xem chi tiết lỗi

## Bước 6: Kiểm tra Authentication

Đảm bảo user đã đăng nhập trước khi upload:
- Check `currentUser` không null
- Token chưa hết hạn

## Troubleshooting

### Lỗi "storage/unauthorized"
- User chưa đăng nhập
- Rules quá strict
- Token hết hạn

### Lỗi "storage/unauthenticated"  
- Firebase Auth không được config đúng
- User session expired

### Lỗi "storage/quota-exceeded"
- Vượt quota free tier
- Cần upgrade plan

### Lỗi CORS
- Chạy lệnh sau với gcloud CLI:
```bash
gsutil cors set cors.json gs://test-simple-123.appspot.com
