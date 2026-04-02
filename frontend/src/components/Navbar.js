import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User, Home, Settings } from 'lucide-react';
import AuthContext from '../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const userName = user?.name || localStorage.getItem('userName') || 'User';
  let userRole = user?.role || localStorage.getItem('userRole') || 'tenant';
  
  // Normalize role (handle both 'maintenance' and 'maintenance_staff')
  if (userRole === 'maintenance_staff') {
    userRole = 'maintenance';
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsOpen(false);
  };

  const toggleMenu = () => setIsOpen(!isOpen);

  const navLinks = {
    tenant: [
      { label: 'Dashboard', path: '/tenant', icon: Home },
      { label: 'Payments', path: '/tenant/payments', icon: 'payment' },
      { label: 'Complaints', path: '/tenant/complaints', icon: 'complaint' },
    ],
    admin: [
      { label: 'Dashboard', path: '/admin', icon: Home },
      { label: 'Settings', path: '/admin/settings', icon: Settings },
    ],
    maintenance: [
    ],
  };

  const links = navLinks[userRole] || navLinks.tenant;

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <Link 
            to={userRole === 'admin' ? '/admin' : userRole === 'maintenance' ? '/maintenance' : '/tenant'}
            className="flex items-center space-x-2 font-bold text-xl hover:text-blue-100 transition duration-200"
          >
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-blue-600 font-bold">PM</span>
            </div>
            <span className="hidden sm:inline">Property Manager</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-blue-700 transition">
              <User size={18} />
              <span className="text-sm font-medium truncate max-w-xs">{userName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 px-3 py-2 rounded-md bg-red-500 hover:bg-red-600 transition duration-200 text-sm font-medium"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMenu}
              className="md:hidden p-2 rounded-md hover:bg-blue-700 transition"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t border-blue-500 pt-4">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 rounded-md text-base font-medium hover:bg-blue-700 transition"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-blue-500">
              <p className="px-4 py-2 text-sm text-blue-100">Logged in as: {userName}</p>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
