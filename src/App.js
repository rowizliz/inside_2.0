import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CallManagerProvider } from './context/CallManager';
import GlobalCallListener from './components/GlobalCallListener';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import VideoCallTest from './components/VideoCallTest';
import VideoCallSimple2 from './components/VideoCallSimple2';
import VideoCallBasic from './components/VideoCallBasic';
import VideoCallNative from './components/VideoCallNative';
import SimpleVideoTest from './components/SimpleVideoTest';
import DebugVideoTest from './components/DebugVideoTest';
import WorkingVideoCall from './components/WorkingVideoCall';
import ResetPassword from './pages/ResetPassword';
import './App.css';
import './styles/VideoCall.css';

import supabase from './supabase';

function RecoveryGate({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pathname = window.location?.pathname || '';
        const hash = window.location?.hash || '';
        const isRecoveryPath = pathname === '/reset-password' && hash.includes('type=recovery');

        if (!isRecoveryPath) {
          setReady(true);
          return;
        }

        // Thử lấy session sau init (detectSessionInUrl=true có thể đã xử lý)
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Chủ động trao đổi code từ URL hiện tại để tạo session
          try {
            await supabase.auth.exchangeCodeForSession(window.location.href);
          } catch (ex) {
            // Không fail app, vẫn tiếp tục để trang ResetPassword xử lý tiếp
            console.warn('[RecoveryGate] exchangeCodeForSession error:', ex);
          }
        }
      } catch (err) {
        console.warn('[RecoveryGate] init error:', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Đang chuẩn bị phiên khôi phục...</div>
      </div>
    );
  }

  return children;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <RecoveryGate>
          <div className="App">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              {/* Trang đặt lại mật khẩu - KHÔNG bảo vệ bởi ProtectedRoute */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/video-call-test" element={<VideoCallTest />} />
              <Route path="/video-call-simple2" element={<VideoCallSimple2 />} />
              <Route path="/video-call-basic" element={<VideoCallBasic />} />
              <Route path="/video-call-native" element={<VideoCallNative />} />
              <Route path="/simple-video-test" element={<SimpleVideoTest />} />
              <Route path="/debug-video-test" element={<DebugVideoTest />} />
              <Route path="/working-video-call" element={<WorkingVideoCall />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <CallManagerProvider>
                      <GlobalCallListener />
                      <Home />
                    </CallManagerProvider>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </RecoveryGate>
      </AuthProvider>
    </Router>
  );
}

export default App;
