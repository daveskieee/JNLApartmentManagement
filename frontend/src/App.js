import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

// Components
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Chatbot from './components/Chatbot';

// Context
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

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

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </div>
        <Toaster position="top-right" />
      </AuthProvider>
    </Router>
  );
}

export default App;
