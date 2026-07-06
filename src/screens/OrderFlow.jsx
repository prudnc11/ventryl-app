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

function OrderFlow({onDone,isMobile}) {
  const {user:authUser}=useAuthStore();
  const {loadBuyerOrders,marketDepots,marketDepotsLoaded,loadMarketDepots,walletNGN,loadWallet}=useVentrylStore();
  useEffect(()=>{loadMarketDepots();},[]);
  useEffect(()=>{if(authUser?.id&&!walletNGN)loadWallet(authUser.id);},[authUser?.id]);
  const [step,setStep]=useState(1);
  const [sel,setSel]=useState(null);
  const [done,setDone]=useState(false);
  const [submittedId,setSubmittedId]=useState(null);
  const [submitting,setSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState(null);
  const [deliveryMode,setDeliveryMode]=useState("delivery"); // "delivery" | "pickup"
  const [pickupNote,setPickupNote]=useState("");
  const [deliveryState,setDeliveryState]=useState("");
  const [deliveryLGA,setDeliveryLGA]=useState("");
  const [deliveryAddress,setDeliveryAddress]=useState("");
  const lgasForState=deliveryState?NG_STATES[deliveryState]||[]:[];

  const MIN_VOL=11000;
  const VOL_PRESETS=[11000,22000,33000,44000,66000];

  // products: { PMS: {enabled,vol,price,isCustom}, ... } — only products the depot has active
  const initProducts=(depot)=>{
    const ps={};
    const pairs=[["PMS",depot.pms],["AGO",depot.ago],["DPK",depot.dpk],["LPG",depot.lpg],["ATK",depot.atk]];
    pairs.forEach(([name,price],i)=>{
      if(price) ps[name]={enabled:i===0,vol:MIN_VOL,price,isCustom:false};
    });
    if(Object.keys(ps).length>0&&!Object.values(ps).some(p=>p.enabled)){
      Object.values(ps)[0].enabled=true;
    }
    return ps;
  };
  const [products,setProducts]=useState({});

  const toggleProduct=(name)=>setProducts(p=>({...p,[name]:{...p[name],enabled:!p[name].enabled}}));
  const setVol=(name,v)=>setProducts(p=>({...p,[name]:{...p[name],vol:Math.max(MIN_VOL,Number(v)||MIN_VOL)}}));
  const setCustomMode=(name,on)=>setProducts(p=>({...p,[name]:{...p[name],isCustom:on}}));

  const enabledProducts=Object.entries(products).filter(([,p])=>p.enabled);
  const totalTrucks=enabledProducts.reduce((s,[,p])=>s+Math.ceil(p.vol/33000),0);
  const totalValue=enabledProducts.reduce((s,[,p])=>s+(p.price*p.vol),0);
  const deliveryLocationComplete=deliveryMode==="pickup"||(deliveryState&&deliveryLGA&&deliveryAddress.trim());
  const canProceed=sel&&enabledProducts.length>0&&deliveryLocationComplete;

  const handleSelectDepot=(d)=>{
    setSel(d);
    setProducts(initProducts(d));
  };

  if(done) return (
    <div style={{maxWidth:"440px",margin:"32px auto",textAlign:"center",padding:"0 16px"}}>
      <div style={{width:"56px",height:"56px",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",fontSize:"24px"}}>✓</div>
      <div style={{fontSize:"20px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Order Submitted</div>
      <div style={{fontSize:"13px",color:T.gray400,marginBottom:"24px"}}>{sel?.name} will confirm within 2 hours.</div>
      <div style={{border:`1px solid ${T.gray100}`,marginBottom:"18px",textAlign:"left"}}>
        {[
          ["Order ID",submittedId||"—"],
          ["Depot",sel?.name],
          ["Products",enabledProducts.map(([n])=>n).join(" + ")],
          ["Delivery Method",deliveryMode==="delivery"?"🚛 Delivery":"🏭 Self Pick-up"],
          ...(deliveryMode==="delivery"?[
            ["Delivery Address",`${deliveryAddress}, ${deliveryLGA}, ${deliveryState}`],
            ["Est. Arrival",`${sel?.eta} after dispatch`],
          ]:[
            ["Pick-up From",sel?.location],
          ]),
          ["Total Trucks",`${totalTrucks} tanker${totalTrucks!==1?"s":""}`],
          ["Total Value",`₦${totalValue.toLocaleString()}`],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:`1px solid ${T.gray100}`,fontSize:"13px",gap:"12px"}}>
            <span style={{color:T.gray400,fontWeight:600,flexShrink:0}}>{k}</span>
            <span style={{color:k==="Delivery Method"?(deliveryMode==="delivery"?T.greenDark:T.blue):T.black,fontWeight:800,textAlign:"right"}}>{v}</span>
          </div>
        ))}
        {enabledProducts.map(([name,p])=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px",background:T.gray50}}>
            <span style={{color:T.gray600,fontWeight:700}}>{name} · {(p.vol/1000).toFixed(0)}k L · {Math.ceil(p.vol/33000)} trucks</span>
            <span style={{color:T.black,fontWeight:800}}>₦{(p.price*p.vol).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <button onClick={onDone} style={{background:T.black,color:T.white,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%"}}>Back to Dashboard</button>
    </div>
  );

  const stepLabels=["Depot","Products","Review"];
  return (
    <div style={{maxWidth:"680px",margin:"0 auto",padding:isMobile?"0":"0 8px"}}>
      {/* Step indicator */}
      <div style={{display:"flex",alignItems:"center",marginBottom:"28px"}}>
        {stepLabels.map((s,i,arr)=>(
          <div key={s} style={{display:"flex",alignItems:"center",flex:i<arr.length-1?"1":"0"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px",whiteSpace:"nowrap"}}>
              <div style={{width:"24px",height:"24px",borderRadius:"50%",background:step>i+1?T.green:step===i+1?T.black:T.gray200,color:step>=i+1?T.white:T.gray400,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:800,flexShrink:0,transition:"all 0.2s"}}>{step>i+1?"✓":i+1}</div>
              {!isMobile&&<span style={{fontSize:"12px",fontWeight:700,color:step===i+1?T.black:T.gray400}}>{s}</span>}
            </div>
            {i<arr.length-1&&<div style={{flex:1,height:"2px",background:step>i+1?T.green:T.gray200,margin:"0 8px",transition:"background 0.2s"}}/>}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Choose Depot ── */}
      {step===1&&(
        <div>
          <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"14px"}}>Choose a Depot</div>
          {marketDepotsLoaded&&marketDepots.length===0&&<div style={{padding:"32px",textAlign:"center",fontSize:"13px",color:T.gray400}}>No depots with available stock right now. Check back soon.</div>}
          {[...(marketDepots||[])]
            .filter(d=>(d.pms||d.ago||d.dpk||d.lpg||d.atk)&&(d.stock??1)>0)
            .sort((a,b)=>(a.pms||a.ago||a.dpk||a.lpg||a.atk||9999)-(b.pms||b.ago||b.dpk||b.lpg||b.atk||9999))
            .map((d,i)=>(
            <div key={d.id} role="button" tabIndex={0} aria-pressed={sel?.id===d.id}
              onClick={()=>handleSelectDepot(d)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")handleSelectDepot(d);}}
              style={{border:`2px solid ${sel?.id===d.id?T.green:T.gray100}`,background:T.white,padding:"16px",cursor:"pointer",marginBottom:"10px",transition:"border-color 0.15s"}}
              onMouseEnter={e=>{if(sel?.id!==d.id)e.currentTarget.style.borderColor=T.gray400}}
              onMouseLeave={e=>{if(sel?.id!==d.id)e.currentTarget.style.borderColor=T.gray100}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:"12px"}}>
                  <div style={{width:"30px",height:"30px",background:i===0?T.green:T.gray100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:800,color:i===0?T.white:T.gray600,flexShrink:0,marginTop:"2px"}}>{i+1}</div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{d.name}</span>
                      {i===0&&<span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:800,padding:"2px 6px"}}>BEST PRICE</span>}
                    </div>
                    <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{d.location} · ETA {d.eta} · ★{d.rating} · {d.slots} slots</div>
                    <div style={{display:"flex",gap:"8px",marginTop:"8px",flexWrap:"wrap"}}>
                      {[["PMS",d.pms],["AGO",d.ago],["DPK",d.dpk],["LPG",d.lpg],["ATK",d.atk]].filter(([,p])=>p).map(([name,price])=>(
                        <span key={name} style={{background:T.gray100,color:T.black,fontSize:"10px",fontWeight:800,padding:"3px 8px"}}>{name} ₦{price}/L</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                  {sel?.id===d.id&&<span style={{fontSize:"18px",color:T.green}}>✓</span>}
                </div>
              </div>
            </div>
          ))}
          <button disabled={!sel} onClick={()=>setStep(2)} style={{background:sel?T.black:T.gray200,color:sel?T.white:T.gray400,border:"none",padding:"14px",fontSize:"13px",fontWeight:800,cursor:sel?"pointer":"not-allowed",fontFamily:F,width:"100%",marginTop:"8px",minHeight:"48px"}}>
            Continue with {sel?.name||"a depot"} →
          </button>
        </div>
      )}

      {/* ── STEP 2: Configure Products ── */}
      {step===2&&(
        <div>
          <button onClick={()=>setStep(1)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"16px",padding:0}}>← Back</button>
          <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Select Products & Volumes</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>{sel.name} · {sel.location}</div>

          {Object.entries(products).map(([name,p])=>(
            <div key={name} style={{border:`2px solid ${p.enabled?T.black:T.gray100}`,background:T.white,padding:"18px",marginBottom:"12px",transition:"border-color 0.15s"}}>
              {/* Product header row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:p.enabled?"16px":"0"}}>
                <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                  <button onClick={()=>toggleProduct(name)} style={{width:"20px",height:"20px",background:p.enabled?T.black:T.white,border:`2px solid ${p.enabled?T.black:T.gray400}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,padding:0}}>
                    {p.enabled&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </button>
                  <div>
                    <span style={{fontSize:"15px",fontWeight:800,color:T.black}}>{name}</span>
                    <span style={{fontSize:"12px",color:T.gray400,marginLeft:"8px"}}>₦{p.price.toLocaleString()}/L</span>
                  </div>
                </div>
                {p.enabled&&<div style={{textAlign:"right"}}>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>₦{(p.price*p.vol).toLocaleString('en-NG')}</div>
                  <div style={{fontSize:"10px",color:T.gray400}}>{p.vol.toLocaleString()} L · {Math.ceil(p.vol/33000)} truck{Math.ceil(p.vol/33000)!==1?"s":""}</div>
                </div>}
              </div>

              {/* Volume controls (visible when enabled) */}
              {p.enabled&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"10px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em"}}>Volume (Litres)</div>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{p.vol.toLocaleString()} L</span>
                      <span style={{fontSize:"10px",color:T.gray400,marginLeft:"6px"}}>{Math.ceil(p.vol/33000)} truck{Math.ceil(p.vol/33000)!==1?"s":""}</span>
                    </div>
                  </div>
                  {/* Preset buttons */}
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {VOL_PRESETS.map(v=>{
                      const active=!p.isCustom&&p.vol===v;
                      return (
                        <button key={v} onClick={()=>{setCustomMode(name,false);setVol(name,v);}}
                          style={{padding:"6px 12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,
                            background:active?T.black:"#fff",color:active?T.white:T.gray600,
                            border:`1px solid ${active?T.black:T.gray200}`,minHeight:"32px"}}>
                          {v.toLocaleString()}
                        </button>
                      );
                    })}
                    <button onClick={()=>setCustomMode(name,true)}
                      style={{padding:"6px 12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,
                        background:p.isCustom?T.black:"#fff",color:p.isCustom?T.white:T.gray600,
                        border:`1px solid ${p.isCustom?T.black:T.gray200}`,minHeight:"32px"}}>
                      Custom
                    </button>
                  </div>
                  {/* Custom liter input */}
                  {p.isCustom&&(
                    <div style={{marginTop:"10px",display:"flex",alignItems:"center",gap:"8px"}}>
                      <input type="number" min={MIN_VOL} step={1000}
                        defaultValue={p.vol}
                        onChange={e=>setVol(name,e.target.value)}
                        placeholder={`Min ${MIN_VOL.toLocaleString()} L`}
                        style={{flex:1,border:`1px solid ${T.gray200}`,padding:"8px 10px",fontSize:"13px",fontWeight:700,fontFamily:F,outline:"none",minWidth:0}}
                        onFocus={e=>e.target.style.borderColor=T.black}
                        onBlur={e=>{e.target.style.borderColor=T.gray200;if(Number(e.target.value)<MIN_VOL)setVol(name,MIN_VOL);}}
                      />
                      <span style={{fontSize:"11px",color:T.gray400,whiteSpace:"nowrap"}}>litres</span>
                    </div>
                  )}
                  <div style={{fontSize:"10px",color:T.gray400,marginTop:"6px"}}>Minimum order: {MIN_VOL.toLocaleString()} L</div>
                </div>
              )}
            </div>
          ))}

          {/* ── Delivery Method ── */}
          {enabledProducts.length>0&&(
            <div style={{marginBottom:"16px"}}>
              <div style={{fontSize:"12px",fontWeight:800,color:T.black,marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.04em"}}>Delivery Method</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                {[
                  {id:"delivery", icon:"🚛", title:"Delivery", sub:"Depot dispatches trucks to your location"},
                  {id:"pickup",   icon:"🏭", title:"Self Pick-up", sub:"You collect from the depot with your own trucks"},
                ].map(opt=>{
                  const active=deliveryMode===opt.id;
                  return (
                    <div key={opt.id} role="button" tabIndex={0} aria-pressed={active}
                      onClick={()=>setDeliveryMode(opt.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setDeliveryMode(opt.id);}}
                      style={{border:`2px solid ${active?T.black:T.gray200}`,background:active?T.black:T.white,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s"}}>
                      <div style={{fontSize:"22px",marginBottom:"6px",lineHeight:1}}>{opt.icon}</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:active?T.white:T.black,marginBottom:"3px"}}>{opt.title}</div>
                      <div style={{fontSize:"10px",color:active?T.gray400:"#999",lineHeight:1.4}}>{opt.sub}</div>
                      {active&&(
                        <div style={{marginTop:"8px",display:"inline-flex",alignItems:"center",gap:"4px",background:T.green,padding:"2px 8px"}}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={T.black} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{fontSize:"9px",fontWeight:800,color:T.black}}>SELECTED</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Delivery — location form */}
              {deliveryMode==="delivery"&&(
                <div style={{border:`1px solid ${T.gray100}`,marginTop:"10px"}}>
                  <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.gray100}`,background:T.gray50,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
                    <div>
                      <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>Delivery Location</div>
                      <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>Trucks will be dispatched to this address</div>
                    </div>
                    {deliveryState&&deliveryLGA&&deliveryAddress.trim()&&(
                      <span style={{background:T.greenLight,color:T.greenDark,fontSize:"10px",fontWeight:800,padding:"3px 8px"}}>✓ Location set</span>
                    )}
                  </div>
                  <div style={{padding:"14px"}}>
                    {/* State */}
                    <div style={{marginBottom:"12px"}}>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>State <span style={{color:T.red}}>*</span></div>
                      <select value={deliveryState} onChange={e=>{setDeliveryState(e.target.value);setDeliveryLGA("");}}
                        style={{width:"100%",border:`1px solid ${deliveryState?T.gray200:T.amber}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:deliveryState?T.black:T.gray400,background:T.white,outline:"none",cursor:"pointer",appearance:"auto"}}>
                        <option value="">Select state…</option>
                        {Object.keys(NG_STATES).sort().map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {/* LGA */}
                    <div style={{marginBottom:"12px"}}>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>LGA <span style={{color:T.red}}>*</span></div>
                      <select value={deliveryLGA} onChange={e=>setDeliveryLGA(e.target.value)}
                        disabled={!deliveryState}
                        style={{width:"100%",border:`1px solid ${deliveryLGA?T.gray200:deliveryState?T.amber:T.gray100}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:deliveryLGA?T.black:T.gray400,background:deliveryState?T.white:T.gray50,outline:"none",cursor:deliveryState?"pointer":"not-allowed",appearance:"auto",opacity:deliveryState?1:0.6}}>
                        <option value="">{deliveryState?"Select LGA…":"Select state first"}</option>
                        {lgasForState.map(l=><option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    {/* Address */}
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Street Address <span style={{color:T.red}}>*</span></div>
                      <textarea value={deliveryAddress} onChange={e=>setDeliveryAddress(e.target.value)}
                        placeholder="e.g. 14 Apapa Road, beside Total filling station"
                        rows={2}
                        style={{width:"100%",border:`1px solid ${deliveryAddress.trim()?T.gray200:deliveryLGA?T.amber:T.gray100}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",color:T.black,outline:"none",resize:"none",boxSizing:"border-box",opacity:deliveryLGA?1:0.6}}
                        disabled={!deliveryLGA}/>
                      {deliveryState&&deliveryLGA&&!deliveryAddress.trim()&&(
                        <div style={{fontSize:"10px",color:T.amber,fontWeight:600,marginTop:"4px"}}>Enter your street address to continue</div>
                      )}
                    </div>
                    {/* ETA strip when complete */}
                    {deliveryState&&deliveryLGA&&deliveryAddress.trim()&&(
                      <div style={{marginTop:"12px",background:T.black,padding:"10px 14px",display:"flex",gap:"24px",flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Delivering to</div>
                          <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>{deliveryLGA}, {deliveryState}</div>
                        </div>
                        <div>
                          <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Est. arrival</div>
                          <div style={{fontSize:"12px",fontWeight:800,color:T.green}}>{sel?.eta||"4–6h"} after dispatch</div>
                        </div>
                        <div>
                          <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Trucks</div>
                          <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>{totalTrucks} tanker{totalTrucks!==1?"s":""}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Self pick-up — show depot address + truck note */}
              {deliveryMode==="pickup"&&(
                <div style={{border:`1px solid ${T.gray100}`,marginTop:"10px"}}>
                  <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.gray100}`,display:"flex",gap:"16px",flexWrap:"wrap",background:T.gray50}}>
                    <div>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Pick-up Location</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{sel?.location||"Depot Address"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Available Slots</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{sel?.slots||"—"} loading bays</div>
                    </div>
                    <div>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Trucks Required</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{totalTrucks} × 33k L tankers</div>
                    </div>
                  </div>
                  <div style={{padding:"12px 14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Your Truck Details (optional)</div>
                    <textarea value={pickupNote} onChange={e=>setPickupNote(e.target.value)}
                      placeholder={`e.g. 3 trucks · Plate: LSD-123-AA, LSD-456-BB, LSD-789-CC`}
                      rows={2}
                      style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
                    <div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>Your truck details will be shared with the depot for gate clearance.</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Order summary strip */}
          {enabledProducts.length>0&&(
            <div style={{background:T.black,padding:"16px 18px",marginBottom:"16px"}}>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(enabledProducts.length+2,4)},1fr)`,gap:"12px",marginBottom:"10px"}}>
                {enabledProducts.map(([name,p])=>(
                  <div key={name}>
                    <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>{name}</div>
                    <div style={{fontSize:"16px",fontWeight:800,color:T.white}}>{p.vol.toLocaleString()} L</div>
                  </div>
                ))}
                <div>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>{deliveryMode==="pickup"?"Your Trucks":"Depot Trucks"}</div>
                  <div style={{fontSize:"16px",fontWeight:800,color:T.white}}>{totalTrucks}</div>
                </div>
                <div>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Total</div>
                  <div style={{fontSize:"16px",fontWeight:800,color:T.green}}>₦{totalValue.toLocaleString('en-NG')}</div>
                </div>
              </div>
            </div>
          )}

          <button disabled={!canProceed} onClick={()=>setStep(3)} style={{background:canProceed?T.green:T.gray200,color:canProceed?T.white:T.gray400,border:"none",padding:"14px",fontSize:"13px",fontWeight:800,cursor:canProceed?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"48px"}}>
            Review Order →
          </button>
          {!enabledProducts.length&&<div style={{textAlign:"center",fontSize:"11px",color:T.gray400,marginTop:"8px"}}>Select at least one product to continue</div>}
        </div>
      )}

      {/* ── STEP 3: Review & Pay ── */}
      {step===3&&(
        <div>
          <button onClick={()=>setStep(2)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"16px"}}>Review & Pay</div>

          {/* Depot + Delivery summary */}
          <div style={{border:`1px solid ${T.gray100}`,background:T.white,marginBottom:"12px"}}>
            {[
              ["Depot",sel.name],
              ["Depot Location",sel.location],
              ["Delivery Method",deliveryMode==="delivery"?"🚛 Delivery":"🏭 Self Pick-up"],
              ...(deliveryMode==="delivery"?[
                ["Deliver to State",deliveryState],
                ["Deliver to LGA",deliveryLGA],
                ["Street Address",deliveryAddress],
                ["Est. Arrival",`${sel.eta} after dispatch`],
              ]:[
                ["Pick-up Address",sel.location],
                ["Your Trucks",`${totalTrucks} tanker${totalTrucks!==1?"s":""}`],
                ...(pickupNote?[["Truck Details",pickupNote]]:[]),
              ]),
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:`1px solid ${T.gray100}`,fontSize:"13px",gap:"12px"}}>
                <span style={{color:T.gray400,fontWeight:600,flexShrink:0}}>{k}</span>
                <span style={{color:k==="Delivery Method"?(deliveryMode==="delivery"?T.greenDark:T.blue):T.black,fontWeight:700,textAlign:"right"}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Products breakdown */}
          <div style={{border:`1px solid ${T.gray100}`,background:T.white,marginBottom:"12px"}}>
            <div style={{padding:"10px 18px",borderBottom:`1px solid ${T.gray100}`,fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em"}}>Products</div>
            {enabledProducts.map(([name,p])=>(
              <div key={name} style={{padding:"12px 18px",borderBottom:`1px solid ${T.gray100}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                  <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{name}</span>
                  <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>₦{(p.price*p.vol).toLocaleString()}</span>
                </div>
                <div style={{fontSize:"11px",color:T.gray400}}>{p.vol.toLocaleString()} L · ₦{p.price.toLocaleString()}/L · {Math.ceil(p.vol/33000)} truck{Math.ceil(p.vol/33000)!==1?"s":""}</div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"14px 18px",fontSize:"15px"}}>
              <span style={{fontWeight:800,color:T.black}}>Total</span>
              <span style={{fontWeight:800,color:T.black}}>₦{totalValue.toLocaleString()}</span>
            </div>
          </div>

          {/* Wallet */}
          {(()=>{
            const bal=walletNGN?.balanceNGN??null;
            const sufficient=bal===null||bal>=totalValue;
            return (
              <div style={{background:sufficient?T.greenLight:"#FEF2F2",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <div>
                  <div style={{fontSize:"10px",fontWeight:700,color:sufficient?T.greenDark:T.red,textTransform:"uppercase"}}>Wallet Balance</div>
                  <div style={{fontSize:"17px",fontWeight:800,color:sufficient?T.greenDark:T.red}}>
                    {bal!==null?`₦${bal.toLocaleString('en-NG')}`:"—"}
                  </div>
                </div>
                <div style={{fontSize:"12px",fontWeight:800,color:sufficient?T.greenDark:T.red}}>
                  {bal===null?"Loading…":sufficient?"✓ Sufficient":"⚠ Insufficient funds"}
                </div>
              </div>
            );
          })()}

          <div style={{background:T.gray50,border:`1px solid ${T.gray100}`,padding:"11px 14px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"16px"}}>{deliveryMode==="delivery"?"🚛":"🏭"}</span>
            <div>
              <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{deliveryMode==="delivery"?"Delivery selected":"Self Pick-up selected"}</div>
              <div style={{fontSize:"10px",color:T.gray400}}>{deliveryMode==="delivery"?`${totalTrucks} truck${totalTrucks!==1?"s":""} → ${deliveryLGA}, ${deliveryState}`:`You collect from ${sel.location}`}</div>
            </div>
          </div>
          {submitError&&<div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"10px 14px",marginBottom:"10px",fontSize:"12px",color:T.red,fontWeight:700}}>{submitError}</div>}
          <button onClick={async()=>{
            if(!authUser?.id){setSubmitError("You must be logged in to place an order.");return;}
            setSubmitting(true);setSubmitError(null);
            try{
              const orderId=await ordersApi.create({
                buyerId:authUser.id,
                depotId:sel.id,
                deliveryMode,
                deliveryState:deliveryMode==="delivery"?deliveryState:null,
                deliveryLga:deliveryMode==="delivery"?deliveryLGA:null,
                deliveryAddress:deliveryMode==="delivery"?deliveryAddress:null,
                pickupNote:deliveryMode==="pickup"?pickupNote:null,
                items:enabledProducts.map(([name,p])=>({product:name,volume:p.vol,pricePerLitre:p.price})),
              });
              await loadBuyerOrders(authUser.id);
              setSubmittedId(orderId);
              setDone(true);
            }catch(e){setSubmitError(e.message);}
            finally{setSubmitting(false);}
          }} disabled={submitting} style={{background:submitting?T.gray200:T.green,color:submitting?T.gray400:T.white,border:"none",padding:"14px",fontSize:"14px",fontWeight:800,cursor:submitting?"not-allowed":"pointer",fontFamily:F,width:"100%",minHeight:"48px"}}>
            {submitting?"Placing Order…":`Confirm & Pay ₦${totalValue.toLocaleString()}`}
          </button>
        </div>
      )}
    </div>
  );
}

export { OrderFlow };
