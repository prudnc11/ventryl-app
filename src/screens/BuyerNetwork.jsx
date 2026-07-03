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

function BuyerNetwork({depot,isMobile}) {
  const {depotOrders,loadDepotOrders}=useVentrylStore();
  useEffect(()=>{if(depot?.id)loadDepotOrders(depot.id);},[depot?.id]);
  const orders=depotOrders[depot?.id]||[];

  // Aggregate per buyer
  const byBuyer={};
  for(const o of orders){
    if(!byBuyer[o.buyer]) byBuyer[o.buyer]={name:o.buyer,orders:0,vol:0,value:0,lastTs:0};
    byBuyer[o.buyer].orders+=1;
    byBuyer[o.buyer].vol+=o.vol||0;
    byBuyer[o.buyer].value+=o.value||0;
    // track most recent: submitted is a string like "2 min ago", use raw placed_at if available
    const ts=o._raw?.placed_at?new Date(o._raw.placed_at).getTime():0;
    if(ts>byBuyer[o.buyer].lastTs) byBuyer[o.buyer].lastTs=ts;
  }
  const buyers=Object.values(byBuyer).sort((a,b)=>b.value-a.value);

  if(buyers.length===0) return (
    <div>
      <SectionHead title="Buyer Network" sub="No buyers yet"/>
      <div style={{textAlign:"center",padding:"40px 0",color:T.gray400,fontSize:"13px",fontWeight:600}}>
        No buyer orders found for this depot.
      </div>
    </div>
  );

  const fmtVol=v=>v>=1e6?`${(v/1e6).toFixed(1)}M L`:`${(v/1000).toFixed(0)}k L`;
  const fmtVal=v=>`₦${(v||0).toLocaleString('en-NG')}`;
  const fmtLast=ts=>ts?new Date(ts).toLocaleDateString("en-NG",{month:"short",day:"numeric"}):"—";

  return (
    <div>
      <SectionHead title="Buyer Network" sub={`${buyers.length} buyer${buyers.length!==1?"s":""} · ${orders.length} total orders`}/>
      {isMobile?(
        buyers.map((b,i)=>(
          <div key={b.name} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"14px 16px",marginBottom:"8px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
              <div>
                <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{b.name}</div>
                <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>Last: {fmtLast(b.lastTs)}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
              {[["Orders",b.orders],["Volume",fmtVol(b.vol)],["Spend",fmtVal(b.value)]].map(([l,v])=>(
                <div key={l}><div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>{l}</div><div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{v}</div></div>
              ))}
            </div>
          </div>
        ))
      ):(
        <Card pad={false}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.gray100}`}}>{["Buyer","Orders","Volume","Spend","Last Order"].map(h=><th key={h} style={{padding:"10px 18px",fontFamily:F,fontSize:"10px",fontWeight:700,color:T.gray400,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{buyers.map((b,i)=>(
              <tr key={b.name} style={{borderBottom:i<buyers.length-1?`1px solid ${T.gray100}`:"none"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.gray50}
                onMouseLeave={e=>e.currentTarget.style.background=T.white}>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>{b.name}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black}}>{b.orders}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",color:T.gray600}}>{fmtVol(b.vol)}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>{fmtVal(b.value)}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"11px",color:T.gray400}}>{fmtLast(b.lastTs)}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export { BuyerNetwork };
