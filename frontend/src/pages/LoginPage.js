import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AuthContext from '../context/AuthContext';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState('Preparing dashboard...');
  const [redirectRoleLabel, setRedirectRoleLabel] = useState('Workspace');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const navigateByRoleWithTransition = async (userObj) => {
    const role = userObj?.role;
    const targetPath = role === 'admin'
      ? '/admin'
      : (role === 'maintenance' || role === 'maintenance_staff')
        ? '/maintenance'
        : '/tenant';

    const message = role === 'admin'
      ? 'Loading admin workspace...'
      : (role === 'maintenance' || role === 'maintenance_staff')
        ? 'Loading maintenance workspace...'
        : 'Loading tenant workspace...';

    const roleLabel = role === 'admin'
      ? 'Admin Dashboard'
      : (role === 'maintenance' || role === 'maintenance_staff')
        ? 'Maintenance Dashboard'
        : 'Tenant Dashboard';

    setRedirectMessage(message);
    setRedirectRoleLabel(roleLabel);
    setRedirecting(true);
    await delay(1100);
    navigate(targetPath);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let keepLoading = false;

    try {
      // Prefer using AuthContext.login when available so AuthContext state updates immediately
      if (login) {
        try {
          const data = await login(email, password);
          // login() already stores token/user in localStorage and sets context state
          toast.success('Login successful!');
          const userObj = data.user || data?.data?.user;
          
          // Check if user needs to change password (first login)
          if (userObj?.firstLogin) {
            navigate('/force-change-password');
            return;
          }

          keepLoading = true;
          await navigateByRoleWithTransition(userObj);
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

      // Check if user needs to change password (first login)
      if (user.firstLogin) {
        navigate('/force-change-password');
        return;
      }

      keepLoading = true;
      await navigateByRoleWithTransition(user);
    } catch (error) {
      console.error('Login error:', error.response || error.message || error);
      const serverMsg = error.response?.data?.message || error.response?.data || error.message || 'Login failed';
      toast.error(typeof serverMsg === 'string' ? serverMsg : 'Login failed (see console)');
    } finally {
      if (!keepLoading) {
        setLoading(false);
      }
    }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen relative overflow-hidden page-wrapper">
        <div className="absolute inset-0 bg-slate-100"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 backdrop-blur-md p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c77b69] text-white font-bold text-2xl shadow-lg">
                PM
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Property Manager</p>
                <h2 className="text-xl font-bold text-slate-900">{redirectRoleLabel}</h2>
              </div>
            </div>

            <p className="text-slate-700 font-medium">{redirectMessage}</p>
            <p className="text-sm text-slate-500 mt-1">Finalizing secure session and permissions</p>

            <div className="mt-6 flex items-center gap-2">
              <span className="splash-progress-dot splash-progress-dot-1"></span>
              <span className="splash-progress-dot splash-progress-dot-2"></span>
              <span className="splash-progress-dot splash-progress-dot-3"></span>
              <span className="splash-progress-dot splash-progress-dot-4"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 page-wrapper">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-slate-100"></div>
      
      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
      
      {/* Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-24">
            <div className="inline-block bg-[#c77b69] rounded-xl p-4 mb-8 shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:scale-105">
              <span className="text-white font-bold text-3xl">PM</span>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-3">Property Manager</h1>
          <p className="text-slate-600 text-lg">Manage your property with ease</p>
        </div>

        {/* Login Card */}
        <div className="card-base p-8 mt-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Welcome Back</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label className="text-label mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-4 text-indigo-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '60px' }}
                  className="w-full pr-4 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="text-label mb-2 block">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-4 text-indigo-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '60px' }}
                  className="w-full pr-12 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right mt-2 mb-4">
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 btn-primary font-bold py-3 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn size={20} />
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Back to Dashboard Button */}
          <Link to="/" className="block w-full mt-6 px-4 py-3 rounded-lg bg-[#c77b69] text-white border border-[#c77b69] shadow-sm hover:bg-[#9d5f51] transition text-center font-semibold">
            <Home size={16} className="inline mr-2" /> Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </div>
  );
};

export default LoginPage;
