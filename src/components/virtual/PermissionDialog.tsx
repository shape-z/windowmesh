import React from "react";

interface PermissionDialogProps {
  requestPermission: () => Promise<void>;
  computeWithoutPermission: () => void;
}

export function PermissionDialog({ requestPermission, computeWithoutPermission }: PermissionDialogProps) {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <div className="w-[500px] shadow-2xl border border-gray-700 bg-gray-900/95 text-white rounded-lg">
        <div className="text-center p-6">
          <h2 className="text-2xl font-bold text-white mb-2">Scan Monitor Layout</h2>
          <p className="text-lg text-gray-300">
            Choose an option to set the layout for your virtual world.
          </p>
        </div>
        <div className="space-y-6 pt-4 px-6 pb-6">
          <button onClick={requestPermission} className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium">
            Grant Permission and Scan All Monitors
          </button>
          <button onClick={computeWithoutPermission} className="w-full h-12 text-base border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-md font-medium">
            Continue Without Permission (Current Screen Only)
          </button>
        </div>
      </div>
    </div>
  );
}