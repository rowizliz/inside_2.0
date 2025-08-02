import React from 'react';
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
import './App.css';
import './styles/VideoCall.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
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
      </AuthProvider>
    </Router>
  );
}

export default App;
