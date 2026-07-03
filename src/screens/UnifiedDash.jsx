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

function MarketPulseWidget({onOrder}) {
  const {marketDepots,marketDepotsLoaded,loadMarketDepots}=useVentrylStore();
  useEffect(()=>{loadMarketDepots();},[]);
  const depotsSource=marketDepots||[];
  const PRODUCTS=[
    {key:"pms",  name:"PMS",  fullName:"Premium Motor Spirit", unit:"/L", change:+2.1, color:T.green},
    {key:"ago",  name:"AGO",  fullName:"Automotive Gas Oil",   unit:"/L", change:-0.8, color:T.blue},
    {key:"dpk",  name:"DPK",  fullName:"Dual Purpose Kerosene",unit:"/L", change:+1.4, color:"#9B59B6"},
    {key:"lpg",  name:"LPG",  fullName:"Liquefied Petroleum Gas",unit:"/kg",change:-0.3,color:T.amber},
    {key:"atk",  name:"ATK",  fullName:"Aviation Turbine Kerosene",unit:"/L",change:+0.9,color:"#E67E22"},
    {key:"lpfo", name:"LPFO", fullName:"Low Pour Fuel Oil",    unit:"/L", change:-1.2, color:"#E74C3C"},
    {key:"hpfo", name:"HPFO", fullName:"High Pour Fuel Oil",   unit:"/L", change:+0.5, color:"#7F8C8D"},
  ];
  return (
    <Card style={{padding:0}}>
      <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Market Prices</div>
          <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>7 product types · updated 2 min ago</div>
        </div>
        <span style={{fontSize:"9px",fontWeight:700,color:T.green,background:T.greenLight,padding:"3px 7px",letterSpacing:"0.04em"}}>● LIVE</span>
      </div>
      <div style={{padding:"0 16px"}}>
        {PRODUCTS.map((p,i)=>{
          const prices=depotsSource.map(d=>d[p.key]).filter(Boolean);
          if(!prices.length) return null;
          const best=Math.min(...prices);
          const high=Math.max(...prices);
          const bestDepot=depotsSource.find(d=>d[p.key]===best);
          const isLast=i===PRODUCTS.length-1||PRODUCTS.slice(i+1).every(pp=>!depotsSource.map(d=>d[pp.key]).filter(Boolean).length);
          return (
            <div key={p.key} style={{padding:"10px 0",borderBottom:isLast?"none":`1px solid ${T.gray100}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                  <div style={{width:"7px",height:"7px",borderRadius:"50%",background:p.color,flexShrink:0}}/>
                  <div>
                    <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{p.name}</span>
                    <span style={{fontSize:"9px",color:T.gray400,marginLeft:"5px"}}>{p.fullName}</span>
                  </div>
                  <span style={{fontSize:"9px",fontWeight:700,color:p.change>0?T.red:T.green,background:p.change>0?T.redLight:T.greenLight,padding:"1px 5px",flexShrink:0}}>
                    {p.change>0?"▲":"▼"}{Math.abs(p.change)}%
                  </span>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>₦{best.toLocaleString()}</span>
                  <span style={{fontSize:"9px",color:T.gray400,marginLeft:"2px"}}>{p.unit}</span>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingLeft:"14px"}}>
                <div style={{fontSize:"10px",color:T.gray400}}>Best: <span style={{color:T.greenDark,fontWeight:700}}>{bestDepot?.name}</span></div>
                <div style={{fontSize:"10px",color:T.gray400}}>Range: <span style={{color:T.gray600,fontWeight:600}}>₦{best.toLocaleString()}–₦{high.toLocaleString()}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{padding:"12px 16px 14px",borderTop:`1px solid ${T.gray100}`}}>
        <button onClick={onOrder} style={{width:"100%",background:T.black,color:T.white,border:"none",padding:"10px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"38px"}}>
          Place Order →
        </button>
      </div>
    </Card>
  );
}

function OrderInboxPanel({incoming,isMobile,depot,onViewOrder}) {
  const {user:authUser}=useAuthStore();
  const {loadDepotOrders}=useVentrylStore();
  const [acting,setActing]=useState({});
  const [panelError,setPanelError]=useState(null);
  const pending=incoming.filter(o=>o.status==="pending");
  const confirmed=incoming.filter(o=>o.status==="confirmed");
  const newCount=pending.length;
  const handleAct=async(e,orderId,toStatus)=>{
    e.stopPropagation();
    const verb=toStatus==="confirmed"?"confirming":"rejecting";
    setActing(a=>({...a,[orderId]:verb}));
    setPanelError(null);
    try{
      await ordersApi.updateStatus(orderId,toStatus,{actorId:authUser?.id,note:toStatus==="confirmed"?"Order confirmed by depot":"Order rejected by depot"});
      const depotId=incoming.find(o=>o.id===orderId)?._raw?.depot_id||depot?.id;
      if(depotId) loadDepotOrders(depotId);
    }catch(err){setPanelError(err.message);}
    finally{setActing(a=>{const n={...a};delete n[orderId];return n;});}
  };
  if(incoming.length===0) return null;
  return (
    <Card style={{marginBottom:"14px"}} pad={false}>
      <div style={{padding:"14px 16px 0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>Order Inbox</span>
          {newCount>0&&<span style={{background:T.red,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 8px",letterSpacing:"0.04em"}}>{newCount} NEW</span>}
          {newCount===0&&confirmed.length>0&&<span style={{background:T.greenLight,color:T.greenDark,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>{confirmed.length} confirmed</span>}
        </div>
        {newCount>0&&<span style={{fontSize:"10px",color:"#8A5C00",fontWeight:700,background:T.amberLight,padding:"3px 8px"}}>⏱ Respond before SLA expires</span>}
      </div>
      {panelError&&<div style={{margin:"8px 16px 0",padding:"8px 12px",background:T.redLight,fontSize:"11px",color:T.red,fontWeight:600}}>{panelError}</div>}
      <div style={{padding:"10px 16px 14px 16px"}}>
        {pending.map(o=>{
          const isActing=acting[o.id];
          return (
            <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
              style={{border:`2px solid ${T.amber}`,background:T.white,marginBottom:"10px",position:"relative",cursor:onViewOrder?"pointer":"default"}}
              onMouseEnter={e=>{if(onViewOrder)e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.10)";}}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              <div style={{position:"absolute",top:0,right:0,background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"3px 8px",letterSpacing:"0.06em",zIndex:1}}>NEW</div>
              <div style={{padding:"14px 16px 10px 16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"8px",gap:"10px",flexWrap:isMobile?"wrap":"nowrap"}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap",marginBottom:"4px"}}>
                      <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{o.id}</span>
                      <span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"2px 6px"}}>{o.type}</span>
                    </div>
                    <div style={{fontSize:"13px",fontWeight:700,color:T.black,marginBottom:"1px"}}>{o.buyer}</div>
                    <div style={{fontSize:"11px",color:T.gray400}}>{o.location} · {o.submitted}</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px 18px",flexShrink:0}}>
                    {[["Product",o.product],["Volume",`${(o.vol/1000).toFixed(0)}k L`],["Trucks",o.trucks],["Value",`₦${(o.value||0).toLocaleString('en-NG')}`]].map(([l,v])=>(
                      <div key={l}>
                        <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"1px"}}>{l}</div>
                        <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px",paddingTop:"10px",borderTop:`1px solid ${T.gray100}`}}>
                  <span style={{fontSize:"11px",fontWeight:800,color:"#8A5C00",background:T.amberLight,padding:"3px 8px"}}>⏱ SLA: {o.slaLeft}</span>
                  <div style={{display:"flex",gap:"7px"}}>
                    <button disabled={!!isActing} onClick={e=>handleAct(e,o.id,"rejected")}
                      style={{background:T.white,color:T.red,border:`1px solid ${T.red}`,padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:isActing?"not-allowed":"pointer",fontFamily:F,minHeight:"36px",opacity:isActing?0.6:1}}>
                      {isActing==="rejecting"?"Rejecting…":"Reject"}
                    </button>
                    <button disabled={!!isActing} onClick={e=>handleAct(e,o.id,"confirmed")}
                      style={{background:T.green,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:isActing?"not-allowed":"pointer",fontFamily:F,minHeight:"36px",opacity:isActing?0.6:1}}>
                      {isActing==="confirming"?"Confirming…":"Confirm →"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {confirmed.map(o=>(
          <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
            style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"12px 16px",marginBottom:"8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",flexWrap:"wrap",cursor:onViewOrder?"pointer":"default"}}
            onMouseEnter={e=>{if(onViewOrder){e.currentTarget.style.borderColor=T.black;e.currentTarget.style.background=T.gray50;}}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.gray100;e.currentTarget.style.background=T.white;}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px"}}>
                <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</span>
                <Badge status="confirmed"/>
              </div>
              <div style={{fontSize:"11px",color:T.gray400}}>{o.buyer} · {o.product} · {(o.vol/1000).toFixed(0)}k L · ₦{(o.value||0).toLocaleString('en-NG')}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"10px",fontWeight:700,color:T.gray400}}>{o.submitted}</span>
              {onViewOrder&&<span style={{fontSize:"10px",fontWeight:800,color:T.black}}>Manage →</span>}
            </div>
          </div>
        ))}
        {pending.length===0&&confirmed.length===0&&(
          <div style={{fontSize:"12px",color:T.gray400,padding:"12px 0",textAlign:"center"}}>No pending orders. New orders will appear here.</div>
        )}
      </div>
    </Card>
  );
}

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
