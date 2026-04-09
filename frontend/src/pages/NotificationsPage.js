import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Bell, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatAppDateTime } from '../utils/dateTime';

const NotificationsPage = ({ role }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [pendingBillsReminder, setPendingBillsReminder] = useState('');
  const [loading, setLoading] = useState(true);

  const dashboardPath = useMemo(() => {
    if (role === 'admin') return '/admin';
    if (role === 'maintenance_staff') return '/maintenance';
    return '/tenant';
  }, [role]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };
      const [listRes, countRes] = await Promise.all([
        axios.get('/api/notifications?limit=100', { headers }).catch(() => ({ data: { data: [] } })),
        axios.get('/api/notifications/unread-count', { headers }).catch(() => ({ data: { data: { unread: 0 } } })),
      ]);

      setNotifications(listRes.data?.data || []);
      setUnread(countRes.data?.data?.unread || 0);

      if (role === 'tenant') {
        const overviewRes = await axios
          .get('/api/chatbot/tenant-overview', { headers })
          .catch(() => ({ data: { data: { bills: [] } } }));
        const bills = overviewRes.data?.data?.bills || [];
        const unpaidCount = bills.filter((bill) => (bill?.status || '').toLowerCase() !== 'paid').length;
        setPendingBillsReminder(
          unpaidCount > 0 ? `Reminder: You currently have ${unpaidCount} unpaid bill(s).` : ''
        );
      } else {
        setPendingBillsReminder('');
      }
    } catch (error) {
      console.warn('Failed to fetch notifications:', error?.message || error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id) => {
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

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.patch('/api/notifications/mark-all-read', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch (error) {
      console.warn('Failed to mark all notifications as read:', error?.message || error);
    }
  };

  const clearOne = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.delete(`/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (error) {
      console.warn('Failed to clear notification:', error?.message || error);
    }
  };

  const clearAll = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.delete('/api/notifications/clear-all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Notifications cleared');
      fetchNotifications();
    } catch (error) {
      console.warn('Failed to clear all notifications:', error?.message || error);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading notifications" />;
  }

  return (
    <div className="min-h-screen page-wrapper pb-12">
      <div className="dashboard-header py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">All Notifications</h1>
              <p className="mt-2">You have {unread} unread notification{unread === 1 ? '' : 's'}.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(dashboardPath)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 transition"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </button>
              <button
                type="button"
                onClick={fetchNotifications}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pendingBillsReminder && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Payment Reminder</p>
            <p className="text-sm text-slate-900 mt-1">{pendingBillsReminder}</p>
          </div>
        )}

        <div className="card-base border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-indigo-600" />
              <h2 className="font-bold text-slate-900">Notification Feed</h2>
            </div>
            <div className="flex items-center gap-4">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm font-semibold text-rose-700 hover:text-rose-900"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-500">No notifications found.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-5 py-4 transition hover:bg-slate-50 bg-white ${n.is_read ? '' : 'border-l-4 border-l-indigo-500'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="text-left flex-1"
                    >
                      <p className="text-sm font-medium text-slate-900">{n.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatAppDateTime(n.created_at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => clearOne(n.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900"
                      title="Clear notification"
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
