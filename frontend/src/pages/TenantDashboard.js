import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, AlertCircle, RefreshCw, FileText, CheckCircle, Clock, XCircle, Droplet, Zap } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AuthContext from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';


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
          } catch (err) {
            console.warn('Failed to parse new_bill event', err);
            fetchDashboardData();
          }
        });
        es.addEventListener('utility_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            toast.success(data.message || 'Utility updated');
            fetchDashboardData();
          } catch (err) {
            console.warn('Failed to parse utility_update event', err);
            fetchDashboardData();
          }
        });

        es.addEventListener('bill_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            toast.success(data.message || `Bill status: ${data.status}`);
            fetchDashboardData();
          } catch (err) {
            console.warn('Failed to parse bill_update event', err);
            fetchDashboardData();
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

      const [billsRes, complaintsRes] = await Promise.all([
        axios.get(`/api/rent/status/${userId}`, { headers }),
        axios.get('/api/complaint/my-complaints', { headers }),
      ]);

      const billsData = billsRes.data?.data || billsRes.data || [];
      const complaintsData = complaintsRes.data?.data || complaintsRes.data || [];
      
      // Normalize and sort bills by due_date (latest -> oldest)
      const sortedBills = (billsData || []).slice().sort((a, b) => {
        const aDate = new Date(a.due_date || a.created_at || 0).getTime();
        const bDate = new Date(b.due_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });

      // Detect new bill additions
      const prevIds = new Set(bills.map(b => b.id));
      const newBills = sortedBills.filter(b => !prevIds.has(b.id));
      if (newBills.length > 0) {
        toast.success(`You have ${newBills.length} new bill(s)`);
      }

      setBills(sortedBills);
      setComplaints(complaintsData);

      // Fetch latest utilities for this tenant
      try {
        const utilRes = await axios.get(`/api/utility/latest/${userId}`, { headers });
        const latest = utilRes.data?.data || {};
        const currencyFromUser = parsedUser?.currency || user?.currency || defaultCurrency;
        setUtilities({
          water: {
            usage: latest.water?.usage || 0,
            cost: latest.water?.cost || 0,
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
      } catch (uErr) {
        console.warn('Failed to fetch utilities:', uErr?.message || uErr);
      }

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

  // Quietly refresh only bills (used by polling)
  const fetchBillsQuiet = async () => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const userId = parsedUser?.id || user?.id;
      if (!token || !userId) return;
      const headers = { Authorization: `Bearer ${token}` };
      const billsRes = await axios.get(`/api/rent/status/${userId}`, { headers });
      const billsData = billsRes.data?.data || billsRes.data || [];

      // Detect newly added bills compared to current list
      const prevIds = new Set(bills.map(b => b.id));
      const newBills = billsData.filter(b => !prevIds.has(b.id));
      if (newBills.length > 0 && bills.length > 0) {
        toast.success(`You have ${newBills.length} new bill(s)`);
      }

      const sortedBills = (billsData || []).slice().sort((a, b) => {
        const aDate = new Date(a.due_date || a.created_at || 0).getTime();
        const bDate = new Date(b.due_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });

      setBills(sortedBills);

      const totalBills = sortedBills.length || 0;
      const paidBills = sortedBills.filter(b => b.status === 'paid').length || 0;
      const pendingBills = sortedBills.filter(b => b.status === 'pending').length || 0;
      const totalPaid = sortedBills
        .filter(b => b.status === 'paid')
        .reduce((sum, b) => sum + (b.amount || 0), 0) || 0;

      setStats({ totalBills, paidBills, pendingBills, totalPaid });
    } catch (err) {
      console.warn('Quiet bills refresh failed:', err?.message || err);
    }
  };

  // Quietly refresh utilities (used by polling)
  const fetchUtilitiesQuiet = async () => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const userId = parsedUser?.id || user?.id;
      if (!token || !userId) return;
      const headers = { Authorization: `Bearer ${token}` };
      
      const utilRes = await axios.get(`/api/utility/latest/${userId}`, { headers });
      const latest = utilRes.data?.data || {};
      const currencyFromUser = parsedUser?.currency || user?.currency || defaultCurrency;
      
      // Check if utilities have changed
      const prevWater = utilities.water;
      const prevElec = utilities.electricity;
      const newWaterUsage = latest.water?.usage || 0;
      const newElecUsage = latest.electricity?.usage || 0;
      
      // Notify only if there's a change
      if (prevWater.usage !== newWaterUsage || prevElec.usage !== newElecUsage) {
        if (prevWater.usage !== 0 || prevElec.usage !== 0) {
          // Only toast if utilities were already loaded (not first load)
          toast.success('Utility readings updated');
        }
      }
      
      setUtilities({
        water: {
          usage: newWaterUsage,
          cost: latest.water?.cost || 0,
          unit: latest.water?.unit || 'cu.m',
          currency: currencyFromUser
        },
        electricity: {
          usage: newElecUsage,
          cost: latest.electricity?.cost || 0,
          unit: latest.electricity?.unit || 'kWh',
          currency: currencyFromUser
        }
      });
    } catch (err) {
      console.warn('Quiet utilities refresh failed:', err?.message || err);
    }
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
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">Welcome, {user?.name || 'Tenant'}!</h1>
          <p className="text-blue-100 mt-2">Manage your payments and property information</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            to="/tenant/payments"
            className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition transform duration-200 flex items-center space-x-4 group"
          >
            <CreditCard size={32} className="group-hover:rotate-12 transition" />
            <div>
              <p className="font-bold text-lg">Pay Bills</p>
              <p className="text-sm text-emerald-100">Submit payments</p>
            </div>
          </Link>

          <Link
            to="/tenant/complaints"
            className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition transform duration-200 flex items-center space-x-4 group"
          >
            <AlertCircle size={32} className="group-hover:rotate-12 transition" />
            <div>
              <p className="font-bold text-lg">File Complaint</p>
              <p className="text-sm text-orange-100">Report issues</p>
            </div>
          </Link>

          <button
            onClick={fetchDashboardData}
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition transform duration-200 flex items-center space-x-4 group"
          >
            <RefreshCw size={32} className="group-hover:rotate-180 transition duration-500" />
            <div>
              <p className="font-bold text-lg">Refresh</p>
              <p className="text-sm text-blue-100">Update data</p>
            </div>
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium">Total Bills</p>
            <p className="text-3xl font-bold text-blue-600">{stats.totalBills}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium">Paid</p>
            <p className="text-3xl font-bold text-green-600">{stats.paidBills}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm font-medium">Pending</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.pendingBills}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium">Total Paid</p>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(stats.totalPaid)}</p>
          </div>
        </div>

        {/* Utilities Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg shadow p-6 border-l-4 border-cyan-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <Droplet size={24} className="text-cyan-600" />
                <span>Water Usage</span>
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-gray-600 text-sm">Current Usage</p>
                <p className="text-3xl font-bold text-cyan-600">{utilities.water.usage} <span className="text-lg">{utilities.water.unit}</span></p>
              </div>
              <div className="bg-white bg-opacity-60 rounded p-3">
                <p className="text-gray-600 text-sm">Estimated Cost</p>
                <p className="text-2xl font-bold text-cyan-700">{formatCurrency(utilities.water.cost, utilities.water.currency)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg shadow p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <Zap size={24} className="text-amber-600" />
                <span>Electricity Usage</span>
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-gray-600 text-sm">Current Usage</p>
                <p className="text-3xl font-bold text-amber-600">{utilities.electricity.usage} <span className="text-lg">{utilities.electricity.unit}</span></p>
              </div>
              <div className="bg-white bg-opacity-60 rounded p-3">
                <p className="text-gray-600 text-sm">Estimated Cost</p>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(utilities.electricity.cost, utilities.electricity.currency)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Bills */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <FileText size={24} className="text-blue-600" />
              <span>Recent Bills</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      No bills found
                    </td>
                  </tr>
                ) : (
                  bills.slice(0, 5).map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(bill.amount, bill.currency || defaultCurrency)}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(bill.due_date).toLocaleDateString()}</td>
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
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
              <AlertCircle size={24} className="text-orange-600" />
              <span>Recent Complaints</span>
            </h2>
          </div>
          <div className="divide-y">
            {complaints.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No complaints filed
              </div>
            ) : (
              complaints.slice(0, 3).map((complaint) => (
                <div key={complaint.id} className="px-6 py-4 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{complaint.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{complaint.description}</p>
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
                    {new Date(complaint.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantDashboard;
