import { useState, useEffect, useRef, useCallback } from "react";
// recharts imports removed — charts replaced with placeholder until real data is wired
import { useNavigate, useParams } from "react-router-dom";
import { T, F } from "../lib/tokens";
import { NG_STATES } from "../lib/ngStates";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useAuthStore } from "../store/authStore";
import { useVentrylStore } from "../store/ventrylStore";
import { Badge, Icon, Card, KpiCard, SectionHead, Sidebar, Topbar } from "../components/shared";
import { _deliveryQuoteStore, _orderStatusStore, _orderBayStore, _orderTruckListStore, _orderDispatchedStore, _orderStatusLogStore, _gateRecordStore, _buyerConfirmedStore } from "../lib/sessionCache";
import { kyc as kycApi, kyb as kybApi, notifications as notifApi, depots as depotsApi, profiles as profilesApi, orders as ordersApi, negotiations as negotiationsApi, teamMembers as teamMembersApi } from "../lib/api";
import { supabase } from "../lib/supabase";
import { printWaybill, printInvoice } from "../lib/documents";
import { openPaystackPopup, verifyAndCreditWallet, FUND_PRESETS } from "../lib/payment";
import { useOrderRealtime, useDepotInboxRealtime, useProfileRealtime } from "../lib/realtime";
import { useDepotContext } from "../context/DepotContext";

