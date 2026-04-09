import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiDollarSign, FiAlertCircle, FiCheckCircle, FiCalendar, FiX } from 'react-icons/fi';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Breadcrumbs from '../components/Breadcrumbs';
import { formatAppDate } from '../utils/dateTime';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [bills, setBills] = useState([]);
  const [maintenanceStaff, setMaintenanceStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showUtilityForm, setShowUtilityForm] = useState(false);
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [resetPasswordModal, setResetPasswordModal] = useState({
    isOpen: false,
    accountType: 'tenant',
    accountId: null,
    accountName: '',
  });
  const [resetPasswordData, setResetPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);
  const [createdTenant, setCreatedTenant] = useState(null);
  const [copiedPasswordField, setCopiedPasswordField] = useState(false);
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: ''
  });
  const [tenantFormData, setTenantFormData] = useState({
    email: '',
    fullName: '',
    phone: '',
    unitNumber: ''
  });
  const [utilityFormData, setUtilityFormData] = useState({
    tenantId: '',
    month: '',
    rent: '',
    waterPreviousReading: '',
    waterPresentReading: '',
    waterUsage: '',
    waterRateCategory: 'hvha',
    electricityUsage: '',
    electricityPreviousReading: '',
    electricityPresentReading: '',
    waterRate: '',
    electricityRate: '',
    waterCost: '',
    electricityCost: ''
  });
  const [selectedPreviewComplaintId, setSelectedPreviewComplaintId] = useState(null);
  const [previewComplaintUrl, setPreviewComplaintUrl] = useState(null);
  const [previewComplaintLoading, setPreviewComplaintLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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

  const parseOptionalNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const deriveUsageFromReadings = (previousReading, presentReading, directUsage) => {
    const prev = parseOptionalNumber(previousReading);
    const present = parseOptionalNumber(presentReading);
    if (prev != null && present != null) {
      return Math.max(0, present - prev);
    }

    const direct = parseOptionalNumber(directUsage);
    return direct != null ? Math.max(0, direct) : 0;
  };

  const hasAnyValue = (...values) => values.some((value) => value !== null && value !== undefined && value !== '');

  const generateUniquePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest with random characters
    for (let i = password.length; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const fetchUtilityForTenant = async (tenantId) => {
    if (!tenantId) {
      setUtilityHistory([]);
      setTenantLastBills([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
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
    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotificationsQuiet();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (previewComplaintUrl) {
        URL.revokeObjectURL(previewComplaintUrl);
      }
    };
  }, [previewComplaintUrl]);

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      
      if (!token) {
        console.error('No authentication token found');
        toast.error('Authentication required. Please log in.');
        setIsLoading(false);
        return;
      }
      
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [statsRes, tenantsRes, complaintsRes, appointmentsRes, staffRes, billsRes] = await Promise.all([
        axios.get(`${apiUrl}/api/admin/dashboard`, config).catch(err => {
          console.error('Dashboard endpoint failed:', err.response?.status, err.response?.data);
          throw new Error(`Dashboard API failed: ${err.response?.data?.message || err.message}`);
        }),
        axios.get(`${apiUrl}/api/admin/tenants`, config).catch(err => {
          console.error('Tenants endpoint failed:', err.response?.status, err.response?.data);
          throw new Error(`Tenants API failed: ${err.response?.data?.message || err.message}`);
        }),
        axios.get(`${apiUrl}/api/complaint/all`, config).catch(() => ({ data: { data: [] } })),
        axios.get(`${apiUrl}/api/admin/appointments`, config).catch(() => ({ data: { data: [] } })),
        axios.get(`${apiUrl}/api/admin/maintenance-staff`, config).catch(() => ({ data: { data: [] } })),
        axios.get(`${apiUrl}/api/admin/bills`, config).catch(() => ({ data: { data: [] } }))
      ]);

      setStats(statsRes.data.data);
      setTenants(tenantsRes.data.data);
      setComplaints(complaintsRes.data.data || []);
      setAppointments(appointmentsRes.data.data || []);
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

  const handleComplaintStatusChange = async (complaintId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
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

  const handlePreviewComplaintAttachment = async (complaint) => {
    if (selectedPreviewComplaintId === complaint.id) {
      setSelectedPreviewComplaintId(null);
      setPreviewComplaintLoading(false);
      if (previewComplaintUrl) {
        URL.revokeObjectURL(previewComplaintUrl);
        setPreviewComplaintUrl(null);
      }
      return;
    }

    if (!complaint.attachment_filename || !complaint.attachment_type?.startsWith('image/')) {
      toast.error('No image attachment available for preview');
      return;
    }

    setPreviewComplaintLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/complaint/${complaint.id}/attachment/view`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to load preview');
      }

      const blob = await response.blob();
      if (previewComplaintUrl) {
        URL.revokeObjectURL(previewComplaintUrl);
      }
      const url = URL.createObjectURL(blob);
      setPreviewComplaintUrl(url);
      setSelectedPreviewComplaintId(complaint.id);
    } catch (error) {
      console.error('Error loading attachment preview:', error);
      toast.error('Unable to load image preview. Please try again.');
      setSelectedPreviewComplaintId(null);
    } finally {
      setPreviewComplaintLoading(false);
    }
  };

  const handleDownloadComplaintAttachment = async (complaint) => {
    if (!complaint.attachment_filename) {
      toast.error('No attachment available to download');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/complaint/${complaint.id}/attachment/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to download attachment');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = complaint.attachment_filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error('Unable to download attachment. Please try again.');
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
      const apiUrl = process.env.REACT_APP_API_URL || '';
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

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    
    if (!tenantFormData.email || !tenantFormData.fullName || !tenantFormData.unitNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      console.log('Creating tenant, API URL:', apiUrl);
      
      const response = await axios.post(
        `${apiUrl}/api/auth/admin/create-tenant`,
        tenantFormData,
        config
      );

      // Store the created tenant info with password for display
      setCreatedTenant({
        email: tenantFormData.email,
        fullName: tenantFormData.fullName,
        unitNumber: tenantFormData.unitNumber,
        activationUrl: response.data?.activationUrl || ''
      });

      toast.success('Tenant account created and activation email sent');
      setTenantFormData({ email: '', fullName: '', phone: '', unitNumber: '' });
      fetchAdminData();
    } catch (error) {
      console.error('Create tenant error - Full response:', error.response);
      console.error('Create tenant error - Message:', error.message);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to create tenant';
      toast.error(errorMsg);
    }
  };

  const handleCopyPassword = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedPasswordField(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedPasswordField(false), 2000);
  };

  const handleEditTenant = (tenant) => {
    setEditingTenant({
      id: tenant.id,
      fullName: tenant.full_name,
      email: tenant.email,
      phone: tenant.phone || '',
      unitNumber: tenant.unit_number
    });
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();

    if (!editingTenant.fullName || !editingTenant.email || !editingTenant.unitNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.put(
        `${apiUrl}/api/admin/tenants/${editingTenant.id}`,
        {
          fullName: editingTenant.fullName,
          email: editingTenant.email,
          phone: editingTenant.phone,
          unitNumber: editingTenant.unitNumber
        },
        config
      );

      toast.success('Tenant updated successfully');
      setEditingTenant(null);
      fetchAdminData();
    } catch (error) {
      console.error('Update tenant error:', error.response);
      const errorMsg = error.response?.data?.message || 'Failed to update tenant';
      toast.error(errorMsg);
    }
  };

  const openResetPasswordModal = (accountType, account) => {
    const generated = generateUniquePassword();
    setResetPasswordModal({
      isOpen: true,
      accountType,
      accountId: account.id,
      accountName: account.full_name,
    });
    setResetPasswordData({
      newPassword: generated,
      confirmPassword: generated,
    });
  };

  const closeResetPasswordModal = () => {
    setResetPasswordModal({
      isOpen: false,
      accountType: 'tenant',
      accountId: null,
      accountName: '',
    });
    setResetPasswordData({ newPassword: '', confirmPassword: '' });
    setResetPasswordSubmitting(false);
  };

  const handleResetTenantPassword = (tenant) => {
    openResetPasswordModal('tenant', tenant);
  };

  const handleDeleteTenant = async (tenant) => {
    const confirmed = window.confirm(
      `Delete tenant account for ${tenant.full_name}? This removes related tenant records and cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      await axios.delete(`${apiUrl}/api/admin/tenants/${tenant.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Tenant account deleted');
      fetchAdminData();
    } catch (error) {
      console.error('Delete tenant error:', error.response || error.message);
      toast.error(error.response?.data?.message || 'Failed to delete tenant');
    }
  };

  const handleEditMaintenance = (staff) => {
    setEditingMaintenance({
      id: staff.id,
      fullName: staff.full_name,
      email: staff.email,
      phone: staff.phone || '',
    });
  };

  const handleUpdateMaintenance = async (e) => {
    e.preventDefault();
    if (!editingMaintenance?.fullName || !editingMaintenance?.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      await axios.put(
        `${apiUrl}/api/admin/maintenance-staff/${editingMaintenance.id}`,
        {
          fullName: editingMaintenance.fullName,
          email: editingMaintenance.email,
          phone: editingMaintenance.phone,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Maintenance staff updated successfully');
      setEditingMaintenance(null);
      fetchAdminData();
    } catch (error) {
      console.error('Update maintenance staff error:', error.response || error.message);
      toast.error(error.response?.data?.message || 'Failed to update maintenance staff');
    }
  };

  const handleResetMaintenancePassword = (staff) => {
    openResetPasswordModal('maintenance', staff);
  };

  const handleSubmitResetPassword = async (e) => {
    e.preventDefault();

    const password = resetPasswordData.newPassword.trim();
    const confirmPassword = resetPasswordData.confirmPassword.trim();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setResetPasswordSubmitting(true);
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const endpoint = resetPasswordModal.accountType === 'tenant'
        ? `${apiUrl}/api/admin/tenants/${resetPasswordModal.accountId}/reset-password`
        : `${apiUrl}/api/admin/maintenance-staff/${resetPasswordModal.accountId}/reset-password`;

      await axios.patch(
        endpoint,
        { newPassword: password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Password reset for ${resetPasswordModal.accountName}`);
      closeResetPasswordModal();
    } catch (error) {
      console.error('Reset password error:', error.response || error.message);
      toast.error(error.response?.data?.message || 'Failed to reset account password');
    } finally {
      setResetPasswordSubmitting(false);
    }
  };

  const handleDeleteMaintenance = async (staff) => {
    const confirmed = window.confirm(
      `Delete maintenance staff account for ${staff.full_name}? Assigned complaints will be unassigned.`
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      await axios.delete(`${apiUrl}/api/admin/maintenance-staff/${staff.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Maintenance staff account deleted');
      if (editingMaintenance?.id === staff.id) {
        setEditingMaintenance(null);
      }
      fetchAdminData();
    } catch (error) {
      console.error('Delete maintenance staff error:', error.response || error.message);
      toast.error(error.response?.data?.message || 'Failed to delete maintenance staff');
    }
  };

  const handleAssignComplaint = async (complaintId, maintenanceStaffId) => {
    try {
      if (!maintenanceStaffId) {
        toast.error('Please select a maintenance staff member');
        return;
      }

      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
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
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const hasWaterDirectUsage = hasAnyValue(utilityFormData.waterUsage);
      const hasWaterReadingPair = hasAnyValue(utilityFormData.waterPreviousReading, utilityFormData.waterPresentReading);
      const hasElectricityDirectUsage = hasAnyValue(utilityFormData.electricityUsage);
      const hasElectricityReadingPair = hasAnyValue(utilityFormData.electricityPreviousReading, utilityFormData.electricityPresentReading);

      if (hasAnyValue(utilityFormData.waterPreviousReading) !== hasAnyValue(utilityFormData.waterPresentReading)) {
        toast.error('Enter both water previous and present readings, or leave both blank');
        return;
      }

      if (hasAnyValue(utilityFormData.electricityPreviousReading) !== hasAnyValue(utilityFormData.electricityPresentReading)) {
        toast.error('Enter both electricity previous and present readings, or leave both blank');
        return;
      }

      if (!hasAnyValue(utilityFormData.rent) && !hasWaterDirectUsage && !hasWaterReadingPair && !hasElectricityDirectUsage && !hasElectricityReadingPair) {
        toast.error('Enter rent, water data, or electricity data before submitting');
        return;
      }

      const derivedWaterUsage = hasWaterDirectUsage || hasWaterReadingPair
        ? deriveUsageFromReadings(
            utilityFormData.waterPreviousReading,
            utilityFormData.waterPresentReading,
            utilityFormData.waterUsage
          )
        : null;

      const derivedElectricityUsage = hasElectricityDirectUsage || hasElectricityReadingPair
        ? deriveUsageFromReadings(
            utilityFormData.electricityPreviousReading,
            utilityFormData.electricityPresentReading,
            utilityFormData.electricityUsage
          )
        : null;
      
      // Ensure numeric values are converted properly
      const payload = {
        tenantId: parseInt(utilityFormData.tenantId),
        month: utilityFormData.month,
        rent: parseOptionalNumber(utilityFormData.rent) || 0,
        waterPreviousReading: parseOptionalNumber(utilityFormData.waterPreviousReading),
        waterPresentReading: parseOptionalNumber(utilityFormData.waterPresentReading),
        waterUsage: derivedWaterUsage,
        waterRateCategory: utilityFormData.waterRateCategory || 'hvha',
        electricityPreviousReading: parseOptionalNumber(utilityFormData.electricityPreviousReading),
        electricityPresentReading: parseOptionalNumber(utilityFormData.electricityPresentReading),
        electricityUsage: derivedElectricityUsage,
        waterRate: parseOptionalNumber(utilityFormData.waterRate),
        electricityRate: parseOptionalNumber(utilityFormData.electricityRate),
        waterCost: parseOptionalNumber(utilityFormData.waterCost),
        electricityCost: parseOptionalNumber(utilityFormData.electricityCost)
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
        waterPreviousReading: '',
        waterPresentReading: '',
        waterUsage: '',
        waterRateCategory: 'hvha',
        electricityUsage: '',
        electricityPreviousReading: '',
        electricityPresentReading: '',
        waterRate: '',
        electricityRate: '',
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
      const apiUrl = process.env.REACT_APP_API_URL || '';
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

  const handleAppointmentStatusChange = async (appointmentId, nextStatus) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.patch(
        `${apiUrl}/api/admin/appointments/${appointmentId}/status`,
        { status: nextStatus },
        config
      );

      setAppointments((prev) => prev.map((appointment) => (
        appointment.id === appointmentId
          ? { ...appointment, status: nextStatus }
          : appointment
      )));
      toast.success('Appointment status updated');
    } catch (error) {
      console.error('Appointment status update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to update appointment status');
    }
  };

  if (isLoading) return <LoadingSpinner message="Loading Admin Dashboard" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="min-h-screen page-wrapper"
    >
      <div className="dashboard-header py-8 mb-8 rounded-xl">
        <div className="max-w-7xl mx-auto px-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-2">Manage tenants, payments, maintenance, and utility billing</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 mb-8">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />
      </div>

      <div className="max-w-7xl mx-auto px-8">
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'overview' ? 'text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-600'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'tenants' ? 'text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-600'}`}
          >
            Tenants
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'complaints' ? 'text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-600'}`}
          >
            Complaints ({complaints.length})
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'maintenance' ? 'text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-600'}`}
          >
            Maintenance Staff
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'appointments' ? 'text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-600'}`}
          >
            Appointments ({appointments.length})
          </button>
          <button
            onClick={() => setActiveTab('utilities')}
            className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'utilities' ? 'text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-600'}`}
          >
            Bills & Utilities
          </button>

          <button
            onClick={() => navigate('/admin/payments')}
            className={`px-4 py-2 font-medium whitespace-nowrap transition ${location.pathname === '/admin/payments' ? 'text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-600 hover:text-indigo-700 hover:border-b-2 hover:border-indigo-500'}`}
          >
            Payment Management
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <StatCard
                icon={<FiUsers />}
                title="Total Tenants"
                value={stats?.totalTenants || 0}
                color="bg-blue-500"
                onClick={() => setActiveTab('tenants')}
              />
              <StatCard
                icon={<FiDollarSign />}
                title="Pending Rents"
                value={stats?.pendingRents || 0}
                color="bg-orange-500"
                onClick={() => navigate('/admin/payments')}
              />
              <StatCard
                icon={<FiAlertCircle />}
                title="Total Complaints"
                value={stats?.totalComplaints || 0}
                color="bg-red-500"
                onClick={() => setActiveTab('complaints')}
              />
              <StatCard
                icon={<FiCheckCircle />}
                title="Resolved Complaints"
                value={stats?.resolvedComplaints || 0}
                color="bg-green-500"
                onClick={() => setActiveTab('complaints')}
              />
              <StatCard
                icon={<FiCalendar />}
                title="Appointments"
                value={stats?.totalAppointments ?? appointments.length}
                color="bg-indigo-500"
                onClick={() => setActiveTab('appointments')}
              />
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div>
            <div className="card-base p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900">All Tenants</h2>
                <button
                  onClick={() => {
                    setShowTenantForm(!showTenantForm);
                    if (showTenantForm) setCreatedTenant(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  {showTenantForm ? 'Cancel' : '+ Create Tenant'}
                </button>
              </div>

              {showTenantForm && (
                <form onSubmit={handleCreateTenant} className="bg-slate-50 p-6 rounded-lg mb-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        value={tenantFormData.fullName}
                        onChange={(e) => setTenantFormData({...tenantFormData, fullName: e.target.value})}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={tenantFormData.email}
                        onChange={(e) => setTenantFormData({...tenantFormData, email: e.target.value})}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Enter email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Unit Number *</label>
                      <input
                        type="text"
                        value={tenantFormData.unitNumber}
                        onChange={(e) => setTenantFormData({...tenantFormData, unitNumber: e.target.value})}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="e.g., A-101, B-202"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Phone (Optional)</label>
                      <input
                        type="tel"
                        value={tenantFormData.phone}
                        onChange={(e) => setTenantFormData({...tenantFormData, phone: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-700">
                      A welcome email with a secure activation link will be sent automatically. The tenant will create their own password in the portal.
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                  >
                    Create Tenant Account
                  </button>
                </form>
              )}

              {createdTenant && (
                <div className="bg-green-50 border border-green-200 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-bold text-green-800 mb-4">✓ Tenant Created Successfully</h3>
                  <div className="space-y-4 bg-white p-4 rounded-lg">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Full Name</label>
                      <input
                        type="text"
                        value={createdTenant.fullName}
                        readOnly
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={createdTenant.email}
                          readOnly
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                        />
                        <button
                          onClick={() => handleCopyPassword(createdTenant.email)}
                          className="p-2 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 rounded-lg transition"
                          title="Copy email"
                        >
                          {copiedPasswordField ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Assigned Unit</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={createdTenant.unitNumber}
                          readOnly
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                        />
                      </div>
                    </div>

                    {createdTenant.activationUrl && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Activation Link (Development)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={createdTenant.activationUrl}
                            readOnly
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-xs"
                          />
                          <button
                            onClick={() => handleCopyPassword(createdTenant.activationUrl)}
                            className="p-2 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 rounded-lg transition"
                            title="Copy activation link"
                          >
                            {copiedPasswordField ? <Check size={18} /> : <Copy size={18} />}
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-slate-600 bg-amber-50 p-3 rounded border border-amber-200">
                      📨 <strong>The tenant has been emailed a secure activation link.</strong> They will set their own password before first login.
                    </p>

                    <button
                      onClick={() => {
                        setCreatedTenant(null);
                        setShowTenantForm(false);
                      }}
                      className="w-full px-4 py-2 bg-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-400 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

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
                      <td className="px-6 py-3">{formatAppDate(tenant.created_at)}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <button 
                            onClick={() => handleEditTenant(tenant)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleResetTenantPassword(tenant)}
                            className="text-amber-700 hover:text-amber-900 hover:underline font-medium"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleDeleteTenant(tenant)}
                            className="text-red-600 hover:text-red-800 hover:underline font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Edit Tenant Form */}
            {editingTenant && (
              <div className="card-base p-6 bg-blue-50 border border-blue-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Tenant: {editingTenant.fullName}</h3>
                <form onSubmit={handleUpdateTenant} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        value={editingTenant.fullName}
                        onChange={(e) => setEditingTenant({...editingTenant, fullName: e.target.value})}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={editingTenant.email}
                        onChange={(e) => setEditingTenant({...editingTenant, email: e.target.value})}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Enter email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Unit Number *</label>
                      <input
                        type="text"
                        value={editingTenant.unitNumber}
                        onChange={(e) => setEditingTenant({...editingTenant, unitNumber: e.target.value})}
                        required
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="e.g., A-101, B-202"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={editingTenant.phone}
                        onChange={(e) => setEditingTenant({...editingTenant, phone: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTenant(null)}
                      className="flex-1 px-4 py-2 bg-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-400 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.length === 0 ? (
              <div className="card-base p-6 text-center">
                <p className="text-slate-400">No complaints found</p>
              </div>
            ) : (
              complaints.map(complaint => (
                <div key={complaint.id} className="card-base p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{complaint.title}</h3>
                      <p className="text-sm text-slate-400">Tenant: {complaint.full_name || 'Unknown'}</p>
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

                  <p className="text-slate-300 mb-4">{complaint.description}</p>

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

                  {complaint.attachment_filename && (
                    <div className="mt-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Attachment</p>
                          <p className="text-sm text-slate-600">{complaint.attachment_filename}</p>
                          {complaint.attachment_size && (
                            <p className="text-xs text-slate-500">{(complaint.attachment_size / (1024 * 1024)).toFixed(2)} MB</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {complaint.attachment_type?.startsWith('image/') && (
                            <button
                              type="button"
                              onClick={() => handlePreviewComplaintAttachment(complaint)}
                              className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-medium hover:bg-emerald-200"
                            >
                              {selectedPreviewComplaintId === complaint.id ? 'Hide Preview' : previewComplaintLoading && selectedPreviewComplaintId === complaint.id ? 'Loading...' : 'Preview'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadComplaintAttachment(complaint)}
                            className="px-3 py-1 rounded bg-slate-100 text-slate-800 text-xs font-medium hover:bg-slate-200"
                          >
                            Download
                          </button>
                        </div>
                      </div>

                      {selectedPreviewComplaintId === complaint.id && previewComplaintUrl && (
                        <div className="mt-3">
                          <img
                            src={previewComplaintUrl}
                            alt="Complaint attachment preview"
                            className="w-full max-h-96 rounded-lg border border-slate-200 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
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
              <div className="card-base p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Add Maintenance Staff Member</h2>
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
                    <button type="submit" className="brand-button text-white px-4 py-2 rounded-lg hover:opacity-95">
                      Add Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMaintenanceForm(false)}
                      className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="card-base p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Current Staff</h2>
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
                        <th className="px-6 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceStaff.map(staff => (
                        <tr key={staff.id} className="border-b hover:bg-gray-50">
                          <td className="px-6 py-3">{staff.full_name}</td>
                          <td className="px-6 py-3">{staff.email}</td>
                          <td className="px-6 py-3">{staff.phone}</td>
                          <td className="px-6 py-3">{formatAppDate(staff.created_at)}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <button
                                onClick={() => handleEditMaintenance(staff)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleResetMaintenancePassword(staff)}
                                className="text-amber-700 hover:text-amber-900 hover:underline font-medium"
                              >
                                Reset Password
                              </button>
                              <button
                                onClick={() => handleDeleteMaintenance(staff)}
                                className="text-red-600 hover:text-red-800 hover:underline font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {editingMaintenance && (
                <div className="card-base p-6 mt-6 bg-blue-50 border border-blue-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Maintenance Staff: {editingMaintenance.fullName}</h3>
                  <form onSubmit={handleUpdateMaintenance} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                        <input
                          type="text"
                          value={editingMaintenance.fullName}
                          onChange={(e) => setEditingMaintenance({...editingMaintenance, fullName: e.target.value})}
                          required
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                        <input
                          type="email"
                          value={editingMaintenance.email}
                          onChange={(e) => setEditingMaintenance({...editingMaintenance, email: e.target.value})}
                          required
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          value={editingMaintenance.phone}
                          onChange={(e) => setEditingMaintenance({...editingMaintenance, phone: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMaintenance(null)}
                        className="flex-1 px-4 py-2 bg-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-400 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="card-base p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Schedule Appointment Requests</h2>
            {appointments.length === 0 ? (
              <p className="text-slate-500">No appointment requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left">Name</th>
                      <th className="px-6 py-3 text-left">Email</th>
                      <th className="px-6 py-3 text-left">Preferred Date</th>
                      <th className="px-6 py-3 text-left">Building</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Requested At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appointment) => (
                      <tr key={appointment.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-3">{appointment.full_name}</td>
                        <td className="px-6 py-3">{appointment.email}</td>
                        <td className="px-6 py-3">{formatAppDate(appointment.preferred_date)}</td>
                        <td className="px-6 py-3">Building {appointment.building}</td>
                        <td className="px-6 py-3">
                          <select
                            value={appointment.status || 'pending'}
                            onChange={(e) => handleAppointmentStatusChange(appointment.id, e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-6 py-3">{formatAppDate(appointment.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Bills & Utilities Tab */}
        {activeTab === 'utilities' && (
          <div className="space-y-6">
            {!showUtilityForm && (
              <button
                onClick={() => setShowUtilityForm(true)}
                className="brand-button text-white px-4 py-2 rounded-lg hover:opacity-95"
              >
                + Submit Bill/Utility Data
              </button>
            )}

            {showUtilityForm && (
              <div className="card-base p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Submit Utility & Bill Data</h2>
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
                    <p className="text-xs text-gray-500 mt-1">Optional direct usage. If previous and present are provided, usage is auto-computed.</p>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Water Previous Reading (Cu.M.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.waterPreviousReading}
                      onChange={(e) => setUtilityFormData({...utilityFormData, waterPreviousReading: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g. 132"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Water Present Reading (Cu.M.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.waterPresentReading}
                      onChange={(e) => setUtilityFormData({...utilityFormData, waterPresentReading: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g. 155"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Water Billing Mode</label>
                    <select
                      value={utilityFormData.waterRateCategory}
                      onChange={(e) => setUtilityFormData({...utilityFormData, waterRateCategory: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="hvha">HVHA / Hongkong Village (Flat ₱10/Cu.M.)</option>
                      <option value="residential">Cabuyao District - Residential</option>
                      <option value="commercial_2_0">Cabuyao District - Commercial (2.0)</option>
                      <option value="commercial_a_1_75">Cabuyao District - Commercial A (1.75)</option>
                      <option value="commercial_b_1_50">Cabuyao District - Commercial B (1.50)</option>
                      <option value="commercial_c_1_25">Cabuyao District - Commercial C (1.25)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Used for automatic water cost when Water Cost is left blank.</p>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Manual Water Rate (₱/m³)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={utilityFormData.waterRate}
                      onChange={(e) => setUtilityFormData({...utilityFormData, waterRate: e.target.value})}
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
                    <p className="text-xs text-gray-500 mt-1">Optional direct usage. If previous and present are provided, usage is auto-computed.</p>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Electricity Previous Reading (kWh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.electricityPreviousReading}
                      onChange={(e) => setUtilityFormData({...utilityFormData, electricityPreviousReading: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="Previous reading"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Electricity Present Reading (kWh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={utilityFormData.electricityPresentReading}
                      onChange={(e) => setUtilityFormData({...utilityFormData, electricityPresentReading: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="Present reading"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Manual Electricity Rate (₱/kWh)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={utilityFormData.electricityRate}
                      onChange={(e) => setUtilityFormData({...utilityFormData, electricityRate: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="Leave blank to use current MERALCO rate"
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
                    <p className="text-xs text-gray-500 mt-1">Leave blank for automatic water cost computation.</p>
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
                    <p className="text-xs text-gray-500 mt-1">Leave blank for automatic electricity cost computation.</p>
                  </div>
                  <div className="col-span-full flex gap-4">
                    <button type="submit" className="brand-button text-white px-4 py-2 rounded-lg hover:opacity-95">
                      Submit
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUtilityForm(false)}
                      className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="card-base p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Submitted Data</h2>
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
                            <div className="text-sm text-gray-600">{formatAppDate(r.reading_date)} — {r.reading_value || r.reading} {r.unit || ''}</div>
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
                            <div className="font-medium">Due: {formatAppDate(b.due_date)}</div>
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

      {resetPasswordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg card-base border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Reset Account Password</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {resetPasswordModal.accountType === 'tenant' ? 'Tenant' : 'Maintenance staff'}: {resetPasswordModal.accountName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeResetPasswordModal}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
                aria-label="Close reset password modal"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">New Password *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetPasswordData.newPassword}
                    onChange={(e) => setResetPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateUniquePassword();
                      setResetPasswordData({ newPassword: generated, confirmPassword: generated });
                      toast.success('New password generated');
                    }}
                    className="px-3 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition whitespace-nowrap"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password *</label>
                <input
                  type="text"
                  value={resetPasswordData.confirmPassword}
                  onChange={(e) => setResetPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Re-enter password"
                  required
                />
              </div>

              <p className="text-xs text-slate-500">
                Minimum 6 characters. You can copy the password after resetting and send it securely to the user.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={resetPasswordSubmitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
                >
                  {resetPasswordSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
                <button
                  type="button"
                  onClick={closeResetPasswordModal}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const StatCard = ({ icon, title, value, color, onClick }) => {
  const cardClasses = `${color} rounded-lg shadow-md text-white p-6 transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-200' : ''}`;

  const handleKeyDown = (event) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={onClick ? `Open ${title}` : undefined}
    >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium opacity-90">{title}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
      </div>
      <div className="text-4xl opacity-20">{icon}</div>
    </div>
    </div>
  );
};

export default AdminDashboard;
