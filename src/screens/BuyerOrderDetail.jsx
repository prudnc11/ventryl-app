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
import { printWaybill, printInvoice, printDeliveryReceipt, printOrderSummary } from "../lib/documents";
import { openPaystackPopup, verifyAndCreditWallet, FUND_PRESETS } from "../lib/payment";
import { useOrderRealtime, useDepotInboxRealtime, useProfileRealtime } from "../lib/realtime";
import { useDepotContext } from "../context/DepotContext";

function DisputeModal({onClose,orderId,product,vol}) {
  const {user:authUser}=useAuthStore();
  const [step,setStep]=useState(1);
  const [reason,setReason]=useState("");
  const [details,setDetails]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState(null);
  const [files,setFiles]=useState([]);
  const [uploadError,setUploadError]=useState(null);
  const [dragging,setDragging]=useState(false);
  const fileInputRef=useRef(null);
  const [ref]=useState(`DSP-${Date.now().toString().slice(-6)}`);

  const REASONS=[
    {id:"short_qty",label:"Short Quantity",desc:"Received less volume than ordered"},
    {id:"quality",label:"Product Quality Issue",desc:"Contaminated, off-spec or wrong grade"},
    {id:"not_delivered",label:"Delivery Not Completed",desc:"Trucks never arrived at destination"},
    {id:"wrong_product",label:"Wrong Product Delivered",desc:"Received different product than ordered"},
    {id:"delay",label:"Significant Delay",desc:"Delivery exceeded agreed SLA"},
    {id:"other",label:"Other Issue",desc:"Something else went wrong"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{background:T.white,maxWidth:"480px",width:"100%",maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",gap:"12px",position:"sticky",top:0,background:T.white,zIndex:1}}>
          {step>1&&step<4&&<button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"18px",lineHeight:1,color:T.gray400,padding:0}}>←</button>}
          <div style={{flex:1}}>
            <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>
              {step===4?"Dispute Submitted":"Raise a Dispute"}
            </div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{orderId} · {product} · {(vol/1000).toFixed(0)}k L</div>
          </div>
          {/* Close button always visible */}
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",color:T.gray400,padding:0,lineHeight:1,flexShrink:0}}>×</button>
          {/* Step indicator */}
          {step<4&&<div style={{display:"flex",gap:"4px"}}>
            {[1,2,3].map(s=><div key={s} style={{width:"6px",height:"6px",borderRadius:"50%",background:step>=s?T.black:T.gray200}}/>)}
          </div>}
        </div>

        <div style={{padding:"20px 24px",flex:1}}>
          {/* Step 1: Choose reason */}
          {step===1&&(
            <div>
              <div style={{fontSize:"12px",color:T.gray600,marginBottom:"16px"}}>Select the reason that best describes your issue:</div>
              {REASONS.map(r=>(
                <div key={r.id} onClick={()=>setReason(r.id)} style={{display:"flex",alignItems:"flex-start",gap:"12px",padding:"12px 14px",border:`2px solid ${reason===r.id?T.black:T.gray100}`,background:reason===r.id?T.black:T.white,cursor:"pointer",marginBottom:"8px",transition:"all 0.15s"}}>
                  <div style={{width:"18px",height:"18px",border:`2px solid ${reason===r.id?T.white:T.gray400}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>
                    {reason===r.id&&<div style={{width:"8px",height:"8px",borderRadius:"50%",background:T.white}}/>}
                  </div>
                  <div>
                    <div style={{fontSize:"13px",fontWeight:800,color:reason===r.id?T.white:T.black}}>{r.label}</div>
                    <div style={{fontSize:"11px",color:reason===r.id?"#aaa":T.gray400,marginTop:"1px"}}>{r.desc}</div>
                  </div>
                </div>
              ))}
              <button disabled={!reason} onClick={()=>setStep(2)} style={{marginTop:"8px",background:reason?T.black:T.gray200,color:reason?T.white:T.gray400,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:reason?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"44px"}}>Continue →</button>
            </div>
          )}

          {/* Step 2: Details */}
          {step===2&&(
            <div>
              <div style={{background:T.gray50,padding:"12px 14px",marginBottom:"16px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Issue</div>
                <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{REASONS.find(r=>r.id===reason)?.label}</div>
              </div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Describe what happened <span style={{color:T.red}}>*</span></div>
              <textarea value={details} onChange={e=>setDetails(e.target.value)}
                placeholder="Provide specific details: quantities, times, truck plates, what the driver said, photos taken, etc."
                style={{width:"100%",minHeight:"120px",border:`1px solid ${details.trim().length>20?T.green:T.gray200}`,padding:"12px 14px",fontFamily:F,fontSize:"13px",color:T.black,outline:"none",resize:"vertical",marginBottom:"6px"}}/>
              <div style={{fontSize:"10px",color:T.gray400,marginBottom:"16px"}}>{details.length}/500 · Minimum 20 characters</div>

              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Evidence (optional)</div>
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx"
                style={{display:"none"}}
                onChange={e=>{
                  const chosen=Array.from(e.target.files||[]);
                  const valid=chosen.filter(f=>f.size<=10*1024*1024);
                  const tooLarge=chosen.filter(f=>f.size>10*1024*1024);
                  if(tooLarge.length) setUploadError(`${tooLarge.map(f=>f.name).join(", ")} exceed 10 MB and were skipped.`);
                  else setUploadError(null);
                  setFiles(prev=>{
                    const existing=new Set(prev.map(f=>f.name));
                    return [...prev,...valid.filter(f=>!existing.has(f.name))];
                  });
                  e.target.value="";
                }}
              />
              {/* Drop zone */}
              <div
                onClick={()=>fileInputRef.current?.click()}
                onDragOver={e=>{e.preventDefault();setDragging(true);}}
                onDragLeave={()=>setDragging(false)}
                onDrop={e=>{
                  e.preventDefault();setDragging(false);
                  const dropped=Array.from(e.dataTransfer.files||[]);
                  const valid=dropped.filter(f=>f.size<=10*1024*1024);
                  const tooLarge=dropped.filter(f=>f.size>10*1024*1024);
                  if(tooLarge.length) setUploadError(`${tooLarge.map(f=>f.name).join(", ")} exceed 10 MB.`);
                  else setUploadError(null);
                  setFiles(prev=>{const ex=new Set(prev.map(f=>f.name));return [...prev,...valid.filter(f=>!ex.has(f.name))];});
                }}
                style={{border:`2px dashed ${dragging?T.black:T.gray200}`,padding:"20px",textAlign:"center",marginBottom:"8px",cursor:"pointer",background:dragging?T.gray100:T.gray50,transition:"all 0.15s"}}>
                <div style={{fontSize:"22px",marginBottom:"6px"}}>📎</div>
                <div style={{fontSize:"12px",fontWeight:700,color:T.gray600}}>Click or drag files here</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>JPG, PNG, PDF, DOC · Max 10 MB each</div>
              </div>
              {uploadError&&<div style={{fontSize:"11px",color:T.red,fontWeight:600,marginBottom:"6px"}}>{uploadError}</div>}
              {/* File list */}
              {files.length>0&&(
                <div style={{marginBottom:"16px"}}>
                  {files.map((f,i)=>(
                    <div key={f.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",background:T.white,border:`1px solid ${T.gray100}`,marginBottom:"4px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",minWidth:0}}>
                        <span style={{fontSize:"14px"}}>{f.type.startsWith("image/")?"🖼️":f.type==="application/pdf"?"📄":"📎"}</span>
                        <span style={{fontSize:"11px",fontWeight:700,color:T.black,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                        <span style={{fontSize:"10px",color:T.gray400,flexShrink:0}}>{(f.size/1024).toFixed(0)} KB</span>
                      </div>
                      <button onClick={e=>{e.stopPropagation();setFiles(prev=>prev.filter((_,j)=>j!==i));}}
                        style={{background:"none",border:"none",cursor:"pointer",color:T.gray400,fontSize:"16px",lineHeight:1,padding:"0 4px",flexShrink:0}}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <button disabled={details.trim().length<20} onClick={()=>setStep(3)} style={{background:details.trim().length>=20?T.black:T.gray200,color:details.trim().length>=20?T.white:T.gray400,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:details.trim().length>=20?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"44px"}}>Review Dispute →</button>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step===3&&(
            <div>
              <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"12px 14px",marginBottom:"16px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:"#8A5C00"}}>⚠ Once submitted, this dispute will be reviewed by Ventryl within 24–48 hours. The depot will be notified.</div>
              </div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"16px"}}>
                {[
                  ["Order",orderId],
                  ["Product",`${product} · ${(vol/1000).toFixed(0)}k L`],
                  ["Issue",REASONS.find(r=>r.id===reason)?.label||reason],
                  ["Details",details.slice(0,120)+(details.length>120?"…":"")],
                  ["Evidence",files.length>0?`${files.length} file${files.length!==1?"s":""} attached`:"None"],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",gap:"16px",padding:"10px 14px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600,width:"70px",flexShrink:0}}>{k}</span>
                    <span style={{color:T.black,fontWeight:700,flex:1}}>{v}</span>
                  </div>
                ))}
              </div>
              {submitError&&<div style={{background:"#FEF2F2",border:`1px solid ${T.red}`,padding:"10px 12px",marginBottom:"10px",fontSize:"12px",color:T.red,fontWeight:700}}>{submitError}</div>}
              <button disabled={submitting} onClick={async()=>{
                setSubmitting(true);setSubmitError(null);
                try{
                  // 1. Upload evidence files to Storage (best-effort)
                  const evidenceUrls=[];
                  for(const file of files){
                    const path=`${orderId}/${ref}/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
                    const {data:upData,error:upErr}=await supabase.storage
                      .from('dispute-evidence').upload(path,file,{upsert:true});
                    if(!upErr&&upData){
                      const {data:{publicUrl}}=supabase.storage.from('dispute-evidence').getPublicUrl(upData.path);
                      evidenceUrls.push(publicUrl);
                    }
                  }
                  // 2. Save dispute record
                  await supabase.from('disputes').insert({
                    reference:ref, order_id:orderId, buyer_id:authUser?.id,
                    reason, details, status:'open',
                    evidence_urls:evidenceUrls,
                  });
                  // 2. Update order status → disputed
                  await supabase.from('orders').update({status:'disputed'}).eq('id',orderId);
                  // 3. Log status change (omit from_status to avoid null type ambiguity)
                  await supabase.from('order_status_logs').insert({
                    order_id:orderId, to_status:'disputed',
                    note:`Dispute filed (${ref}): ${REASONS.find(r=>r.id===reason)?.label}`,
                    actor_id:authUser?.id,
                  });
                  // 4. Notify depot (fire-and-forget)
                  const {data:orderRow}=await supabase.from('orders')
                    .select('depot_id, depots(name)')
                    .eq('id',orderId).maybeSingle();
                  if(orderRow){
                    notifApi.send({
                      userId:authUser?.id, type:'dispute_filed', channel:'email',
                      data:{orderId, depotName:orderRow.depots?.name||'Depot',
                        buyerName:authUser?.email||'Buyer', reason:REASONS.find(r=>r.id===reason)?.label||reason, ref},
                    }).catch(()=>{});
                  }
                  setStep(4);
                }catch(e){setSubmitError(e.message);}
                finally{setSubmitting(false);}
              }} style={{background:submitting?T.gray200:T.red,color:submitting?T.gray400:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:submitting?"not-allowed":"pointer",fontFamily:F,width:"100%",minHeight:"44px",marginBottom:"8px"}}>
                {submitting?"Submitting…":"Submit Dispute"}
              </button>
              <button onClick={onClose} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.gray600,padding:"10px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,width:"100%",minHeight:"40px"}}>Cancel</button>
            </div>
          )}

          {/* Step 4: Submitted */}
          {step===4&&(
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{width:"56px",height:"56px",background:T.amberLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:"24px"}}>⚠</div>
              <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Dispute Filed</div>
              <div style={{fontSize:"12px",color:T.gray400,lineHeight:1.6,marginBottom:"20px"}}>Reference: <strong style={{color:T.black}}>{ref}</strong><br/>Our team will review this dispute within 24–48 hours. Both parties will be notified via email and in-app.</div>
              <div style={{border:`1px solid ${T.gray100}`,padding:"14px",marginBottom:"20px",textAlign:"left"}}>
                {[["Status","Under Review"],["Filed","Just now"],["Ref",ref],["Response ETA","24–48 hours"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600}}>{k}</span>
                    <span style={{color:T.black,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={onClose} style={{background:T.black,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%",minHeight:"44px"}}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BuyerOrderDetail({isMobile}) {
  const navigate = useNavigate();
  const { id: orderId } = useParams();
  const onBack = () => navigate(-1);
  const {buyerOrders,orderDetails,loadOrderDetail,invalidateOrderDetail,loadBuyerOrders}=useVentrylStore();
  const {user:authUser}=useAuthStore();
  const [loading,setLoading]=useState(true);
  const order=buyerOrders.find(o=>o.id===orderId);
  const meta=orderDetails[orderId]||{};

  // local live-tracking state (synced from depot stores so changes persist across navigation)
  const [liveStatus,setLiveStatus]=useState(()=>_orderStatusStore[orderId]||order?.status||"pending");
  const [liveTrucks,setLiveTrucks]=useState(()=>_orderTruckListStore[orderId]||(meta.trucks_detail||[]).map(t=>({...t})));
  const [deliveryConfirmed,setDeliveryConfirmed]=useState(()=>_buyerConfirmedStore[orderId]||false);
  // Persist deliveryConfirmed from timeline logs (survives page reload)
  useEffect(()=>{
    if(deliveryConfirmed) return;
    const tl=meta?.timeline||[];
    const confirmed=tl.some(t=>t.note&&t.note.toLowerCase().includes("receipt confirmed"));
    if(confirmed){_buyerConfirmedStore[orderId]=true;setDeliveryConfirmed(true);}
  },[meta?.timeline]);
  const [showConfirmModal,setShowConfirmModal]=useState(false);
  const [showDispute,setShowDispute]=useState(false);
  const [showCancelConfirm,setShowCancelConfirm]=useState(false);
  const [cancelling,setCancelling]=useState(false);
  const [actionErr,setActionErr]=useState("");
  const [activeTab,setActiveTab]=useState("tracking");  // tracking | details | payment

  // Delivery cost negotiation state
  const [quoteRounds,setQuoteRounds]=useState(()=>(_deliveryQuoteStore[orderId]||{rounds:[]}).rounds);
  const [quoteStatus,setQuoteStatus]=useState(()=>(_deliveryQuoteStore[orderId]||{status:"none"}).status);
  const [counterInput,setCounterInput]=useState("");
  const [showCounterForm,setShowCounterForm]=useState(false);

  // Direct negotiation fetch — bypasses order detail join (handles RLS / empty join edge cases)
  const loadNeg=useCallback(async()=>{
    try{
      const neg=await negotiationsApi.get(orderId);
      if(neg){
        if(neg.status) setQuoteStatus(neg.status);
        const rounds=(neg.delivery_rounds||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(r=>({
          from:r.from_party,amount:r.amount,time:new Date(r.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
        }));
        if(rounds.length>0) setQuoteRounds(rounds);
      }
    }catch(e){/* negotiation load is non-critical, fail silently */}
  },[orderId]);

  // Always load fresh detail from DB on mount (invalidate stale cache)
  useEffect(()=>{
    setLoading(true);
    invalidateOrderDetail(orderId);
    Promise.all([
      loadOrderDetail(orderId),
      authUser?.id ? loadBuyerOrders(authUser.id) : Promise.resolve(),
      loadNeg(),
    ]).finally(()=>setLoading(false));
  },[orderId]);

  // Sync liveStatus + negotiation from loaded data (covers page-load and post-reload cases)
  useEffect(()=>{
    const s=meta?.status||order?.status;
    if(s) setLiveStatus(s);
  },[meta?.status,order?.status]);

  useEffect(()=>{
    const neg=meta?._negotiation;
    if(neg){
      if(neg.status) setQuoteStatus(neg.status);
      const rounds=(neg.delivery_rounds||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(r=>({
        from:r.from_party,amount:r.amount,time:new Date(r.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
      }));
      if(rounds.length>0) setQuoteRounds(rounds);
    }
  },[meta?._negotiation]);

  // Helper: reload full order data (invalidate cache then fetch fresh)
  const reloadOrderDetail=useRef(null);
  reloadOrderDetail.current=()=>{
    invalidateOrderDetail(orderId);
    loadOrderDetail(orderId);
    if(authUser?.id) loadBuyerOrders(authUser.id);
    loadNeg();
  };

  // ── Realtime: update live state when Supabase pushes changes ──────
  useOrderRealtime(orderId,(payload)=>{
    const {table,new:n}=payload;
    if(table==="orders"&&n?.status){
      setLiveStatus(n.status);
      // Refresh full detail so trucks, timeline, financials all update
      reloadOrderDetail.current?.();
    }
    if(table==="order_trucks"&&n){
      setLiveTrucks(prev=>{
        const idx=prev.findIndex(t=>t._dbId===n.id||t.id===n.id);
        if(idx>=0) return prev.map((t,i)=>i===idx?{...t,...n,_dbId:n.id}:t);
        return [...prev,n];
      });
    }
    if(table==="order_status_logs"){
      // New activity log entry — refresh detail to get updated timeline
      reloadOrderDetail.current?.();
    }
    if(table==="delivery_negotiations"&&n){
      // Direct fetch to get full rounds + amount (realtime payload has no amount)
      loadNeg();
      reloadOrderDetail.current?.();
      if(authUser?.id) loadBuyerOrders(authUser.id);
    }
  });

  const approveDeliveryQuote=async()=>{
    try{
      const latestAmount=quoteRounds[quoteRounds.length-1]?.amount||0;
      await negotiationsApi.accept(orderId,latestAmount);
      setQuoteStatus("agreed");
      setShowCounterForm(false);
      reloadOrderDetail.current?.();
    }catch(e){setActionErr(e.message||"Failed to approve quote. Please try again.");}
  };

  const sendCounterOffer=async(amount)=>{
    try{
      await negotiationsApi.sendQuote(orderId,"buyer",parseInt(amount));
      setQuoteStatus("depot_pending");
      setCounterInput("");
      setShowCounterForm(false);
      reloadOrderDetail.current?.();
    }catch(e){setActionErr(e.message||"Failed to send counter offer. Please try again.");}
  };

  if(loading) return (
    <div style={{padding:"40px",textAlign:"center"}}>
      <div style={{fontSize:"14px",fontWeight:700,color:T.gray400}}>Loading order…</div>
    </div>
  );

  if(!order) return (
    <div style={{padding:"40px",textAlign:"center"}}>
      <div style={{fontSize:"14px",fontWeight:700,color:T.gray400}}>Order not found.</div>
      <button onClick={onBack} style={{marginTop:"16px",background:T.black,color:T.white,border:"none",padding:"9px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F}}>← Back</button>
    </div>
  );

  const finials   = meta.financials||{};
  const timeline  = meta.timeline||[];
  const buyerInfo = meta.buyer||{};
  const depotInfo = meta.depot||{};
  const delivery  = meta.delivery||null;
  const isDelivery= !delivery||delivery.mode==="delivery";
  const fmtMoney  = n=>`₦${(n||0).toLocaleString('en-NG')}`;
  const isMulti   = Array.isArray(meta.products)&&meta.products.length>1;
  const vol       = meta.vol||order.vol||0;
  const product   = isMulti ? meta.products.map(p=>p.name).join(" + ") : (meta.product||order.product);
  const truckCount= meta.trucks||order.trucks||0;

  const isPickup=delivery&&delivery.mode==="pickup";
  const isTerminal=["rejected","cancelled"].includes(liveStatus);
  const isDisputed=liveStatus==="disputed";
  const STATUS_STEPS=isPickup
    ?["pending","confirmed","loading","collected"]
    :["pending","confirmed","loading","in_transit","delivered"];
  const STEP_LABELS=isPickup
    ?["Placed","Confirmed","Loading","Collected"]
    :["Placed","Confirmed","Loading","In Transit","Delivered"];
  const currentStep=isTerminal?-1:isDisputed?Math.max(0,STATUS_STEPS.indexOf("in_transit")):Math.max(0,STATUS_STEPS.indexOf(liveStatus));

  // Status-specific hero config
  const HERO={
    pending:  {bg:T.gray800,    accent:T.gray400, icon:"🕐", title:"Waiting for Depot",      msg:"Your order has been submitted. The depot has up to 2 hours to confirm.",      cta:null},
    confirmed:{bg:"#1A3A0A",    accent:T.green,   icon:"✅", title:"Order Confirmed",        msg:`${depotInfo.name||"The depot"} confirmed your order. Loading preparations are underway.`,cta:null},
    loading:  {bg:"#0A1F3A",    accent:T.blue,    icon:"⚙️", title:"Loading in Progress",    msg:isPickup?`Your products are being loaded at ${meta.bay||"the depot"}. Proceed to the depot for collection.`:`Your products are being loaded at ${meta.bay||"the depot"}. Trucks depart soon.`,cta:null},
    in_transit:{bg:"#0A1F3A",   accent:T.blue,    icon:"🚛", title:"On the Way",             msg:`${truckCount} truck${truckCount!==1?"s":""} are en route to your location. Track progress below.`,cta:null},
    delivered:{bg:"#0D2B0D",    accent:T.green,   icon:"📦", title:"Arrived — Confirm Receipt",msg:`${truckCount} truck${truckCount!==1?"s":""} have arrived. Please confirm receipt to complete the order.`,cta:"confirm"},
    collected:{bg:"#0D2B0D",    accent:T.green,   icon:"✅", title:"Order Collected",         msg:"You have collected your products from the depot. Order complete.",cta:null},
    rejected: {bg:"#3A0A0A",    accent:T.red,     icon:"✕",  title:"Order Rejected",          msg:`${depotInfo.name||"The depot"} has rejected this order. Your payment will be refunded to your wallet.`,cta:null},
    cancelled:{bg:T.gray800,    accent:T.gray400, icon:"✕",  title:"Order Cancelled",         msg:"This order has been cancelled. Any held funds will be returned to your wallet.",cta:null},
    disputed: {bg:"#3A1F0A",    accent:"#D97706",  icon:"⚠",  title:"Dispute Filed",           msg:"A dispute has been filed on this order. Ventryl's team will review within 24–48 hours.",cta:null},
  };
  const hero = HERO[liveStatus]||HERO.pending;
  const allDelivered = liveTrucks.length>0&&liveTrucks.every(t=>t.status==="delivered");

  return (
    <div>
      {/* Modals */}
      {showDispute&&<DisputeModal onClose={()=>setShowDispute(false)} orderId={orderId} product={product} vol={vol}/>}
      {showCancelConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"400px",width:"100%",padding:"28px",fontFamily:F}}>
            <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"10px"}}>Cancel Order?</div>
            <div style={{fontSize:"13px",color:T.gray600,lineHeight:1.6,marginBottom:"16px"}}>
              Are you sure you want to cancel order <strong>{orderId}</strong>? Your escrowed funds will be refunded to your wallet.
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button disabled={cancelling} onClick={async()=>{
                setCancelling(true);
                try{
                  await ordersApi.updateStatus(orderId,"cancelled",{actorId:authUser?.id,note:"Cancelled by buyer"});
                  setLiveStatus("cancelled");_orderStatusStore[orderId]="cancelled";
                  setShowCancelConfirm(false);
                  invalidateOrderDetail(orderId);
                  loadOrderDetail(orderId,true);
                }catch(e){setActionErr(e.message||"Failed to cancel order. Please try again.");}
                finally{setCancelling(false);}
              }} style={{flex:1,background:T.red,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:cancelling?"not-allowed":"pointer",fontFamily:F,minHeight:"46px",opacity:cancelling?0.6:1}}>
                {cancelling?"Cancelling…":"Yes, Cancel Order"}
              </button>
              <button onClick={()=>setShowCancelConfirm(false)} style={{flex:1,background:"none",color:T.black,border:`1px solid ${T.gray200}`,padding:"12px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>Keep Order</button>
            </div>
          </div>
        </div>
      )}
      {showConfirmModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"400px",width:"100%",padding:"28px"}}>
            <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"10px"}}>Confirm Receipt?</div>
            <div style={{fontSize:"13px",color:T.gray600,lineHeight:1.6,marginBottom:"10px"}}>
              You are confirming receipt of <strong>{(vol/1000).toFixed(0)}k litres</strong> of <strong>{product}</strong> from <strong>{depotInfo.name||order.depot}</strong>.
            {isMulti&&(
              <div style={{marginTop:"8px",display:"flex",flexDirection:"column",gap:"3px"}}>
                {meta.products.map(p=><div key={p.name} style={{fontSize:"11px",color:T.gray600}}>· {p.name}: {(p.vol/1000).toFixed(0)}k L</div>)}
              </div>
            )}
            </div>
            <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"10px 14px",marginBottom:"20px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
              ⚠ Only confirm if you have physically received and checked the delivery. Payment will be released to the depot.
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={async()=>{
                try{
                  await ordersApi.updateStatus(orderId,"delivered",{actorId:authUser?.id,note:"Receipt confirmed by buyer"});
                  _buyerConfirmedStore[orderId]=true;setDeliveryConfirmed(true);setShowConfirmModal(false);
                  reloadOrderDetail.current?.();
                }catch(e){setActionErr(e.message||"Failed to confirm receipt. Please try again.");}
              }} style={{flex:1,background:T.green,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>Yes, Confirm</button>
              <button onClick={()=>setShowConfirmModal(false)} style={{flex:1,background:"none",color:T.black,border:`1px solid ${T.gray200}`,padding:"12px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {actionErr&&(
        <div style={{background:"#FEE2E2",border:"1px solid #FECACA",padding:"10px 14px",marginBottom:"12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:"12px",fontWeight:600,color:"#991B1B"}}>{actionErr}</span>
          <button onClick={()=>setActionErr("")} style={{background:"none",border:"none",fontSize:"14px",cursor:"pointer",color:"#991B1B",fontWeight:800}}>✕</button>
        </div>
      )}

      {/* Back + header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.black,padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <span style={{fontSize:isMobile?"16px":"20px",fontWeight:800,color:T.black}}>{order.id}</span>
            <Badge status={liveStatus}/>
          </div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{depotInfo.name||order.depot} · {product} · {meta.placed||order.placed}</div>
        </div>
        <div style={{display:"flex",gap:"8px",flexShrink:0,flexWrap:"wrap"}}>
          {/* Raise dispute — only before delivery confirmed */}
          {liveStatus!=="delivered"||(deliveryConfirmed===false)?(
            liveStatus!=="pending"&&liveStatus!=="delivered"&&(
              <button onClick={()=>setShowDispute(true)}
                style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
                ⚠ Dispute
              </button>
            )
          ):null}

          {/* Confirm receipt — delivered but not yet confirmed */}
          {liveStatus==="delivered"&&!deliveryConfirmed&&(
            <button onClick={()=>setShowConfirmModal(true)}
              style={{background:T.green,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px",whiteSpace:"nowrap"}}>
              ✓ Confirm Receipt
            </button>
          )}

          {/* Invoice — only after confirmed */}
          {deliveryConfirmed&&(
            <button
              onClick={()=>{
                const totalVal=finials.productValue||meta?.value||order?.value||0;
                const ppl=meta?.pricePerLitre||order?.pricePerLitre||(vol>0&&totalVal?Math.round(totalVal/vol):0);
                const invoiceItems=isMulti&&meta.products?meta.products.map(p=>({product:p.name,vol:p.vol,pricePerLitre:p.pricePerLitre||(p.value&&p.vol?Math.round(p.value/p.vol):ppl)})):null;
                printInvoice({
                  orderId,
                  product,
                  vol,
                  pricePerLitre:ppl,
                  items:invoiceItems,
                  buyer:buyerInfo.company||order?.buyer||"",
                  buyerAddr:buyerInfo.location||"Lagos, Nigeria",
                  buyerRc:buyerInfo.rc||"",
                  depot:depotInfo.name||order?.depot||"",
                  depotAddr:depotInfo.location||"Nigeria",
                  depotLicense:meta?.license||"",
                  date:new Date().toLocaleDateString('en-NG',{day:'2-digit',month:'long',year:'numeric'}),
                  vat:true,
                  platformFee:finials.platformFee||0,
                  deliveryFee:quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0,
                  status:finials.paymentStatus||"",
                });
              }}
              style={{background:T.black,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
              ⬇ Invoice
            </button>
          )}

          {/* Delivery Receipt — after delivery confirmed */}
          {deliveryConfirmed&&(
            <button
              onClick={()=>printDeliveryReceipt({
                orderId,
                product,
                vol,
                buyer:buyerInfo.company||order?.buyer||"",
                buyerAddr:buyerInfo.location||"Lagos, Nigeria",
                depot:depotInfo.name||order?.depot||"",
                depotAddr:depotInfo.location||"Nigeria",
                trucks:liveTrucks.filter(t=>t.plate&&t.plate!=="TBD"),
                deliveredAt:meta?.dispatchDate||"",
                confirmedAt:new Date().toLocaleDateString('en-NG',{day:'2-digit',month:'long',year:'numeric'}),
                confirmedBy:buyerInfo.company||order?.buyer||"Buyer",
                condition:"good",
              })}
              style={{background:T.white,color:T.black,border:`1px solid ${T.green}`,padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
              ⬇ Delivery Receipt
            </button>
          )}

          {/* Order Summary — always available */}
          {order&&(
            <button
              onClick={()=>printOrderSummary({
                orderId,
                product,
                vol,
                pricePerLitre:meta?.pricePerLitre||order?.pricePerLitre||(vol>0&&(finials.productValue||meta?.value||order?.value)?Math.round((finials.productValue||meta?.value||order?.value)/vol):0),
                buyer:buyerInfo.company||order?.buyer||"",
                buyerAddr:buyerInfo.location||"Lagos, Nigeria",
                buyerRc:buyerInfo.rc||"",
                depot:depotInfo.name||order?.depot||"",
                depotAddr:depotInfo.location||"Nigeria",
                depotLicense:meta?.license||"",
                status:liveStatus,
                placedAt:meta?.placed||order?.placed||"",
                type:isPickup?"pickup":"delivery",
                trucks:truckCount,
                vat:true,
                platformFee:finials.platformFee||0,
                deliveryFee:quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0,
                timeline:timeline.map(t=>({status:t.status,time:t.time,note:t.note||""})),
              })}
              style={{background:"transparent",color:T.black,border:`1px solid ${T.gray200}`,padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
              ⬇ Order Summary
            </button>
          )}
        </div>
      </div>

      {/* ── STATUS HERO BANNER ── */}
      <div style={{background:hero.bg,padding:isMobile?"16px":"20px 24px",marginBottom:"16px",position:"relative",overflow:"hidden"}}>
        {/* subtle animated ring for in_transit */}
        {liveStatus==="in_transit"&&(
          <div style={{position:"absolute",right:"-30px",top:"-30px",width:"120px",height:"120px",borderRadius:"50%",border:`2px solid ${T.blue}`,opacity:0.15,animation:"pulse 2s infinite"}}/>
        )}
        <div style={{display:"flex",alignItems:"center",gap:"16px",flexWrap:"wrap"}}>
          <div style={{fontSize:isMobile?"28px":"36px",lineHeight:1,flexShrink:0}}>{hero.icon}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:isMobile?"16px":"20px",fontWeight:800,color:T.white,marginBottom:"4px"}}>{hero.title}</div>
            <div style={{fontSize:"12px",color:"#aaa",lineHeight:1.5}}>{hero.msg}</div>
            {liveStatus==="in_transit"&&meta.trucks_detail?.[0]?.eta&&(
              <div style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                <span style={{background:T.blue,color:T.white,fontSize:"11px",fontWeight:800,padding:"3px 10px"}}>ETA {meta.trucks_detail[0].eta}</span>
                <span style={{fontSize:"10px",color:"#888"}}>Lead truck · {meta.trucks_detail[0].plate}</span>
              </div>
            )}
          </div>
          {/* Primary CTA */}
          {liveStatus==="delivered"&&!deliveryConfirmed&&(
            <button onClick={()=>setShowConfirmModal(true)} style={{background:T.green,color:T.white,border:"none",padding:"12px 20px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"48px",whiteSpace:"nowrap",flexShrink:0}}>
              Confirm Receipt ✓
            </button>
          )}
          {liveStatus==="delivered"&&deliveryConfirmed&&(
            <div style={{background:T.green,color:T.white,padding:"10px 16px",fontSize:"12px",fontWeight:800}}>✓ Receipt Confirmed</div>
          )}
          {liveStatus==="pending"&&(
            <button onClick={()=>setShowCancelConfirm(true)} style={{background:"transparent",color:"#aaa",border:"1px solid #333",padding:"9px 14px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"40px",flexShrink:0}}>
              Cancel Order
            </button>
          )}
        </div>

        {/* Progress bar inside hero for in_transit */}
        {liveStatus==="in_transit"&&liveTrucks.length>0&&(
          <div style={{marginTop:"14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
              <span style={{fontSize:"10px",color:"#888",fontWeight:600}}>Overall delivery progress</span>
              <span style={{fontSize:"10px",color:"#aaa",fontWeight:700}}>
                {liveTrucks.filter(t=>t.status==="delivered").length}/{liveTrucks.length} trucks arrived
              </span>
            </div>
            <div style={{height:"4px",background:"#1A1A2E",borderRadius:"2px",overflow:"hidden"}}>
              <div style={{height:"100%",background:T.blue,borderRadius:"2px",transition:"width 0.5s",
                width:`${Math.round(liveTrucks.reduce((s,t)=>s+(t.progress||0),0)/Math.max(liveTrucks.length,1))}%`}}/>
            </div>
          </div>
        )}
      </div>

      {/* ── STEPPER ── */}
      {isTerminal?(
        <Card style={{marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"12px",padding:"12px 0"}}>
            <div style={{width:"30px",height:"30px",borderRadius:"50%",background:liveStatus==="rejected"?T.red:T.gray400,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",color:T.white,fontWeight:800}}>✕</div>
            <div style={{fontSize:"13px",fontWeight:800,color:liveStatus==="rejected"?T.red:T.gray600,textTransform:"uppercase",letterSpacing:"0.05em"}}>
              {liveStatus==="rejected"?"Order Rejected by Depot":"Order Cancelled"}
            </div>
          </div>
        </Card>
      ):(
        <Card style={{marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",position:"relative"}}>
            <div style={{position:"absolute",top:"13px",left:"13px",right:"13px",height:"2px",background:T.gray100,zIndex:0}}/>
            <div style={{position:"absolute",top:"13px",left:"13px",height:"2px",
              width:`${Math.max(0,(currentStep/(STATUS_STEPS.length-1))*100)}%`,
              background:isDisputed?"#D97706":T.green,zIndex:1,transition:"width 0.6s ease"}}/>
            {STATUS_STEPS.map((s,i)=>{
              const done=i<currentStep;
              const active=i===currentStep;
              return (
                <div key={s} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,zIndex:2,position:"relative"}}>
                  <div style={{width:"26px",height:"26px",borderRadius:"50%",
                    background:done?T.green:active?(isDisputed?"#D97706":T.black):T.white,
                    border:`2px solid ${done?T.green:active?(isDisputed?"#D97706":T.black):T.gray200}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"10px",fontWeight:800,color:done||active?T.white:T.gray400,
                    transition:"all 0.4s",
                    boxShadow:active?`0 0 0 4px ${isDisputed?"rgba(217,119,6,0.18)":"rgba(6,193,103,0.18)"}`:"none"}}>
                    {done?"✓":active&&isDisputed?"⚠":i+1}
                  </div>
                  <div style={{marginTop:"6px",fontSize:"9px",fontWeight:700,
                    color:done||active?T.black:T.gray400,
                    textTransform:"uppercase",letterSpacing:"0.04em",
                    textAlign:"center",whiteSpace:"nowrap"}}>
                    {STEP_LABELS[i]}
                  </div>
                  {active&&!isDisputed&&(
                    <div style={{width:"5px",height:"5px",borderRadius:"50%",background:T.green,
                      marginTop:"3px",animation:"pulse 1.4s infinite"}}/>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── TAB BAR ── */}
      <div style={{display:"flex",borderBottom:`2px solid ${T.gray100}`,marginBottom:"16px"}}>
        {[["tracking","Tracking"],["details","Order Details"],["payment","Payment"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            style={{padding:"9px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:F,
              fontSize:"12px",fontWeight:activeTab===id?800:600,
              color:activeTab===id?T.black:T.gray400,
              borderBottom:`2px solid ${activeTab===id?T.black:"transparent"}`,
              marginBottom:"-2px",transition:"all 0.15s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ TAB: TRACKING ══ */}
      {activeTab==="tracking"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr",gap:"14px",alignItems:"start"}}>

          {/* LEFT: Status context + trucks */}
          <div>
            {/* Status context card */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="What's happening"/>
              {isTerminal?(
                <div style={{display:"flex",alignItems:"center",gap:"14px",padding:"8px 0"}}>
                  <div style={{width:"36px",height:"36px",borderRadius:"50%",background:liveStatus==="rejected"?"#FEF2F2":"#F5F5F5",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0,
                    border:`2px solid ${liveStatus==="rejected"?T.red:T.gray200}`}}>
                    {liveStatus==="rejected"?"✕":"—"}
                  </div>
                  <div>
                    <div style={{fontSize:"13px",fontWeight:800,color:liveStatus==="rejected"?T.red:T.gray600}}>
                      {liveStatus==="rejected"?"Order Rejected":"Order Cancelled"}
                    </div>
                    <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px",lineHeight:1.5}}>
                      {liveStatus==="rejected"
                        ?`${depotInfo.name||"The depot"} has rejected this order. Your escrowed payment will be refunded to your Ventryl wallet.`
                        :"This order has been cancelled. Any held funds will be returned to your wallet."}
                    </div>
                  </div>
                </div>
              ):isDisputed?(
                <div style={{display:"flex",alignItems:"center",gap:"14px",padding:"8px 0"}}>
                  <div style={{width:"36px",height:"36px",borderRadius:"50%",background:T.amberLight,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0,
                    border:"2px solid #D97706"}}>⚠</div>
                  <div>
                    <div style={{fontSize:"13px",fontWeight:800,color:"#D97706"}}>Dispute Under Review</div>
                    <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px",lineHeight:1.5}}>
                      A dispute has been filed on this order. Ventryl's team will review and resolve within 24–48 hours.
                    </div>
                  </div>
                </div>
              ):(
              <div style={{display:"flex",flexDirection:"column",gap:"0"}}>
                {(isPickup?[
                  {s:"pending",   icon:"🕐", label:"Order Placed",     done:currentStep>=0, active:currentStep===0,
                   detail:"Your order is with the depot. Confirmation expected within 2 hours."},
                  {s:"confirmed", icon:"✅", label:"Depot Confirmed",   done:currentStep>=1, active:currentStep===1,
                   detail:`${depotInfo.name||"Depot"} accepted the order. Bay ${meta.bay||"assigned"} · Loading ref: ${meta.loadingRef||"TBA"}.`},
                  {s:"loading",   icon:"⚙️", label:"Loading Products",  done:currentStep>=2, active:currentStep===2,
                   detail:`Products are being loaded at ${meta.bay||"loading bay"}. Proceed to the depot for collection.`},
                  {s:"collected", icon:"🏭", label:"Collected",         done:currentStep>=3, active:currentStep===3,
                   detail:"You have collected your products from the depot. Order complete."},
                ]:[
                  {s:"pending",   icon:"🕐", label:"Order Placed",     done:currentStep>=0, active:currentStep===0,
                   detail:"Your order is with the depot. Confirmation expected within 2 hours."},
                  {s:"confirmed", icon:"✅", label:"Depot Confirmed",   done:currentStep>=1, active:currentStep===1,
                   detail:`${depotInfo.name||"Depot"} accepted the order. Bay ${meta.bay||"assigned"} · Loading ref: ${meta.loadingRef||"TBA"}.`},
                  {s:"loading",   icon:"⚙️", label:"Loading Products",  done:currentStep>=2, active:currentStep===2,
                   detail:`Products are being loaded at ${meta.bay||"loading bay"}. Trucks depart once complete.`},
                  {s:"in_transit",icon:"🚛", label:"En Route",          done:currentStep>=3, active:currentStep===3,
                   detail:`${truckCount} truck${truckCount!==1?"s":""} dispatched. Lead truck ETA: ${meta.trucks_detail?.[0]?.eta||"—"}.`},
                  {s:"delivered", icon:"📦", label:"Delivered",         done:currentStep>=4, active:currentStep===4,
                   detail:deliveryConfirmed?"Receipt confirmed. Payment has been processed.":"Trucks have arrived. Please inspect and confirm receipt."},
                ]).map((step,i,arr)=>(
                  <div key={step.s} style={{display:"flex",gap:"12px",paddingBottom:i<arr.length-1?"16px":"0",position:"relative"}}>
                    {i<arr.length-1&&(
                      <div style={{position:"absolute",left:"15px",top:"32px",bottom:0,width:"2px",
                        background:step.done?T.green:T.gray100,transition:"background 0.4s"}}/>
                    )}
                    <div style={{width:"30px",height:"30px",borderRadius:"50%",flexShrink:0,
                      background:step.done?(step.active?T.black:T.green):T.gray100,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",
                      border:`2px solid ${step.done?T.green:T.gray200}`,
                      boxShadow:step.active?"0 0 0 4px rgba(6,193,103,0.15)":"none",
                      transition:"all 0.4s",zIndex:1}}>
                      {step.done&&!step.active?"✓":step.icon}
                    </div>
                    <div style={{flex:1,paddingTop:"4px"}}>
                      <div style={{fontSize:"12px",fontWeight:800,
                        color:step.done?T.black:T.gray400,marginBottom:"2px"}}>{step.label}</div>
                      {(step.done||step.active)&&(
                        <div style={{fontSize:"11px",color:T.gray600,lineHeight:1.5}}>{step.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </Card>

            {/* Truck tracking */}
            {liveTrucks.length>0&&(liveStatus==="loading"||liveStatus==="in_transit"||liveStatus==="delivered")&&(
              <Card style={{marginBottom:"14px"}}>
                <SectionHead title="Truck Tracking" sub={`${liveTrucks.length} truck${liveTrucks.length!==1?"s":`s`} · ${(vol/1000).toFixed(0)}k L total`}/>
                {liveTrucks.map((t,i)=>{
                  const tStatus=t.status;
                  const isDelivered=tStatus==="delivered";
                  const isMoving=tStatus==="in_transit";
                  const isLoading=liveStatus==="loading";
                  return (
                    <div key={t.id} style={{paddingTop:i>0?"14px":"0",marginTop:i>0?"14px":"0",
                      borderTop:i>0?`1px solid ${T.gray100}`:"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px",flexWrap:isMobile?"wrap":"nowrap"}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:"10px",flex:1}}>
                          <div style={{width:"36px",height:"36px",flexShrink:0,
                            background:isDelivered?T.greenLight:isMoving?T.blueLight:T.gray100,
                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>
                            🚛
                          </div>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px",flexWrap:"wrap"}}>
                              <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>Truck {i+1}</span>
                              <Badge status={isDelivered?"delivered":isLoading?"loading":tStatus}/>
                            </div>
                            <div style={{fontSize:"11px",color:T.gray600,marginBottom:"1px"}}>
                              {t.driver==="TBD"?"Driver: TBA":t.driver}
                            </div>
                            <div style={{fontSize:"10px",color:T.gray400}}>
                              {t.plate==="TBD"?"Plate: TBA":t.plate} · {(t.vol/1000).toFixed(0)}k L
                            </div>
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          {isDelivered?(
                            <div>
                              <div style={{fontSize:"11px",fontWeight:800,color:T.greenDark}}>✓ Arrived</div>
                              {t.arrivalTime&&<div style={{fontSize:"10px",color:T.gray400}}>{t.arrivalTime}</div>}
                            </div>
                          ):isMoving?(
                            <div>
                              <div style={{fontSize:"11px",fontWeight:800,color:T.blue}}>En Route</div>
                              <div style={{fontSize:"10px",color:T.gray400}}>ETA {t.eta}</div>
                            </div>
                          ):(
                            <div style={{fontSize:"10px",color:T.gray400}}>Departed {t.departure!=="TBD"?t.departure:"TBA"}</div>
                          )}
                        </div>
                      </div>
                      {(isMoving||isDelivered)&&(
                        <div style={{marginTop:"10px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                            <span style={{fontSize:"10px",color:T.gray400}}>
                              {isDelivered?"Delivered":"En route"}
                              {t.departure!=="TBD"&&!isDelivered?` · Departed ${t.departure}`:""}
                            </span>
                            <span style={{fontSize:"10px",fontWeight:800,color:isDelivered?T.greenDark:T.blue}}>{t.progress}%</span>
                          </div>
                          <div style={{height:"6px",background:T.gray100,borderRadius:"3px",overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${t.progress}%`,
                              background:isDelivered?T.green:T.blue,
                              borderRadius:"3px",transition:"width 0.6s ease"}}/>
                          </div>
                          {isMoving&&(
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:"3px"}}>
                              <span style={{fontSize:"9px",color:T.gray400}}>Departed</span>
                              <span style={{fontSize:"9px",color:T.gray400}}>ETA {t.eta}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}

            {/* Delivery confirmation card */}
            {liveStatus==="delivered"&&!deliveryConfirmed&&(
              <div style={{border:`2px solid ${T.green}`,background:T.greenLight,padding:"18px 20px",marginBottom:"14px"}}>
                <div style={{fontSize:"14px",fontWeight:800,color:T.greenDark,marginBottom:"6px"}}>📦 Delivery Complete — Action Required</div>
                <div style={{fontSize:"12px",color:T.greenDark,lineHeight:1.6,marginBottom:"14px"}}>
                  All trucks have arrived. Please inspect the delivery and confirm receipt. This releases payment to the depot.
                </div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <button onClick={()=>setShowConfirmModal(true)}
                    style={{background:T.green,color:T.white,border:"none",padding:"12px 24px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                    Confirm Receipt ✓
                  </button>
                  <button onClick={()=>setShowDispute(true)}
                    style={{background:"none",color:T.red,border:`2px solid ${T.red}`,padding:"12px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                    Issue with Delivery
                  </button>
                </div>
              </div>
            )}
            {liveStatus==="delivered"&&deliveryConfirmed&&(
              <div style={{background:T.greenLight,border:`1px solid ${T.green}`,padding:"14px 18px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"22px"}}>✅</span>
                <div>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.greenDark}}>Receipt Confirmed</div>
                  <div style={{fontSize:"11px",color:T.greenDark,marginTop:"2px"}}>
                    Payment of {fmtMoney((finials.productValue||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))} released to {depotInfo.name||"the depot"}.
                  </div>
                  {quoteStatus==="agreed"&&(
                    <div style={{fontSize:"10px",color:T.greenDark,marginTop:"2px",fontWeight:600,opacity:0.8}}>
                      Includes ₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()} delivery cost
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Depot info + timeline + actions */}
          <div>
            {/* Depot card */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Depot"/>
              <div style={{display:"flex",alignItems:"flex-start",gap:"12px",marginBottom:"12px"}}>
                <div style={{width:"40px",height:"40px",background:T.black,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",fontWeight:800,color:T.white,flexShrink:0}}>
                  {(depotInfo.name||order.depot||"D")[0]}
                </div>
                <div>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{depotInfo.name||order.depot}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{depotInfo.location||"—"}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{depotInfo.contact||"—"}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                {[["Loading Bay",meta.bay||"TBA"],["Loading Ref",meta.loadingRef||"TBA"],["Dispatch",meta.dispatchDate?meta.dispatchDate.split(" · ")[1]||"—":"TBA"],["ETA",meta.trucks_detail?.[0]?.eta||"TBA"]].map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"2px"}}>{l}</div>
                    <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Delivery location strip */}
            <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",gap:"8px",background:T.gray50}}>
                <span style={{fontSize:"14px"}}>{isDelivery?"🚛":"🏭"}</span>
                <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{isDelivery?"Delivery Location":"Self Pick-up"}</div>
                <span style={{marginLeft:"auto",fontSize:"9px",fontWeight:800,padding:"2px 7px",background:isDelivery?T.blueLight:T.amberLight,color:isDelivery?T.blue:"#8A5C00"}}>{isDelivery?"DELIVERY":"PICK-UP"}</span>
              </div>
              {isDelivery&&delivery?.state?(
                <div style={{padding:"12px 14px"}}>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.black,marginBottom:"3px"}}>{delivery.lga}, {delivery.state}</div>
                  <div style={{fontSize:"11px",color:T.gray600,lineHeight:1.4}}>{delivery.address}</div>
                </div>
              ):(
                <div style={{padding:"12px 14px"}}>
                  <div style={{fontSize:"12px",fontWeight:700,color:T.black,marginBottom:"2px"}}>{depotInfo.name||order.depot}</div>
                  <div style={{fontSize:"11px",color:T.gray400}}>{depotInfo.location||"—"} · You collect</div>
                </div>
              )}
            </Card>

            {/* Delivery cost negotiation card */}
            {isDelivery&&(liveStatus==="confirmed"||quoteStatus!=="none")&&(
              <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",gap:"8px",
                  background:quoteStatus==="agreed"?T.greenLight:quoteStatus==="buyer_pending"?"#12122A":quoteStatus==="depot_pending"?T.amberLight:T.gray50}}>
                  <span style={{fontSize:"14px"}}>💰</span>
                  <div style={{fontSize:"11px",fontWeight:800,color:quoteStatus==="agreed"?T.greenDark:quoteStatus==="buyer_pending"?T.white:T.black}}>Delivery Cost</div>
                  <span style={{marginLeft:"auto",fontSize:"9px",fontWeight:800,padding:"2px 7px",flexShrink:0,
                    background:quoteStatus==="agreed"?T.greenDark:quoteStatus==="buyer_pending"?T.green:quoteStatus==="depot_pending"?"#8A5C00":T.gray400,
                    color:T.white}}>
                    {quoteStatus==="agreed"?"AGREED":quoteStatus==="buyer_pending"?"REVIEW NOW":quoteStatus==="depot_pending"?"SENT":"PENDING"}
                  </span>
                </div>

                {quoteStatus==="none"&&(
                  <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:"10px"}}>
                    <span style={{fontSize:"18px"}}>⏳</span>
                    <div>
                      <div style={{fontSize:"11px",fontWeight:700,color:T.black}}>Awaiting delivery cost quote</div>
                      <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{depotInfo.name||order.depot} will send a quote shortly.</div>
                    </div>
                  </div>
                )}

                {quoteStatus==="buyer_pending"&&(
                  <div style={{padding:"14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>
                      {depotInfo.name||order.depot}'s Quote
                    </div>
                    <div style={{fontSize:"26px",fontWeight:800,color:T.black,marginBottom:"4px"}}>
                      ₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()}
                    </div>
                    <div style={{fontSize:"10px",color:T.gray400,fontWeight:600,marginBottom:"14px"}}>
                      Delivery to {delivery?.lga}, {delivery?.state} · Quoted {quoteRounds[quoteRounds.length-1]?.time||""}
                    </div>
                    <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:showCounterForm?"12px":"0"}}>
                      <button onClick={approveDeliveryQuote}
                        style={{flex:1,background:T.green,color:T.white,border:"none",padding:"11px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
                        Approve ✓
                      </button>
                      <button onClick={()=>setShowCounterForm(!showCounterForm)}
                        style={{flex:1,background:"none",color:T.black,border:`2px solid ${T.black}`,padding:"11px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
                        {showCounterForm?"Cancel":"Counter-offer"}
                      </button>
                    </div>
                    {showCounterForm&&(
                      <div>
                        <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>
                          Your Counter-offer (₦)
                        </div>
                        <div style={{display:"flex",gap:"8px"}}>
                          <div style={{position:"relative",flex:1}}>
                            <span style={{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",fontSize:"12px",fontWeight:700,color:T.gray400,pointerEvents:"none"}}>₦</span>
                            <input value={counterInput}
                              onChange={e=>setCounterInput(e.target.value.replace(/[^0-9]/g,""))}
                              placeholder="e.g. 350000" type="text"
                              style={{width:"100%",boxSizing:"border-box",paddingLeft:"24px",paddingRight:"10px",paddingTop:"10px",paddingBottom:"10px",border:`1px solid ${counterInput?T.black:T.gray200}`,fontFamily:F,fontSize:"14px",fontWeight:800,color:T.black,outline:"none"}}/>
                          </div>
                          <button disabled={!counterInput||parseInt(counterInput)<=0}
                            onClick={()=>sendCounterOffer(counterInput)}
                            style={{background:counterInput?T.black:T.gray200,color:counterInput?T.white:T.gray400,border:"none",padding:"0 14px",fontSize:"11px",fontWeight:800,cursor:counterInput?"pointer":"not-allowed",fontFamily:F,minHeight:"44px",whiteSpace:"nowrap"}}>
                            Send →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {quoteStatus==="depot_pending"&&(
                  <div style={{padding:"14px"}}>
                    <div style={{marginBottom:"10px"}}>
                      {quoteRounds.map((r,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.gray100}`,gap:"10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                            <span style={{fontSize:"9px",fontWeight:800,padding:"1px 6px",
                              background:r.from==="buyer"?T.greenDark:T.blue,color:T.white}}>
                              {r.from==="buyer"?"YOU":"DEPOT"}
                            </span>
                            <span style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>Round {i+1} · {r.time}</span>
                          </div>
                          <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>₦{(r.amount||0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"10px 12px",fontSize:"10px",color:"#8A5C00",fontWeight:700}}>
                      ⏳ Counter-offer sent. Awaiting {depotInfo.name||order.depot}'s response.
                    </div>
                  </div>
                )}

                {quoteStatus==="agreed"&&(
                  <div style={{padding:"14px",display:"flex",alignItems:"center",gap:"12px"}}>
                    <span style={{fontSize:"22px"}}>✅</span>
                    <div>
                      <div style={{fontSize:"12px",fontWeight:800,color:T.greenDark}}>Delivery cost agreed</div>
                      <div style={{fontSize:"20px",fontWeight:800,color:T.greenDark,marginTop:"2px"}}>
                        ₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()}
                      </div>
                      <div style={{fontSize:"10px",color:T.greenDark,marginTop:"2px",fontWeight:600}}>
                        Agreed in {quoteRounds.length} round{quoteRounds.length!==1?"s":""}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Activity feed */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Activity Feed"/>
              {timeline.map((e,i)=>(
                <div key={i} style={{display:"flex",gap:"10px",paddingBottom:i<timeline.length-1?"12px":"0",position:"relative"}}>
                  {i<timeline.length-1&&<div style={{position:"absolute",left:"10px",top:"21px",bottom:0,width:"2px",background:T.gray100}}/>}
                  <div style={{width:"20px",height:"20px",borderRadius:"50%",flexShrink:0,zIndex:1,
                    background:e.actor==="buyer"?T.blueLight:e.actor==="depot"?T.greenLight:T.gray100,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"8px",fontWeight:800,
                    color:e.actor==="buyer"?T.blue:e.actor==="depot"?T.greenDark:T.gray400}}>
                    {e.actor==="buyer"?"B":e.actor==="depot"?"D":"S"}
                  </div>
                  <div style={{flex:1,paddingTop:"1px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:T.black,lineHeight:1.4}}>
                      {e.event||(e.from||e.to?(e.from?e.from+" → ":"")+e.to:e.note||"Status update")}
                    </div>
                    {e.note&&e.event===undefined&&<div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{e.note}</div>}
                    <div style={{fontSize:"9px",color:T.gray400,marginTop:"2px"}}>{e.time}</div>
                  </div>
                </div>
              ))}
            </Card>

            {/* Contact actions */}
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>setShowDispute(true)} style={{flex:1,background:"none",border:`2px solid ${T.red}`,color:T.red,padding:"11px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>⚠ Dispute</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: ORDER DETAILS ══ */}
      {activeTab==="details"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"14px"}}>
          <Card>
            <SectionHead title="Order Specifications"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px",marginBottom:isMulti?"14px":"0"}}>
              {[
                ["Order ID",order.id],
                ...(!isMulti?[
                  ["Product",<span style={{background:T.black,color:T.white,fontSize:"11px",fontWeight:800,padding:"2px 8px"}}>{product}</span>],
                  ["Volume",`${(vol/1000).toFixed(0)},000 L`],
                  ["Price / Litre",`₦${(meta.pricePerLitre||0).toLocaleString()}`],
                ]:[]),
                ["Trucks",`${truckCount} trucks`],
                ["Placed",meta.placed||order.placed||"—"],
                ["Confirmed",meta.confirmed||"—"],
                ["Dispatched",meta.dispatchDate||"—"],
              ].map(([l,v])=>(
                <div key={l}>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px"}}>{l}</div>
                  <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{v}</div>
                </div>
              ))}
            </div>
            {isMulti&&(
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"8px"}}>Products Ordered</div>
                <div style={{border:`1px solid ${T.gray100}`}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 60px",background:T.gray50,padding:"7px 12px",gap:"8px"}}>
                    {["Product","Volume","Price/L","Value"].map(h=><div key={h} style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
                  </div>
                  {meta.products.map((p,i)=>(
                    <div key={p.name} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 60px",padding:"10px 12px",gap:"8px",borderTop:`1px solid ${T.gray100}`,alignItems:"center"}}>
                      <div>
                        <span style={{background:T.black,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 7px",marginRight:"6px"}}>{p.name}</span>
                        <span style={{fontSize:"10px",color:T.gray400}}>{p.fullName}</span>
                      </div>
                      <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{(p.vol/1000).toFixed(0)}k L</div>
                      <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>₦{p.pricePerLitre?.toLocaleString()}</div>
                      <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{fmtMoney(p.value)}</div>
                    </div>
                  ))}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 60px",padding:"10px 12px",gap:"8px",borderTop:`2px solid ${T.black}`,background:T.gray50}}>
                    <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>Total</div>
                    <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{(vol/1000).toFixed(0)}k L</div>
                    <div/>
                    <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{fmtMoney(meta.value||order.value)}</div>
                  </div>
                </div>
              </div>
            )}
          </Card>
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontSize:"16px"}}>{isDelivery?"🚛":"🏭"}</span>
                <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{isDelivery?"Delivery Details":"Self Pick-up"}</div>
              </div>
              <span style={{fontSize:"9px",fontWeight:800,padding:"3px 8px",background:isDelivery?T.blueLight:T.amberLight,color:isDelivery?T.blue:"#8A5C00"}}>
                {isDelivery?"DELIVERY":"PICK-UP"}
              </span>
            </div>

            {isDelivery&&delivery?.state?(
              <>
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
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black,lineHeight:1.5}}>{delivery.address}</div>
                </div>
                <div style={{display:"grid",gap:"0"}}>
                  {[
                    ["From",`${depotInfo.name||order.depot} · ${depotInfo.location||"—"}`],
                    ["Loading Bay",meta.bay||"TBA"],
                    ["Loading Ref",meta.loadingRef||"TBA"],
                    ["Depot Contact",depotInfo.contact||"—"],
                  ].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 16px",borderBottom:`1px solid ${T.gray100}`,gap:"12px"}}>
                      <span style={{fontSize:"11px",color:T.gray400,fontWeight:600,flexShrink:0}}>{l}</span>
                      <span style={{fontSize:"11px",fontWeight:700,color:T.black,textAlign:"right"}}>{v}</span>
                    </div>
                  ))}
                </div>
              </>
            ):(
              <div style={{display:"grid",gap:"0"}}>
                {[
                  ["Pick-up From",`${depotInfo.name||order.depot} · ${depotInfo.location||"—"}`],
                  ["Loading Bay",meta.bay||"TBA"],
                  ["Loading Ref",meta.loadingRef||"TBA"],
                  ["Depot Contact",depotInfo.contact||"—"],
                ].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 16px",borderBottom:`1px solid ${T.gray100}`,gap:"12px"}}>
                    <span style={{fontSize:"11px",color:T.gray400,fontWeight:600,flexShrink:0}}>{l}</span>
                    <span style={{fontSize:"11px",fontWeight:700,color:T.black,textAlign:"right"}}>{v}</span>
                  </div>
                ))}
                <div style={{padding:"10px 16px",background:T.amberLight,fontSize:"10px",color:"#8A5C00",fontWeight:700}}>
                  ⚠ Your trucks must arrive at the depot for loading. Bring your waybill and gate pass.
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ══ TAB: PAYMENT ══ */}
      {activeTab==="payment"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"14px"}}>
          <Card>
            <SectionHead title="Payment Breakdown"/>
            {isMulti&&(
              <div style={{marginBottom:"12px"}}>
                {meta.products.map(p=>(
                  <div key={p.name} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.gray100}`,alignItems:"center"}}>
                    <span style={{fontSize:"11px",color:T.gray600,fontWeight:600,display:"flex",alignItems:"center",gap:"6px"}}>
                      <span style={{background:T.gray100,color:T.black,fontSize:"9px",fontWeight:800,padding:"1px 6px"}}>{p.name}</span>
                      {(p.vol/1000).toFixed(0)}k L
                    </span>
                    <span style={{fontSize:"12px",fontWeight:700,color:T.black}}>{fmtMoney(p.value)}</span>
                  </div>
                ))}
              </div>
            )}
            {[
              ["Product Value",fmtMoney(finials.productValue),null],
              ...(quoteStatus==="agreed"?[["Delivery Cost",`+${fmtMoney(quoteRounds[quoteRounds.length-1]?.amount||0)}`,null]]:isDelivery?[["Delivery Cost","Pending negotiation","pending"]]:[] ),
              ["Platform Fee (1%)",`+${fmtMoney(finials.platformFee)}`,"sub"],
              [`VAT (${finials.productValue>0?((finials.vat/finials.productValue)*100).toFixed(1):7.5}%)`,`+${fmtMoney(finials.vat)}`,"sub"],
            ].map(([l,v,type])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.gray100}`,alignItems:"center"}}>
                <span style={{fontSize:type==="sub"?"11px":"12px",color:type==="sub"?T.gray400:type==="pending"?T.gray400:T.gray600,fontWeight:type==="sub"?600:700}}>{l}</span>
                <span style={{fontSize:type==="sub"?"11px":"12px",fontWeight:700,color:type==="sub"?T.gray400:type==="pending"?T.gray400:T.gray800}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0 0"}}>
              <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>Total Paid</span>
              <span style={{fontSize:"16px",fontWeight:800,color:T.black}}>
                {fmtMoney((finials.productValue||0)+(finials.platformFee||0)+(finials.vat||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))}
              </span>
            </div>
          </Card>
          <Card>
            <SectionHead title="Payment Status"/>
            <div style={{display:"grid",gap:"0"}}>
              {[["Method","Ventryl Pay"],["Reference",order.id],
                ["Status",finials.paymentStatus==="paid"?"Completed":finials.paymentStatus==="processing"?"Processing":"Pending"],
                ["Product Value",fmtMoney(finials.productValue)],
                ...( quoteStatus==="agreed"?[["Delivery Cost",fmtMoney(quoteRounds[quoteRounds.length-1]?.amount||0)]]:isDelivery?[["Delivery Cost","Pending"]]:[] ),
                ["Total",fmtMoney((finials.productValue||0)+(finials.platformFee||0)+(finials.vat||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))],
              ].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.gray100}`}}>
                  <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>{l}</span>
                  <span style={{fontSize:"12px",fontWeight:800,color:l==="Status"&&finials.paymentStatus==="paid"?T.greenDark:T.black}}>{v}</span>
                </div>
              ))}
            </div>
            {liveStatus==="delivered"&&!deliveryConfirmed&&(
              <button onClick={()=>setShowConfirmModal(true)} style={{marginTop:"16px",width:"100%",background:T.green,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                Confirm Receipt to Release Payment
              </button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export { BuyerOrderDetail, DisputeModal };
