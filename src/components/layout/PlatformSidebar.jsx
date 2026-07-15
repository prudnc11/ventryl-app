import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { T, F } from "../../lib/tokens";
import { Icon } from "../../components/shared";
import { useVentrylStore } from "../../store/ventrylStore";

export function PlatformSidebar({ depots, onNewDepot, onPlaceOrder, identity, isMobile, onSignOut, isAdmin }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { depotOrders, loadDepotOrders } = useVentrylStore();

  // Load orders for all depots so badges are available
  useEffect(() => {
    depots.forEach(d => { if (d.kyb === "verified" && !depotOrders[d.id]) loadDepotOrders(d.id); });
  }, [depots]);

  const getOngoingCount = (depotId) => {
    const orders = depotOrders[depotId] || [];
    return orders.filter(o => ["pending", "confirmed", "loading", "in_transit", "disputed"].includes(o.status)).length;
  };

  const ITEMS = [
    { path: "/",            label: "Dashboard",      icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
    { path: "/market",      label: "Depot Prices", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
    { path: "/place-order", label: "Place Order",    icon: "M12 4v16m8-8H4" },
    { path: "/orders",      label: "My Orders",      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { path: "/wallet",      label: "Wallet",         icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
    ...(isAdmin ? [{ path: "/admin", label: "Admin Panel", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", adminBadge: true }] : []),
  ];
  const GEAR = "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
  const pendingKyb = depots.filter(d => d.kyb !== "verified").length;

  const isActive = (path) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  if (isMobile) {
    const MOB = [
      { path: "/",            label: "Home",    icon: ITEMS[0].icon },
      { path: "/market",      label: "Market",  icon: ITEMS[1].icon },
      { path: "/place-order", label: "Order",   icon: ITEMS[2].icon },
      { path: "/orders",      label: "Orders",  icon: ITEMS[3].icon },
      { path: "__depots__",   label: "Depots",  icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", badge: pendingKyb || null },
    ];
    return (
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.black, borderTop: "1px solid #1A1A1A", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {MOB.map(n => {
          const active = n.path === "__depots__" ? pathname.startsWith("/depot") : isActive(n.path);
          return (
            <button key={n.path}
              onClick={() => {
                if (n.path === "/place-order" && onPlaceOrder) { onPlaceOrder(); return; }
                navigate(n.path === "__depots__" ? (depots[0] ? `/depot/${depots[0].id}` : "/") : n.path);
              }}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: F, color: active ? T.green : "#555", position: "relative", minHeight: "56px" }}>
              {n.badge && <span style={{ position: "absolute", top: "6px", right: "calc(50% - 14px)", background: T.amber, color: T.black, fontSize: "9px", fontWeight: 800, padding: "1px 4px", borderRadius: "8px", minWidth: "16px", textAlign: "center" }}>{n.badge}</span>}
              <Icon d={n.icon} size={20} />
              <span style={{ fontSize: "9px", fontWeight: 700, marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ width: "220px", background: T.black, minHeight: "100vh", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
      <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid #1A1A1A" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "30px", height: "30px", background: T.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "14px", fontWeight: 800, color: T.black }}>V</span>
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: T.white }}>Ventryl</div>
            <div style={{ fontSize: "9px", fontWeight: 700, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Platform</div>
          </div>
        </div>
      </div>
      <nav style={{ padding: "12px 10px", flex: 1, overflowY: "auto" }}>
        {ITEMS.map(n => {
          const active = isActive(n.path);
          return (
            <button key={n.path} onClick={() => {
                if (n.path === "/place-order" && onPlaceOrder) { onPlaceOrder(); return; }
                navigate(n.path);
              }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "9px 12px", borderRadius: "5px", background: active ? T.white : "transparent", color: active ? T.black : "#888", border: "none", cursor: "pointer", marginBottom: "2px", fontFamily: F, fontSize: "12px", fontWeight: active ? 800 : 600, textAlign: "left", transition: "all 0.1s" }}>
              <Icon d={n.icon} size={15} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.adminBadge && <span style={{ background: T.green, color: T.black, fontSize: "8px", fontWeight: 800, padding: "1px 5px", borderRadius: "2px", flexShrink: 0 }}>ADMIN</span>}
            </button>
          );
        })}
        <div style={{ padding: "14px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "9px", fontWeight: 800, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em" }}>My Depots</span>
          {depots.length > 0 && <span style={{ fontSize: "9px", color: "#444", fontWeight: 700 }}>{depots.length}</span>}
        </div>
        {depots.map(d => {
          const active = pathname === `/depot/${d.id}`;
          const ongoing = getOngoingCount(d.id);
          const pending = (depotOrders[d.id] || []).filter(o => o.status === "pending").length;
          return (
            <button key={d.id} onClick={() => navigate(`/depot/${d.id}`)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "9px 12px", borderRadius: "5px", background: active ? T.white : "transparent", color: active ? T.black : "#888", border: "none", cursor: "pointer", marginBottom: "2px", fontFamily: F, fontSize: "12px", fontWeight: active ? 800 : 600, textAlign: "left", transition: "all 0.1s" }}>
              <div style={{ width: "20px", height: "20px", background: active ? T.black : d.kyb === "verified" ? T.green : "#333", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: T.white, flexShrink: 0 }}>{d.name[0]}</div>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              {d.kyb !== "verified" && <span style={{ background: T.amberLight, color: "#8A5C00", fontSize: "8px", fontWeight: 800, padding: "1px 4px", borderRadius: "2px", flexShrink: 0 }}>KYB</span>}
              {d.kyb === "verified" && pending > 0 && <span style={{ background: T.red, color: T.white, fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "8px", minWidth: "16px", textAlign: "center", flexShrink: 0 }}>{pending}</span>}
              {d.kyb === "verified" && pending === 0 && ongoing > 0 && <span style={{ background: T.green, color: T.black, fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "8px", minWidth: "16px", textAlign: "center", flexShrink: 0 }}>{ongoing}</span>}
            </button>
          );
        })}
        <button onClick={onNewDepot}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "9px 12px", background: "transparent", color: "#555", border: "1px dashed #2A2A2A", cursor: "pointer", marginTop: "4px", marginBottom: "2px", fontFamily: F, fontSize: "11px", fontWeight: 600, textAlign: "left", borderRadius: "5px" }}>
          <span style={{ fontSize: "16px", lineHeight: 1, flexShrink: 0 }}>+</span>New Depot
        </button>
        <div style={{ height: "1px", background: "#1A1A1A", margin: "12px 0" }} />
        {(() => {
          const active = pathname === "/settings";
          return (
            <button onClick={() => navigate("/settings")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "9px 12px", borderRadius: "5px", background: active ? T.white : "transparent", color: active ? T.black : "#888", border: "none", cursor: "pointer", marginBottom: "2px", fontFamily: F, fontSize: "12px", fontWeight: active ? 800 : 600, textAlign: "left", transition: "all 0.1s" }}>
              <Icon d={GEAR} size={15} /><span>Settings</span>
            </button>
          );
        })()}
      </nav>
      <div style={{ padding: "14px 20px", borderTop: "1px solid #1A1A1A" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: onSignOut ? "10px" : "0" }}>
          <div style={{ width: "30px", height: "30px", background: identity.bg || T.green, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, color: identity.textColor || T.black, flexShrink: 0 }}>{identity.initials || "?"}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: T.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity.name || ""}</div>
            <div style={{ fontSize: "10px", color: "#555" }}>{identity.role || ""}</div>
          </div>
        </div>
        {identity.isAdmin && <div style={{ background: "#0A2A0A", color: T.green, fontSize: "9px", fontWeight: 800, padding: "4px 8px", textAlign: "center", letterSpacing: "0.08em", marginBottom: "6px" }}>ADMIN ACCESS</div>}
        {onSignOut && (
          <button onClick={onSignOut} style={{ width: "100%", padding: "8px", background: "transparent", border: "1px solid #2A2A2A", color: "#666", fontFamily: F, fontSize: "11px", fontWeight: 700, cursor: "pointer", textAlign: "center", letterSpacing: "0.04em" }}>
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}
