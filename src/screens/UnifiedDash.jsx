import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useNavigate, useParams } from "react-router-dom";
import { T, F } from "../lib/tokens";
import { NG_STATES } from "../lib/ngStates";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useAuthStore } from "../store/authStore";
import { useVentrylStore } from "../store/ventrylStore";
import { Badge, Icon, Card, KpiCard, SectionHead, ChartTip, Sidebar, Topbar } from "../components/shared";
import { _deliveryQuoteStore, _orderStatusStore, _orderBayStore, _orderTruckListStore, _orderDispatchedStore, _orderStatusLogStore, _gateRecordStore, _buyerConfirmedStore } from "../lib/sessionCache";
import { kyc as kycApi, kyb as kybApi, notifications as notifApi, depots as depotsApi, profiles as profilesApi, orders as ordersApi, negotiations as negotiationsApi, teamMembers as teamMembersApi } from "../lib/api";
import { supabase } from "../lib/supabase";
import { printWaybill, printInvoice } from "../lib/documents";
import { openPaystackPopup, verifyAndCreditWallet, FUND_PRESETS } from "../lib/payment";
import { useOrderRealtime, useDepotInboxRealtime, useProfileRealtime } from "../lib/realtime";
import { useDepotContext } from "../context/DepotContext";

function UnifiedDash({onOrder,onDepotClick,onNewDepot,onViewOrder,isMobile}) {
  const { depots } = useDepotContext();
  const {profile:userProfile}=useAuthStore();
  const {buyerOrders,walletNGN,priceHistory,depotOrders}=useVentrylStore();
  const allOrders=buyerOrders;
  const verified=depots.filter(d=>d.kyb==="verified");
  const pending=depots.filter(d=>d.kyb!=="verified");
  const hasInbox=verified.length>0;
  const chartData=priceHistory;
  // Aggregate real pending orders across all verified depots
  const allDepotIncoming=verified.flatMap(d=>depotOrders[d.id]||[]);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>

      {/* ── Hero ── */}
      <div style={{background:T.black,padding:isMobile?"16px":"22px 28px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:isMobile?"17px":"20px",fontWeight:800,color:T.white,marginBottom:"2px"}}>{(()=>{const h=new Date().getHours();const g=h<12?"Good morning":h<17?"Good afternoon":"Good evening";const first=(userProfile?.full_name||"").split(" ")[0];return first?`${g}, ${first}`:g;})()}</div>
            <div style={{fontSize:"11px",color:"#666"}}>{[userProfile?.company_name,userProfile?.state,userProfile?.kyc_status==="approved"?"KYC verified":null].filter(Boolean).join(" · ")||"Welcome to Ventryl"}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"2px"}}>Wallet</div>
              <div style={{fontSize:isMobile?"18px":"22px",fontWeight:800,color:T.green}}>{walletNGN?`₦${walletNGN.balanceNGN.toLocaleString('en-NG')}`:"—"}</div>
            </div>
            <button onClick={onOrder} style={{background:T.green,color:T.black,border:"none",padding:"10px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px",whiteSpace:"nowrap"}}>+ Place Order</button>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`}}>
        {[
          {l:"Orders This Month",v:"7",sub:"3 delivered · 2 in transit"},
          {l:"Total Volume Bought",v:"363k L",sub:"₦280.5M spend"},
          {l:"Active Depots",v:`${verified.length||"—"}`,sub:pending.length>0?`${pending.length} awaiting KYB`:"All verified",alert:pending.length>0},
          {l:"Depot Revenue",v:verified.length>0?"₦218M":"—",sub:"Combined · last 30 days"},
        ].map(k=><KpiCard key={k.l} label={k.l} value={k.v} sub={k.sub} alert={k.alert}/>)}
      </div>

      {/* ── Main content: left col (Inbox + Orders) · right col (Market Prices) ── */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr",gap:"14px",alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          {hasInbox&&(
            <OrderInboxPanel incoming={allDepotIncoming} isMobile={isMobile} depot={null} onViewOrder={onViewOrder}/>
          )}
          <Card>
            <SectionHead title="Recent Orders" sub={`${allOrders.length} orders`} right={<button onClick={()=>onViewOrder&&onViewOrder(allOrders[0]?.id)} style={{background:"none",border:"none",fontSize:"11px",fontWeight:700,color:T.gray400,cursor:"pointer",fontFamily:F,padding:0}}>View all →</button>}/>
            {allOrders.length===0&&<div style={{padding:"16px 0",fontSize:"12px",color:T.gray400,textAlign:"center"}}>No orders yet</div>}
            {allOrders.slice(0,5).map((o,i,arr)=>(
              <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<arr.length-1?`1px solid ${T.gray100}`:"none",gap:"8px",flexWrap:"wrap",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.gray50}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{o.depot} · {o.product} · {(o.vol/1000).toFixed(0)}k L</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>₦{(o.value||0).toLocaleString('en-NG')}</span>
                  <Badge status={o.status}/>
                  {o.pendingQuote&&<span style={{background:T.amber,color:"#000",fontSize:"9px",fontWeight:800,padding:"2px 6px",letterSpacing:"0.04em"}}>💰 QUOTE</span>}
                </div>
              </div>
            ))}
          </Card>
        </div>
        <MarketPulseWidget onOrder={onOrder}/>
      </div>

    </div>
  );
}

export { UnifiedDash };
