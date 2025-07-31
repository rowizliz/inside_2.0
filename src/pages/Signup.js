import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const supabase = require('../supabase').default;

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { signup, forceRefreshAvatar } = useAuth();
  const navigate = useNavigate();

  // Resize/crop ảnh về 250x250 JPEG
  async function resizeImageTo250(file) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 250;
        canvas.height = 250;
        const ctx = canvas.getContext('2d');
        // Crop center
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 250, 250);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Resize failed'));
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!avatarFile) {
      setError('Please upload avatar!');
      return;
    }
    if (password !== confirmPassword) {
      return setError('Mật khẩu không khớp');
    }
    if (password.length < 6) {
      return setError('Mật khẩu phải có ít nhất 6 ký tự');
    }
    try {
      setError('');
      setLoading(true);
      // Resize/crop avatar về 250x250 JPEG
      const resizedBlob = await resizeImageTo250(avatarFile);
      // Định dạng tên file: avatar_(tên user, không dấu, chỉ chữ/số/_)
      let rawName = displayName || email.split('@')[0] || 'user';
      let safeName = rawName
        .toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9_]/g, '_');
      const fileName = `avatar_${safeName}.jpg`;
      // Upload lên Supabase Storage, overwrite (upsert: true)
      const { data: uploadData, error: uploadError } = await supabase.storage.from('avatars').upload(fileName, resizedBlob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      // Lấy signed URL 10000 năm
      const expireSeconds = 10000 * 365 * 24 * 60 * 60;
      const { data: urlData, error: urlError } = await supabase.storage.from('avatars').createSignedUrl(fileName, expireSeconds);
      if (urlError) throw urlError;
      const avatarUrl = urlData.signedUrl;
      await signup(email, password, displayName, avatarUrl);
      
      // Refresh avatar globally after signup
              await forceRefreshAvatar();
      
      setShowSuccessModal(true);
    } catch (error) {
      let errorMessage = 'Đăng ký thất bại. Vui lòng thử lại.';
      if (error.message === 'User already registered') {
        errorMessage = 'Email này đã được sử dụng.';
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Email không hợp lệ.';
      } else if (error.message.includes('Password')) {
        errorMessage = 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.';
      } else if (error.message.includes('bucket')) {
        errorMessage = 'Lỗi upload ảnh đại diện.';
      }
      setError(errorMessage);
    }
    setLoading(false);
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 tracking-wide">INSIDE</h1>
          <h1 className="text-base md:text-xl font-semibold text-white mb-2 break-words whitespace-normal">[Mạng xã hội dành cho người hướng nội]</h1>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            {/* Upload avatar */}
            <div className="flex flex-col items-center">
              <div className="relative group mb-2">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="avatar preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-blue-500 cursor-pointer"
                    onClick={() => document.getElementById('avatarInput').click()}
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border-2 border-gray-700 cursor-pointer"
                    onClick={() => document.getElementById('avatarInput').click()}
                  >Chưa chọn</div>
                )}
                {/* Overlay icon camera */}
                <div
                  className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer group-hover:scale-110 transition"
                  onClick={() => document.getElementById('avatarInput').click()}
                  title="Chọn ảnh đại diện"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75v-7.5A2.25 2.25 0 014.5 6h2.379a1.5 1.5 0 001.06-.44l1.122-1.122A1.5 1.5 0 0110.621 4.5h2.758a1.5 1.5 0 011.06.44l1.122 1.122a1.5 1.5 0 001.06.44H19.5a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-15A2.25 2.25 0 012.25 15.75z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                {/* Dấu * đỏ */}
                {!avatarPreview && (
                  <span className="absolute -top-1 -right-1 text-red-500 text-lg font-bold select-none">*</span>
                )}
                <input
                  id="avatarInput"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>
            <div>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Tên hiển thị"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Email"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Mật khẩu"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Xác nhận mật khẩu"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>
          <button
            disabled={loading}
            type="submit"
            className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>
        <div className="text-center">
          <p className="text-gray-400">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
        {/* Modal thông báo xác nhận email */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-[#18181b] rounded-2xl shadow-xl p-8 max-w-sm w-full text-center border border-blue-500">
              <div className="text-2xl text-blue-400 font-bold mb-4">Đăng ký thành công!</div>
              <div className="text-white mb-2">Vui lòng kiểm tra email của bạn để xác nhận tài khoản.</div>
              <div className="text-gray-400 text-sm mb-4">Email xác nhận được gửi từ Supabase Auth.<br/>Hãy kiểm tra cả mục <b>Spam</b>/<b>Quảng cáo</b> nếu không thấy trong hộp thư chính.</div>
              <button
                className="mt-2 px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                onClick={() => { setShowSuccessModal(false); navigate('/login'); }}
              >
                Đã hiểu, về trang đăng nhập
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
