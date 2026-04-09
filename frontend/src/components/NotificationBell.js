import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatAppDateTime } from '../utils/dateTime';

const NotificationBell = ({
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onViewAll,
  reminderMessage = '',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group relative inline-flex items-center justify-center w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-[#9d5f51] hover:border-[#9d5f51] hover:ring-2 hover:ring-white/80 hover:shadow-md hover:-translate-y-0.5 transition duration-200"
        aria-label="Open notifications"
      >
        <Bell size={20} className="text-slate-700 transition duration-200 group-hover:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] leading-5 font-semibold text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[350px] max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-medium text-rose-700 hover:text-rose-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {reminderMessage && (
              <div className="mx-4 mt-3 mb-3 p-3 rounded-lg border border-slate-200 bg-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Reminder</p>
                <p className="text-sm text-slate-900 mt-1">{reminderMessage}</p>
              </div>
            )}

            {recentNotifications.length === 0 && !reminderMessage ? (
              <p className="px-4 py-6 text-sm text-slate-500">No notifications yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => onMarkRead && onMarkRead(notification.id)}
                    className={`w-full text-left px-4 py-3 transition duration-200 hover:bg-[#f8f2ef] bg-white ${
                      notification.is_read ? '' : 'border-l-4 border-l-indigo-500'
                    }`}
                  >
                    <p className="text-sm text-slate-900">{notification.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatAppDateTime(notification.created_at)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (onViewAll) onViewAll();
              }}
              className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
