import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lock, AlertCircle } from 'lucide-react';

const ForceChangePasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const response = await axios.post(
        `${apiUrl}/api/auth/change-password`,
        {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        },
        config
      );

      if (response.data.success) {
        toast.success('Password changed successfully!');
        
        // Redirect to appropriate dashboard based on role
        const user = JSON.parse(localStorage.getItem('user'));
        const redirectPath = user?.role === 'admin' ? '/admin' : 
                           user?.role === 'maintenance_staff' ? '/maintenance' : 
                           '/tenant';
        
        setTimeout(() => navigate(redirectPath), 1500);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to change password';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-amber-100 p-3 rounded-lg">
            <AlertCircle size={32} className="text-amber-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Set New Password</h1>
        <p className="text-slate-600 text-center mb-6">
          This is your first login. Please set a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 font-medium mb-2">Current Password</label>
            <div className="relative">
              <Lock size={20} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Enter your current password"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-2">New Password</label>
            <div className="relative">
              <Lock size={20} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Enter new password"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-2">Confirm New Password</label>
            <div className="relative">
              <Lock size={20} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-6 text-center">
          Password must be at least 6 characters and different from your current password.
        </p>
      </div>
    </div>
  );
};

export default ForceChangePasswordPage;
