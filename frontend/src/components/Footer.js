import React from 'react';
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-white border-t border-slate-800 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-bold mb-4">JNL Apartment</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Delivering premium living spaces with modern amenities, security, and community in Cabuyao, Laguna.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4 text-slate-100">Quick Links</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#hero" className="hover:text-white transition">Home</a></li>
              <li><a href="#amenities" className="hover:text-white transition">Amenities</a></li>
              <li><a href="#floorplans" className="hover:text-white transition">Floor Plans</a></li>
              <li><a href="#buildings" className="hover:text-white transition">Buildings</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-4 text-slate-100">Contact</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <MapPin size={16} className="text-indigo-400" />
                <span>Hongkong Village, Cabuyao, Laguna</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-indigo-400" />
                <span>+63 XXX XXXX XXX</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="text-indigo-400" />
                <a href="mailto:jnlapartmentmanagement@gmail.com" className="hover:text-white transition">
                  jnlapartmentmanagement@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* Social Links */}
          <div>
            <h4 className="font-semibold mb-4 text-slate-100">Follow Us</h4>
            <div className="flex gap-4">
              <a href="#" className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 transition">
                <Facebook size={18} />
              </a>
              <a href="#" className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 transition">
                <Twitter size={18} />
              </a>
              <a href="#" className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 transition">
                <Linkedin size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="divider my-8"></div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-400 space-y-4 md:space-y-0">
          <p>&copy; {new Date().getFullYear()} JNL Apartment. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition">Privacy Policy</a>
            <a href="#" className="hover:text-white transition">Terms of Service</a>
            <a href="#" className="hover:text-white transition">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
