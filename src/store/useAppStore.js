import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NOTIFICATIONS, ORDERS, LISTINGS, DEPOTS } from '../lib/data';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Auth / User ────────────────────────────────────────────
      user: {
        id: 'u1',
        name: 'Adebayo Okonkwo',
        company: 'Okonkwo Petroleum & Gas Ltd',
        role: 'buyer',            // 'buyer' | 'seller' | 'admin'
        state: 'Lagos',
        phone: '+234 802 000 1111',
        email: 'adebayo@okonkwopetro.ng',
        cacNumber: 'RC-1234567',
        avatarInitials: 'AO',
        verified: true,
        walletBalance: 142_500_000,
      },

      // ── Notifications ──────────────────────────────────────────
      notifications: NOTIFICATIONS,
      unreadCount: NOTIFICATIONS.filter((n) => !n.read).length,

      markNotificationRead: (id) =>
        set((s) => {
          const notifications = s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
        }),

      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      // ── Orders ────────────────────────────────────────────────
      orders: ORDERS,

      addOrder: (order) =>
        set((s) => ({ orders: [order, ...s.orders] })),

      updateOrderStatus: (id, status) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o
          ),
        })),

      // ── Marketplace ────────────────────────────────────────────
      listings: LISTINGS,

      // ── Depots ─────────────────────────────────────────────────
      depots: DEPOTS,

      // ── Watchlist / saved listings ─────────────────────────────
      watchlist: [],
      toggleWatchlist: (listingId) =>
        set((s) => ({
          watchlist: s.watchlist.includes(listingId)
            ? s.watchlist.filter((id) => id !== listingId)
            : [...s.watchlist, listingId],
        })),

      // ── UI state ───────────────────────────────────────────────
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      // ── Marketplace filters ───────────────────────────────────
      filters: {
        product: 'all',
        state: 'all',
        minVolume: '',
        maxPrice: '',
        search: '',
        verifiedOnly: false,
      },
      setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),
      resetFilters: () =>
        set({
          filters: {
            product: 'all', state: 'all', minVolume: '',
            maxPrice: '', search: '', verifiedOnly: false,
          },
        }),
    }),
    {
      name: 'ventryl-store',
      partialize: (s) => ({ watchlist: s.watchlist, filters: s.filters, sidebarOpen: s.sidebarOpen, orders: s.orders }),
    }
  )
);
