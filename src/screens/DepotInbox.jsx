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

function DepotInbox({depotId,isMobile,onViewOrder}) {
  const {depotOrders,loadDepotOrders}=useVentrylStore();
  const {user:authUser}=useAuthStore();
  const [acting,setActing]=useState({}); // orderId -> 'confirming'|'rejecting'
  const [bayAssigning,setBayAssigning]=useState({}); // orderId -> true
  const [inboxError,setInboxError]=useState(null);
  const BAYS=["Bay 1","Bay 2","Bay 3"];

  useEffect(()=>{if(depotId)loadDepotOrders(depotId);},[depotId]);

  // Realtime: reload on any order insert/update for this depot
  useDepotInboxRealtime(depotId,()=>{loadDepotOrders(depotId);});

  const orders=depotOrders[depotId]||[];
  const pending=orders.filter(o=>o.status==="pending");
  const active=orders.filter(o=>["confirmed","loading","in_transit"].includes(o.status));
  const completed=orders.filter(o=>["delivered","collected"].includes(o.status)).slice(0,5);

  const handleConfirm=async(orderId)=>{
    setActing(a=>({...a,[orderId]:"confirming"}));
    setInboxError(null);
    try{
      await ordersApi.updateStatus(orderId,"confirmed",{actorId:authUser?.id,note:"Order confirmed by depot"});
      loadDepotOrders(depotId);
    }catch(e){setInboxError(e.message);}
    finally{setActing(a=>{const n={...a};delete n[orderId];return n;});}
  };

  const handleReject=async(orderId)=>{
    setActing(a=>({...a,[orderId]:"rejecting"}));
    setInboxError(null);
    try{
      await ordersApi.updateStatus(orderId,"rejected",{actorId:authUser?.id,note:"Order rejected by depot"});
      loadDepotOrders(depotId);
    }catch(e){setInboxError(e.message);}
    finally{setActing(a=>{const n={...a};delete n[orderId];return n;});}
  };

  const handleAssignBay=async(orderId,bay)=>{
    const loadingRef=`LOAD-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100).padStart(3,"0")}`;
    setBayAssigning(b=>({...b,[orderId]:true}));
    setInboxError(null);
    try{
      await ordersApi.assignBay(orderId,bay,loadingRef,authUser?.id);
      loadDepotOrders(depotId);
    }catch(e){setInboxError(e.message);}
    finally{setBayAssigning(b=>{const n={...b};delete n[orderId];return n;});}
  };

  return (
    <div>
      {inboxError&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"10px 14px",marginBottom:"14px",fontSize:"12px",color:T.red,fontWeight:600}}>
          {inboxError}
        </div>
      )}

      {/* ── INCOMING ORDERS ── */}
      <div style={{marginBottom:"24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>Incoming Orders</div>
          {pending.length>0&&(
            <div style={{background:T.red,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>
              {pending.length} ACTION REQUIRED
            </div>
          )}
        </div>

        {pending.length===0&&(
          <div style={{border:`1px dashed ${T.gray200}`,padding:"32px",textAlign:"center",marginBottom:"8px"}}>
            <div style={{fontSize:"13px",fontWeight:700,color:T.gray400}}>No pending orders</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"4px"}}>New orders appear here in real time.</div>
          </div>
        )}

        {pending.map(o=>{
          const isActing=acting[o.id];
          return (
            <div key={o.id} style={{border:`2px solid ${T.amber}`,background:T.white,marginBottom:"12px"}}>
              <div style={{background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"3px 10px",letterSpacing:"0.06em",display:"inline-block"}}>NEW</div>
              <div style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"10px",gap:"10px",flexWrap:isMobile?"wrap":"nowrap"}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap",marginBottom:"4px"}}>
                      <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black,textDecoration:"underline"}}>{o.id}</button>
                      <span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"2px 6px"}}>{o.type}</span>
                    </div>
                    <div style={{fontSize:"13px",fontWeight:700,color:T.black,marginBottom:"2px"}}>{o.buyer}</div>
                    <div style={{fontSize:"11px",color:T.gray400}}>{o.location} · {o.submitted}</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px 18px",flexShrink:0}}>
                    {[["Product",null],["Volume",`${(o.vol/1000).toFixed(0)}k L`],["Trucks",o.trucks],["Value",`₦${(o.value||0).toLocaleString('en-NG')}`]].map(([l,v])=>(
                      <div key={l}>
                        <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"1px"}}>{l}</div>
                        {l==="Product"?(
                          <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{o.product}</div>
                        ):(
                          <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{v}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{borderTop:`1px solid ${T.gray100}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px",background:T.gray50}}>
                <span style={{fontSize:"11px",fontWeight:800,color:"#8A5C00",background:T.amberLight,padding:"3px 8px"}}>⏱ SLA: {o.slaLeft}</span>
                <div style={{display:"flex",gap:"8px"}}>
                  <button disabled={!!isActing} onClick={()=>handleReject(o.id)}
                    style={{background:T.white,color:T.red,border:`1px solid ${T.red}`,padding:"8px 16px",fontSize:"11px",fontWeight:800,cursor:isActing?"not-allowed":"pointer",fontFamily:F,minHeight:"38px",opacity:isActing?0.6:1}}>
                    {isActing==="rejecting"?"Rejecting…":"Reject"}
                  </button>
                  <button disabled={!!isActing} onClick={()=>handleConfirm(o.id)}
                    style={{background:T.green,color:T.white,border:"none",padding:"8px 16px",fontSize:"11px",fontWeight:800,cursor:isActing?"not-allowed":"pointer",fontFamily:F,minHeight:"38px",opacity:isActing?0.6:1}}>
                    {isActing==="confirming"?"Confirming…":"Confirm →"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ACTIVE ORDERS ── */}
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
        <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>Active Orders</div>
        {active.length>0&&<div style={{background:T.blueLight,color:T.blue,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>{active.length} orders</div>}
      </div>

      {active.length===0?(
        <div style={{border:`1px dashed ${T.gray200}`,padding:"32px",textAlign:"center"}}>
          <div style={{fontSize:"13px",fontWeight:700,color:T.gray400}}>No active orders</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"4px"}}>Confirmed and dispatched orders appear here.</div>
        </div>
      ):active.map(o=>{
        const raw=o._raw||{};
        const isBayAssigning=bayAssigning[o.id];
        return (
          <Card key={o.id} pad={false} style={{marginBottom:"12px"}}>
            <div style={{padding:"14px 16px",borderBottom:o.status==="confirmed"&&!raw.bay_assigned?`1px solid ${T.gray100}`:"none",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"8px"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                  <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black,textDecoration:"underline"}}>{o.id}</button>
                  <Badge status={o.status}/>
                </div>
                <div style={{fontSize:"11px",color:T.gray400,marginBottom:"2px"}}>{o.buyer} · {o.product} · {(o.vol/1000).toFixed(0)}k L · {o.trucks} trucks</div>
                {raw.bay_assigned&&<div style={{fontSize:"11px",fontWeight:700,color:T.black}}>{raw.bay_assigned}{raw.loading_ref?` · Ref: ${raw.loading_ref}`:""}</div>}
              </div>
              <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:T.black,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Manage →</button>
            </div>

            {/* Bay assignment — only for confirmed orders without a bay yet */}
            {o.status==="confirmed"&&!raw.bay_assigned&&(
              <div style={{background:T.greenLight,padding:"10px 14px"}}>
                <div style={{fontSize:"11px",fontWeight:800,color:T.greenDark,marginBottom:"8px"}}>✓ Confirmed — Assign a loading bay to continue</div>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                  {BAYS.map(b=>(
                    <button key={b} disabled={!!isBayAssigning} onClick={()=>handleAssignBay(o.id,b)}
                      style={{background:T.black,color:T.white,border:"none",padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:isBayAssigning?"not-allowed":"pointer",fontFamily:F,minHeight:"34px",opacity:isBayAssigning?0.6:1}}>{b}</button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* ── RECENTLY COMPLETED ── */}
      {completed.length>0&&(
        <div style={{marginTop:"24px"}}>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"14px"}}>Recently Completed</div>
          {completed.map(o=>(
            <div key={o.id} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"12px 16px",marginBottom:"8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px"}}>
                  <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:F,fontSize:"12px",fontWeight:800,color:T.black,textDecoration:"underline"}}>{o.id}</button>
                  <Badge status={o.status}/>
                </div>
                <div style={{fontSize:"11px",color:T.gray400}}>{o.buyer} · {o.product} · {(o.vol/1000).toFixed(0)}k L</div>
              </div>
              <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.black,padding:"6px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>View →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { DepotInbox };
