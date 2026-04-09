import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TenantDashboard from './pages/TenantDashboard';
import ComplaintsPage from './pages/ComplaintsPage';
import PaymentPage from './pages/PaymentPage';
import PaymentSuccess from './pages/PaymentSuccess';
import AdminDashboard from './pages/AdminDashboard';
import AdminPayments from './pages/AdminPayments';
import AdminUtilityDebug from './pages/AdminUtilityDebug';
import MaintenanceDashboard from './pages/MaintenanceDashboard';
import MaintenanceHistoryPage from './pages/MaintenanceHistoryPage';
import LandingPage from './pages/LandingPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForceChangePasswordPage from './pages/ForceChangePasswordPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';

// Components
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Chatbot from './components/Chatbot';

// Context
import { AuthProvider } from './context/AuthContext';

const TabMetadataSync = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let section = 'Home';

    if (path === '/' || path === '/landing') section = 'Landing';
    else if (path === '/login') section = 'Login';
    else if (path === '/register') section = 'Register';
    else if (path.startsWith('/reset-password')) section = 'Reset Password';
    else if (path.startsWith('/activate-account')) section = 'Activate Account';
    else if (path === '/force-change-password') section = 'Change Password';
    else if (path === '/tenant') section = 'Tenant Dashboard';
    else if (path === '/tenant/payments') section = 'Tenant Payments';
    else if (path === '/tenant/complaints') section = 'Tenant Complaints';
    else if (path === '/tenant/profile') section = 'Tenant Profile';
    else if (path === '/tenant/notifications') section = 'Tenant Notifications';
    else if (path === '/admin') section = 'Admin Dashboard';
    else if (path === '/admin/payments') section = 'Admin Payments';
    else if (path === '/admin/utility-debug') section = 'Admin Utility Debug';
    else if (path === '/admin/profile') section = 'Admin Profile';
    else if (path === '/admin/notifications') section = 'Admin Notifications';
    else if (path === '/maintenance') section = 'Maintenance Dashboard';
    else if (path === '/maintenance/history') section = 'Maintenance History';
    else if (path === '/maintenance/profile') section = 'Maintenance Profile';
    else if (path === '/maintenance/notifications') section = 'Maintenance Notifications';
    else if (path === '/payment/success') section = 'Payment Success';

    document.title = `${section} | Property Manager`;
  }, [location.pathname]);

  return null;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <TabMetadataSync />
        <div className="min-h-screen page-wrapper">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/activate-account/:token" element={<ResetPasswordPage mode="activation" />} />
            <Route path="/force-change-password" element={<ForceChangePasswordPage />} />

            {/* Tenant Routes */}
            <Route
              path="/tenant"
              element={
                <PrivateRoute role="tenant">
                  <Navbar />
                  <TenantDashboard />
                  <Chatbot />
                </PrivateRoute>
              }
            />
            <Route
              path="/tenant/complaints"
              element={
                <PrivateRoute role="tenant">
                  <Navbar />
                  <ComplaintsPage />
                  <Chatbot />
                </PrivateRoute>
              }
            />

            <Route
              path="/tenant/payments"
              element={
                <PrivateRoute role="tenant">
                  <Navbar />
                  <PaymentPage />
                  <Chatbot />
                </PrivateRoute>
              }
            />

            <Route
              path="/payment/success"
              element={
                <PrivateRoute role="tenant">
                  <Navbar />
                  <PaymentSuccess />
                  <Chatbot />
                </PrivateRoute>
              }
            />

            <Route
              path="/tenant/profile"
              element={
                <PrivateRoute role="tenant">
                  <Navbar />
                  <ProfilePage />
                </PrivateRoute>
              }
            />

            <Route
              path="/tenant/notifications"
              element={
                <PrivateRoute role="tenant">
                  <Navbar />
                  <NotificationsPage role="tenant" />
                </PrivateRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <PrivateRoute role="admin">
                  <Navbar />
                  <AdminDashboard />
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/payments"
              element={
                <PrivateRoute role="admin">
                  <Navbar />
                  <AdminPayments />
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/utility-debug"
              element={
                <PrivateRoute role="admin">
                  <Navbar />
                  <AdminUtilityDebug />
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/profile"
              element={
                <PrivateRoute role="admin">
                  <Navbar />
                  <ProfilePage />
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/notifications"
              element={
                <PrivateRoute role="admin">
                  <Navbar />
                  <NotificationsPage role="admin" />
                </PrivateRoute>
              }
            />

            {/* Maintenance Routes */}
            <Route
              path="/maintenance"
              element={
                <PrivateRoute role="maintenance_staff">
                  <Navbar />
                  <MaintenanceDashboard />
                </PrivateRoute>
              }
            />

            <Route
              path="/maintenance/profile"
              element={
                <PrivateRoute role="maintenance_staff">
                  <Navbar />
                  <ProfilePage />
                </PrivateRoute>
              }
            />

            <Route
              path="/maintenance/notifications"
              element={
                <PrivateRoute role="maintenance_staff">
                  <Navbar />
                  <NotificationsPage role="maintenance_staff" />
                </PrivateRoute>
              }
            />

            <Route
              path="/maintenance/history"
              element={
                <PrivateRoute role="maintenance_staff">
                  <Navbar />
                  <MaintenanceHistoryPage />
                </PrivateRoute>
              }
            />

            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />

            {/* Default Route */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
        <Toaster position="top-right" />
      </AuthProvider>
    </Router>
  );
}

export default App;
