import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, User, Home, Settings, Layers, Bell } from 'lucide-react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingBillsReminder, setPendingBillsReminder] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);
  const userName = user?.fullName || user?.name || localStorage.getItem('userName') || 'User';
  let userRole = user?.role || localStorage.getItem('userRole') || 'tenant';
  
  // Normalize role (handle both 'maintenance' and 'maintenance_staff')
  if (userRole === 'maintenance_staff') {
    userRole = 'maintenance';
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      const [listRes, countRes] = await Promise.all([
        axios.get('/api/notifications?limit=8', { headers }).catch(() => ({ data: { data: [] } })),
        axios.get('/api/notifications/unread-count', { headers }).catch(() => ({ data: { data: { unread: 0 } } })),
      ]);

      setNotifications(listRes.data?.data || []);
      setUnreadNotifications(countRes.data?.data?.unread || 0);

      if (userRole === 'tenant') {
        const overviewRes = await axios
          .get('/api/chatbot/tenant-overview', { headers })
          .catch(() => ({ data: { data: { bills: [] } } }));
        const bills = overviewRes.data?.data?.bills || [];
        const unpaidCount = bills.filter((bill) => (bill?.status || '').toLowerCase() !== 'paid').length;
        setPendingBillsReminder(
          unpaidCount > 0 ? `You currently have ${unpaidCount} unpaid bill(s).` : ''
        );
      } else {
        setPendingBillsReminder('');
      }
    } catch (error) {
      console.warn('Failed to load notifications:', error?.message || error);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await axios.patch(`/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (error) {
      console.warn('Failed to mark notification as read:', error?.message || error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await axios.patch('/api/notifications/mark-all-read', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (error) {
      console.warn('Failed to mark all notifications as read:', error?.message || error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await axios.delete('/api/notifications/clear-all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (error) {
      console.warn('Failed to clear notifications:', error?.message || error);
    }
  };

  const handleViewAllNotifications = () => {
    if (userRole === 'admin') {
      navigate('/admin/notifications');
      return;
    }
    if (userRole === 'maintenance') {
      navigate('/maintenance/notifications');
      return;
    }
    navigate('/tenant/notifications');
  };

  const handleLogout = async () => {
    setIsOpen(false);
    setLoggingOut(true);

    await new Promise((resolve) => setTimeout(resolve, 900));
    logout();
    navigate('/login');
  };

  const toggleMenu = () => setIsOpen(!isOpen);

  const navLinks = {
    tenant: [
      { label: 'Dashboard', path: '/tenant', icon: Home },
      { label: 'Payments', path: '/tenant/payments', icon: Layers },
      { label: 'Complaints', path: '/tenant/complaints', icon: Bell },
      { label: 'Profile', path: '/tenant/profile', icon: User },
    ],
    admin: [
      { label: 'Dashboard', path: '/admin', icon: Home },
      { label: 'Profile', path: '/admin/profile', icon: User },
      { label: 'Settings', path: '/admin/settings', icon: Settings },
    ],
    maintenance: [
      { label: 'Dashboard', path: '/maintenance', icon: Home },
      { label: 'Task History', path: '/maintenance/history', icon: Layers },
      { label: 'Profile', path: '/maintenance/profile', icon: User },
    ],
  };

  const links = navLinks[userRole] || navLinks.tenant;
  const dashboardPath = userRole === 'admin' ? '/admin' : userRole === 'maintenance' ? '/maintenance' : '/tenant';
  const profilePath = userRole === 'admin' ? '/admin/profile' : userRole === 'maintenance' ? '/maintenance/profile' : '/tenant/profile';

  if (loggingOut) {
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
                <h2 className="text-xl font-bold text-slate-900">Signing Out</h2>
              </div>
            </div>

            <p className="text-slate-700 font-medium">Securing your session...</p>
            <p className="text-sm text-slate-500 mt-1">Saving state and returning to login</p>

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
    <>
      <div className="fixed inset-x-0 top-0 z-40 bg-[#9d5f51]/95 backdrop-blur-md border-b border-[#c77b69] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMenu}
                className="p-2 rounded-md bg-[#c77b69] border border-[#c77b69] text-[#fff8f5] hover:bg-[#9d5f51] hover:ring-2 hover:ring-white/80 transition duration-300 ease-out"
                aria-label="Toggle menu"
              >
                {isOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
              <Link
                to={dashboardPath}
                className="flex items-center gap-2 font-bold text-xl text-white hover:text-slate-200 transition duration-200"
              >
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-slate-900 font-bold">PM</span>
                </div>
                <span className="hidden sm:inline">Property Manager</span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadNotifications}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onClearAll={clearAllNotifications}
                onViewAll={handleViewAllNotifications}
                reminderMessage={pendingBillsReminder}
              />
              <Link
                to={profilePath}
                className="group hidden sm:flex items-center gap-2 rounded-xl px-3 py-2 bg-[#f0d6cf] border border-[#c77b69] text-[#2f1f1d] transition duration-200 hover:bg-[#9d5f51] hover:border-[#9d5f51] hover:text-white hover:ring-2 hover:ring-white/80 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                aria-label="Open profile"
                title="Go to profile"
              >
                <User size={18} className="transition duration-200 group-hover:text-white" />
                <span className="text-sm font-medium truncate max-w-[12rem]">{userName}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-md bg-[#c77b69] px-3 py-2 text-sm font-medium text-white hover:bg-[#9d5f51] hover:ring-2 hover:ring-white/80 transition duration-200"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="h-16" />

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-full bg-[#2f1f1d]/95 border-r border-[#c77b69] shadow-2xl backdrop-blur-xl transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-full overflow-y-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#f0d6cf]">Menu</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Navigation</h2>
            </div>
            <button
              onClick={toggleMenu}
              className="p-2 rounded-md bg-[#c77b69] border border-[#c77b69] text-[#fff8f5] hover:bg-[#9d5f51] transition duration-200"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-2">
            {links.map((link) => {
              const LinkIcon = typeof link.icon === 'function' ? link.icon : null;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition duration-300 ${isActive ? 'bg-[#c77b69] text-white shadow-lg' : 'text-[#f0d6cf] hover:bg-[#9d5f51] hover:text-white'} hover:-translate-x-1`}
                >
                  {LinkIcon && <LinkIcon size={18} className="text-[#f0d6cf]" />}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          <Link
            to={profilePath}
            onClick={() => setIsOpen(false)}
            className="mt-8 block rounded-3xl border border-[#c77b69] bg-[#efd5cf] p-4 shadow-inner text-[#2f1f1d] transition duration-200 hover:bg-[#f4ddd7] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="Open profile"
            title="Go to profile"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-[#9d5f51]">Logged in as</p>
            <p className="mt-2 font-medium text-[#2f1f1d] truncate">{userName}</p>
            <p className="mt-1 text-sm text-[#5e4842] capitalize">{userRole}</p>
          </Link>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;
