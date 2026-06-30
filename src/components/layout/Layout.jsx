import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <ScrollToTop />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
