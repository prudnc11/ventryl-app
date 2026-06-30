import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { timeAgo } from '../../lib/utils';
import { formatNaira } from '../../lib/constants';

const PAGE_TITLES = {
  '/':           { title: 'Dashboard',    subtitle: 'Overview of your trading activity' },
  '/market':     { title: 'Marketplace',  subtitle: 'Browse available fuel listings' },
  '/orders':     { title: 'My Orders',    subtitle: 'Track and manage your orders' },
  '/priceboard': { title: 'Price Board',  subtitle: 'Live market prices and trends' },
  '/depots':     { title: 'Depots',       subtitle: 'Find and connect with certified depots' },
  '/watchlist':  { title: 'Watchlist',    subtitle: 'Saved listings and price alerts' },
  '/settings':   { title: 'Settings',     subtitle: 'Manage your account and preferences' },
};

const NOTIF_ICONS = {
  order:   { bg: 'bg-blue-100',   icon: '📦' },
  price:   { bg: 'bg-amber-100',  icon: '📈' },
  listing: { bg: 'bg-emerald-100', icon: '🏭' },
  system:  { bg: 'bg-gray-100',   icon: '🔔' },
};

export function Header() {
  const location = useLocation();
  const { title, subtitle } = PAGE_TITLES[location.pathname] ?? { title: 'Ventryl', subtitle: '' };
  const {
    notifications, unreadCount,
    markNotificationRead, markAllNotificationsRead,
    toggleSidebar, user,
  } = useAppStore();

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">{title}</h1>
          <p className="text-xs text-gray-400 leading-tight">{subtitle}</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Wallet */}
        <div className="hidden sm:flex items-center gap-2 bg-[#0A2540]/5 rounded-lg px-3 py-1.5">
          <svg className="w-3.5 h-3.5 text-[#0A2540]" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-semibold text-[#0A2540]">
            {formatNaira(user.walletBalance)}
          </span>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Notifications"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.map((n) => {
                  const { bg, icon } = NOTIF_ICONS[n.type] ?? NOTIF_ICONS.system;
                  return (
                    <button
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center text-sm flex-shrink-0`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
