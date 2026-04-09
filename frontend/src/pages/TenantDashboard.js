import React, { useEffect, useState, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, AlertCircle, RefreshCw, FileText, CheckCircle, Clock, XCircle, Droplet, Zap } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AuthContext from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatAppDate } from '../utils/dateTime';


const TenantDashboard = () => {
  const { user } = useContext(AuthContext);
  const defaultCurrency = user?.preferred_currency || user?.currency || 'PHP';
  const [bills, setBills] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [utilities, setUtilities] = useState({
    water: { usage: 0, cost: 0, unit: 'cu.m', currency: defaultCurrency },
    electricity: { usage: 0, cost: 0, unit: 'kWh', currency: defaultCurrency }
  });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBills: 0,
    paidBills: 0,
    pendingBills: 0,
    totalPaid: 0,
  });
  const [meralcoRates, setMeralcoRates] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const seenBillIdsRef = useRef(new Set());
  const hasInitializedBillsRef = useRef(false);

  const notifyForNewUnpaidBills = (allBills = []) => {
    const normalizedIds = allBills
      .map((bill) => (bill?.id != null ? String(bill.id) : null))
      .filter(Boolean);

    // Prime baseline on first load so existing bills do not trigger "new" toasts.
    if (!hasInitializedBillsRef.current) {
      seenBillIdsRef.current = new Set(normalizedIds);
      hasInitializedBillsRef.current = true;
      return;
    }

    const newlySeenUnpaid = allBills.filter((bill) => {
      const id = bill?.id != null ? String(bill.id) : null;
      if (!id) return false;
      const isNew = !seenBillIdsRef.current.has(id);
      const isUnpaid = (bill?.status || '').toLowerCase() !== 'paid';
      return isNew && isUnpaid;
    });

    if (newlySeenUnpaid.length > 0) {
      toast.success(`You have ${newlySeenUnpaid.length} new unpaid bill(s)`);
    }

    // Always update seen cache so already discovered bills don't retrigger.
    seenBillIdsRef.current = new Set(normalizedIds);
  };

  const formatCurrency = (amount = 0, currency = defaultCurrency) => {
    const code = currency === 'USD' ? 'USD' : 'PHP';
    const locale = code === 'USD' ? 'en-US' : 'en-PH';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(amount || 0));
    } catch (e) {
      return (code === 'USD' ? '$' : '₱') + (Number(amount || 0).toLocaleString());
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchNotifications();

    // Subscribe to server-sent events for real-time updates (if token present)
    const token = localStorage.getItem('token');
    let es;
    if (token) {
      try {
        es = new EventSource(`/api/notifications/subscribe?token=${encodeURIComponent(token)}`);
        es.addEventListener('connected', (e) => console.log('SSE connected:', e));
        es.addEventListener('new_bill', (e) => {
          try {
            const data = JSON.parse(e.data);
            toast.success(data.message || 'New bill created');
            // Fetch new data immediately
            fetchDashboardData();
            fetchNotifications();
          } catch (err) {
            console.warn('Failed to parse new_bill event', err);
            fetchDashboardData();
            fetchNotifications();
          }
        });
        es.addEventListener('utility_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            toast.success(data.message || 'Utility updated');
            fetchDashboardData();
            fetchNotifications();
          } catch (err) {
            console.warn('Failed to parse utility_update event', err);
            fetchDashboardData();
            fetchNotifications();
          }
        });

        es.addEventListener('bill_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            toast.success(data.message || `Bill status: ${data.status}`);
            fetchDashboardData();
            fetchNotifications();
          } catch (err) {
            console.warn('Failed to parse bill_update event', err);
            fetchDashboardData();
            fetchNotifications();
          }
        });
        es.onerror = (err) => {
          console.warn('SSE error', err);
        };
      } catch (sErr) {
        console.warn('SSE subscribe failed:', sErr);
      }
    }

    // Poll for bill and utility updates every 15 seconds as a fallback
    const interval = setInterval(() => {
      fetchBillsQuiet();
      fetchUtilitiesQuiet();
      fetchNotificationsQuiet();
    }, 15000);

    return () => {
      clearInterval(interval);
      if (es) {
        try { es.close(); } catch (e) {}
      }
    };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const userId = parsedUser?.id || user?.id;

      if (!token || !userId) {
        toast.error('Please login first');
        setBills([]);
        setComplaints([]);
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      // Unified tenant overview (synced with chatbot/suggestions)
      const overviewRes = await axios.get('/api/chatbot/tenant-overview', { headers });
      const overview = overviewRes.data?.data || {};
      
      const billsData = overview.bills || [];
      const complaintsData = overview.complaints || [];
      const utilitiesData = overview.utilities || [];
      const currentMeralcoRates = overview.meralco_rates || null;
      setMeralcoRates(currentMeralcoRates);
      
      // Normalize and sort bills by due_date (latest -> oldest)
      const sortedBills = (billsData || []).slice().sort((a, b) => {
        const aDate = new Date(a.due_date || a.created_at || 0).getTime();
        const bDate = new Date(b.due_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });

      notifyForNewUnpaidBills(sortedBills);

      setBills(sortedBills);
      setComplaints(complaintsData);

      // Process utilities (same data structure as chatbot sees)
      const currencyFromUser = parsedUser?.currency || user?.currency || defaultCurrency;
      const latest = {};
      utilitiesData.forEach(u => {
        const type = u.utility_type || u.meter_type || 'unknown';
        if (!latest[type]) {
          latest[type] = {
            usage: u.reading_value || u.reading || 0,
            cost: u.estimated_cost || u.cost || 0,
            rate: u.water_rate != null ? u.water_rate : null,
            unit: u.unit || ''
          };
        }
      });

      setUtilities({
        water: {
          usage: latest.water?.usage || 0,
          cost: latest.water?.cost || 0,
          rate: latest.water?.rate != null ? latest.water.rate : (latest.water?.usage ? latest.water.cost / latest.water.usage : null),
          unit: latest.water?.unit || 'cu.m',
          currency: currencyFromUser
        },
        electricity: {
          usage: latest.electricity?.usage || 0,
          cost: latest.electricity?.cost || 0,
          unit: latest.electricity?.unit || 'kWh',
          currency: currencyFromUser
        }
      });

      // Calculate stats
      const totalBills = billsData.length || 0;
      const paidBills = billsData.filter(b => b.status === 'paid').length || 0;
      const pendingBills = billsData.filter(b => b.status === 'pending').length || 0;
      const totalPaid = billsData
        .filter(b => b.status === 'paid')
        .reduce((sum, b) => sum + (b.amount || 0), 0) || 0;

      setStats({
        totalBills,
        paidBills,
        pendingBills,
        totalPaid,
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load dashboard data');
      setBills([]);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error) {
      console.warn('Failed to load notifications:', error?.message || error);
    }
  };

  const fetchNotificationsQuiet = async () => {
    await fetchNotifications();
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
      toast.success('All notifications marked as read');
    } catch (error) {
      console.warn('Failed to mark all notifications as read:', error?.message || error);
    }
  };

  // Quietly refresh data using unified endpoint (used by polling)
  const fetchBillsQuiet = async () => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const userId = parsedUser?.id || user?.id;
      if (!token || !userId) return;
      const headers = { Authorization: `Bearer ${token}` };
      
      const overviewRes = await axios.get('/api/chatbot/tenant-overview', { headers });
      const overview = overviewRes.data?.data || {};
      const billsData = overview.bills || [];
      const currentMeralcoRates = overview.meralco_rates || null;
      setMeralcoRates(currentMeralcoRates);

      const sortedBills = (billsData || []).slice().sort((a, b) => {
        const aDate = new Date(a.due_date || a.created_at || 0).getTime();
        const bDate = new Date(b.due_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });

      notifyForNewUnpaidBills(sortedBills);

      setBills(sortedBills);

      const totalBills = sortedBills.length || 0;
      const paidBills = sortedBills.filter(b => b.status === 'paid').length || 0;
      const pendingBills = sortedBills.filter(b => b.status === 'pending').length || 0;
      const totalPaid = sortedBills
        .filter(b => b.status === 'paid')
        .reduce((sum, b) => sum + (b.amount || 0), 0) || 0;

      setStats({ totalBills, paidBills, pendingBills, totalPaid });

      // Also update utilities
      const utilitiesData = overview.utilities || [];
      const currencyFromUser = parsedUser?.currency || user?.currency || defaultCurrency;
      const latest = {};
      utilitiesData.forEach(u => {
        const type = u.utility_type || u.meter_type || 'unknown';
        if (!latest[type]) {
          latest[type] = {
            usage: u.reading_value || u.reading || 0,
            cost: u.estimated_cost || u.cost || 0,
            rate: u.water_rate != null ? u.water_rate : null,
            unit: u.unit || ''
          };
        }
      });
      setUtilities({
        water: {
          usage: latest.water?.usage || 0,
          cost: latest.water?.cost || 0,
          rate: latest.water?.rate != null ? latest.water.rate : (latest.water?.usage ? latest.water.cost / latest.water.usage : null),
          unit: latest.water?.unit || 'cu.m',
          currency: currencyFromUser
        },
        electricity: {
          usage: latest.electricity?.usage || 0,
          cost: latest.electricity?.cost || 0,
          unit: latest.electricity?.unit || 'kWh',
          currency: currencyFromUser
        }
      });
    } catch (err) {
      console.warn('Quiet refresh failed:', err?.message || err);
    }
  };

  // Alias for backward compatibility (data now comes with fetchBillsQuiet)
  const fetchUtilitiesQuiet = async () => {
    // Data is now fetched with bills via unified endpoint
  };

  const getStatusBadge = (status) => {
    const badges = {
      paid: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      overdue: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full ${badge.bg} ${badge.text} text-sm font-medium`}>
        <Icon size={16} />
        <span className="capitalize">{status}</span>
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading your dashboard" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="min-h-screen page-wrapper pb-12"
    >
      {/* Header Section */}
      <div className="tenant-header py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-slate-900">Welcome, {user?.fullName || user?.name || 'Tenant'}!</h1>
          <p className="text-slate-700 mt-2">Manage your payments and property information</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            to="/tenant/payments"
            className="brand-button text-white p-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition transform duration-200 flex items-center space-x-4 group"
          >
            <CreditCard size={32} className="text-white group-hover:rotate-12 transition" />
            <div>
              <p className="font-bold text-lg">Pay Bills</p>
              <p className="text-sm text-white">Submit payments</p>
            </div>
          </Link>

          <Link
            to="/tenant/complaints"
            className="brand-button text-white p-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition transform duration-200 flex items-center space-x-4 group"
          >
            <AlertCircle size={32} className="text-white group-hover:rotate-12 transition" />
            <div>
              <p className="font-bold text-lg">File Complaint</p>
              <p className="text-sm text-white">Report issues</p>
            </div>
          </Link>

          <button
            onClick={fetchDashboardData}
            className="brand-button text-white p-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition transform duration-200 flex items-center space-x-4 group"
          >
            <RefreshCw size={32} className="text-white group-hover:rotate-180 transition duration-500" />
            <div>
              <p className="font-bold text-lg">Refresh</p>
              <p className="text-sm text-white">Update data</p>
            </div>
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card-base bg-white border border-slate-200 p-6">
            <p className="text-slate-600 text-sm font-medium">Total Bills</p>
            <p className="text-3xl font-bold text-blue-600">{stats.totalBills}</p>
          </div>
          <div className="card-base bg-white border border-slate-200 p-6">
            <p className="text-slate-500 text-sm font-medium">Paid</p>
            <p className="text-3xl font-bold text-green-400">{stats.paidBills}</p>
          </div>
          <div className="card-base bg-white border border-slate-200 p-6">
            <p className="text-slate-500 text-sm font-medium">Pending</p>
            <p className="text-3xl font-bold text-yellow-500">{stats.pendingBills}</p>
          </div>
          <div className="card-base bg-white border border-slate-200 p-6">
            <p className="text-slate-500 text-sm font-medium">Total Paid</p>
            <p className="text-3xl font-bold text-purple-500">{formatCurrency(stats.totalPaid)}</p>
          </div>
        </div>

        {/* Utilities Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="card-base bg-white border border-slate-200 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <Droplet size={24} className="text-indigo-600" />
                <span>Water Usage</span>
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-gray-600 text-sm">Current Usage</p>
                <p className="text-3xl font-bold text-cyan-600">{utilities.water.usage} <span className="text-lg">{utilities.water.unit}</span></p>
              </div>
              <div className="card-soft p-3">
                <p className="text-slate-600 text-sm">Estimated Cost</p>
                <p className="text-2xl font-bold text-cyan-700">{formatCurrency(utilities.water.cost, utilities.water.currency)}</p>
              </div>
              {utilities.water.rate != null && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm mt-3">
                  <p className="text-slate-500 text-xs uppercase tracking-[0.18em] font-semibold">Current Water Rate</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 flex items-baseline gap-2">
                    <span>₱{utilities.water.rate.toFixed(4)}</span>
                    <span className="text-sm font-medium text-slate-500">/ m³</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-600">Rate manually entered by admin</p>
                </div>
              )}
            </div>
          </div>

          <div className="card-base bg-white border border-slate-200 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <Zap size={24} className="text-indigo-600" />
                <span>Electricity Usage</span>
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-gray-600 text-sm">Current Usage</p>
                <p className="text-3xl font-bold text-amber-600">{utilities.electricity.usage} <span className="text-lg">{utilities.electricity.unit}</span></p>
              </div>
              <div className="card-soft p-3">
                <p className="text-slate-600 text-sm">Estimated Cost</p>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(utilities.electricity.cost, utilities.electricity.currency)}</p>
              </div>
              {meralcoRates && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-slate-500 text-xs uppercase tracking-[0.18em] font-semibold">Current MERALCO Rate</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 flex items-baseline gap-2">
                        <span>₱{meralcoRates.rate_kwh?.toFixed(4)}</span>
                        <span className="text-sm font-medium text-slate-500">/ kWh</span>
                      </p>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${meralcoRates.trend === 'down' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : meralcoRates.trend === 'up' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-slate-100 text-slate-800 border-slate-200'} border`}>
                      <span>{meralcoRates.trend === 'down' ? '📉' : meralcoRates.trend === 'up' ? '📈' : '➡️'}</span>
                      <span className="capitalize">{meralcoRates.trend || 'stable'}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {meralcoRates.rate_change_percent != null ? `Change: ${meralcoRates.rate_change_percent >= 0 ? '+' : '-'}${Math.abs(meralcoRates.rate_change_percent).toFixed(2)}%` : 'Rate change unavailable'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Bills */}
        <div className="card-base bg-white border border-slate-200 mb-8">
          <div className="px-6 py-4 border-b border-slate-200 bg-white rounded-t-lg">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <FileText size={24} className="text-indigo-500" />
              <span>Recent Bills</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-soft border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                      No bills found
                    </td>
                  </tr>
                ) : (
                  bills.slice(0, 5).map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-100 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">{formatCurrency(bill.amount, bill.currency || defaultCurrency)}</td>
                      <td className="px-6 py-4 text-slate-300">{formatAppDate(bill.due_date)}</td>
                      <td className="px-6 py-4">{getStatusBadge(bill.status)}</td>
                      <td className="px-6 py-4">
                        {bill.status === 'pending' && (
                          <Link
                            to="/tenant/payments"
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            Pay Now
                          </Link>
                        )}
                        {bill.status === 'paid' && (
                          <span className="text-green-600 text-sm font-medium">✓ Paid</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Complaints */}
        <div className="card-base bg-white border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 bg-white rounded-t-lg">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <AlertCircle size={24} className="text-orange-400" />
              <span>Recent Complaints</span>
            </h2>
          </div>
          <div className="divide-y divide-slate-700">
            {complaints.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400">
                No complaints filed
              </div>
            ) : (
              complaints.slice(0, 3).map((complaint) => (
                <div key={complaint.id} className="px-6 py-4 hover:bg-surface-soft transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{complaint.title}</h3>
                      <p className="text-slate-600 text-sm mt-1">{complaint.description}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      complaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                      complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {complaint.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    {formatAppDate(complaint.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TenantDashboard;
