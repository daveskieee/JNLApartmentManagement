import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  
  useEffect(() => {
    // Redirect if not authenticated or not admin
    if (!token) {
      toast.error('Admin authentication required');
      navigate('/login');
      return;
    }
    if (user?.role !== 'admin') {
      toast.error('Only admins can create tenant accounts');
      navigate('/admin');
      return;
    }
  }, [token, user, navigate]);

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    phone: '',
    unitNumber: '',
    role: 'tenant'
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.fullName) {
      toast.error('Full name is required');
      return;
    }

    if (!formData.unitNumber) {
      toast.error('Unit number is required for tenant registration');
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const response = await axios.post(`${apiUrl}/api/auth/admin/create-tenant`, {
        email: formData.email,
        fullName: formData.fullName,
        phone: formData.phone,
        unitNumber: formData.unitNumber
      }, config);
      
      toast.success(response.data?.message || `Tenant ${formData.fullName} created successfully!`);
      setFormData({
        email: '',
        fullName: '',
        phone: '',
        unitNumber: '',
        role: 'tenant'
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create tenant account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen page-wrapper relative flex items-center justify-center p-4">
      <div className="card-base p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Tenant Account</h1>
        <p className="text-slate-600 mb-6">Admin - Create a new tenant account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 font-medium mb-2">Full Name</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-2">Unit Number *</label>
            <input
              type="text"
              name="unitNumber"
              value={formData.unitNumber}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., A-101, B-202"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-2">Phone (Optional)</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your phone number"
            />
          </div>

          <div className="card-soft p-3 rounded-lg">
            <p className="text-sm text-slate-500">
              <strong>Note:</strong> This page is restricted to administrators. A secure activation link will be emailed automatically so the tenant can create their own password.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full brand-button font-medium py-2 rounded-lg hover:opacity-95 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Tenant Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            <Link to="/admin" className="text-blue-600 hover:underline font-medium">
              Back to Admin Dashboard
            </Link>
          </p>
        </div>

        <Link to="/" className="block w-full mt-6 px-4 py-2 rounded-lg bg-[#c77b69] text-white border border-[#c77b69] shadow-sm hover:bg-[#9d5f51] transition font-semibold text-center">
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default RegisterPage;
