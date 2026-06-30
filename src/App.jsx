import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Marketplace } from './pages/Marketplace';
import { Orders } from './pages/Orders';
import { PriceBoard } from './pages/PriceBoard';
import { Depots } from './pages/Depots';
import { Watchlist } from './pages/Watchlist';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="market" element={<Marketplace />} />
          <Route path="orders" element={<Orders />} />
          <Route path="priceboard" element={<PriceBoard />} />
          <Route path="depots" element={<Depots />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
