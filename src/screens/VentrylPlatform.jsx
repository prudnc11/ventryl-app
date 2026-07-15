import { useState, useEffect, useCallback, lazy, Suspense, Component } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { T, F, GLOBAL_STYLES } from "../lib/tokens";
import { useAuthStore } from "../store/authStore";
import { useVentrylStore } from "../store/ventrylStore";
import { depots as depotsApi } from "../lib/api";
import { supabase } from "../lib/supabase";
import { PlatformSidebar } from "../components/layout/PlatformSidebar";
import { Topbar } from "../components/shared";
import { DepotContext } from "../context/DepotContext";
import { AdminPanel } from "./AdminPanel";

// ── Error Boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("[ErrorBoundary]", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontFamily: F }}>
          <div style={{ textAlign: "center", maxWidth: "400px", padding: "20px" }}>
            <div style={{ width: "44px", height: "44px", background: T.redLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "20px" }}>!</div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: T.black, marginBottom: "8px" }}>Something went wrong</div>
            <div style={{ fontSize: "12px", color: T.gray400, marginBottom: "16px", lineHeight: 1.5 }}>{this.state.error?.message || "An unexpected error occurred."}</div>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}
              style={{ background: T.black, color: T.white, border: "none", padding: "10px 20px", fontSize: "12px", fontWeight: 800, cursor: "pointer", fontFamily: F }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 404 Not Found ────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontFamily: F }}>
      <div style={{ textAlign: "center", maxWidth: "400px", padding: "20px" }}>
        <div style={{ fontSize: "64px", fontWeight: 900, color: T.gray200, lineHeight: 1 }}>404</div>
        <div style={{ fontSize: "14px", fontWeight: 800, color: T.black, marginTop: "12px", marginBottom: "8px" }}>Page not found</div>
        <div style={{ fontSize: "12px", color: T.gray400, lineHeight: 1.5, marginBottom: "20px" }}>The page you're looking for doesn't exist or you don't have access.</div>
      </div>
    </div>
  );
}

// ── Code-split routes (lazy loaded) ─────────────────────────────────────────
const UnifiedDash       = lazy(() => import("./UnifiedDash").then(m => ({ default: m.UnifiedDash })));
const BuyerMarketplace  = lazy(() => import("./BuyerMarketplace").then(m => ({ default: m.BuyerMarketplace })));
const OrdersListView    = lazy(() => import("./OrdersListView").then(m => ({ default: m.OrdersListView })));
const BuyerOrderDetail  = lazy(() => import("./BuyerOrderDetail").then(m => ({ default: m.BuyerOrderDetail })));
const BuyerWallet       = lazy(() => import("./BuyerWallet").then(m => ({ default: m.BuyerWallet })));
const OrderFlow         = lazy(() => import("./OrderFlow").then(m => ({ default: m.OrderFlow })));
const SettingsModule    = lazy(() => import("./SettingsModule").then(m => ({ default: m.SettingsModule })));
const CreateDepotFlow   = lazy(() => import("./CreateDepotFlow").then(m => ({ default: m.CreateDepotFlow })));
const DepotDetailView   = lazy(() => import("./DepotDetailView").then(m => ({ default: m.DepotDetailView })));
const DepotOrderDetail  = lazy(() => import("./DepotOrderDetail").then(m => ({ default: m.DepotOrderDetail })));

function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontFamily: F }}>
      <div style={{ fontSize: "12px", fontWeight: 700, color: T.gray400, letterSpacing: "0.08em", textTransform: "uppercase" }}>Loading…</div>
    </div>
  );
}

const CRUMB_MAP = {
  "/":            "Dashboard",
  "/market":      "Depot Prices",
  "/orders":      "My Orders",
  "/wallet":      "Wallet",
  "/place-order": "Place Order",
  "/settings":    "Settings",
};

