import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiDownload, FiRefreshCw, FiArrowLeft } from 'react-icons/fi';
import axios from 'axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatAppDate, formatAppDateTime, formatAppTime } from '../utils/dateTime';

const AdminPayments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [searchTenant, setSearchTenant] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [createForm, setCreateForm] = useState({ tenantId: '', amount: '', dueDate: '', currency: 'PHP' });

  const apiUrl = process.env.REACT_APP_API_URL || '';
  const token = localStorage.getItem('token');

  const formatCurrency = (amount = 0, currency = 'PHP') => {
    const code = currency === 'USD' ? 'USD' : 'PHP';
    const locale = code === 'USD' ? 'en-US' : 'en-PH';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(amount || 0));
    } catch (e) {
      return (code === 'USD' ? '$' : '₱') + (Number(amount || 0).toLocaleString());
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPayments();
    fetchStats();
    loadTenants();

    // Set up auto-refresh interval
    if (autoRefreshEnabled) {
      const interval = setInterval(() => {
        fetchPaymentsQuiet();
        fetchStatsQuiet();
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [page, filter, autoRefreshEnabled, refreshInterval]);

  const loadTenants = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/admin/tenants`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) setTenants(response.data.data || []);
    } catch (error) {
      console.error('Failed to load tenants', error);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 20
      });

      if (filter && filter !== 'all') {
        params.append('status', filter);
      }

      const response = await axios.get(
        `${apiUrl}/api/payment/admin/all?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const sorted = (response.data.data || []).slice().sort((a,b) => {
          const aDate = new Date(a.created_at || a.date || 0).getTime();
          const bDate = new Date(b.created_at || b.date || 0).getTime();
          return bDate - aDate;
        });
        setPayments(sorted);
        setPagination(response.data.pagination);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching payments:', error.response?.status, error.response?.data);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch payment records';
      toast.error(`Payment Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentsQuiet = async () => {
    try {
      const params = new URLSearchParams({
        page,
        limit: 20
      });

      if (filter && filter !== 'all') {
        params.append('status', filter);
      }

      const response = await axios.get(
        `${apiUrl}/api/payment/admin/all?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const sorted = (response.data.data || []).slice().sort((a,b) => {
          const aDate = new Date(a.created_at || a.date || 0).getTime();
          const bDate = new Date(b.created_at || b.date || 0).getTime();
          return bDate - aDate;
        });
        setPayments(sorted);
        setPagination(response.data.pagination);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching payments (quiet):', error.response?.status, error.response?.data);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${apiUrl}/api/payment/admin/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error.response?.status, error.response?.data);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch statistics';
      toast.error(`Stats Error: ${errorMsg}`);
    }
  };

  const fetchStatsQuiet = async () => {
    try {
      const response = await axios.get(
        `${apiUrl}/api/payment/admin/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats (quiet):', error.response?.status, error.response?.data);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPayments(), fetchStats()]);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleResetPayments = async () => {
    if (window.confirm('Are you sure you want to reset all payment data? This cannot be undone.')) {
      try {
        setLoading(true);
        const response = await axios.post(
          `${apiUrl}/api/payment/admin/reset`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.success) {
          toast.success('All payment data has been reset');
          setPayments([]);
          setPage(1);
          setFilter('');
          await Promise.all([fetchPayments(), fetchStats()]);
        }
      } catch (error) {
        console.error('Error resetting payments:', error);
        toast.error('Failed to reset payment data');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportCSV = () => {
    if (payments.length === 0) {
      toast.error('No payments to export');
      return;
    }

    const headers = ['Payment ID', 'Tenant Name', 'Email', 'Amount', 'Currency', 'Original Amount', 'Original Currency', 'Converted Amount', 'Converted Currency', 'Conversion Rate', 'Method', 'Status', 'Date'];
    const rows = payments.map(p => [
      p.id,
      p.tenant_name,
      p.tenant_email,
      p.amount,
      p.currency || 'PHP',
      p.original_amount || '',
      p.original_currency || '',
      p.converted_amount || '',
      p.converted_currency || '',
      p.conversion_rate || '',
      p.payment_method,
      p.status,
      formatAppDate(p.created_at)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Payments exported successfully');
  };

  const formatDate = (dateString) => {
    return formatAppDateTime(dateString, {
      second: undefined,
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-indigo-700 hover:text-indigo-900 font-medium mb-4 transition"
            >
              <FiArrowLeft size={20} />
              Back to Dashboard
            </button>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Payment Management</h1>
            <p className="text-gray-600">View and manage all tenant payments</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 brand-button text-white rounded-lg hover:opacity-95"
            >
              Create Bill
            </button>
            <button              onClick={() => navigate('/admin/utility-debug')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
            >
              Utility Debug
            </button>
            <button              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="mb-8 overflow-hidden rounded-3xl border bg-white shadow-sm" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
              <div className="p-6">
                <p className="text-slate-500 text-sm mb-1">Total Amount Paid</p>
                <div className="space-y-2">
                  {(stats.totalStats.totalsByCurrency || []).map((t) => (
                    <div key={t.currency} className="flex items-baseline justify-between">
                      <p className="text-sm text-gray-600">{t.currency}</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(t.total_amount, t.currency)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">{stats.totalStats.total_payments} total transactions</p>
              </div>

              <div className="p-6">
                <p className="text-slate-500 text-sm mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.totalStats.completed_count || 0}
                </p>
                <p className="text-xs text-gray-500 mt-2">Transactions: {stats.totalStats.completed_count || 0}</p>
              </div>

              <div className="p-6">
                <p className="text-slate-500 text-sm mb-1">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {stats.totalStats.pending_count || 0}
                </p>
                <p className="text-xs text-gray-500 mt-2">Transactions: {stats.totalStats.pending_count || 0}</p>
              </div>

              <div className="p-6">
                <p className="text-slate-500 text-sm mb-1">Failed</p>
                <p className="text-3xl font-bold text-red-600">
                  {stats.totalStats.failed_count || 0}
                </p>
                <p className="text-xs text-gray-500 mt-2">Transactions: {stats.totalStats.failed_count || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="card-base mb-8 p-6">
          {/* Create Bill Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="card-base p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Create Bill</h3>
                <div className="space-y-3">
                  <select
                    value={createForm.tenantId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, tenantId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="">Select tenant</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} {t.unit_number ? `(Unit: ${t.unit_number})` : '(No Unit)'} - {t.email}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Amount"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />

                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />

                  <select
                    value={createForm.currency}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="PHP">PHP (₱)</option>
                    <option value="USD">USD ($)</option>
                  </select>

                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowCreateModal(false)} className="px-4 py-2">Cancel</button>
                    <button
                      onClick={async () => {
                        if (!createForm.tenantId || !createForm.amount || !createForm.dueDate) {
                          toast.error('Please fill all fields');
                          return;
                        }
                        try {
                          await axios.post(`${apiUrl}/api/admin/bills`, {
                            tenantId: createForm.tenantId,
                            amount: createForm.amount,
                            dueDate: createForm.dueDate,
                            currency: createForm.currency
                          }, { headers: { Authorization: `Bearer ${token}` } });
                          toast.success('Bill created');
                          setShowCreateModal(false);
                          setCreateForm({ tenantId: '', amount: '', dueDate: '', currency: 'PHP' });
                          fetchPayments();
                        } catch (err) {
                          console.error('Create bill failed', err);
                          toast.error('Failed to create bill');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by tenant name or email..."
                value={searchTenant}
                onChange={(e) => setSearchTenant(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className={`flex items-center gap-2 px-4 py-2 brand-button text-white rounded-lg transition ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FiRefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
            >
              <FiDownload size={18} />
              Export CSV
            </button>

            <button
              onClick={handleResetPayments}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Reset Data
            </button>
          </div>

          {/* Real-time controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center border-t pt-4">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefreshEnabled}
                  onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Auto-refresh</span>
              </label>
            </div>

            {autoRefreshEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Every</label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>3s</option>
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                </select>
              </div>
            )}

            {lastUpdated && (
              <div className="text-xs text-gray-500">
                Last updated: {formatAppTime(lastUpdated)}
              </div>
            )}
          </div>
        </div>

        {/* Payments Table */}
        {loading ? (
          <LoadingSpinner fullPage={false} message="Loading payments" />
        ) : payments.length === 0 ? (
          <div className="card-base p-12 text-center">
            <p className="text-gray-500 text-lg">No payments found</p>
          </div>
        ) : (
          <div className="card-base overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tenant</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Bill ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Method</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{payment.tenant_name}</p>
                        <p className="text-gray-500">{payment.tenant_email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">#{payment.rent_id}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {payment.original_amount ? (
                        <div>
                          <div>{formatCurrency(payment.original_amount, payment.original_currency || 'PHP')}</div>
                          {payment.converted_amount && payment.converted_currency && (
                            <div className="text-xs text-gray-500 mt-1">Charged: {formatCurrency(payment.converted_amount, payment.converted_currency)} (rate: {payment.conversion_rate})</div>
                          )}
                        </div>
                      ) : (
                        <div>{formatCurrency(payment.amount, payment.currency || 'PHP')}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="capitalize text-gray-700 font-medium">{payment.payment_method}</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(payment.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      {payment.transaction_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPayments;
