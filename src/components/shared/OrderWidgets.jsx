import { useState, useEffect } from "react";
import { T, F } from "../../lib/tokens";
import { useAuthStore } from "../../store/authStore";
import { useVentrylStore } from "../../store/ventrylStore";
import { orders as ordersApi } from "../../lib/api";
import { Badge, Card } from "./index";

export function MarketPulseWidget({onOrder}) {
  const {marketDepots,loadMarketDepots}=useVentrylStore();
  useEffect(()=>{loadMarketDepots();},[]);
  const depotsSource=marketDepots||[];
  const PRODUCTS=[
    {key:"pms",  name:"PMS",  fullName:"Premium Motor Spirit", unit:"/L", color:T.green},
    {key:"ago",  name:"AGO",  fullName:"Automotive Gas Oil",   unit:"/L", color:T.blue},
    {key:"dpk",  name:"DPK",  fullName:"Dual Purpose Kerosene",unit:"/L", color:"#9B59B6"},
    {key:"lpg",  name:"LPG",  fullName:"Liquefied Petroleum Gas",unit:"/kg",color:T.amber},
    {key:"atk",  name:"ATK",  fullName:"Aviation Turbine Kerosene",unit:"/L",color:"#E67E22"},
  ];
  return (
    <Card style={{padding:0}}>
      <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Market Prices</div>
          <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{depotsSource.length} {depotsSource.length===1?"depot":"depots"} · {PRODUCTS.length} products</div>
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

export function OrderInboxPanel({incoming,isMobile,depot,onViewOrder}) {
  const {user:authUser}=useAuthStore();
  const {loadDepotOrders}=useVentrylStore();
  const [acting,setActing]=useState({});
  const [panelError,setPanelError]=useState(null);
  const pending=incoming.filter(o=>o.status==="pending");
  const confirmed=incoming.filter(o=>o.status==="confirmed");
  const ongoing=incoming.filter(o=>["confirmed","loading","in_transit","disputed"].includes(o.status));
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
  return (
    <Card style={{marginBottom:"14px"}} pad={false}>
      <div style={{padding:"14px 16px 0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>Order Inbox</span>
          {newCount>0&&<span style={{background:T.red,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 8px",letterSpacing:"0.04em"}}>{newCount} NEW</span>}
          {ongoing.length>0&&<span style={{background:T.blueLight,color:T.blue,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>{ongoing.length} ongoing</span>}
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
        {/* Ongoing orders (confirmed, loading, in_transit, disputed) */}
        {ongoing.length>0&&(
          <div style={{marginTop:pending.length>0?"8px":"0"}}>
            {pending.length>0&&ongoing.length>0&&(
              <div style={{fontSize:"10px",fontWeight:800,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px",marginTop:"6px"}}>Ongoing ({ongoing.length})</div>
            )}
            {ongoing.map(o=>(
              <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
                style={{border:`1px solid ${o.status==="disputed"?T.amber:T.gray100}`,background:T.white,padding:"12px 16px",marginBottom:"8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",flexWrap:"wrap",cursor:onViewOrder?"pointer":"default"}}
                onMouseEnter={e=>{if(onViewOrder){e.currentTarget.style.borderColor=T.black;e.currentTarget.style.background=T.gray50;}}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=o.status==="disputed"?T.amber:T.gray100;e.currentTarget.style.background=T.white;}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px"}}>
                    <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</span>
                    <Badge status={o.status}/>
                  </div>
                  <div style={{fontSize:"11px",color:T.gray400}}>{o.buyer} · {o.product} · {(o.vol/1000).toFixed(0)}k L · ₦{(o.value||0).toLocaleString('en-NG')}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{fontSize:"10px",fontWeight:700,color:T.gray400}}>{o.submitted}</span>
                  {onViewOrder&&<span style={{fontSize:"10px",fontWeight:800,color:T.black}}>Manage →</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {pending.length===0&&ongoing.length===0&&(
          <div style={{fontSize:"12px",color:T.gray400,padding:"12px 0",textAlign:"center"}}>No pending orders. New orders will appear here.</div>
        )}
      </div>
    </Card>
  );
}
