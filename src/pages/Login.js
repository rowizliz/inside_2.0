import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const supabase = require('../supabase').default;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (error) {
      let errorMessage = 'Đăng nhập thất bại. ';
      switch(error.message) {
        case 'Invalid login credentials':
          errorMessage += 'Email hoặc mật khẩu không đúng.';
          break;
        case 'Email not confirmed':
          errorMessage += 'Email chưa được xác nhận.';
          break;
        case 'Too many requests':
          errorMessage += 'Quá nhiều lần thử. Vui lòng đợi.';
          break;
        default:
          errorMessage += error.message;
      }
      setError(errorMessage);
    }
    setLoading(false);
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setForgotMsg('');
    setError('');
    try {
      if (!forgotEmail) {
        setForgotMsg('Vui lòng nhập email.');
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin + '/reset-password'
      });
      if (error) {
        setForgotMsg('Gửi email thất bại: ' + error.message);
      } else {
        setForgotMsg('Đã gửi email đặt lại mật khẩu! Vui lòng kiểm tra hộp thư.');
      }
    } catch (err) {
      setForgotMsg('Có lỗi xảy ra: ' + err.message);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">INSIDE</h1>
          <div className="text-base md:text-lg text-white font-semibold mb-1">Mạng xã hội dành cho người hướng nội</div>
          <div className="text-gray-400 mb-2">Đăng nhập để chúng ta cùng kết nối</div>
        </div>
        {showForgot ? (
          <form className="space-y-6" onSubmit={handleForgotPassword}>
            <div className="text-center text-white font-semibold text-lg mb-2">Quên mật khẩu</div>
            {forgotMsg && <div className="text-sm text-center mb-2 text-blue-400">{forgotMsg}</div>}
            <input
              type="email"
              required
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Nhập email của bạn"
              style={{ fontSize: '16px' }}
            />
            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Gửi link đặt lại mật khẩu
            </button>
            <div className="text-center mt-2">
              <button type="button" onClick={() => setShowForgot(false)} className="text-gray-400 hover:text-blue-400 text-sm">Quay lại đăng nhập</button>
            </div>
          </form>
        ) : (
        <>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
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
          </div>
          <button
            disabled={loading}
            type="submit"
            className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
          <div className="text-right mt-2">
            <button type="button" onClick={() => setShowForgot(true)} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">Quên mật khẩu?</button>
          </div>
        </form>
        <div className="text-center">
          <p className="text-gray-400">
            Chưa có tài khoản?{' '}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
              Đăng ký ngay
            </Link>
          </p>
        </div>
        </>
        )}
      </div>
    </div>
  );
} 
