import { useState, useEffect } from "react";

export function useBreakpoint() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    let timer;
    const fn = () => { clearTimeout(timer); timer = setTimeout(() => setW(window.innerWidth), 150); };
    window.addEventListener("resize", fn);
    return () => { window.removeEventListener("resize", fn); clearTimeout(timer); };
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1024, isDesktop: w >= 1024, width: w };
}