export function VentrylPlatform({ bp, user, onSignOut }) {
  const { isMobile } = bp;
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, profile: authProfile } = useAuthStore();
  const {
    ownerDepots, ownerDepotsLoaded, loadOwnerDepots,
    loadMarketDepots, buyerOrders, buyerOrdersLoaded,
    loadBuyerOrders, loadPriceHistory, walletNGN, loadWallet,
  } = useVentrylStore();

  const [showKycGate, setShowKycGate] = useState(false);
  const [kycGateAction, setKycGateAction] = useState(""); // "order" | "depot"
  const [adBannerDismissed, setAdBannerDismissed] = useState(false);
  const [adSlide, setAdSlide] = useState(0);
  const AD_SLIDES = [
    { bg: "linear-gradient(135deg, #1a0a2e 0%, #2d1b69 50%, #1a0a2e 100%)", badge: "AD", badgeBg: "#7c3aed", headline: "Leadway Assurance", sub: "Protect your fleet, cargo & depot assets — tailored petroleum insurance for Nigerian businesses.", cta: "Get a Free Quote", ctaLink: "https://leadway.com", ctaBg: "#7c3aed", ctaColor: "#fff" },
    { bg: "linear-gradient(135deg, #0a1a0a 0%, #0f3d0f 50%, #0a1a0a 100%)", badge: "LOANS", badgeBg: T.green, headline: "Petroleum Trade Financing", sub: "Access up to ₦500M in working capital — fast approval, competitive rates for verified buyers & depots.", cta: "Apply Now", ctaLink: "/settings", ctaBg: T.green, ctaColor: T.black, internal: true },
    { bg: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 40%, #0f3460 100%)", badge: "LIVE", badgeBg: T.amber, headline: "Oil Price Alerts", sub: "Get instant SMS & email alerts when PMS, AGO or DPK prices move — never miss a buying opportunity.", cta: "Set Up Alerts", ctaLink: "/settings", ctaBg: T.amber, ctaColor: T.black, internal: true },
    { bg: "linear-gradient(135deg, #1a0505 0%, #6b1010 50%, #1a0505 100%)", badge: "NEW", badgeBg: T.red, headline: "Depot Owners — List for Free", sub: "Reach thousands of verified petroleum buyers across Nigeria. Zero listing fees for your first 90 days.", cta: "Register Depot", ctaLink: "/depot/new", ctaBg: "#fff", ctaColor: T.red, internal: true },
  ];
  useEffect(() => {
    if (adBannerDismissed) return;
    const t = setInterval(() => setAdSlide(s => (s + 1) % AD_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [adBannerDismissed]);

  const kycApproved = authProfile?.kyc_status === "verified" || authProfile?.kyc_status === "approved";

  const requireKyc = (action, cb) => {
    if (!kycApproved) { setKycGateAction(action); setShowKycGate(true); return; }
    cb();
  };

  useEffect(() => {
    if (!authUser?.id) return;
    if (!ownerDepotsLoaded) loadOwnerDepots(authUser.id);
    if (!buyerOrdersLoaded) loadBuyerOrders(authUser.id);
    loadPriceHistory(7);
    loadWallet(authUser.id);
  }, [authUser?.id]);

  // Optimistic local depot patches (pending DB round-trip)
  const [localDepots, setLocalDepots] = useState([]);
  const depots = [
    ...ownerDepots.map(d => { const l = localDepots.find(ld => ld.id === d.id); return l ? { ...d, ...l } : d; }),
    ...localDepots.filter(ld => !ownerDepots.find(d => d.id === ld.id)),
  ];

  const handleNewDepot = () => requireKyc("depot", () => navigate("/depot/new"));
  const handlePlaceOrder = () => requireKyc("order", () => navigate("/place-order"));

  const handleCreateDepot = async (form) => {
    const created = await depotsApi.create({
      ownerId: authUser.id, name: form.name, location: form.location,
      state: form.state, lga: form.lga || form.location, address: form.address,
      licenseNumber: form.license, licenseExpiry: form.expiry,
      capacity: Number(form.capacity) || 0, products: form.products,
      vatPercent: parseFloat(form.vatPercent) || 7.5,
      contactName: form.contactName, contactPhone: form.contactPhone,
      contactEmail: form.contactEmail, contactRole: form.contactRole,
    });
    const optimistic = {
      id: created.id, name: form.name, location: form.location, kyb: "pending",
      license: form.license, capacity: Number(form.capacity) || 0,
      products: form.products.map(n => ({ id: n.toLowerCase() + "_" + created.id, name: n, pricePerLitre: 0, stock: 0, threshold: 5000 })),
      stockHistory: [],
    };
    setLocalDepots(prev => [...prev, optimistic]);
    loadOwnerDepots(authUser.id);
    return created;
  };

  const handleUpdateDepot = async (depotId, patch) => {
    setLocalDepots(prev => {
      const exists = prev.find(d => d.id === depotId);
      if (exists) return prev.map(d => d.id === depotId ? { ...d, ...patch } : d);
      const base = ownerDepots.find(d => d.id === depotId);
      return base ? [...prev, { ...base, ...patch }] : prev;
    });
    if (patch?.products) {
      const currentDepot = depots.find(d => d.id === depotId);
      const currentNames = new Set((currentDepot?.products || []).map(p => p.name));
      const newNames = new Set(patch.products.map(p => p.name));
      const VALID = new Set(["PMS", "AGO", "DPK", "LPG", "ATK"]);
      const validRows = patch.products
        .filter(p => VALID.has(p.name) && (p.pricePerLitre || 0) > 0)
        .map(p => ({ depot_id: depotId, product: p.name, price_per_litre: p.pricePerLitre, stock: p.stock || 0, threshold: p.threshold || 5000, is_active: p.is_active !== false }));
      if (validRows.length > 0) {
        await supabase.from("depot_products").upsert(validRows, { onConflict: "depot_id,product" });
      }
      for (const name of [...currentNames].filter(n => !newNames.has(n))) {
        await supabase.from("depot_products").delete().eq("depot_id", depotId).eq("product", name);
      }
    }
    if (authUser?.id) loadOwnerDepots(authUser.id);
    loadMarketDepots();
  };

  // Breadcrumb from URL path
  const isAdmin = !!user?.isAdmin;

  const getCrumb = () => {
    const p = location.pathname;
    if (p.startsWith("/depot/") && p.includes("/order/")) {
      const depotId = p.split("/")[2];
      const d = depots.find(dep => dep.id === depotId);
      const orderId = p.split("/order/")[1];
      return `${d?.name || "Depot"} · ${orderId}`;
    }
    if (p.startsWith("/depot/new")) return "New Depot";
    if (p.startsWith("/depot/")) {
      const d = depots.find(dep => dep.id === p.replace("/depot/", ""));
      return d?.name || "Depot";
    }
    if (p.startsWith("/orders/")) return p.replace("/orders/", "");
    if (p === "/admin" && isAdmin) return "Admin Panel";
    return CRUMB_MAP[p] || "Page Not Found";
  };
  const pendingKyb = depots.filter(d => d.kyb !== "verified").length;
  const pills = [
    authProfile?.kyc_status === "verified" || authProfile?.kyc_status === "approved" ? { bg: T.greenLight, color: T.greenDark, label: "KYC ✓" }
      : authProfile?.kyc_status === "submitted" ? { bg: T.amberLight, color: "#8A5C00", label: "KYC Pending" } : null,
    walletNGN ? { bg: T.gray50, color: T.black, label: `₦${(walletNGN.balanceNGN / 1e6).toFixed(1)}M` } : null,
    pendingKyb
      ? { bg: T.amberLight, color: "#8A5C00", label: `${pendingKyb} KYB pending` }
      : { bg: T.gray50, color: T.black, label: `${depots.length} depot${depots.length !== 1 ? "s" : ""}` },
  ].filter(Boolean);

  const IDENTITY = user || {
    initials: (authProfile?.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
    bg: T.green, textColor: T.black,
    name: authProfile?.full_name || "User",
    role: "Account Owner",
  };

  const KYC_GATE = showKycGate && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: T.white, maxWidth: "420px", width: "100%", padding: "28px", fontFamily: F }}>
        <div style={{ width: "44px", height: "44px", background: T.amberLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", fontSize: "20px" }}>🔒</div>
        <div style={{ fontSize: "16px", fontWeight: 800, color: T.black, marginBottom: "8px" }}>KYC Verification Required</div>
        <div style={{ fontSize: "13px", color: "#555", lineHeight: 1.6, marginBottom: "20px" }}>
          You need to complete identity verification (KYC) before {kycGateAction === "order" ? "placing an order" : kycGateAction === "depot" ? "creating a depot" : "performing this action"}.<br /><br />
          Go to <strong>Settings → Verification</strong> to upload your required documents (NIN, CAC Certificate, Proof of Address) and submit for review.
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => { setShowKycGate(false); navigate("/settings"); }}
            style={{ flex: 1, background: T.black, color: T.white, border: "none", padding: "12px", fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: F }}>
            Go to Verification →
          </button>
          <button onClick={() => setShowKycGate(false)}
            style={{ flex: "0 0 auto", background: T.white, color: T.gray600, border: `1px solid ${T.gray200}`, padding: "12px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: F }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const ctxValue = { depots, handleUpdateDepot, handleNewDepot, handleCreateDepot, buyerOrders };

  return (
    <DepotContext.Provider value={ctxValue}>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: F }}>
        <style>{GLOBAL_STYLES}</style>
        {KYC_GATE}
        {!isMobile && (
          <PlatformSidebar
            depots={depots} onNewDepot={handleNewDepot} onPlaceOrder={handlePlaceOrder}
            identity={IDENTITY} onSignOut={onSignOut} isAdmin={isAdmin}
          />
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Topbar crumb={getCrumb()} isMobile={isMobile} portalLabel="Platform" pills={pills} />
          {!adBannerDismissed && (()=>{
            const slide = AD_SLIDES[adSlide];
            return (
              <>
                <style>{`
                  @keyframes bannerShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                  @keyframes bannerSlideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
                `}</style>
                <div style={{background:slide.bg,padding:isMobile?"12px 16px":"14px 28px",position:"relative",overflow:"hidden",transition:"background 0.6s ease"}}>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 60%, transparent 100%)",backgroundSize:"200% 100%",animation:"bannerShimmer 4s linear infinite",pointerEvents:"none"}} />
                  <div key={adSlide} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:isMobile?"10px":"16px",position:"relative",zIndex:1,animation:"bannerSlideIn 0.4s ease-out",flexWrap:isMobile?"wrap":"nowrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:isMobile?"8px":"12px",flex:1,minWidth:0}}>
                      <span style={{background:slide.badgeBg,color:slide.badge==="LOANS"?T.black:T.white,fontSize:"8px",fontWeight:800,padding:"2px 6px",flexShrink:0,letterSpacing:"0.06em"}}>{slide.badge}</span>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:isMobile?"12px":"14px",fontWeight:800,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{slide.headline}</div>
                        <div style={{fontSize:isMobile?"10px":"11px",color:"rgba(255,255,255,0.6)",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:"1px"}}>{slide.sub}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
                      {slide.internal
                        ? <a href={slide.ctaLink} onClick={e=>{e.preventDefault();navigate(slide.ctaLink);}}
                            style={{background:slide.ctaBg,color:slide.ctaColor,fontSize:"10px",fontWeight:800,padding:"6px 14px",textDecoration:"none",whiteSpace:"nowrap",fontFamily:F}}>{slide.cta}</a>
                        : <a href={slide.ctaLink} target="_blank" rel="noopener noreferrer"
                            style={{background:slide.ctaBg,color:slide.ctaColor,fontSize:"10px",fontWeight:800,padding:"6px 14px",textDecoration:"none",whiteSpace:"nowrap",fontFamily:F}}>{slide.cta}</a>
                      }
                    </div>
                  </div>
                  {/* Dot indicators */}
                  <div style={{display:"flex",justifyContent:"center",gap:"6px",marginTop:"8px",position:"relative",zIndex:1}}>
                    {AD_SLIDES.map((_,i)=>(
                      <button key={i} onClick={()=>setAdSlide(i)}
                        style={{width:adSlide===i?"16px":"6px",height:"6px",borderRadius:"3px",background:adSlide===i?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.25)",border:"none",cursor:"pointer",padding:0,transition:"all 0.3s ease"}}
                        aria-label={`Slide ${i+1}`} />
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
          <div style={{ padding: isMobile ? "14px 16px" : "24px 28px", paddingBottom: isMobile ? "80px" : "24px", flex: 1, overflowY: "auto" }}>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route index element={<UnifiedDash onOrder={handlePlaceOrder} onDepotClick={id => navigate(`/depot/${id}`)} onNewDepot={handleNewDepot} onViewOrder={id => navigate(`/orders/${id}`)} isMobile={isMobile} />} />
                  <Route path="market" element={<BuyerMarketplace onOrder={handlePlaceOrder} isMobile={isMobile} />} />
                  <Route path="orders" element={<OrdersListView isMobile={isMobile} />} />
                  <Route path="orders/:id" element={<BuyerOrderDetail isMobile={isMobile} />} />
                  <Route path="wallet" element={<BuyerWallet isMobile={isMobile} />} />
                  <Route path="place-order" element={kycApproved ? <OrderFlow onDone={() => navigate("/")} isMobile={isMobile} /> : <Navigate to="/settings" replace />} />
                  <Route path="settings" element={<SettingsModule portalType="buyer" isMobile={isMobile} />} />
                  <Route path="depot/new" element={kycApproved ? <CreateDepotFlow onCreateDepot={handleCreateDepot} onDone={id => navigate(id ? `/depot/${id}` : "/")} onCancel={() => navigate(-1)} isMobile={isMobile} /> : <Navigate to="/settings" replace />} />
                  <Route path="depot/:id" element={<DepotDetailView onViewOrder={(orderId, depotId) => navigate(`/depot/${depotId}/order/${orderId}`)} isMobile={isMobile} />} />
                  <Route path="depot/:depotId/order/:orderId" element={<DepotOrderDetail isMobile={isMobile} />} />
                  {isAdmin && <Route path="admin" element={<AdminPanel isMobile={isMobile} />} />}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
        {isMobile && (
          <PlatformSidebar
            depots={depots} onNewDepot={handleNewDepot} onPlaceOrder={handlePlaceOrder}
            identity={IDENTITY} onSignOut={onSignOut} isAdmin={isAdmin} isMobile={true}
          />
        )}
      </div>
    </DepotContext.Provider>
  );
}
