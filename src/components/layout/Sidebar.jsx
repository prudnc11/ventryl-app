import { NavLink, useLocation } from 'react-router-dom';
import { cls } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';

const NAV = [
  {
    label: 'Main',
    items: [
      { to: '/',          label: 'Dashboard',   icon: IconDashboard },
      { to: '/market',    label: 'Marketplace', icon: IconMarket },
      { to: '/orders',    label: 'My Orders',   icon: IconOrders },
      { to: '/priceboard',label: 'Price Board', icon: IconPrice },
    ],
  },
  {
    label: 'Discover',
    items: [
      { to: '/depots',    label: 'Depots',      icon: IconDepot },
      { to: '/watchlist', label: 'Watchlist',   icon: IconWatch },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/settings',  label: 'Settings',    icon: IconSettings },
    ],
  },
];

export function Sidebar() {
  const { user, sidebarOpen } = useAppStore();

  return (
    <aside
      className={cls(
        'h-screen bg-[#0A2540] flex flex-col transition-all duration-200 flex-shrink-0',
        sidebarOpen ? 'w-56' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 flex-shrink-0">
        <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" strokeLinejoin="round" />
          </svg>
        </div>
        {sidebarOpen && (
          <span className="text-white font-bold text-lg tracking-tight">Ventryl</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {NAV.map((group) => (
          <div key={group.label}>
            {sidebarOpen && (
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 mb-1">
                {group.label}
              </p>
            )}
            {group.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cls(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )
                }
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0 w-[18px] h-[18px]" />
                {sidebarOpen && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#F59E0B] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user.avatarInitials}
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-white/40 truncate capitalize">{user.role}</p>
            </div>
          )}
        </NavLink>
      </div>
    </aside>
  );
}

// ── Icons (inline SVG to keep zero deps) ──────────────────────────
function IconDashboard({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
    </svg>
  );
}
function IconMarket({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}
function IconOrders({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  );
}
function IconPrice({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  );
}
function IconDepot({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  );
}
function IconWatch({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
  );
}
function IconSettings({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
}
