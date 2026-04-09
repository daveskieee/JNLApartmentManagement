import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

const Breadcrumbs = ({ items }) => {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
      <Link to="/" className="flex items-center gap-1 hover:text-indigo-600 transition">
        <Home size={16} />
        <span>Home</span>
      </Link>
      
      {items && items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight size={16} className="text-slate-400" />
          {item.href ? (
            <Link to={item.href} className="hover:text-indigo-600 transition">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900 font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
