import React from 'react';

const LoadingSpinner = ({ fullPage = true, message = 'Loading...' }) => {
  const spinnerContent = (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-12 h-12 mb-4">
        {/* Outer rotating ring */}
        <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
        {/* Spinning ring */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-400 animate-spin"></div>
      </div>
      <p className="text-gray-600 text-lg font-medium">{message}</p>
      <p className="text-gray-400 text-sm mt-2">Please wait...</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        {spinnerContent}
      </div>
    );
  }

  return (
    <div className="w-full py-12 flex justify-center">
      {spinnerContent}
    </div>
  );
};

export default LoadingSpinner;
