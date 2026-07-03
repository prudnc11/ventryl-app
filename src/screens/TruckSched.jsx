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

function TruckSched({depot,isMobile}) {
  const {depotOrders,loadDepotOrders}=useVentrylStore();
  useEffect(()=>{if(depot?.id)loadDepotOrders(depot.id);},[depot?.id]);
  const orders=(depotOrders[depot?.id]||[]).filter(o=>["confirmed","loading","in_transit"].includes(o.status));

  // Build bay schedule: one row per active order that has a bay_assigned
  const slots=orders.map(o=>({
    order:o.id,
    bay:o._raw?.bay_assigned||"Pending Bay",
    product:o.product,
    trucks:o.trucks||0,
    status:o.status,
    buyer:o.buyer,
  }));
  const bays=["Bay 1","Bay 2","Bay 3"];
  const bayUtil=bays.map(b=>({
    bay:b,
    count:slots.filter(s=>s.bay===b).length,
  }));

  if(slots.length===0) return (
    <div>
      <SectionHead title="Loading Bay Schedule" sub={depot?.name||"Depot"}/>
      <div style={{textAlign:"center",padding:"40px 0",color:T.gray400,fontSize:"13px",fontWeight:600}}>
        No active orders in bay at this time.
      </div>
    </div>
  );

  return (
    <div>
      <SectionHead title="Loading Bay Schedule" sub={depot?.name||"Depot"}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"14px"}}>
        {bayUtil.map(({bay,count})=>(
          <Card key={bay}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
              <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{bay}</div>
              <div style={{fontSize:"11px",fontWeight:700,color:T.gray400}}>{count} active</div>
            </div>
            <div style={{height:"5px",background:T.gray100,borderRadius:"3px",overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(count/2*100,100)}%`,background:count>0?T.green:T.gray200}}/>
            </div>
            <div style={{fontSize:"10px",color:T.gray400,marginTop:"4px"}}>{count===0?"Available":"In use"}</div>
          </Card>
        ))}
      </div>
      {isMobile?(
        <div>
          {slots.map((s,i)=>(
            <div key={i} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"14px 16px",marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
                <div>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{s.bay}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{s.order} · {s.buyer} · {s.product}</div>
                </div>
                <Badge status={s.status}/>
              </div>
              {s.trucks>0&&<div style={{fontSize:"11px",color:T.gray600,fontWeight:600}}>{s.trucks} truck{s.trucks!==1?"s":""} 🚛</div>}
            </div>
          ))}
        </div>
      ):(
        <Card pad={false}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.gray100}`}}>{["Bay","Order","Buyer","Product","Trucks","Status"].map(h=><th key={h} style={{padding:"10px 18px",fontFamily:F,fontSize:"10px",fontWeight:700,color:T.gray400,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{slots.map((s,i)=>(
              <tr key={i} style={{borderBottom:i<slots.length-1?`1px solid ${T.gray100}`:"none"}}>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>{s.bay}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",fontWeight:700,color:T.black}}>{s.order}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",color:T.gray600}}>{s.buyer}</td>
                <td style={{padding:"13px 18px"}}><span style={{background:T.gray100,color:T.black,fontSize:"10px",fontWeight:800,padding:"3px 7px"}}>{s.product}</span></td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",fontWeight:800,color:s.trucks?T.black:T.gray200}}>{s.trucks?`${s.trucks} 🚛`:"—"}</td>
                <td style={{padding:"13px 18px"}}><Badge status={s.status}/></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export { TruckSched };
