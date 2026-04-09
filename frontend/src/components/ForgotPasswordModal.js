import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Mail } from 'lucide-react';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await axios.post(`${apiUrl}/api/auth/forgot-password`, { email });

      if (response.data.success) {
        toast.success('Password reset link sent to your email');
        
        // In development, we get the token directly for testing
        if (response.data.resetToken) {
          setResetToken(response.data.resetToken);
          toast.success(`Reset token (for testing): ${response.data.resetToken}`);
        }
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          setEmail('');
          setResetToken(null);
          onClose();
        }, 3000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to send reset link';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={24} className="text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-slate-600 mb-4">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <div>
            <label className="block text-slate-700 font-medium mb-2">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <Mail size={20} className="text-slate-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                style={{ paddingLeft: '3.25rem' }}
                placeholder="your@email.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-600">
          <p>Remember your password? <button onClick={onClose} className="text-indigo-600 hover:underline font-semibold">Back to login</button></p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
