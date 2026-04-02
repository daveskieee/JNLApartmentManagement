import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AuthContext from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prefer using AuthContext.login when available so AuthContext state updates immediately
      if (login) {
        try {
          const data = await login(email, password);
          // login() already stores token/user in localStorage and sets context state
          toast.success('Login successful!');
          const userObj = data.user || data?.data?.user;
          if (userObj?.role === 'admin') {
            navigate('/admin');
          } else if (userObj?.role === 'maintenance' || userObj?.role === 'maintenance_staff') {
            navigate('/maintenance');
          } else {
            navigate('/tenant');
          }
          return;
        } catch (ctxErr) {
          console.warn('AuthContext login failed, falling back to direct request:', ctxErr?.response || ctxErr?.message || ctxErr);
          // continue to fallback to relative axios call
        }
      }

      // Fallback: direct POST (works with proxy)
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      console.log('Login response:', response?.data);
      const { token, user } = response.data;

      if (!token || !user) {
        console.error('Login response missing token/user:', response.data);
        toast.error('Login failed: invalid server response');
        setLoading(false);
        return;
      }
      
      // Store in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userName', user.fullName || user.full_name || user.name || 'User');

      // Try to update AuthContext state so the rest of the app knows we're logged in
      try {
        if (login) await login(email, password);
      } catch (e) {
        console.warn('Secondary AuthContext update failed:', e);
      }

      toast.success('Login successful!');

      // Navigate based on role
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'maintenance' || user.role === 'maintenance_staff') {
        navigate('/maintenance');
      } else {
        navigate('/tenant');
      }
    } catch (error) {
      console.error('Login error:', error.response || error.message || error);
      const serverMsg = error.response?.data?.message || error.response?.data || error.message || 'Login failed';
      toast.error(typeof serverMsg === 'string' ? serverMsg : 'Login failed (see console)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background with Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600"></div>
      
      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>
      
      {/* Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-xl p-4 mb-4 shadow-2xl hover:shadow-3xl transition-shadow duration-300 transform hover:scale-105">
            <span className="text-blue-600 font-bold text-3xl">PM</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">Property Manager</h1>
          <p className="text-blue-100 text-lg drop-shadow-md">Manage your property with ease</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 backdrop-blur-sm border border-white border-opacity-20">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Welcome Back</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Email Address
              </label>
              <div className="relative">
                <Mail size={20} className="absolute left-4 top-4 text-blue-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-gray-50 hover:bg-gray-100"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Password
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-4 top-4 text-blue-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-gray-50 hover:bg-gray-100"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-gray-400 hover:text-blue-500 transition"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transform hover:scale-105 active:scale-95"
            >
              <LogIn size={20} />
              <span>{loading ? 'Logging in...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Register Link */}
          <p className="text-center text-gray-600 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
