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

function BuyerMarketplace({onOrder,isMobile}) {
  const [sort,setSort]=useState("price");
  const {marketDepots,marketDepotsLoaded,loadMarketDepots}=useVentrylStore();
  useEffect(()=>{loadMarketDepots();},[]);
  const source=marketDepots||[];
  const hasAnyPrice=d=>d.pms!=null||d.ago!=null||d.dpk!=null||d.lpg!=null||d.atk!=null;
  const lowestPrice=d=>Math.min(...[d.pms,d.ago,d.dpk,d.lpg,d.atk].filter(v=>v!=null));
  const sorted=[...source].filter(hasAnyPrice).sort((a,b)=>sort==="price"?lowestPrice(a)-lowestPrice(b):sort==="rating"?b.rating-a.rating:b.stock-a.stock);

  const VerificationBadge=({d})=>{
    if(d.verificationStatus==="expired") return <span style={{background:"#FEF2F2",color:"#c0392b",fontSize:"9px",fontWeight:800,padding:"2px 6px"}}>VERIFICATION EXPIRED</span>;
    if(d.locationType==="stock_point") return <span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:700,padding:"2px 6px"}}>STOCK POINT ✓</span>;
    return <span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:700,padding:"2px 6px"}}>NMDPRA ✓</span>;
  };

  const OrderButton=({d,style:s})=>{
    if(d.verificationStatus==="expired") return(
      <div style={{...s,background:"#FEF2F2",color:"#c0392b",border:"1px solid #fca5a5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:800,fontFamily:F,cursor:"not-allowed"}}>
        Verification Expired
      </div>
    );
    return <button onClick={onOrder} style={{...s,background:T.black,color:T.white,border:"none",cursor:"pointer",fontFamily:F}}>Order →</button>;
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
        <div><div style={{fontSize:"14px",fontWeight:800,color:T.black}}>Depot Prices</div><div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{sorted.length} location{sorted.length!==1?"s":""} · verified</div></div>
        <div style={{display:"flex",gap:"6px"}}>
          {["price","rating","stock"].map(s=>(
            <button key={s} onClick={()=>setSort(s)} style={{background:sort===s?T.black:T.white,color:sort===s?T.white:T.gray600,border:`1px solid ${sort===s?T.black:T.gray200}`,padding:"5px 10px",fontSize:"10px",fontWeight:700,cursor:"pointer",fontFamily:F,borderRadius:"20px",textTransform:"capitalize"}}>{s}</button>
          ))}
        </div>
      </div>
      {sorted.map((d,i)=>(
        <div key={d.id} style={{border:`1px solid ${d.verificationStatus==="expired"?"#fca5a5":T.gray100}`,background:T.white,padding:"16px",marginBottom:"10px",opacity:d.verificationStatus==="expired"?0.75:1}}>
          {isMobile?(
            <>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"10px",gap:"10px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
                  {d.companyLogo?(
                    <img src={d.companyLogo} alt="" style={{width:"30px",height:"30px",objectFit:"contain",borderRadius:"4px",background:T.gray100,flexShrink:0}}/>
                  ):(
                    <div style={{width:"30px",height:"30px",background:i===0&&sort==="price"?T.green:T.gray100,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:800,color:i===0&&sort==="price"?T.white:T.gray600,flexShrink:0}}>{i+1}</div>
                  )}
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{d.name}</span>
                      {i===0&&sort==="price"&&d.verificationStatus!=="expired"&&<span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:800,padding:"1px 5px"}}>BEST</span>}
                    </div>
                    {d.companyName&&<div style={{fontSize:"10px",color:T.gray600,fontWeight:600}}>{d.companyName}{d.companyWebsite&&<>{" · "}<a href={d.companyWebsite} target="_blank" rel="noopener noreferrer" style={{color:T.blue||"#2563eb",textDecoration:"none",fontWeight:700}} onClick={e=>e.stopPropagation()}>Website ↗</a></>}</div>}
                    <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{d.location} · ★{d.rating} · {d.slots} slots</div>
                    <div style={{marginTop:"4px"}}><VerificationBadge d={d}/></div>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  {[["PMS",d.pms],["AGO",d.ago],["DPK",d.dpk],["LPG",d.lpg],["ATK",d.atk]].filter(([,v])=>v!=null).map(([label,price],pi)=>(
                    <div key={label} style={{fontSize:pi===0?"18px":"10px",fontWeight:pi===0?800:600,color:pi===0?(i===0&&sort==="price"?T.green:T.black):T.gray400}}>{pi===0?`₦${price.toLocaleString()}`:`${label} ₦${price.toLocaleString()}`}</div>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"3px"}}>Stock: {(d.stock/1000).toFixed(0)}k/{(d.cap/1000).toFixed(0)}k MT</div>
                  <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(d.stock/d.cap*100)}%`,background:T.green}}/></div>
                </div>
                <OrderButton d={d} style={{padding:"9px 16px",fontSize:"12px",fontWeight:800,minHeight:"40px",flexShrink:0}}/>
              </div>
            </>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
              {d.companyLogo?(
                <img src={d.companyLogo} alt="" style={{width:"36px",height:"36px",objectFit:"contain",borderRadius:"4px",background:T.gray100,flexShrink:0}}/>
              ):(
                <div style={{width:"36px",height:"36px",background:i===0&&sort==="price"?T.green:T.gray100,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:800,color:i===0&&sort==="price"?T.white:T.gray600,flexShrink:0}}>{i+1}</div>
              )}
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                  <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{d.name}</span>
                  <VerificationBadge d={d}/>
                </div>
                <div style={{fontSize:"11px",color:T.gray400}}>
                  {d.companyName&&<><span style={{color:T.gray600,fontWeight:600}}>{d.companyName}</span>{d.companyWebsite&&<>{" "}<a href={d.companyWebsite} target="_blank" rel="noopener noreferrer" style={{color:T.blue||"#2563eb",textDecoration:"none",fontSize:"10px",fontWeight:700}} onClick={e=>e.stopPropagation()}>↗</a></>} · </>}
                  {d.location} · ★{d.rating} ({d.orders} orders) · {d.slots} slots · ETA {d.eta}
                </div>
              </div>
              <div style={{display:"flex",gap:"16px",alignItems:"center"}}>
                {[["PMS",d.pms],["AGO",d.ago],["DPK",d.dpk],["LPG",d.lpg],["ATK",d.atk]].filter(([,v])=>v!=null).map(([label,price])=>(
                  <div key={label} style={{textAlign:"center"}}><div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>{label}</div><div style={{fontSize:"18px",fontWeight:800,color:T.black}}>₦{price.toLocaleString()}</div></div>
                ))}
                <div>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"4px"}}>Stock</div>
                  <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden",width:"70px"}}><div style={{height:"100%",width:`${Math.round(d.stock/d.cap*100)}%`,background:T.green}}/></div>
                  <div style={{fontSize:"9px",color:T.gray400,marginTop:"2px"}}>{(d.stock/1000).toFixed(0)}k/{(d.cap/1000).toFixed(0)}k MT</div>
                </div>
                <OrderButton d={d} style={{padding:"9px 16px",fontSize:"12px",fontWeight:800,minHeight:"40px"}}/>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export { BuyerMarketplace };
