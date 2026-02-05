import React from 'react';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
    </div>
  );
}
