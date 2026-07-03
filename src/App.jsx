import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import { AuthScreens } from "./screens/Auth";
import { VentrylPlatform } from "./screens/VentrylPlatform";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { T, F, GLOBAL_STYLES } from "./lib/tokens";

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: T.black, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "40px", height: "40px", background: T.green, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <span style={{ fontSize: "18px", fontWeight: 800, color: T.black }}>V</span>
        </div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>Loading…</div>
      </div>
    </div>
  );
}

export default function VentrylApp() {
  const bp = useBreakpoint();
  const { session, profile, loading, init, signOut } = useAuthStore();

  useEffect(() => { init(); }, []);

  if (loading) return <LoadingScreen />;

  if (!session) return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <AuthScreens />
    </>
  );

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const user = {
    initials,
    bg: T.green,
    textColor: T.black,
    name: profile?.full_name || "",
    role: profile?.company_name || "",
    isAdmin: !!profile?.is_admin,
    vcs: profile?.vcs || 300,
  };

  return (
    <div style={{ fontFamily: F, background: T.gray50, minHeight: "100vh" }}>
      <style>{GLOBAL_STYLES}</style>
      <VentrylPlatform bp={bp} user={user} onSignOut={signOut} />
    </div>
  );
}
