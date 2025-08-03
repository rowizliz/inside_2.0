import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('initial'); // initial | exchanging | ready | updating | success | error
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Khi detectSessionInUrl=true, Supabase sẽ tự đọc hash (#) lúc khởi tạo client.
        // Tuy nhiên, để chắc chắn, ta thử thêm bước kiểm tra sự kiện recovery từ URL.
        setStatus('exchanging');
        const url = new URL(window.location.href);
        const hash = url.hash || '';
        const search = url.search || '';

        console.log('[ResetPassword] location.search:', search);
        console.log('[ResetPassword] location.hash:', hash);

        // Với Supabase v2, khi type=recovery trong hash và detectSessionInUrl=true,
        // client sẽ tự xử lý và phát sinh session. Ta kiểm tra session hiện tại.
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[ResetPassword] session after init:', session);

        // Nếu chưa có session (một số trường hợp trình duyệt chặn), thử gọi exchangeCodeForSession (nếu có mã trong URL).
        // Supabase v2 hỗ trợ exchange code qua URL hiện tại.
        if (!session) {
          try {
            console.log('[ResetPassword] Trying exchangeCodeForSession...');
            await supabase.auth.exchangeCodeForSession(window.location.href);
            const { data: { session: s2 } } = await supabase.auth.getSession();
            console.log('[ResetPassword] session after exchange:', s2);
          } catch (ex) {
            console.warn('[ResetPassword] exchangeCodeForSession error (non-fatal):', ex);
          }
        }

        setStatus('ready');
        setMessage('Vui lòng nhập mật khẩu mới của bạn.');
      } catch (err) {
        console.error('[ResetPassword] init error:', err);
        setStatus('error');
        setMessage('Không thể khởi tạo phiên đặt lại mật khẩu. Vui lòng thử lại liên kết trong email.');
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!password || !confirm) {
      setMessage('Vui lòng nhập đầy đủ mật khẩu.');
      return;
    }
    if (password !== confirm) {
      setMessage('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (password.length < 6) {
      setMessage('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    try {
      setStatus('updating');
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error('[ResetPassword] updateUser error:', error);
        setStatus('error');
        setMessage('Cập nhật mật khẩu thất bại: ' + error.message);
        return;
      }
      console.log('[ResetPassword] updateUser success:', data);
      setStatus('success');
      setMessage('Đổi mật khẩu thành công. Đang chuyển về trang đăng nhập...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      console.error('[ResetPassword] update error:', err);
      setStatus('error');
      setMessage('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const isBusy = status === 'exchanging' || status === 'updating';

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Đặt lại mật khẩu</h1>
          <p className="text-gray-400">Nhập mật khẩu mới cho tài khoản của bạn</p>
        </div>

        {message && (
          <div className="text-sm text-center mb-2 text-blue-400">{message}</div>
        )}

        {(status === 'initial' || status === 'exchanging') && (
          <div className="text-center text-gray-400">Đang chuẩn bị...</div>
        )}

        {(status === 'ready' || status === 'updating' || status === 'error') && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Mật khẩu mới"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Xác nhận mật khẩu mới"
                style={{ fontSize: '16px' }}
              />
            </div>
            <button
              disabled={isBusy}
              type="submit"
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'updating' ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        )}

        {status === 'success' && (
          <div className="text-center text-green-400">Thành công!</div>
        )}
      </div>
    </div>
  );
}