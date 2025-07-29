import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <div className="text-white text-xl">Đang tải...</div>
        <div className="text-gray-400 text-sm mt-2">Vui lòng đợi trong giây lát</div>
      </div>
    </div>
  );
} 