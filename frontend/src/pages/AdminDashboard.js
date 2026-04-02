import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiDollarSign, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [bills, setBills] = useState([]);
  const [maintenanceStaff, setMaintenanceStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showUtilityForm, setShowUtilityForm] = useState(false);
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: ''
  });
  const [utilityFormData, setUtilityFormData] = useState({
    tenantId: '',
    month: '',
    rent: '',
    waterUsage: '',
    electricityUsage: '',
    waterCost: '',
    electricityCost: ''
  });

  // History of utility readings for selected tenant
  const [utilityHistory, setUtilityHistory] = useState([]);
  // Recent bills for selected tenant
  const [tenantLastBills, setTenantLastBills] = useState([]);

  const formatCurrency = (amount = 0, currency = 'PHP') => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'PHP', maximumFractionDigits: 2 }).format(amount);
    } catch (e) {
      return `${currency} ${parseFloat(amount || 0).toFixed(2)}`;
    }
  };

  const fetchUtilityForTenant = async (tenantId) => {
    if (!tenantId) {
      setUtilityHistory([]);
      setTenantLastBills([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [utilRes, billsRes] = await Promise.all([
        axios.get(`${apiUrl}/api/utility/tenant/${tenantId}`, config).catch(() => ({ data: { data: [] } })),
        axios.get(`${apiUrl}/api/admin/bills`, config).catch(() => ({ data: { data: [] } }))
      ]);

      setUtilityHistory(utilRes.data.data || []);
      const billsForTenant = (billsRes.data.data || []).filter(b => b.tenant_id === parseInt(tenantId));
      setTenantLastBills(billsForTenant);
    } catch (e) {
      console.error('Failed to fetch utility/bills for tenant:', e);
    }
  };

  useEffect(() => {
    if (utilityFormData.tenantId) fetchUtilityForTenant(utilityFormData.tenantId);
  }, [utilityFormData.tenantId]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      if (!token) {
        console.error('No authentication token found');
        toast.error('Authentication required. Please log in.');
        setIsLoading(false);
        return;
      }
      
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [statsRes, tenantsRes, complaintsRes, staffRes, billsRes] = await Promise.all([
        axios.get(`${apiUrl}/api/admin/dashboard`, config).catch(err => {
          console.error('Dashboard endpoint failed:', err.response?.status, err.response?.data);
          throw new Error(`Dashboard API failed: ${err.response?.data?.message || err.message}`);
        }),
        axios.get(`${apiUrl}/api/admin/tenants`, config).catch(err => {
          console.error('Tenants endpoint failed:', err.response?.status, err.response?.data);
          throw new Error(`Tenants API failed: ${err.response?.data?.message || err.message}`);
        }),
        axios.get(`${apiUrl}/api/complaint/all`, config).catch(() => ({ data: { data: [] } })),
        axios.get(`${apiUrl}/api/admin/maintenance-staff`, config).catch(() => ({ data: { data: [] } })),
        axios.get(`${apiUrl}/api/admin/bills`, config).catch(() => ({ data: { data: [] } }))
      ]);

      setStats(statsRes.data.data);
      setTenants(tenantsRes.data.data);
      setComplaints(complaintsRes.data.data || []);
      setMaintenanceStaff(staffRes.data.data || []);
      setBills(billsRes.data.data || []);
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load admin dashboard';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplaintStatusChange = async (complaintId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      await axios.patch(
        `${apiUrl}/api/complaint/${complaintId}`,
        { status: newStatus },
        config
      );

      toast.success('Complaint status updated');
      fetchAdminData();
    } catch (error) {
      console.error('Status update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to update complaint');
    }
  };

  const handleAddMaintenanceStaff = async (e) => {
    e.preventDefault();
    
    if (!maintenanceFormData.email || !maintenanceFormData.password || !maintenanceFormData.fullName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      console.log('Adding maintenance staff, API URL:', apiUrl);
      
      await axios.post(
        `${apiUrl}/api/admin/add-staff`,
        {
          ...maintenanceFormData,
          role: 'maintenance_staff'
        },
        config
      );

      toast.success('Maintenance staff added successfully');
      setMaintenanceFormData({ email: '', password: '', fullName: '', phone: '' });
      setShowMaintenanceForm(false);
      fetchAdminData();
    } catch (error) {
      console.error('Add staff error - Full response:', error.response);
      console.error('Add staff error - Message:', error.message);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to add maintenance staff';
      toast.error(errorMsg);
    }
  };

  const handleAssignComplaint = async (complaintId, maintenanceStaffId) => {
    try {
      if (!maintenanceStaffId) {
        toast.error('Please select a maintenance staff member');
        return;
      }

      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      console.log('Assigning complaint:', complaintId, 'to:', maintenanceStaffId);
      console.log('API URL:', apiUrl);

      await axios.patch(
        `${apiUrl}/api/complaint/${complaintId}/assign`,
        { assignedTo: parseInt(maintenanceStaffId) },
        config
      );

      toast.success('Complaint assigned successfully');
      fetchAdminData();
    } catch (error) {
      console.error('Assignment error - Full response:', error.response);
      console.error('Assignment error - Message:', error.message);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to assign complaint';
      toast.error(errorMsg);
    }
  };

  const handleSubmitUtility = async (e) => {
    e.preventDefault();
    
    if (!utilityFormData.tenantId || !utilityFormData.month) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // Ensure numeric values are converted properly
      const payload = {
        tenantId: parseInt(utilityFormData.tenantId),
        month: utilityFormData.month,
        rent: utilityFormData.rent ? parseFloat(utilityFormData.rent) : 0,
        waterUsage: utilityFormData.waterUsage ? parseFloat(utilityFormData.waterUsage) : 0,
        electricityUsage: utilityFormData.electricityUsage ? parseFloat(utilityFormData.electricityUsage) : 0,
        waterCost: utilityFormData.waterCost ? parseFloat(utilityFormData.waterCost) : 0,
        electricityCost: utilityFormData.electricityCost ? parseFloat(utilityFormData.electricityCost) : 0
      };
      
      console.log('Submitting utility data, API URL:', apiUrl);
      console.log('Utility payload:', payload);
      
      await axios.post(
        `${apiUrl}/api/admin/submit-utility`,
        payload,
        config
      );

      toast.success('Utility data submitted successfully');
      setUtilityFormData(prev => ({
        ...prev,
        month: '',
        rent: '',
        waterUsage: '',
        electricityUsage: '',
        waterCost: '',
        electricityCost: ''
      }));
      setShowUtilityForm(false);
      fetchAdminData();
      // Refresh utility history and tenant bills for the tenant we just submitted for
      fetchUtilityForTenant(payload.tenantId);
    } catch (error) {
      console.error('Submit utility error - Full response:', error.response);
      console.error('Submit utility error - Message:', error.message);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to submit utility data';
      toast.error(errorMsg);
    }
  };

  const handleUpdateBillStatus = async (billId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const paidDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;

      await axios.patch(
        `${apiUrl}/api/admin/bills/${billId}`,
        { status: newStatus, paid_date: paidDate },
        config
      );

      toast.success('Bill status updated successfully');
      fetchAdminData();
    } catch (error) {
      console.error('Bill update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to update bill status');
    }
  };

  if (isLoading) return <LoadingSpinner message="Loading Admin Dashboard" />;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Admin Dashboard</h1>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'overview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'tenants' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            Tenants
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'complaints' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            Complaints ({complaints.length})
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'maintenance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            Maintenance Staff
          </button>
          <button
            onClick={() => setActiveTab('utilities')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'utilities' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            Bills & Utilities
          </button>

          <button
            onClick={() => navigate('/admin/payments')}
            className="px-4 py-2 font-medium whitespace-nowrap text-blue-600 hover:border-b-2 hover:border-blue-600 transition"
          >
            Payment Analytics
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard
                icon={<FiUsers />}
                title="Total Tenants"
                value={stats?.totalTenants || 0}
                color="bg-blue-500"
              />
              <StatCard
                icon={<FiDollarSign />}
                title="Pending Rents"
                value={stats?.pendingRents || 0}
                color="bg-orange-500"
              />
              <StatCard
                icon={<FiAlertCircle />}
                title="Total Complaints"
                value={stats?.totalComplaints || 0}
                color="bg-red-500"
              />
              <StatCard
                icon={<FiCheckCircle />}
                title="Resolved Complaints"
                value={stats?.resolvedComplaints || 0}
                color="bg-green-500"
              />
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold text-gray-800 mb-4">All Tenants</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Unit Number</th>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-left">Phone</th>
                    <th className="px-6 py-3 text-left">Joined</th>
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(tenant => (
                    <tr key={tenant.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3">{tenant.full_name}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                          tenant.unit_number 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {tenant.unit_number || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-6 py-3">{tenant.email}</td>
                      <td className="px-6 py-3">{tenant.phone}</td>
                      <td className="px-6 py-3">{new Date(tenant.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-3">
                        <button className="text-blue-600 hover:underline">View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.length === 0 ? (
              <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <p className="text-gray-500">No complaints found</p>
              </div>
            ) : (
              complaints.map(complaint => (
                <div key={complaint.id} className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{complaint.title}</h3>
                      <p className="text-sm text-gray-600">Tenant: {complaint.full_name || 'Unknown'}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        complaint.status === 'resolved' ? 'bg-green-100 text-green-800' : 
                        complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        complaint.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {complaint.status?.toUpperCase()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        complaint.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {complaint.priority?.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-4">{complaint.description}</p>

                  <div className="flex gap-2 mb-3">
                    <select
                      value={complaint.status}
                      onChange={(e) => handleComplaintStatusChange(complaint.id, e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Assign to Maintenance Staff:</label>
                    <select
                      value={complaint.assigned_to || ''}
                      onChange={(e) => handleAssignComplaint(complaint.id, e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full"
                    >
                      <option value="">-- Select Staff --</option>
                      {maintenanceStaff.map(staff => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name}
                        </option>
                      ))}
                    </select>
                    {complaint.assigned_to && (
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned to: {maintenanceStaff.find(s => s.id === complaint.assigned_to)?.full_name}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Maintenance Staff Tab */}
        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            {!showMaintenanceForm && (
              <button
                onClick={() => setShowMaintenanceForm(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                + Add Maintenance Staff
              </button>
            )}

            {showMaintenanceForm && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Add Maintenance Staff Member</h2>
                <form onSubmit={handleAddMaintenanceStaff} className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={maintenanceFormData.fullName}
                      onChange={(e) => setMaintenanceFormData({...maintenanceFormData, fullName: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Email *</label>
                    <input
                      type="email"
                      value={maintenanceFormData.email}
                      onChange={(e) => setMaintenanceFormData({...maintenanceFormData, email: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Password *</label>
                    <input
                      type="password"
                      value={maintenanceFormData.password}
                      onChange={(e) => setMaintenanceFormData({...maintenanceFormData, password: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Phone</label>
                    <input
                      type="tel"
                      value={maintenanceFormData.phone}
                      onChange={(e) => setMaintenanceFormData({...maintenanceFormData, phone: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                      Add Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMaintenanceForm(false)}
                      className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Current Staff</h2>
              {maintenanceStaff.length === 0 ? (
                <p className="text-gray-500">No maintenance staff added yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left">Name</th>
                        <th className="px-6 py-3 text-left">Email</th>
                        <th className="px-6 py-3 text-left">Phone</th>
                        <th className="px-6 py-3 text-left">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceStaff.map(staff => (
                        <tr key={staff.id} className="border-b hover:bg-gray-50">
                          <td className="px-6 py-3">{staff.full_name}</td>
                          <td className="px-6 py-3">{staff.email}</td>
                          <td className="px-6 py-3">{staff.phone}</td>
                          <td className="px-6 py-3">{new Date(staff.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bills & Utilities Tab */}
        {activeTab === 'utilities' && (
          <div className="space-y-6">
            {!showUtilityForm && (
              <button
                onClick={() => setShowUtilityForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Submit Bill/Utility Data
              </button>
            )}

            {showUtilityForm && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Submit Utility & Bill Data</h2>
                <form onSubmit={handleSubmitUtility} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Tenant *</label>
                    <select
                      value={utilityFormData.tenantId}
                      onChange={(e) => setUtilityFormData({...utilityFormData, tenantId: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">-- Select Tenant --</option>
                      {tenants.map(tenant => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.full_name} {tenant.unit_number ? `(Unit: ${tenant.unit_number})` : '(No Unit)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Month *</label>
                    <input
                      type="month"
                      value={utilityFormData.month}
                      onChange={(e) => setUtilityFormData({...utilityFormData, month: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Rent</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.rent}
                      onChange={(e) => setUtilityFormData({...utilityFormData, rent: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Water Usage (m³)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.waterUsage}
                      onChange={(e) => setUtilityFormData({...utilityFormData, waterUsage: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Electricity Usage (kWh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.electricityUsage}
                      onChange={(e) => setUtilityFormData({...utilityFormData, electricityUsage: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Water Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.waterCost}
                      onChange={(e) => setUtilityFormData({...utilityFormData, waterCost: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Electricity Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.electricityCost}
                      onChange={(e) => setUtilityFormData({...utilityFormData, electricityCost: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-full flex gap-4">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                      Submit
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUtilityForm(false)}
                      className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Submitted Data</h2>
              {utilityFormData.tenantId ? (
                <>
                  <h3 className="font-bold text-gray-700">Recent Utility Readings</h3>
                  {utilityHistory.length === 0 ? (
                    <p className="text-sm text-gray-600 mt-2">No utility readings found for this tenant.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {utilityHistory.slice(0, 5).map(r => (
                        <li key={r.id} className="flex justify-between items-center border-b py-2">
                          <div>
                            <div className="font-medium">{r.utility_type || r.meter_type || 'Utility'}</div>
                            <div className="text-sm text-gray-600">{new Date(r.reading_date).toLocaleDateString()} — {r.reading_value || r.reading} {r.unit || ''}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(r.estimated_cost || r.cost || 0, r.currency || 'PHP')}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <h3 className="font-bold text-gray-700 mt-4">Recent Bills</h3>
                  {tenantLastBills.length === 0 ? (
                    <p className="text-sm text-gray-600 mt-2">No bills found for this tenant.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {tenantLastBills.slice(0,5).map(b => (
                        <li key={b.id} className="flex justify-between items-center border-b py-2">
                          <div>
                            <div className="font-medium">Due: {new Date(b.due_date).toLocaleDateString()}</div>
                            <div className="text-sm text-gray-600">{b.full_name || b.email}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(b.amount, b.currency || 'PHP')}</div>
                            <div className="text-sm text-gray-500">{b.status}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-gray-600">Select a tenant above to view submitted utility and bill data.</p>
              )}
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, color }) => (
  <div className={`${color} rounded-lg shadow-md text-white p-6`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium opacity-90">{title}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
      </div>
      <div className="text-4xl opacity-20">{icon}</div>
    </div>
  </div>
);

export default AdminDashboard;
