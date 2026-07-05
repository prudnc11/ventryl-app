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
import { printWaybill, printInvoice, printDeliveryReceipt } from "../lib/documents";
import { openPaystackPopup, verifyAndCreditWallet, FUND_PRESETS } from "../lib/payment";
import { useOrderRealtime, useDepotInboxRealtime, useProfileRealtime } from "../lib/realtime";
import { useDepotContext } from "../context/DepotContext";
import { DisputeModal } from "./BuyerOrderDetail";

function DepotOrderDetail({isMobile}) {
  const navigate = useNavigate();
  const { depotId, orderId } = useParams();
  const onBack = () => navigate(-1);
  const { depots, handleUpdateDepot: onUpdateDepot } = useDepotContext();
  const depot = depots.find(d => d.id === depotId) || depots[0] || null;
  const {user:authUser}=useAuthStore();
  const {depotOrders,orderDetails,loadOrderDetail,invalidateOrderDetail,loadDepotOrders}=useVentrylStore();
  const allDepotOrders=Object.values(depotOrders).flat();
  const dbRaw=allDepotOrders.find(o=>o.id===orderId);
  const raw=dbRaw;
  const meta=orderDetails[orderId]||{};

  // Local negotiation state — populated by direct fetch (bypasses join / RLS issues)
  const [localNeg,setLocalNeg]=useState(null);

  const loadNeg=useCallback(async()=>{
    try{
      const neg=await negotiationsApi.get(orderId);
      if(neg) setLocalNeg(neg);
    }catch(e){console.error("[DepotOrderDetail] loadNeg",e);}
  },[orderId]);

  useEffect(()=>{
    invalidateOrderDetail(orderId);
    loadOrderDetail(orderId);
    loadNeg();
  },[orderId]);

  // Realtime: reload when buyer files dispute, confirms receipt, or negotiation changes
  useOrderRealtime(orderId,(payload)=>{
    const {table,new:n}=payload;
    if(table==="orders"||table==="order_status_logs"||table==="delivery_negotiations"){
      invalidateOrderDetail(orderId);
      loadOrderDetail(orderId);
      if(depot?.id) loadDepotOrders(depot.id);
      loadNeg();
    }
  });

  // Derive live state from DB (meta refreshes after each API call via invalidate+reload)
  const liveStatus=raw?.status||meta?.status||"pending";
  const liveBay=meta.bay||raw?._raw?.bay_assigned||"";
  const liveTrucks=(meta.trucks_detail||[]).map(t=>({...t}));
  const liveTimeline=meta.timeline||[];

  // Derive negotiation state — prefer direct fetch over join result
  const neg=localNeg||meta._negotiation||null;
  const liveQuoteRounds=(neg?.delivery_rounds||[])
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
    .map(r=>({
      from:r.from_party,
      amount:r.amount,
      time:r.created_at?new Date(r.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"",
    }));
  const liveQuoteStatus=neg?.status||"none";

  // Local UI-only state (not persisted, just for the current screen session)
  const [bay,setBay]=useState("");
  const [statusNote,setStatusNote]=useState("");
  const [updating,setUpdating]=useState(false);
  const [updateError,setUpdateError]=useState(null);
  const [showDispute,setShowDispute]=useState(false);
  const [activeTab,setActiveTab]=useState("manage");

  // Dispute resolution state
  const [disputeData,setDisputeData]=useState(null);
  const [disputeNote,setDisputeNote]=useState("");
  const [disputeResolveAs,setDisputeResolveAs]=useState("delivered");
  const [resolvingDispute,setResolvingDispute]=useState(false);
  const [disputeError,setDisputeError]=useState(null);

  // Load dispute details when order is disputed
  useEffect(()=>{
    if(liveStatus==="disputed"&&orderId){
      (async()=>{
        const {data}=await supabase.from("disputes").select("*").eq("order_id",orderId).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(data) setDisputeData(data);
      })();
    }
  },[liveStatus,orderId]);

  const DISPUTE_REASONS={quantity_short:"Quantity Shortage",quality_issue:"Quality Issue",late_delivery:"Late Delivery",wrong_product:"Wrong Product",damaged_goods:"Damaged Goods",pricing_error:"Pricing Error",other:"Other"};

  const handleResolveDispute=async()=>{
    if(!disputeData) return;
    setResolvingDispute(true);setDisputeError(null);
    try{
      // 1. Update dispute status
      await supabase.from("disputes").update({status:"resolved",admin_note:disputeNote||"Resolved by depot",resolved_at:new Date().toISOString()}).eq("id",disputeData.id);
      // 2. Update order status back
      await ordersApi.updateStatus(orderId,disputeResolveAs,{actorId:authUser?.id,note:`Dispute resolved by depot. ${disputeNote}`.trim()});
      // 3. Reload
      reloadOrder();
      setDisputeData(d=>d?{...d,status:"resolved"}:d);
    }catch(e){setDisputeError(e.message);}
    finally{setResolvingDispute(false);}
  };

  // Sync bay input with live value when meta loads
  useEffect(()=>{if(liveBay)setBay(liveBay);},[liveBay]);

  // Truck dispatch entry (delivery mode)
  const defaultTruckCount=meta.trucks||raw?.trucks||1;
  const emptyTruck=()=>({driver:"",plate:"",vol:"",eta:""});
  const [truckInputs,setTruckInputs]=useState(()=>Array.from({length:defaultTruckCount},emptyTruck));
  const totalOrderVol=meta.vol||raw?.vol||0;
  const truckVolTotal=truckInputs.reduce((s,t)=>s+(parseInt(t.vol)||0),0);
  const trucksValid=truckInputs.length>0&&truckInputs.every(t=>t.driver.trim()&&t.plate.trim()&&parseInt(t.vol)>0)&&truckVolTotal>0;
  const updateTruck=(i,field,val)=>setTruckInputs(list=>list.map((t,idx)=>idx===i?{...t,[field]:val}:t));
  const addTruck=()=>setTruckInputs(list=>[...list,emptyTruck()]);
  const removeTruck=(i)=>setTruckInputs(list=>list.filter((_,idx)=>idx!==i));

  // Pickup: gate clearance (session-only — waybill printed before leaving screen)
  const emptyBuyerTruck=()=>({plate:"",vol:"",driver:""});
  const [buyerTrucks,setBuyerTrucks]=useState([emptyBuyerTruck()]);
  const [gateNote,setGateNote]=useState("");
  const [waybillRef,setWaybillRef]=useState("");
  const buyerTruckVolTotal=buyerTrucks.reduce((s,t)=>s+(parseInt(t.vol)||0),0);
  const buyerTrucksValid=buyerTrucks.length>0&&buyerTrucks.every(t=>t.plate.trim()&&parseInt(t.vol)>0)&&buyerTruckVolTotal>0;
  const updateBuyerTruck=(i,field,val)=>setBuyerTrucks(list=>list.map((t,idx)=>idx===i?{...t,[field]:val}:t));
  const addBuyerTruck=()=>setBuyerTrucks(list=>[...list,emptyBuyerTruck()]);
  const removeBuyerTruck=(i)=>setBuyerTrucks(list=>list.filter((_,idx)=>idx!==i));

  // Delivery cost negotiation — UI inputs only
  const [depotCostInput,setDepotCostInput]=useState("");
  const [depotReQuoteInput,setDepotReQuoteInput]=useState("");
  const [showDepotReQuote,setShowDepotReQuote]=useState(false);

  // Helper: reload order after any mutation
  const reloadOrder=()=>{
    invalidateOrderDetail(orderId);
    loadOrderDetail(orderId);
    if(depot?.id) loadDepotOrders(depot.id);
    loadNeg();
  };

  const sendDeliveryQuote=async(amount)=>{
    setUpdating(true);setUpdateError(null);
    try{
      await negotiationsApi.sendQuote(orderId,"depot",parseInt(amount));
      reloadOrder();
      setDepotCostInput("");setDepotReQuoteInput("");setShowDepotReQuote(false);
    }catch(e){setUpdateError(e.message);}
    finally{setUpdating(false);}
  };

  const acceptBuyerCounterOffer=async()=>{
    const agreed=liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0;
    setUpdating(true);setUpdateError(null);
    try{
      await negotiationsApi.accept(orderId,agreed);
      reloadOrder();
      setShowDepotReQuote(false);
    }catch(e){setUpdateError(e.message);}
    finally{setUpdating(false);}
  };

  if(!raw&&!meta.buyer) return (
    <div style={{padding:"40px",textAlign:"center"}}>
      <div style={{fontSize:"14px",fontWeight:700,color:T.gray400}}>Loading order…</div>
      <button onClick={onBack} style={{marginTop:"16px",background:T.black,color:T.white,border:"none",padding:"9px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F}}>← Back</button>
    </div>
  );

  const buyerInfo=meta.buyer||{};
  const finials=meta.financials||{};
  const fmtMoney=n=>`₦${(n||0).toLocaleString('en-NG')}`;
  const isMultiDepot=Array.isArray(meta.products)&&meta.products.length>1;
  const orderProductLabel=isMultiDepot?meta.products.map(p=>p.name).join(" + "):(meta.product||raw?.product||"");
  const delivery=meta.delivery||null;
  const isDelivery=!delivery||delivery.mode==="delivery";
  const isPickup=delivery?.mode==="pickup";

  const isDisputed=liveStatus==="disputed";
  const isTerminal=["rejected","cancelled"].includes(liveStatus);
  const STATUS_STEPS=isPickup
    ?["pending","confirmed","loading","collected"]
    :["pending","confirmed","loading","in_transit","delivered"];
  const STEP_LABELS=isPickup
    ?["Received","Confirmed","Loading","Collected"]
    :["Received","Confirmed","Loading","Dispatched","Delivered"];
  const currentStep=isTerminal?-1:isDisputed?Math.max(0,STATUS_STEPS.indexOf("in_transit")):Math.max(0,STATUS_STEPS.indexOf(liveStatus));
  const BAYS=["Bay 1","Bay 2","Bay 3"];
  const allTrucksDelivered=liveTrucks.length>0&&liveTrucks.every(t=>t.status==="delivered");

  const applyStatusUpdate=async(toStatus,note,newBay,trucks)=>{
    setUpdating(true);setUpdateError(null);
    try{
      if(toStatus==="loading"&&newBay){
        const loadRef=`LOAD-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100).padStart(3,"0")}`;
        await ordersApi.assignBay(orderId,newBay,loadRef,authUser?.id);
      } else if(toStatus==="in_transit"&&trucks?.length){
        await ordersApi.dispatch(orderId,trucks.map(t=>({
          driver_name:t.driver,plate_number:t.plate,volume:parseInt(t.vol),eta:t.eta||null,
        })),authUser?.id);
      } else {
        await ordersApi.updateStatus(orderId,toStatus,{actorId:authUser?.id,note});
      }
      reloadOrder();
      setStatusNote("");
    }catch(e){setUpdateError(e.message);}
    finally{setUpdating(false);}
  };

  const handleConfirm=()=>applyStatusUpdate("confirmed","Order confirmed by depot");
  const handleReject=()=>applyStatusUpdate("rejected","Order rejected by depot");
  const handleMarkTruckDelivered=async(idx)=>{
    const truck=liveTrucks[idx];
    setUpdating(true);setUpdateError(null);
    try{
      if(truck._dbId){
        await ordersApi.updateTruck(truck._dbId,{status:"delivered",arrival_time:new Date().toISOString(),progress:100});
      }
      // Check if this was the last truck
      const remaining=liveTrucks.filter((_,i)=>i!==idx&&_?.status!=="delivered");
      if(remaining.length===0){
        await ordersApi.updateStatus(orderId,"delivered",{actorId:authUser?.id,note:"All trucks delivered"});
      }
      reloadOrder();
    }catch(e){setUpdateError(e.message);}
    finally{setUpdating(false);}
  };

  return (
    <div>
      {/* Modals */}
      {showDispute&&<DisputeModal onClose={()=>setShowDispute(false)} orderId={raw.id} product={meta.product||raw.product} vol={meta.vol||raw.vol||33000}/>}

      {/* Back + header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.black,padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <span style={{fontSize:isMobile?"16px":"20px",fontWeight:800,color:T.black}}>{raw.id}</span>
            <Badge status={liveStatus}/>
            {liveStatus==="pending"&&<span style={{background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"2px 8px",letterSpacing:"0.06em",animation:"pulse 1.6s infinite"}}>ACTION REQUIRED</span>}
          </div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{buyerInfo.company||raw.buyer} · {orderProductLabel} · {meta.placed||raw.submitted||""}</div>
        </div>
        <div style={{display:"flex",gap:"8px",flexShrink:0}}>
          {liveStatus!=="rejected"&&<button onClick={()=>setShowDispute(true)} style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>⚠ Flag</button>}
        </div>
      </div>

      {/* Status Stepper */}
      {!isTerminal&&(
        <Card style={{marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",position:"relative",paddingBottom:"4px"}}>
            <div style={{position:"absolute",top:"13px",left:"13px",right:"13px",height:"2px",background:T.gray100,zIndex:0}}/>
            <div style={{position:"absolute",top:"13px",left:"13px",height:"2px",width:`${Math.max(0,(currentStep/(STATUS_STEPS.length-1))*100)}%`,
              background:isDisputed?"#D97706":T.green,zIndex:1,transition:"width 0.5s"}}/>
            {STATUS_STEPS.map((s,i)=>{
              const done=i<currentStep;
              const active=i===currentStep;
              return (
                <div key={s} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,position:"relative",zIndex:2}}>
                  <div style={{width:"26px",height:"26px",borderRadius:"50%",
                    background:done?T.green:active?(isDisputed?"#D97706":T.black):T.white,
                    border:`2px solid ${done?T.green:active?(isDisputed?"#D97706":T.black):T.gray200}`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:800,
                    color:done||active?T.white:T.gray400,transition:"all 0.3s",
                    boxShadow:active?`0 0 0 4px ${isDisputed?"rgba(217,119,6,0.18)":"rgba(0,0,0,0.1)"}`:"none"}}>
                    {done?"✓":active&&isDisputed?"⚠":i+1}
                  </div>
                  <div style={{marginTop:"5px",fontSize:"9px",fontWeight:700,color:done||active?T.black:T.gray400,textTransform:"uppercase",letterSpacing:"0.03em",textAlign:"center"}}>{STEP_LABELS[i]}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {liveStatus==="rejected"&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"14px 18px",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.red}}>Order Rejected</div>
          <div style={{fontSize:"11px",color:T.red,marginTop:"2px"}}>Payment has been returned to the buyer. This order is closed.</div>
        </div>
      )}

      {isDisputed&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:"#3A1F0A",padding:"16px 18px",display:"flex",alignItems:"center",gap:"14px"}}>
            <div style={{width:"40px",height:"40px",borderRadius:"50%",background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0,border:"2px solid #D97706"}}>⚠</div>
            <div style={{flex:1}}>
              <div style={{fontSize:"14px",fontWeight:800,color:"#FBBF24"}}>Dispute Filed by Buyer</div>
              <div style={{fontSize:"11px",color:"#D4A574",marginTop:"3px",lineHeight:1.5}}>
                Review the details below and resolve this dispute, or wait for Ventryl admin to mediate.
              </div>
            </div>
            <span style={{background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"3px 8px",letterSpacing:"0.06em",flexShrink:0}}>ACTION</span>
          </div>

          {/* Dispute details */}
          <div style={{padding:"16px 18px"}}>
            {disputeData?(
              <>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:"10px",marginBottom:"14px"}}>
                  {[["Reference",disputeData.reference],["Reason",DISPUTE_REASONS[disputeData.reason]||disputeData.reason],["Filed",new Date(disputeData.created_at).toLocaleDateString("en-NG")]].map(([l,v])=>(
                    <div key={l} style={{background:T.gray50,padding:"10px 12px",border:`1px solid ${T.gray100}`}}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"2px"}}>{l}</div>
                      <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:T.gray50,padding:"10px 12px",border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px"}}>Buyer's Description</div>
                  <div style={{fontSize:"12px",color:T.black,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{disputeData.details}</div>
                </div>
                {disputeData.evidence_urls&&disputeData.evidence_urls.length>0&&(
                  <div style={{marginBottom:"14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Evidence ({disputeData.evidence_urls.length} file{disputeData.evidence_urls.length!==1?"s":""})</div>
                    <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                      {disputeData.evidence_urls.map((url,i)=>(
                        <a key={i} href={url} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:"6px",background:T.blueLight,border:`1px solid ${T.blue}20`,padding:"7px 12px",fontSize:"11px",fontWeight:700,color:T.blue,textDecoration:"none"}}>
                          📎 File {i+1} — View
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution form */}
                <div style={{borderTop:`1px solid ${T.gray100}`,paddingTop:"14px"}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Resolution Note</div>
                  <textarea value={disputeNote} onChange={e=>setDisputeNote(e.target.value)}
                    placeholder="Describe how you're resolving this dispute…"
                    style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"12px",minHeight:"60px",resize:"vertical",outline:"none",boxSizing:"border-box",marginBottom:"10px"}}/>
                  <div style={{marginBottom:"12px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Resolve Order As</div>
                    <div style={{display:"flex",gap:"6px"}}>
                      {[["delivered","Delivered"],["collected","Collected"]].map(([val,label])=>(
                        <button key={val} onClick={()=>setDisputeResolveAs(val)}
                          style={{background:disputeResolveAs===val?T.black:T.white,color:disputeResolveAs===val?T.white:T.gray600,border:`1px solid ${disputeResolveAs===val?T.black:T.gray200}`,padding:"6px 14px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F}}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {disputeError&&<div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"8px 12px",marginBottom:"10px",fontSize:"11px",color:T.red,fontWeight:700}}>{disputeError}</div>}
                  <button disabled={resolvingDispute||!disputeNote.trim()} onClick={handleResolveDispute}
                    style={{background:disputeNote.trim()?T.green:T.gray200,color:disputeNote.trim()?T.white:T.gray400,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:disputeNote.trim()?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"46px"}}>
                    {resolvingDispute?"Resolving…":"Resolve Dispute ✓"}
                  </button>
                </div>
              </>
            ):(
              <div style={{fontSize:"12px",color:T.gray400}}>Loading dispute details…</div>
            )}
          </div>
        </Card>
      )}

      {/* ── ACTION PANEL — one focused card per stage ── */}
      {liveStatus==="pending"&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:T.black,padding:"14px 18px"}}>
            <div style={{fontSize:"12px",fontWeight:800,color:T.white,marginBottom:"2px"}}>New Order · Action Required</div>
            <div style={{fontSize:"11px",color:T.gray400}}>{buyerInfo.company||raw.buyer} · {fmtMoney(finials.productValue||0)} · SLA: {raw.slaLeft||"—"}</div>
          </div>
          <div style={{padding:"16px 18px",display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <button onClick={handleConfirm}
              style={{flex:1,background:T.green,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
              Confirm Order ✓
            </button>
            <button onClick={handleReject}
              style={{background:"none",color:T.red,border:`1px solid ${T.red}`,padding:"12px 20px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
              Reject
            </button>
          </div>
        </Card>
      )}

      {/* ── DELIVERY COST NEGOTIATION — confirmed delivery orders only ── */}
      {liveStatus==="confirmed"&&isDelivery&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          {liveQuoteStatus==="none"&&(
            <>
              <div style={{background:"#12122A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"20px"}}>💰</span>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Set Delivery Cost</div>
                  <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>
                    Quote the delivery fee to {delivery?.lga}, {delivery?.state}. Buyer will approve or counter-offer.
                  </div>
                </div>
              </div>
              <div style={{padding:"16px 18px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"7px"}}>Delivery Cost (₦)</div>
                <div style={{display:"flex",gap:"8px",alignItems:"stretch"}}>
                  <div style={{position:"relative",flex:1}}>
                    <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",fontSize:"13px",fontWeight:700,color:T.gray400,pointerEvents:"none"}}>₦</span>
                    <input value={depotCostInput}
                      onChange={e=>setDepotCostInput(e.target.value.replace(/[^0-9]/g,""))}
                      placeholder="e.g. 450000" type="text"
                      style={{width:"100%",boxSizing:"border-box",paddingLeft:"28px",paddingRight:"12px",paddingTop:"12px",paddingBottom:"12px",border:`1px solid ${depotCostInput?T.black:T.gray200}`,fontFamily:F,fontSize:"15px",fontWeight:800,color:T.black,outline:"none"}}/>
                  </div>
                  <button disabled={!depotCostInput||parseInt(depotCostInput)<=0}
                    onClick={()=>sendDeliveryQuote(depotCostInput)}
                    style={{background:depotCostInput?T.black:T.gray200,color:depotCostInput?T.white:T.gray400,border:"none",padding:"0 20px",fontSize:"12px",fontWeight:800,cursor:depotCostInput?"pointer":"not-allowed",fontFamily:F,whiteSpace:"nowrap",minHeight:"48px"}}>
                    Send to Buyer →
                  </button>
                </div>
                {depotCostInput&&parseInt(depotCostInput)>0&&(
                  <div style={{marginTop:"7px",fontSize:"10px",color:T.gray400,fontWeight:600}}>
                    ≈ ₦{(parseInt(depotCostInput)/1000).toFixed(0)}k · ₦{(parseInt(depotCostInput)/(totalOrderVol||1)).toFixed(2)}/L surcharge
                  </div>
                )}
              </div>
            </>
          )}

          {liveQuoteStatus==="buyer_pending"&&(
            <>
              <div style={{background:"#12122A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"20px"}}>⏳</span>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Quote Sent — Awaiting Buyer</div>
                  <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>{buyerInfo.company||raw.buyer} is reviewing your delivery cost.</div>
                </div>
              </div>
              <div style={{padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:T.gray50,border:`1px solid ${T.gray100}`,marginBottom:"8px"}}>
                  <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>Your Quote</span>
                  <span style={{fontSize:"20px",fontWeight:800,color:T.black}}>₦{(liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0).toLocaleString()}</span>
                </div>
                <div style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>Sent {liveQuoteRounds[liveQuoteRounds.length-1]?.time||"—"} · Waiting for buyer approval or counter-offer.</div>
              </div>
            </>
          )}

          {liveQuoteStatus==="depot_pending"&&(
            <>
              <div style={{background:"#2E1500",padding:"14px 18px",display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"20px"}}>💬</span>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Counter-Offer Received</div>
                  <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>{buyerInfo.company||raw.buyer} wants a different delivery price.</div>
                </div>
                <span style={{marginLeft:"auto",background:T.amber,color:T.black,fontSize:"9px",fontWeight:800,padding:"3px 8px",flexShrink:0}}>ACTION</span>
              </div>
              <div style={{padding:"14px 18px"}}>
                <div style={{marginBottom:"12px"}}>
                  {liveQuoteRounds.map((r,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",background:r.from==="buyer"?T.amberLight:T.blueLight,marginBottom:"4px",gap:"10px",border:`1px solid ${r.from==="buyer"?"#FFDD8A":"#C3D7FC"}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={{fontSize:"9px",fontWeight:800,padding:"2px 7px",background:r.from==="buyer"?"#8A5C00":T.blue,color:T.white}}>
                          {r.from==="buyer"?"BUYER":"YOU"}
                        </span>
                        <span style={{fontSize:"10px",color:T.gray600,fontWeight:600}}>Round {i+1} · {r.time}</span>
                      </div>
                      <span style={{fontSize:"15px",fontWeight:800,color:T.black}}>₦{(r.amount||0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:showDepotReQuote?"12px":"0"}}>
                  <button onClick={acceptBuyerCounterOffer}
                    style={{flex:1,background:T.green,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                    Accept ₦{(liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0).toLocaleString()} ✓
                  </button>
                  <button onClick={()=>setShowDepotReQuote(!showDepotReQuote)}
                    style={{flex:1,background:T.black,color:T.white,border:"none",padding:"12px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                    {showDepotReQuote?"Cancel":"Re-quote →"}
                  </button>
                </div>
                {showDepotReQuote&&(
                  <div>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Your New Quote (₦)</div>
                    <div style={{display:"flex",gap:"8px"}}>
                      <div style={{position:"relative",flex:1}}>
                        <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",fontSize:"13px",fontWeight:700,color:T.gray400,pointerEvents:"none"}}>₦</span>
                        <input value={depotReQuoteInput}
                          onChange={e=>setDepotReQuoteInput(e.target.value.replace(/[^0-9]/g,""))}
                          placeholder="e.g. 380000" type="text"
                          style={{width:"100%",boxSizing:"border-box",paddingLeft:"28px",paddingRight:"12px",paddingTop:"11px",paddingBottom:"11px",border:`1px solid ${depotReQuoteInput?T.black:T.gray200}`,fontFamily:F,fontSize:"14px",fontWeight:800,color:T.black,outline:"none"}}/>
                      </div>
                      <button disabled={!depotReQuoteInput}
                        onClick={()=>sendDeliveryQuote(depotReQuoteInput)}
                        style={{background:depotReQuoteInput?T.black:T.gray200,color:depotReQuoteInput?T.white:T.gray400,border:"none",padding:"0 16px",fontSize:"12px",fontWeight:800,cursor:depotReQuoteInput?"pointer":"not-allowed",fontFamily:F,minHeight:"46px",whiteSpace:"nowrap"}}>
                        Send →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {liveQuoteStatus==="agreed"&&(
            <div style={{padding:"16px 18px",display:"flex",alignItems:"center",gap:"14px",background:T.greenLight}}>
              <span style={{fontSize:"24px"}}>✅</span>
              <div style={{flex:1}}>
                <div style={{fontSize:"13px",fontWeight:800,color:T.greenDark}}>Delivery Cost Agreed</div>
                <div style={{fontSize:"11px",color:T.greenDark,marginTop:"2px"}}>
                  Agreed in {liveQuoteRounds.length} round{liveQuoteRounds.length!==1?"s":""} · Now assign a loading bay below.
                </div>
              </div>
              <span style={{fontSize:"20px",fontWeight:800,color:T.greenDark}}>₦{(liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0).toLocaleString()}</span>
            </div>
          )}
        </Card>
      )}

      {liveStatus==="confirmed"&&(!isDelivery||liveQuoteStatus==="agreed")&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:"#1A3A0A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"18px"}}>{isPickup?"🏭":"🏗"}</span>
            <div>
              <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>
                {isPickup?"Assign Bay & Await Buyer Trucks":"Assign Bay & Start Loading"}
              </div>
              <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>
                {isPickup?"Select a loading bay. The buyer will arrive with their own trucks.":"Select a loading bay then confirm to begin loading."}
              </div>
            </div>
          </div>
          <div style={{padding:"16px 18px"}}>
            {isPickup&&(
              <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"10px 14px",marginBottom:"14px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
                <span style={{fontSize:"16px",flexShrink:0}}>⚠</span>
                <div>
                  <div style={{fontSize:"11px",fontWeight:800,color:"#8A5C00",marginBottom:"2px"}}>Self Pick-up Order</div>
                  <div style={{fontSize:"10px",color:"#8A5C00",lineHeight:1.5}}>
                    {buyerInfo.company||raw.buyer} will dispatch their own trucks to collect this order.
                    Confirm their arrival and verify truck details before beginning loading.
                  </div>
                </div>
              </div>
            )}
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"8px"}}>Loading Bay</div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"14px"}}>
              {BAYS.map(b=>(
                <button key={b} onClick={()=>setBay(bay===b?"":b)}
                  style={{padding:"10px 20px",border:`2px solid ${bay===b?T.black:T.gray200}`,background:bay===b?T.black:T.white,color:bay===b?T.white:T.black,fontFamily:F,fontSize:"12px",fontWeight:800,cursor:"pointer",minHeight:"42px",transition:"all 0.15s"}}>
                  {b}
                </button>
              ))}
            </div>
            <input value={statusNote} onChange={e=>setStatusNote(e.target.value)}
              placeholder={isPickup?"Note (optional) — e.g. Buyer ETA 14:00":"Note (optional) — e.g. Loading crew assigned"}
              style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",marginBottom:"12px",boxSizing:"border-box"}}/>
            <button
              disabled={!bay}
              onClick={()=>applyStatusUpdate("loading",statusNote||( isPickup?"Awaiting buyer trucks":"Loading started"),bay)}
              style={{width:"100%",background:bay?T.green:T.gray200,color:bay?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:bay?"pointer":"not-allowed",fontFamily:F,minHeight:"48px"}}>
              {bay?(isPickup?`Assign ${bay} — Awaiting Trucks ✓`:`Start Loading at ${bay} ✓`):"Select a bay to continue"}
            </button>
          </div>
        </Card>
      )}

      {liveStatus==="loading"&&!isPickup&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:"#0A1F3A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"18px"}}>🚛</span>
            <div>
              <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Enter Truck Details &amp; Dispatch</div>
              <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>
                {bay&&<span style={{color:T.green,fontWeight:700}}>{bay} · </span>}
                {(totalOrderVol/1000).toFixed(0)}k L · {defaultTruckCount} truck{defaultTruckCount!==1?"s":""} expected
              </div>
            </div>
            <button onClick={addTruck}
              style={{marginLeft:"auto",background:"rgba(255,255,255,0.1)",color:T.white,border:"1px solid rgba(255,255,255,0.2)",padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"32px",whiteSpace:"nowrap"}}>
              + Add Truck
            </button>
          </div>
          <div style={{padding:"12px 18px"}}>
            {truckInputs.map((t,i)=>(
              <div key={i} style={{border:`1px solid ${T.gray100}`,background:T.gray50,padding:"12px",marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                  <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>Truck {i+1}</span>
                  {truckInputs.length>1&&(
                    <button onClick={()=>removeTruck(i)}
                      style={{background:"none",border:"none",color:T.red,fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,padding:0}}>
                      Remove
                    </button>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"8px"}}>
                  {[
                    {label:"Driver Name *",   field:"driver", ph:"e.g. Musa Ibrahim",   req:true,  type:"text"},
                    {label:"Plate Number *",  field:"plate",  ph:"e.g. LG-123-ABC",    req:true,  type:"text"},
                    {label:"Volume (L) *",    field:"vol",    ph:"e.g. 33000",          req:true,  type:"number"},
                    {label:"Est. Delivery",   field:"eta",    ph:"e.g. 4–6 hrs",        req:false, type:"text"},
                  ].map(({label,field,ph,req,type})=>(
                    <div key={field}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>{label}</div>
                      <input value={t[field]} type={type}
                        onChange={e=>updateTruck(i,field,field==="plate"?e.target.value.toUpperCase():e.target.value)}
                        placeholder={ph}
                        style={{width:"100%",border:`1px solid ${req&&!t[field]?T.amber:T.gray200}`,padding:"8px 10px",fontFamily:F,fontSize:"11px",color:T.black,outline:"none",background:T.white,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",marginBottom:"10px",
              background:truckVolTotal===totalOrderVol?T.greenLight:truckVolTotal>0?T.amberLight:T.gray50}}>
              <span style={{fontSize:"11px",fontWeight:700,color:truckVolTotal===totalOrderVol?T.greenDark:truckVolTotal>0?"#8A5C00":T.gray400}}>
                {truckVolTotal===totalOrderVol?"✓ Volume matches order":truckVolTotal>0?`⚠ ${(truckVolTotal/1000).toFixed(1)}k / ${(totalOrderVol/1000).toFixed(1)}k L`:"Enter truck volumes"}
              </span>
              <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>{(truckVolTotal/1000).toFixed(1)}k / {(totalOrderVol/1000).toFixed(1)}k L</span>
            </div>
            <input value={statusNote} onChange={e=>setStatusNote(e.target.value)}
              placeholder="Dispatch note (optional) — e.g. Waybill refs attached"
              style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",marginBottom:"12px",boxSizing:"border-box"}}/>
            <button
              disabled={!trucksValid}
              onClick={()=>applyStatusUpdate("in_transit",statusNote,bay,truckInputs)}
              style={{width:"100%",background:trucksValid?T.green:T.gray200,color:trucksValid?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:trucksValid?"pointer":"not-allowed",fontFamily:F,minHeight:"48px"}}>
              {trucksValid?`Dispatch ${truckInputs.length} Truck${truckInputs.length!==1?"s":""} ✓`:"Fill in all truck details to dispatch"}
            </button>
          </div>
        </Card>
      )}

      {/* ── PICKUP: Gate Clearance & Mark Collected ── */}
      {liveStatus==="loading"&&isPickup&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:"#1A2E0A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"18px"}}>🏭</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Gate Clearance — Buyer Trucks On-Site</div>
              <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>
                {bay&&<span style={{color:T.green,fontWeight:700}}>{bay} · </span>}
                Record buyer truck details, then mark as collected when loading is complete.
              </div>
            </div>
            <button onClick={addBuyerTruck}
              style={{background:"rgba(255,255,255,0.1)",color:T.white,border:"1px solid rgba(255,255,255,0.2)",padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"32px",whiteSpace:"nowrap",flexShrink:0}}>
              + Add Truck
            </button>
          </div>

          <div style={{padding:"14px 18px"}}>
            {/* Buyer truck entries */}
            {buyerTrucks.map((t,i)=>(
              <div key={i} style={{border:`1px solid ${T.gray100}`,background:T.gray50,padding:"12px",marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>Buyer Truck {i+1}</span>
                    <span style={{fontSize:"9px",background:T.amberLight,color:"#8A5C00",fontWeight:700,padding:"1px 6px"}}>GATE RECORD</span>
                  </div>
                  {buyerTrucks.length>1&&(
                    <button onClick={()=>removeBuyerTruck(i)}
                      style={{background:"none",border:"none",color:T.red,fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,padding:0}}>
                      Remove
                    </button>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:"8px"}}>
                  {[
                    {label:"Plate Number *", field:"plate",  ph:"e.g. LG-456-XY",  req:true,  type:"text"},
                    {label:"Volume (L) *",   field:"vol",    ph:"e.g. 33000",       req:true,  type:"number"},
                    {label:"Driver Name",    field:"driver", ph:"e.g. Musa Ibrahim",req:false, type:"text"},
                  ].map(({label,field,ph,req,type})=>(
                    <div key={field}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>{label}</div>
                      <input value={t[field]} type={type}
                        onChange={e=>updateBuyerTruck(i,field,field==="plate"?e.target.value.toUpperCase():e.target.value)}
                        placeholder={ph}
                        style={{width:"100%",border:`1px solid ${req&&!t[field]?T.amber:T.gray200}`,padding:"8px 10px",fontFamily:F,fontSize:"11px",color:T.black,outline:"none",background:T.white,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Volume check */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",marginBottom:"12px",
              background:buyerTruckVolTotal===totalOrderVol?T.greenLight:buyerTruckVolTotal>0?T.amberLight:T.gray50}}>
              <span style={{fontSize:"11px",fontWeight:700,color:buyerTruckVolTotal===totalOrderVol?T.greenDark:buyerTruckVolTotal>0?"#8A5C00":T.gray400}}>
                {buyerTruckVolTotal===totalOrderVol?"✓ Volume matches order":buyerTruckVolTotal>0?`⚠ ${(buyerTruckVolTotal/1000).toFixed(1)}k / ${(totalOrderVol/1000).toFixed(1)}k L`:"Enter truck volumes"}
              </span>
              <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>{(buyerTruckVolTotal/1000).toFixed(1)}k / {(totalOrderVol/1000).toFixed(1)}k L</span>
            </div>

            {/* Waybill ref */}
            <div style={{marginBottom:"10px"}}>
              <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"5px"}}>Waybill / Gate Pass Reference</div>
              <input value={waybillRef} onChange={e=>setWaybillRef(e.target.value)}
                placeholder="e.g. WB-2026-0042"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",boxSizing:"border-box"}}/>
            </div>

            <input value={gateNote} onChange={e=>setGateNote(e.target.value)}
              placeholder="Collection note (optional) — e.g. Gate B used, all checks passed"
              style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",marginBottom:"12px",boxSizing:"border-box"}}/>

            <button
              disabled={!buyerTrucksValid}
              onClick={()=>applyStatusUpdate("collected",gateNote||(waybillRef?`Waybill: ${waybillRef}`:"Collected by buyer"),bay)}
              style={{width:"100%",background:buyerTrucksValid?T.green:T.gray200,color:buyerTrucksValid?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:buyerTrucksValid?"pointer":"not-allowed",fontFamily:F,minHeight:"48px"}}>
              {buyerTrucksValid?"Mark as Collected ✓":"Enter plate number and volume to continue"}
            </button>
          </div>
        </Card>
      )}

      {liveStatus==="in_transit"&&!isPickup&&(
        <Card style={{marginBottom:"14px",background:"#0A1F3A",border:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <span style={{fontSize:"24px"}}>🚛</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",fontWeight:800,color:T.white}}>Trucks in Transit</div>
              <div style={{fontSize:"11px",color:"#aaa",marginTop:"2px"}}>
                {liveTrucks.filter(t=>t.status==="delivered").length} of {liveTrucks.length||defaultTruckCount} trucks delivered · Mark each truck below as it arrives
              </div>
            </div>
          </div>
        </Card>
      )}


      {(liveStatus==="delivered"||liveStatus==="collected")&&(
        <div style={{background:T.greenLight,border:`1px solid ${T.green}`,padding:"16px 20px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"14px"}}>
          <span style={{fontSize:"28px"}}>✅</span>
          <div style={{flex:1}}>
            <div style={{fontSize:"14px",fontWeight:800,color:T.greenDark}}>
              {liveStatus==="collected"?"Order Complete — Collected by Buyer":"Order Complete — Delivered"}
            </div>
            <div style={{fontSize:"11px",color:T.greenDark,marginTop:"3px"}}>
              Net revenue: {fmtMoney((finials.netToDepot||0)+(liveQuoteStatus==="agreed"?liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0:0))}
              {liveQuoteStatus==="agreed"&&<span style={{marginLeft:"8px",fontSize:"10px",fontWeight:600,opacity:0.8}}>(incl. ₦{(liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0).toLocaleString()} delivery)</span>}
            </div>
            {waybillRef&&liveStatus==="collected"&&<div style={{fontSize:"10px",color:T.greenDark,marginTop:"3px",fontWeight:600}}>Waybill: {waybillRef}</div>}
            {liveTimeline.length>0&&<div style={{fontSize:"10px",color:T.greenDark,marginTop:"4px",fontWeight:600}}>Completed: {liveTimeline[liveTimeline.length-1]?.time}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"7px",flexShrink:0}}>
            <button
              onClick={()=>printWaybill({
                orderId,
                product:orderProductLabel,
                vol:meta.vol||raw.vol||0,
                buyer:buyerInfo.company||raw.buyer||"Buyer",
                buyerAddr:buyerInfo.location||"Lagos, Nigeria",
                depot:depot?.name||"Depot",
                depotAddr:depot?.location||"Lagos, Nigeria",
                depotLicense:depot?.license||"",
                trucks:(liveTrucks.length>0?liveTrucks:buyerTrucks).filter(t=>t.plate&&t.plate!=="TBD"),
                bay,
                loadRef:meta.loadRef||"",
                waybillRef,
                type:isPickup?"pickup":"delivery",
              })}
              style={{background:T.black,color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px",whiteSpace:"nowrap"}}>
              ⬇ Waybill
            </button>
            <button
              onClick={()=>{
                const v=meta.vol||raw.vol||0;
                const ppl=meta?.pricePerLitre||(v>0&&finials.productValue?Math.round(finials.productValue/v):0);
                const invoiceItems=isMultiDepot&&meta.products?meta.products.map(p=>({product:p.name,vol:p.vol,pricePerLitre:p.pricePerLitre||(p.value&&p.vol?Math.round(p.value/p.vol):ppl)})):null;
                printInvoice({
                  orderId,
                  product:orderProductLabel,
                  vol:v,
                  pricePerLitre:ppl,
                  items:invoiceItems,
                  buyer:buyerInfo.company||raw.buyer||"Buyer",
                  buyerAddr:buyerInfo.location||"Lagos, Nigeria",
                  buyerRc:buyerInfo.rc||"",
                  depot:depot?.name||"Depot",
                  depotAddr:depot?.location||"Lagos, Nigeria",
                  depotRc:depot?.rc||"",
                  depotLicense:depot?.license||"",
                  vat:true,
                  platformFee:finials.platformFee||0,
                  deliveryFee:liveQuoteStatus==="agreed"?liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0:0,
                  status:finials.paymentStatus||"",
                });
              }}
              style={{background:T.white,color:T.black,border:`1px solid ${T.green}`,padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px",whiteSpace:"nowrap"}}>
              ⬇ Invoice
            </button>
            {(liveStatus==="delivered"||liveStatus==="collected")&&(
              <button
                onClick={()=>printDeliveryReceipt({
                  orderId,
                  product:orderProductLabel,
                  vol:meta.vol||raw.vol||0,
                  buyer:buyerInfo.company||raw.buyer||"Buyer",
                  buyerAddr:buyerInfo.location||"Lagos, Nigeria",
                  depot:depot?.name||"Depot",
                  depotAddr:depot?.location||"Lagos, Nigeria",
                  trucks:(liveTrucks.length>0?liveTrucks:buyerTrucks).filter(t=>t.plate&&t.plate!=="TBD"),
                  deliveredAt:meta?.dispatchDate||"",
                  confirmedAt:new Date().toLocaleDateString('en-NG',{day:'2-digit',month:'long',year:'numeric'}),
                  condition:"good",
                  waybillRef:waybillRef||"",
                })}
                style={{background:"transparent",color:T.black,border:`1px solid ${T.gray200}`,padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px",whiteSpace:"nowrap"}}>
                ⬇ Delivery Receipt
              </button>
            )}
          </div>
        </div>
      )}

      {liveStatus==="rejected"&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"14px 18px",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.red}}>Order Rejected</div>
          <div style={{fontSize:"11px",color:T.red,marginTop:"2px"}}>Payment has been returned to the buyer. This order is closed.</div>
        </div>
      )}

      {/* Dispatch modal (legacy — kept for dispatch confirm flow from truck management) */}
      {/* Sub-tabs */}
      <div style={{display:"flex",borderBottom:`2px solid ${T.gray100}`,marginBottom:"16px",gap:"0"}}>
        {[["manage","Order Management"],["timeline","Timeline"],["activity","Activity Log"],["financials","Financials"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{padding:"9px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:activeTab===id?800:600,color:activeTab===id?T.black:T.gray400,borderBottom:`2px solid ${activeTab===id?T.black:"transparent"}`,marginBottom:"-2px",transition:"all 0.15s"}}>{label}</button>
        ))}
      </div>

      {/* ── TAB: ORDER MANAGEMENT ── */}
      {activeTab==="manage"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.3fr 1fr",gap:"14px",alignItems:"start"}}>
          <div>
            {/* Buyer Info */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Buyer"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
                {[["Company",buyerInfo.company||raw.buyer],["Type",buyerInfo.type||raw.type||"—"],["Contact",buyerInfo.name||"—"],["Phone",buyerInfo.phone||"—"],["Email",buyerInfo.email||"—"],["Business Address",buyerInfo.location||raw.location||"—"]].map(([l,v])=>(
                  <div key={l} style={{gridColumn:l==="Email"||l==="Business Address"?"span 2":"auto"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"2px"}}>{l}</div>
                    <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Delivery Location */}
            <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{fontSize:"16px"}}>{isDelivery?"🚛":"🏭"}</span>
                  <div>
                    <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{isDelivery?"Delivery Location":"Self Pick-up"}</div>
                    <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{isDelivery?"Trucks dispatch to this address":"Buyer collects from your depot"}</div>
                  </div>
                </div>
                <span style={{
                  fontSize:"9px",fontWeight:800,padding:"3px 8px",
                  background:isDelivery?T.blueLight:T.amberLight,
                  color:isDelivery?T.blue:"#8A5C00",
                  flexShrink:0,
                }}>
                  {isDelivery?"DELIVERY":"PICK-UP"}
                </span>
              </div>

              {isDelivery&&delivery?.state?(
                <div>
                  {/* Address breakdown */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:`1px solid ${T.gray100}`}}>
                    <div style={{padding:"12px 16px",borderRight:`1px solid ${T.gray100}`}}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>State</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{delivery.state}</div>
                    </div>
                    <div style={{padding:"12px 16px"}}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>LGA</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{delivery.lga}</div>
                    </div>
                  </div>
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.gray100}`}}>
                    <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Street Address</div>
                    <div style={{fontSize:"13px",fontWeight:700,color:T.black,lineHeight:1.4}}>{delivery.address}</div>
                  </div>
                  <div style={{padding:"10px 16px",background:T.gray50,display:"flex",alignItems:"center",gap:"6px"}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.gray400} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>Est. transit time from depot: {meta.depot?.eta||"4–6h"}</span>
                  </div>
                </div>
              ):isDelivery?(
                /* delivery mode but no structured address in meta — show raw location */
                <div style={{padding:"14px 16px"}}>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Delivery Address</div>
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{buyerInfo.location||raw.location||"Not specified"}</div>
                </div>
              ):(
                /* self pick-up */
                <div style={{padding:"14px 16px"}}>
                  <div style={{fontSize:"11px",color:T.gray600,lineHeight:1.5,marginBottom:"10px"}}>
                    The buyer will arrive at your depot with their own tanker trucks. Ensure loading bays are available and gate clearance is issued.
                  </div>
                  <div style={{background:T.amberLight,padding:"9px 12px",fontSize:"10px",color:"#8A5C00",fontWeight:700}}>
                    ⚠ Verify buyer's truck plates at gate before loading begins.
                  </div>
                </div>
              )}
            </Card>

            {/* Order Specs */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Order Specifications"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px",marginBottom:isMultiDepot?"14px":"0"}}>
                {[
                  ...(!isMultiDepot?[
                    ["Product",<span style={{background:T.black,color:T.white,fontSize:"11px",fontWeight:800,padding:"2px 8px"}}>{meta.product||raw.product}</span>],
                    ["Volume",`${((meta.vol||raw.vol)/1000).toFixed(0)}k Litres`],
                    ["Price / Litre",`₦${(meta.pricePerLitre||0).toLocaleString()}`],
                  ]:[]),
                  ["Trucks",`${meta.trucks||raw.trucks} trucks`],
                  ["Loading Bay",bay||"Pending"],
                  [isDelivery?"Deliver To":"Mode", isDelivery?(delivery?.lga&&delivery?.state?`${delivery.lga}, ${delivery.state}`:(buyerInfo.location||raw.location||"—")):"Self Pick-up"],
                ].map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"2px"}}>{l}</div>
                    <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{v}</div>
                  </div>
                ))}
              </div>
              {isMultiDepot&&(
                <div>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"8px"}}>Products Breakdown</div>
                  <div style={{border:`1px solid ${T.gray100}`}}>
                    {meta.products.map((p,i)=>(
                      <div key={p.name} style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr",alignItems:"center",padding:"9px 12px",gap:"10px",borderTop:i>0?`1px solid ${T.gray100}`:"none"}}>
                        <span style={{background:T.black,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>{p.name}</span>
                        <div>
                          <div style={{fontSize:"9px",color:T.gray400,fontWeight:600,textTransform:"uppercase"}}>Volume</div>
                          <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{(p.vol/1000).toFixed(0)}k L</div>
                        </div>
                        <div>
                          <div style={{fontSize:"9px",color:T.gray400,fontWeight:600,textTransform:"uppercase"}}>Price/L</div>
                          <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>₦{p.pricePerLitre?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{fontSize:"9px",color:T.gray400,fontWeight:600,textTransform:"uppercase"}}>Value</div>
                          <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{fmtMoney(p.value)}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{padding:"9px 12px",borderTop:`2px solid ${T.black}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.gray50}}>
                      <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>Total · {(meta.vol/1000).toFixed(0)}k L</span>
                      <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{fmtMoney(finials.productValue)}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Pickup: Gate Record Summary */}
            {isPickup&&liveStatus==="collected"&&buyerTrucks.some(t=>t.plate)&&(
              <Card style={{marginBottom:"14px"}}>
                <SectionHead title="Gate Record" sub={`${buyerTrucks.length} truck${buyerTrucks.length!==1?"s":""} collected · ${(buyerTruckVolTotal/1000).toFixed(0)}k L`}/>
                {buyerTrucks.filter(t=>t.plate).map((t,i)=>(
                  <div key={i} style={{paddingTop:i>0?"10px":"0",marginTop:i>0?"10px":"0",borderTop:i>0?`1px solid ${T.gray100}`:"none",display:"flex",alignItems:"center",gap:"10px"}}>
                    <div style={{width:"32px",height:"32px",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>🏭</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"2px"}}>
                        <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{t.plate}</span>
                        <span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:800,padding:"1px 6px"}}>COLLECTED</span>
                      </div>
                      <div style={{fontSize:"11px",color:T.gray600}}>{t.driver||"Driver not recorded"} · {(parseInt(t.vol)||0).toLocaleString()} L</div>
                    </div>
                  </div>
                ))}
                {waybillRef&&(
                  <div style={{marginTop:"10px",paddingTop:"10px",borderTop:`1px solid ${T.gray100}`,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>Waybill Ref</span>
                    <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>{waybillRef}</span>
                  </div>
                )}
              </Card>
            )}

            {/* Truck Management — delivery only */}
            {liveTrucks.length>0&&!isPickup&&(
              <Card>
                <SectionHead title="Truck Status" sub={`${liveTrucks.length} trucks · ${((meta.vol||raw.vol)/1000).toFixed(0)}k L`}/>
                {liveTrucks.map((t,i)=>{
                  const isDelivered=t.status==="delivered";
                  const isInTransit=liveStatus==="in_transit"&&!isDelivered;
                  return (
                    <div key={t.id} style={{paddingTop:i>0?"12px":"0",marginTop:i>0?"12px":"0",borderTop:i>0?`1px solid ${T.gray100}`:"none",display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                      <div style={{width:"32px",height:"32px",background:isDelivered?T.greenLight:isInTransit?T.blueLight:T.gray100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>🚛</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px",flexWrap:"wrap"}}>
                          <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>Truck {i+1}</span>
                          <Badge status={isDelivered?"delivered":liveStatus==="loading"?"loading":"in_transit"}/>
                          <span style={{fontSize:"10px",color:T.gray400}}>{t.plate==="TBD"?"—":t.plate}</span>
                        </div>
                        <div style={{fontSize:"11px",color:T.gray600}}>{t.driver==="TBD"?"Driver TBA":t.driver} · {(t.vol/1000).toFixed(0)}k L</div>
                        {isInTransit&&(
                          <div style={{marginTop:"5px"}}>
                            <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${t.progress||10}%`,background:T.blue,borderRadius:"2px"}}/>
                            </div>
                            <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{t.progress||10}% · ETA {t.eta}</div>
                          </div>
                        )}
                      </div>
                      <div style={{flexShrink:0}}>
                        {isDelivered?(
                          <span style={{fontSize:"11px",fontWeight:800,color:T.greenDark}}>✓</span>
                        ):isInTransit?(
                          <button onClick={()=>handleMarkTruckDelivered(i)} style={{background:T.green,color:T.white,border:"none",padding:"6px 12px",fontSize:"10px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"32px",whiteSpace:"nowrap"}}>Delivered ✓</button>
                        ):null}
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>

          {/* RIGHT: Status guide + quick actions */}
          <div>
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Next Steps"/>
              {liveStatus==="pending"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Review the order details and either <strong>Confirm</strong> to accept or <strong>Reject</strong> to decline. You have <strong style={{color:T.red}}>{raw.slaLeft||"—"}</strong> to respond.</div>}
              {liveStatus==="confirmed"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Assign an available loading bay above. This moves the order to <strong>Loading</strong> status.</div>}
              {liveStatus==="loading"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Ensure all {meta.trucks||raw.trucks} trucks are loaded, then click <strong>Dispatch All Trucks</strong> to mark the order as <strong>In Transit</strong>.</div>}
              {liveStatus==="in_transit"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Mark each truck as <strong>Delivered</strong> as they confirm delivery. When all trucks are marked, the order completes automatically.</div>}
              {liveStatus==="delivered"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Order complete. Net revenue of <strong style={{color:T.greenDark}}>{fmtMoney(finials.netToDepot)}</strong> has been credited to your account.</div>}
              {liveStatus==="rejected"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>This order was rejected. No further action required.</div>}
            </Card>

            <Card>
              <SectionHead title="Financials"/>
              {[
                ["Order Value",fmtMoney(finials.productValue),null],
                ...(liveQuoteStatus==="agreed"?[["Delivery Revenue",`+${fmtMoney(liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0)}`,null]]:isDelivery?[["Delivery Cost","Pending","pending"]]:[] ),
                [`VAT (${finials.productValue>0?((finials.vat/finials.productValue)*100).toFixed(1):7.5}%)`,`+${fmtMoney(finials.vat)}`,null],
              ].map(([l,v,type])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.gray100}`,alignItems:"center"}}>
                  <span style={{fontSize:type==="sub"?"11px":"12px",color:type==="sub"?T.gray400:type==="pending"?T.gray400:T.gray600,fontWeight:type==="sub"?600:700}}>{l}</span>
                  <span style={{fontSize:type==="sub"?"11px":"12px",fontWeight:700,
                    color:type==="sub"?T.gray400:type==="pending"?T.gray400:l==="Delivery Revenue"?T.greenDark:T.gray800}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0 0"}}>
                <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>Net to Depot</span>
                <span style={{fontSize:"15px",fontWeight:800,color:T.greenDark}}>
                  {fmtMoney((finials.productValue||0)+(finials.vat||0)+(liveQuoteStatus==="agreed"?liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0:0))}
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: TIMELINE ── */}
      {activeTab==="timeline"&&(
        <Card>
          <SectionHead title="Order Timeline"/>
          {liveTimeline.map((e,i)=>(
            <div key={i} style={{display:"flex",gap:"10px",paddingBottom:i<liveTimeline.length-1?"14px":"0",position:"relative"}}>
              {i<liveTimeline.length-1&&<div style={{position:"absolute",left:"11px",top:"22px",bottom:0,width:"2px",background:T.gray100}}/>}
              <div style={{width:"22px",height:"22px",borderRadius:"50%",background:e.actor==="buyer"?T.blueLight:e.actor==="depot"?T.greenLight:T.gray100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",flexShrink:0,zIndex:1,color:e.actor==="buyer"?T.blue:e.actor==="depot"?T.greenDark:T.gray400,fontWeight:800}}>
                {e.actor==="buyer"?"B":e.actor==="depot"?"D":"S"}
              </div>
              <div style={{flex:1,paddingTop:"2px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:T.black,lineHeight:1.4}}>
                  {e.event||(e.from||e.to?(e.from?e.from+" → ":"")+e.to:e.note||"Status update")}
                </div>
                {e.note&&e.event===undefined&&<div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{e.note}</div>}
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{e.time}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── TAB: ACTIVITY LOG ── */}
      {activeTab==="activity"&&(
        <Card>
          <SectionHead title="Activity Log" sub="Status changes and actions on this order"/>
          {liveTimeline.length===0?(
            <div style={{textAlign:"center",padding:"24px 0",color:T.gray400,fontSize:"12px"}}>No activity recorded yet.</div>
          ):liveTimeline.map((e,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"10px",padding:"10px 0",borderBottom:i<liveTimeline.length-1?`1px solid ${T.gray100}`:"none"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:T.green,marginTop:"5px",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>
                  {e.from?(STEP_LABELS[STATUS_STEPS.indexOf(e.from)]||e.from)+" → "+(STEP_LABELS[STATUS_STEPS.indexOf(e.to)]||(e.to==="collected"?"Collected":e.to||"")):"Status update"}
                </div>
                {e.note&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{e.note}</div>}
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{e.time}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── TAB: FINANCIALS ── */}
      {activeTab==="financials"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"14px"}}>
          <Card>
            <SectionHead title="Revenue Breakdown"/>
            {[
              ["Gross Order Value",fmtMoney(finials.productValue),null],
              ...(liveQuoteStatus==="agreed"?[["Delivery Revenue",`+${fmtMoney(liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0)}`,null]]:isDelivery?[["Delivery Cost","Pending negotiation","pending"]]:[] ),
              [`VAT (${finials.productValue>0?((finials.vat/finials.productValue)*100).toFixed(1):7.5}%)`,`+${fmtMoney(finials.vat)}`,null],
            ].map(([l,v,type])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.gray100}`}}>
                <span style={{fontSize:"12px",color:type==="sub"?T.gray400:type==="pending"?T.gray400:T.gray600,fontWeight:type?600:700}}>{l}</span>
                <span style={{fontSize:"12px",fontWeight:800,
                  color:type==="sub"?T.gray400:type==="pending"?T.gray400:l==="Delivery Revenue"?T.greenDark:T.black}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0 0"}}>
              <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>Net to Depot</span>
              <span style={{fontSize:"16px",fontWeight:800,color:T.greenDark}}>
                {fmtMoney((finials.productValue||0)+(finials.vat||0)+(liveQuoteStatus==="agreed"?liveQuoteRounds[liveQuoteRounds.length-1]?.amount||0:0))}
              </span>
            </div>
          </Card>
          <Card>
            <SectionHead title="Payment Status"/>
            <div style={{display:"grid",gap:"10px"}}>
              {[["Status",finials.paymentStatus==="paid"?"Completed":finials.paymentStatus==="processing"?"Processing":"Pending"],["Order Value",fmtMoney(finials.productValue)],["Method","Ventryl Pay"],["Ref",raw.id]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.gray100}`}}>
                  <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>{l}</span>
                  <span style={{fontSize:"12px",fontWeight:700,color:l==="Status"&&finials.paymentStatus==="paid"?T.greenDark:T.black}}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export { DepotOrderDetail };
