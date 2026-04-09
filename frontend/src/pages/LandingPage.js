import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Building2,
  ShieldCheck,
  Camera,
  Lock,
  Zap,
  MapPin,
  Home,
  Users,
  Calendar,
  Building,
  Layers,
  Menu,
  X,
  CreditCard,
  FileText,
} from 'lucide-react';
import Footer from '../components/Footer';

const floorPlans = {
  studio: {
    label: 'Studio Suite',
    price: '₱1,200/mo',
    area: '450 sq.ft.',
    image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/708319671.jpg?k=c5e4bf8a9333f82449f85c363907683359a49c4f4854b7ccfdb416d58d82ed36&o=',
  },
  oneBedroom: {
    label: 'One Bedroom',
    price: '₱1,850/mo',
    area: '750 sq.ft.',
    image: 'https://pix.dotproperty.co.th/eyJidWNrZXQiOiJwcmQtbGlmdWxsY29ubmVjdC1iYWNrZW5kLWIyYi1pbWFnZXMiLCJrZXkiOiJwcm9wZXJ0aWVzLzAxOWJiMjhiLWRiYzktNzIwYi1hZTMwLTBkODdlYzgzMTg2My8wMTljM2NjMy0zYzQzLTcxNDgtODlkNC0zYTNhYTIwZDcxOWIuanBnIiwiYnJhbmQiOiJkb3Rwcm9wZXJ0eSIsImVkaXRzIjp7InJvdGF0ZSI6bnVsbCwicmVzaXplIjp7IndpZHRoIjo0OTAsImhlaWdodCI6MzI1LCJmaXQiOiJjb3ZlciJ9fX0=',
  },
  twoBedroom: {
    label: 'Two Bedroom',
    price: '₱2,600/mo',
    area: '1,100 sq.ft.',
    image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/486423898.jpg?k=177211f1ef71c52a8a6c585a6f0751453650b0386c1f8ee0fa763cd6b94afbe9&o=',
  },
};

const amenities = [
  {
    name: 'Dedicated Parking',
    icon: Building,
    image: '/images/frontview/parking.png',
    big: true,
    description: 'Secure, covered parking spaces with 24/7 access for residents and guests',
  },
  {
    name: '24/7 Security',
    icon: ShieldCheck,
    image: '/images/frontview/Security.png',
  },
  {
    name: 'Gated Entrance',
    icon: Lock,
    image: '/images/frontview/Gate.png',
  },
  {
    name: 'CCTV Monitoring',
    icon: Camera,
    image: '/images/frontview/cctv.png',
  },
  {
    name: 'Reliable Utilities',
    icon: Zap,
    image: '/images/frontview/watertank.png',
    big: true,
    description: 'Modern water tank and electrical systems ensuring uninterrupted service',
  },
];

const buildings = ['A', 'B', 'C', 'D', 'E'];

const buildingImages = [
  '/images/frontview/apartment1.png',
  '/images/frontview/apartment2.png',
  '/images/frontview/apartment3.png',
  '/images/frontview/apartment4.png',
  '/images/frontview/apartment5.png',
];

const buildingGalleries = {
  A: [
    'https://images.unsplash.com/photo-1560448204-92f6c0b2aa29?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1618221120891-b9b0efd5f7c6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1549187774-b4e9df1e5f8d?auto=format&fit=crop&w=800&q=80',
  ],
  B: [
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1590608897129-79d9a8f53969?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542467411-8d801b66a9fc?auto=format&fit=crop&w=800&q=80',
  ],
  C: [
    'https://images.unsplash.com/photo-1431287314919-8f94acd65524?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1505691723518-36a023492c49?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
  ],
  D: [
    'https://images.unsplash.com/photo-1542314818-2cf2ee2dbd93?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
  ],
  E: [
    'https://images.unsplash.com/photo-1540852280-5b53a9dfc5c3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1551918120-973f7f8d4ada?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=800&q=80',
  ],
};