function DepotDash({isMobile,depot}) {
  const {depotOrders}=useVentrylStore();
  const orders=depot?depotOrders[depot.id]||[]:[];
  const pmsProduct=depot?.products?.find(p=>p.name==="PMS");
  const agoProduct=depot?.products?.find(p=>p.name==="AGO");
  const [pms,setPms]=useState(pmsProduct?.pricePerLitre||0);
  const [ago,setAgo]=useState(agoProduct?.pricePerLitre||0);
  const [editing,setEditing]=useState(false);
  const col2=isMobile?"1fr":"1fr 1fr";
  return (
    <div>
      <div style={{background:T.black,padding:isMobile?"18px 16px":"24px 28px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
        <div>
          <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"4px"}}>Depot Dashboard</div>
          <div style={{fontSize:isMobile?"20px":"24px",fontWeight:800,color:T.white}}>{depot?.name||"Depot Dashboard"}</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>{[depot?.location,depot?.license?`NMDPRA: ${depot.license}`:null].filter(Boolean).join(" · ")||"No depot selected"}</div>
        </div>
        <div style={{textAlign:isMobile?"left":"right"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"3px"}}>Revenue ({new Date().toLocaleDateString("en-NG",{month:"short"})})</div>
          {(()=>{const now=new Date();const monthStart=new Date(now.getFullYear(),now.getMonth(),1);const mtdRev=orders.filter(o=>new Date(o._raw?.placed_at)>=monthStart&&(o.status==="delivered"||o.status==="collected")).reduce((s,o)=>s+o.value,0);return <div style={{fontSize:isMobile?"22px":"28px",fontWeight:800,color:T.green}}>{mtdRev>0?`₦${mtdRev>=1e6?(mtdRev/1e6).toFixed(1)+"M":mtdRev.toLocaleString("en-NG")}`:"—"}</div>;})()}
          <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{orders.length} orders total</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        {(()=>{const now=new Date();const monthStart=new Date(now.getFullYear(),now.getMonth(),1);const mtd=orders.filter(o=>new Date(o._raw?.placed_at)>=monthStart);const fulfilled=mtd.filter(o=>o.status==="delivered"||o.status==="collected").length;const totalVol=orders.reduce((s,o)=>s+o.vol,0);const fmtVol=totalVol>=1e6?`${(totalVol/1e6).toFixed(2)}M L`:totalVol>=1000?`${(totalVol/1000).toFixed(0)}k L`:`${totalVol} L`;const pendingCount=orders.filter(o=>o.status==="pending").length;return(<><KpiCard label="Orders MTD" value={`${mtd.length}`} sub={fulfilled?`${fulfilled} fulfilled`:"None fulfilled"}/><KpiCard label="Volume" value={totalVol>0?fmtVol:"—"} sub={`${orders.reduce((s,o)=>s+o.trucks,0)} trucks`}/><KpiCard label="Pending" value={`${pendingCount}`} sub="SLA: 2h max" alert={pendingCount>0}/><KpiCard label="Rating" value={depot?.rating?`${depot.rating} ★`:"—"} sub={`${depot?.orders||0} reviews`}/></>);})()}
      </div>

      <div style={{display:"grid",gridTemplateColumns:col2,gap:"14px",marginBottom:"14px"}}>
        {/* Price Control */}
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
            <div><div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Live Price Control</div><div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>Updates marketplace instantly</div></div>
            <button onClick={()=>setEditing(!editing)} style={{background:editing?T.green:T.black,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>{editing?"Save":"Edit"}</button>
          </div>
          {[{label:"PMS",val:pms,set:setPms},{label:"AGO",val:ago,set:setAgo}].map(p=>(
            <div key={p.label} style={{marginBottom:"12px",paddingBottom:"12px",borderBottom:`1px solid ${T.gray100}`}}>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"7px"}}>{p.label}</div>
              {editing?(
                <div style={{display:"flex",alignItems:"center",border:`2px solid ${T.black}`}}>
                  <span style={{padding:"9px 10px",fontSize:"12px",fontWeight:700,color:T.gray400,borderRight:`1px solid ${T.gray100}`}}>₦</span>
                  <input type="number" value={p.val} onChange={e=>p.set(Number(e.target.value))} style={{flex:1,border:"none",padding:"9px 10px",fontSize:"16px",fontWeight:800,fontFamily:F,outline:"none",color:T.black,width:"100%"}}/>
                  <span style={{padding:"9px 10px",fontSize:"11px",fontWeight:600,color:T.gray400}}>/L</span>
                </div>
              ):(
                <div style={{background:T.gray50,padding:"10px 12px",fontSize:"18px",fontWeight:800,color:T.black}}>₦{p.val.toLocaleString()}/L</div>
              )}
            </div>
          ))}
          <div style={{background:T.greenLight,padding:"10px 12px",display:"flex",alignItems:"center",gap:"7px"}}>
            <span>📡</span><span style={{fontSize:"11px",fontWeight:700,color:T.greenDark}}>Live on marketplace</span>
          </div>
        </Card>

        {/* Inventory */}
        <Card>
          <SectionHead title="Inventory Status" sub={`Current stock · ${depot?.location||""}`}/>
          {(depot?.products||[]).filter(p=>p.is_active&&p.stock>0).map(p=>({prod:p.name,current:p.stock,cap:depot?.capacity||100000})).concat([{prod:"Total",current:(depot?.products||[]).reduce((s,p)=>s+(p.stock||0),0),cap:depot?.capacity||100000}]).map(s=>(
            <div key={s.prod} style={{marginBottom:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{s.prod}</span>
                <span style={{fontSize:"11px",fontWeight:700,color:T.gray400}}>{(s.current/1000).toFixed(1)}k/{(s.cap/1000).toFixed(0)}k MT · <span style={{color:T.green,fontWeight:800}}>{Math.round(s.current/s.cap*100)}%</span></span>
              </div>
              <div style={{height:"7px",background:T.gray100,borderRadius:"4px",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(s.current/s.cap*100)}%`,background:T.green,borderRadius:"4px"}}/></div>
            </div>
          ))}
          {(()=>{const totalStock=(depot?.products||[]).reduce((s,p)=>s+(p.stock||0),0);const cap=depot?.capacity||1;const pct=Math.round(totalStock/cap*100);return pct<30?(<div style={{background:T.amberLight,padding:"10px 14px",marginTop:"6px"}}><div style={{fontSize:"11px",fontWeight:700,color:"#8A5C00"}}>⚠ Stock below 30% — consider restocking</div></div>):null;})()}
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.5fr 1fr",gap:"14px"}}>
        <Card>
          <SectionHead title="Revenue Trend" sub="₦ Millions · 6 months"/>
          <div style={{height:isMobile?150:170,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:"12px",color:T.gray400,fontWeight:600}}>No revenue data yet</div>
          </div>
        </Card>
        <Card>
          <SectionHead title="Orders by Day" sub="This week"/>
          <div style={{height:isMobile?150:170,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:"12px",color:T.gray400,fontWeight:600}}>No order data yet</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export { DepotDash };