const neighborhoodSpots = [
  {
    name: 'SM Savemore Cabuyao',
    image: 'https://scontent.fmnl30-3.fna.fbcdn.net/v/t39.30808-6/619660929_1326230966203761_4906087816938900864_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=13d280&_nc_eui2=AeGIhn1zYgQz7b5jO_SCZTYml6Uv4hSHcxyXpS_iFIdzHCgI2Bl6dIqX3Sd8HUgDIrFM-yITDiC6HWjlKTGt-f5V&_nc_ohc=1d7UFR00vRQQ7kNvwHojtmt&_nc_oc=AdoEPd1PrjTSI8ZFGPr6PhNw9lPCA0gbLt9qaPmrUuudlTQ13TlCLQ0iQaf-e53WoGM&_nc_zt=23&_nc_ht=scontent.fmnl30-3.fna&_nc_gid=frzFmPH12JsMtvRXTh4N7Q&_nc_ss=7a3a8&oh=00_Af1uPYjEuDlg-S6CHYCNzXAs48gZR56uLKcx03VgQpKPKQ&oe=69D5592C',
    map: 'https://www.google.com/maps?q=SM+City+Cabuyao',
  },
  {
    name: 'Malayan Colleges Laguna',
    image: 'https://mcl.edu.ph/wp-content/uploads/2024/05/Facilities-Einstein-Building-Main-scaled.webp',
    map: 'https://www.google.com/maps?q=Malayan+Colleges+Laguna',
  },
  {
    name: 'Cabuyao City Hall',
    image: 'https://upload.wikimedia.org/wikipedia/en/3/3d/Cabuyao_City_Hall_%28F.B._Bailon%2C_Cabuyao%2C_Laguna%3B_12-23-2021%29.jpg',
    map: 'https://www.google.com/maps?q=Cabuyao+City+Hall',
  },
  {
    name: 'SLEX Cabuyao Exit',
    image: 'https://upload.wikimedia.org/wikipedia/commons/1/10/SLEX_%28Cabuyao%2C_Laguna%29%282018-08-21%29.jpg',
    map: 'https://www.google.com/maps?q=SLEX+Cabuyao+Exit',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [selectedFloor, setSelectedFloor] = useState('studio');
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [redirectingToLogin, setRedirectingToLogin] = useState(false);
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    fullName: '',
    email: '',
    preferredDate: '',
    building: 'A',
  });

  const handleScroll = (event, id) => {
    event.preventDefault();
    const target = document.querySelector(id);
    if (target) {
      if (id === '#hero') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const navbarOffset = 88;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - navbarOffset;
      window.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
    }
  };

  const handleAppointmentClick = (event) => {
    event.preventDefault();
    setShowAppointment(true);
    setTimeout(() => {
      const target = document.querySelector('#appointment');
      if (target) {
        const navbarOffset = 88;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - navbarOffset;
        window.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
      }
    }, 100);
  };

  const handleAppointmentFieldChange = (event) => {
    const { name, value } = event.target;
    setAppointmentForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAppointmentSubmit = async (event) => {
    event.preventDefault();
    setAppointmentSubmitting(true);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await axios.post(`${apiUrl}/api/appointment/request`, appointmentForm);

      if (response?.data?.success) {
        toast.success('Appointment request submitted. We will contact you shortly.');
        setAppointmentForm({
          fullName: '',
          email: '',
          preferredDate: '',
          building: 'A',
        });
      } else {
        toast.error('Failed to submit appointment request. Please try again.');
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.errors?.[0]?.msg ||
        'Failed to submit appointment request.';
      toast.error(errorMessage);
    } finally {
      setAppointmentSubmitting(false);
    }
  };

  const handleSignInRedirect = async (event) => {
    event.preventDefault();
    setMobileMenuOpen(false);
    setRedirectingToLogin(true);

    await new Promise((resolve) => setTimeout(resolve, 600));
    navigate('/login');
  };

  if (redirectingToLogin) {
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
                <h2 className="text-xl font-bold text-slate-900">Sign In Portal</h2>
              </div>
            </div>

            <p className="text-slate-700 font-medium">Opening secure sign in...</p>
            <p className="text-sm text-slate-500 mt-1">Preparing account access and authentication</p>

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
    <div className="font-sans text-slate-800 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="sticky top-0 z-50 backdrop-blur-lg bg-white/90 border-b border-slate-200/50 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <motion.a
              href="#hero"
              className="flex items-center space-x-3 text-slate-950 hover:text-indigo-800 transition-colors"
              whileHover={{ scale: 1.02 }}
            >
              <div className="p-2 bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-xl shadow-lg">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <span className="font-bold text-2xl tracking-tight text-slate-950">JNL</span>
                <span className="block text-xs text-slate-600 uppercase tracking-wider">Apartments</span>
              </div>
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              {[
                { href: '#hero', label: 'Home' },
                { href: '#amenities', label: 'Amenities' },
                { href: '#floorplans', label: 'Floor Plans' },
                { href: '#buildings', label: 'Buildings' },
                { href: '#features', label: 'Features' },
                { href: '#neighborhood', label: 'Location' },
                { href: '#appointment', label: 'Contact' }
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href === '#appointment') {
                      setShowAppointment(true);
                      setTimeout(() => handleScroll(e, item.href), 120);
                    } else {
                      handleScroll(e, item.href);
                    }
                  }}
                  className="text-slate-900 hover:text-indigo-700 font-medium transition-colors duration-200 relative group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-indigo-600 transition-all duration-200 group-hover:w-full"></span>
                </a>
              ))}
            </div>

            {/* Desktop Auth Buttons */}
            <div className="hidden lg:flex items-center space-x-4">
              <motion.button
                type="button"
                onClick={handleSignInRedirect}
                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all duration-200"
                whileHover={{ scale: 1.05, y: -2 }}
              >
                Sign In
              </motion.button>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-900 hover:bg-slate-100 transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </motion.button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm"
            >
              <div className="px-4 py-6 space-y-4">
                {[
                  { href: '#hero', label: 'Home' },
                  { href: '#amenities', label: 'Amenities' },
                  { href: '#floorplans', label: 'Floor Plans' },
                  { href: '#buildings', label: 'Buildings' },
                  { href: '#features', label: 'Features' },
                  { href: '#neighborhood', label: 'Location' },
                  { href: '#appointment', label: 'Contact' }
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      if (item.href === '#appointment') {
                        setShowAppointment(true);
                        setTimeout(() => handleScroll(e, item.href), 120);
                      } else {
                        handleScroll(e, item.href);
                      }
                      setMobileMenuOpen(false);
                    }}
                    className="block px-4 py-3 text-slate-900 hover:text-indigo-700 hover:bg-slate-50 rounded-lg transition-colors font-medium"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <button
                    type="button"
                    onClick={handleSignInRedirect}
                    className="block w-full px-4 py-3 text-center bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all duration-200"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.nav>

      <motion.section
        id="hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex min-h-[calc(100vh-4rem)] scroll-mt-24 items-center overflow-hidden bg-slate-100 pt-16 pb-10"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-slate-100" />
          <div className="absolute -left-24 -top-24 h-[30rem] w-[30rem] rounded-full bg-indigo-600 opacity-18 mix-blend-multiply blur-3xl animate-pulse" />
          <div className="absolute -right-24 -top-16 h-[28rem] w-[28rem] rounded-full bg-indigo-600 opacity-18 mix-blend-multiply blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute left-1/4 top-1/3 h-[34rem] w-[34rem] rounded-full bg-indigo-600 opacity-15 mix-blend-multiply blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-[#f6efec]/88 to-[#f8fafc]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid min-h-[calc(100vh-8rem)] items-center gap-12 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-100 border border-indigo-200 rounded-full">
                  <div className="flex items-center gap-2">
                    <span className="relative inline-flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
                    </span>
                    <span className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Premium Property Management</span>
                  </div>
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
                  Modern Living
                  <span className="block text-indigo-600">Made Affordable</span>
                </h1>

                <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
                  Experience exceptional apartment living in Cabuyao, Laguna. Where modern architecture meets unparalleled comfort, security, and community excellence.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <motion.button
                  type="button"
                  onClick={handleAppointmentClick}
                  className="group inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-indigo-700 hover:-translate-y-1"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Schedule Tour
                </motion.button>

                <motion.a
                  href="#buildings"
                  onClick={(e) => handleScroll(e, '#buildings')}
                  className="group inline-flex items-center justify-center px-8 py-4 border-2 border-indigo-600 bg-white text-indigo-700 font-semibold rounded-xl hover:bg-indigo-600 hover:text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Building className="w-5 h-5 mr-2" />
                  Explore Buildings
                </motion.a>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-slate-600 font-medium">24/7 Security</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-slate-600 font-medium">High-Speed Internet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm text-slate-600 font-medium">Community Focused</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative"
            >
              {/* Main feature card */}
              <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <Building2 className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">JNL Apartments</h3>
                    <p className="text-slate-600">Premium Living Experience</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-slate-700">Modern villa-inspired architecture</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-700">24/7 CCTV surveillance & security</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span className="text-slate-700">High-speed internet & utilities</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-slate-700">Prime location in Cabuyao, Laguna</span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 uppercase tracking-wide">Starting from</p>
                      <p className="text-3xl font-bold text-indigo-600">₱1,200<span className="text-lg text-slate-600">/month</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600 uppercase tracking-wide">Available Units</p>
                      <p className="text-2xl font-bold text-slate-900">70</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating stats card */}
              <motion.div
                className="absolute top-4 right-4 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Happy Residents</p>
                    <p className="text-xl font-bold text-slate-900">100+</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating location card */}
              <motion.div
                className="absolute top-28 right-4 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Location</p>
                    <p className="text-sm font-semibold text-slate-900">Cabuyao, Laguna</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="py-20 bg-gradient-to-r from-slate-50 to-indigo-50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h2 className="text-4xl font-bold text-slate-900 mb-4">Why Choose JNL Apartments?</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                Join a thriving community of residents who enjoy premium amenities, exceptional service, and modern living in the heart of Cabuyao, Laguna.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-6 group-hover:bg-indigo-200 transition-colors">
                <Building className="w-8 h-8 text-indigo-600" />
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-indigo-600 mb-2">5</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Modern Buildings</h3>
                <p className="text-slate-600">Contemporary architecture designed for comfort and style</p>
              </div>
            </motion.div>

            <motion.div
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6 group-hover:bg-green-200 transition-colors">
                <Home className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">70</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Premium Units</h3>
                <p className="text-slate-600">Spacious and well-appointed living spaces for every lifestyle</p>
              </div>
            </motion.div>

            <motion.div
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6 group-hover:bg-blue-200 transition-colors">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">100+</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Happy Residents</h3>
                <p className="text-slate-600">A vibrant community of satisfied homeowners and tenants</p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        id="amenities"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="scroll-mt-24 bg-gradient-to-b from-white to-slate-50 pb-20 pt-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h2 className="text-4xl font-bold text-slate-900 mb-4">Essential Amenities</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                Comfortable living with practical amenities focused on your security, convenience, and everyday needs.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {amenities.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className={`group relative overflow-hidden rounded-3xl shadow-xl transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-2xl focus-within:scale-[1.02] focus-within:shadow-2xl ${item.big ? 'md:col-span-2 lg:col-span-2' : ''} bg-white border border-slate-200`}
              >
                <div
                  className="relative h-64 overflow-hidden"
                  style={{
                    backgroundImage: `linear-gradient(rgba(15,23,42,0.25), rgba(15,23,42,0.12)), url('${item.image}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: '#cbd5e1',
                  }}
                >
                  <div className="absolute inset-0 bg-black/25 transition duration-300 group-hover:bg-black/30" />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-4">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
                      <item.icon size={22} className="text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white lg:text-[1.05rem]">{item.name}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-white/90 lg:text-[0.92rem]">
                    {item.name === 'Dedicated Parking' && 'Secure, covered parking spaces with 24/7 access for residents and guests.'}
                    {item.name === '24/7 Security' && 'Professional security personnel and advanced surveillance systems ensure your safety.'}
                    {item.name === 'Gated Entrance' && 'Controlled access with modern security gates and visitor management system.'}
                    {item.name === 'CCTV Monitoring' && 'Comprehensive CCTV coverage throughout the property for maximum security.'}
                    {item.name === 'Reliable Utilities' && 'Modern water tank and electrical systems ensuring uninterrupted service.'}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="floorplans"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="scroll-mt-24 py-20 bg-white border-t border-slate-100"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h2 className="text-4xl font-bold text-slate-900 mb-4">Choose Your Perfect Space</h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                Discover our thoughtfully designed floor plans, each crafted to provide comfort, functionality, and modern living.
              </p>
            </motion.div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {Object.entries(floorPlans).map(([key, plan]) => (
              <motion.button
                key={key}
                onClick={() => setSelectedFloor(key)}
                className={`px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${
                  selectedFloor === key
                    ? 'bg-indigo-600 text-white shadow-lg scale-105'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 hover:shadow-md'
                }`}
                whileHover={{ scale: selectedFloor === key ? 1.05 : 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {plan.label}
              </motion.button>
            ))}
          </div>

          <motion.div
            key={selectedFloor}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-8 border border-indigo-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-indigo-100 rounded-2xl">
                    <Home className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-900">{floorPlans[selectedFloor].label}</h3>
                    <p className="text-slate-600">Premium living space</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 uppercase tracking-wide">Monthly Rent</p>
                    <p className="text-3xl font-bold text-indigo-600">{floorPlans[selectedFloor].price}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-600 uppercase tracking-wide">Area</p>
                    <p className="text-2xl font-bold text-slate-900">{floorPlans[selectedFloor].area}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-slate-700">Modern kitchen with premium appliances</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-700">Spacious living areas with natural light</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span className="text-slate-700">High-quality finishes and fixtures</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-slate-700">Energy-efficient design and utilities</span>
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={handleAppointmentClick}
                  className="w-full mt-8 bg-indigo-600 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-indigo-700"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Calendar className="w-5 h-5 inline mr-2" />
                  Schedule Viewing
                </motion.button>
              </div>
            </div>

            <div className="relative">
              <motion.div
                className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src={floorPlans[selectedFloor].image}
                  alt={`${floorPlans[selectedFloor].label} floor plan`}
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/94a3b8/ffffff?text=Floor+Plan+Image'; }}
                  className="w-full h-96 object-cover"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl">
                  <p className="text-sm font-semibold text-slate-900">{floorPlans[selectedFloor].area}</p>
                </div>
              </motion.div>

              <motion.div
                className="absolute -bottom-6 -left-6 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Security</p>
                    <p className="text-sm font-semibold text-slate-900">24/7 Protected</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        id="buildings"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="scroll-mt-24 max-w-6xl mx-auto px-4 py-14 sm:px-6 lg:px-8"
      >
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Buildings Preview</h2>
        <p className="mt-2 text-slate-600">View details of each building and access galleries.</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildings.map((b, idx) => (
            <motion.div
              key={b}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: idx * 0.06 }}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl"
            >
              <div className="relative overflow-hidden rounded-xl mb-4">
                <img
                  src={buildingImages[idx]}
                  alt={`Building ${b}`}
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x360/334155/ffffff?text=Building+Image+Unavailable'; }}
                  className="w-full h-40 object-cover rounded-xl transition duration-500 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-slate-950/20 rounded-xl" />
              </div>
              <div className="flex items-center space-x-3 mb-4">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-xl font-semibold text-slate-900">Building {b}</h3>
              </div>
              <p className="text-slate-600">Modern units with secure entry and shared community amenities.</p>
              <button
                onClick={() => setSelectedBuilding(b)}
                className="mt-5 px-4 py-2 rounded-full bg-indigo-600 text-white font-semibold transition duration-300 ease-out hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-lg"
              >
                View Gallery
              </button>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {selectedBuilding && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setSelectedBuilding(null)}
        >
          <motion.div
            className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Building {selectedBuilding} Gallery</h3>
              <button
                onClick={() => setSelectedBuilding(null)}
                className="text-sm text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(buildingGalleries[selectedBuilding] || buildingGalleries.A).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Building ${selectedBuilding} image ${i + 1}`}
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x600/334155/ffffff?text=Gallery+Image+Unavailable'; }}
                  className="h-40 w-full object-cover rounded-xl"
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      <motion.section
        id="features"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="scroll-mt-24 bg-slate-50 border-t border-slate-200"
      >
        <div className="max-w-6xl mx-auto px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">System Features</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'User Management',
                desc: 'Tenant profiles, guest logs, and secure authentication.',
                icon: Users,
              },
              {
                title: 'Utility & Billing',
                desc: 'Track water/electric usage, generate bills, and send automated alerts.',
                icon: Zap,
              },
              {
                title: 'Appointment Booking',
                desc: 'Schedule tours, repairs, and inspections with ease.',
                icon: Calendar,
              },
              {
                title: 'Maintenance Tracking',
                desc: 'Assign repairs, update progress, and close service requests.',
                icon: Layers,
              },
              {
                title: 'Complaint Resolution',
                desc: 'Submit issues with photo attachments and monitor response status.',
                icon: FileText,
              },
              {
                title: 'Rent Payments',
                desc: 'Record rent payments, track history, and review payment status.',
                icon: CreditCard,
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.1 }}
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl hover:ring-1 hover:ring-indigo-100 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-white"
              >
                <feature.icon className="h-6 w-6 text-indigo-600 transition duration-300 ease-out group-hover:text-indigo-700" />
                <h3 className="mt-3 text-xl font-semibold text-slate-900 group-hover:text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-slate-600 text-sm group-hover:text-slate-700">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="neighborhood"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="scroll-mt-24 max-w-6xl mx-auto px-4 py-14 sm:px-6 lg:px-8"
      >
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Nearby Highlights</h2>
        <p className="mt-2 text-slate-600">Local landmarks, shopping, and transit options around the community.</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {neighborhoodSpots.map((spot) => (
            <div key={spot.name} className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <img
                src={spot.image}
                alt={spot.name}
                referrerPolicy="no-referrer"
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/94a3b8/ffffff?text=Location+image+not+found'; }}
                className="h-40 w-full object-cover transition duration-300 hover:scale-105"
              />
              <div className="p-4">
                <h3 className="text-lg font-semibold text-slate-900">{spot.name}</h3>
                <a
                  href={spot.map}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-indigo-600 text-sm font-medium hover:text-indigo-500"
                >
                  <MapPin className="h-4 w-4" />
                  View on map
                </a>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {showAppointment && (
        <motion.section
          id="appointment"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="scroll-mt-24 bg-slate-50 border-t border-slate-200"
        >
          <div className="max-w-6xl mx-auto px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Schedule Your Appointment</h2>
          <p className="mt-2 text-slate-600">Fill out the form and our team will contact you shortly.</p>
          <form className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4" onSubmit={handleAppointmentSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm text-slate-700 font-medium">Name</label>
              <input
                type="text"
                id="name"
                name="fullName"
                value={appointmentForm.fullName}
                onChange={handleAppointmentFieldChange}
                placeholder="Your full name"
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm text-slate-700 font-medium">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={appointmentForm.email}
                onChange={handleAppointmentFieldChange}
                placeholder="you@example.com"
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="date" className="block text-sm text-slate-700 font-medium">Date</label>
              <input
                type="date"
                id="date"
                name="preferredDate"
                value={appointmentForm.preferredDate}
                onChange={handleAppointmentFieldChange}
                min={new Date().toISOString().split('T')[0]}
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="building" className="block text-sm text-slate-700 font-medium">Building</label>
              <select
                id="building"
                name="building"
                value={appointmentForm.building}
                onChange={handleAppointmentFieldChange}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="A">Building A</option>
                <option value="B">Building B</option>
                <option value="C">Building C</option>
                <option value="D">Building D</option>
                <option value="E">Building E</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={appointmentSubmitting}
                className="w-full rounded-3xl bg-indigo-600 px-6 py-3 text-white font-semibold transition duration-300 ease-out hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-xl"
              >
                {appointmentSubmitting ? 'Submitting...' : 'Request Appointment'}
              </button>
            </div>
          </form>
        </div>
      </motion.section>
      )}

      <Footer />
    </div>
  );
};

export default LandingPage;
