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
import { DepotInbox } from "./DepotInbox";
import { TruckSched } from "./TruckSched";
import { BuyerNetwork } from "./BuyerNetwork";
import { DepotKYBView } from "./DepotKYBView";
import { SettingsModule } from "./SettingsModule";
import { OrderInboxPanel } from "../components/shared/OrderWidgets";

function DepotOverview({depot,onUpdateDepot,onViewOrder,isMobile}) {
  const {depotOrders,loadDepotOrders}=useVentrylStore();
  useEffect(()=>{if(depot?.id)loadDepotOrders(depot.id);},[depot?.id]);
  const products=depot.products||[];
  const totalStockValue=products.reduce((s,p)=>s+(p.stock*p.pricePerLitre),0);
  const totalStock=products.reduce((s,p)=>s+p.stock,0);
  const lowStock=products.filter(p=>p.threshold>0&&p.stock<p.threshold);
  const DEPOT_ORDERS=depotOrders[depot?.id]||[];
  return (
    <div>
      {/* Stock KPI strip */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":`repeat(${Math.max(products.length+2,3)},1fr)`,gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        <KpiCard label="Total Stock" value={totalStock>=1000?`${(totalStock/1000).toFixed(0)}k L`:`${totalStock} L`} sub={`${products.length} product${products.length!==1?"s":""}`}/>
        <KpiCard label="Stock Value" value={`₦${(totalStockValue||0).toLocaleString('en-NG')}`} sub="At current prices"/>
        {products.map(p=>{
          const isLow=p.threshold>0&&p.stock<p.threshold;
          return <KpiCard key={p.id} label={p.name} value={p.stock>=1000?`${(p.stock/1000).toFixed(0)}k L`:`${p.stock} L`} sub={`₦${p.pricePerLitre}/L`} alert={isLow}/>;
        })}
        <KpiCard label="Orders" value={String(DEPOT_ORDERS.length||0)} sub={`${DEPOT_ORDERS.filter(o=>o.status==="in_transit").length} in transit`}/>
      </div>

      {/* Low stock alert */}
      {lowStock.length>0&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"12px 16px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:"12px",fontWeight:800,color:T.red}}>Low Stock Alert</div>
            <div style={{fontSize:"11px",color:T.red,marginTop:"2px"}}>{lowStock.map(p=>`${p.name} (${(p.stock/1000).toFixed(0)}k L remaining)`).join(" · ")}</div>
          </div>
          <button style={{background:T.red,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"34px"}}>Manage Stock →</button>
        </div>
      )}

      {/* ① ORDER INBOX — top priority */}
      <OrderInboxPanel incoming={DEPOT_ORDERS} isMobile={isMobile} depot={depot} onViewOrder={onViewOrder}/>

      {/* ② STOCK LEVELS */}
      {products.length>0?(
        <Card style={{marginBottom:"14px"}}>
          <SectionHead title="Stock Levels" sub={`Capacity: ${depot.capacity>0?depot.capacity.toLocaleString()+" L":"Not set"}`}/>
          {products.map((p,i)=>{
            const pct=depot.capacity>0?Math.min((p.stock/depot.capacity)*100,100):0;
            const isLow=p.threshold>0&&p.stock<p.threshold;
            const color=isLow?T.red:pct>60?T.green:T.amber;
            return (
              <div key={p.id} style={{marginBottom:i<products.length-1?"16px":"0"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{background:T.black,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 7px"}}>{p.name}</span>
                    {isLow&&<span style={{background:T.redLight,color:T.red,fontSize:"9px",fontWeight:800,padding:"1px 5px"}}>LOW</span>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{p.stock>=1000?`${(p.stock/1000).toFixed(0)}k`:p.stock} L</span>
                    {depot.capacity>0&&<span style={{fontSize:"10px",color:T.gray400,marginLeft:"6px"}}>({pct.toFixed(0)}%)</span>}
                  </div>
                </div>
                <div style={{height:"8px",background:T.gray100,borderRadius:"4px",overflow:"hidden",position:"relative"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:"4px",transition:"width 0.3s"}}/>
                  {depot.capacity>0&&p.threshold>0&&(
                    <div style={{position:"absolute",top:0,bottom:0,left:`${(p.threshold/depot.capacity)*100}%`,width:"2px",background:"#8A5C00",opacity:0.6}}/>
                  )}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
                  <span style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>₦{p.pricePerLitre.toLocaleString()}/L</span>
                  {depot.capacity>0&&p.threshold>0&&<span style={{fontSize:"10px",color:"#8A5C00",fontWeight:600}}>Alert at {(p.threshold/1000).toFixed(0)}k L</span>}
                </div>
              </div>
            );
          })}
        </Card>
      ):(
        <div style={{border:`1px dashed ${T.gray200}`,padding:"28px",textAlign:"center",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:700,color:T.gray400,marginBottom:"4px"}}>No products configured</div>
          <div style={{fontSize:"11px",color:T.gray400}}>Go to the Inventory tab to add your first product.</div>
        </div>
      )}

      {/* ③ REVENUE + RECENT ORDERS */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.3fr 1fr",gap:"14px"}}>
        <Card>
          <SectionHead title="Revenue" sub="Lifetime orders"/>
          <div style={{padding:"20px 0",textAlign:"center"}}>
            <div style={{fontSize:"28px",fontWeight:800,color:T.green}}>{(()=>{const t=DEPOT_ORDERS.reduce((s,o)=>s+(o.value||0),0);return t>0?`₦${t.toLocaleString('en-NG')}`:"—";})()}</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"4px"}}>{DEPOT_ORDERS.length} total orders · {DEPOT_ORDERS.filter(o=>o.status==="delivered"||o.status==="collected").length} delivered</div>
          </div>
        </Card>
        <Card>
          <SectionHead title="Recent Orders" sub={DEPOT_ORDERS.length>0?`${DEPOT_ORDERS.length} orders`:"No orders yet"}/>
          {DEPOT_ORDERS.length>0?DEPOT_ORDERS.map((o,i)=>(
            <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
              style={{padding:"9px 0",borderBottom:i<DEPOT_ORDERS.length-1?`1px solid ${T.gray100}`:"none",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.gray50}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div><div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{o.buyer} · {o.product}</div></div>
                <Badge status={o.status}/>
              </div>
              <div style={{display:"flex",gap:"12px",marginTop:"4px"}}>
                <span style={{fontSize:"11px",color:T.gray600,fontWeight:700}}>{(o.vol/1000).toFixed(0)}k L</span>
                <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>₦{(o.value||0).toLocaleString('en-NG')}</span>
              </div>
            </div>
          )):(
            <div style={{fontSize:"12px",color:T.gray400,padding:"12px 0"}}>Orders will appear here once your depot goes live.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ProductCard({product,depot,onAddStock,onAdjustStock,onUpdatePrice,onUpdateThreshold,onRemove,isMobile}) {
  const [mode,setMode]=useState(null); // null | "add" | "adjust"
  const [addQty,setAddQty]=useState("");
  const [addRef,setAddRef]=useState("");
  const [adjQty,setAdjQty]=useState("");
  const [adjNote,setAdjNote]=useState("");
  const [editingPrice,setEditingPrice]=useState(false);
  const [tempPrice,setTempPrice]=useState(String(product.pricePerLitre));
  const [editingThreshold,setEditingThreshold]=useState(false);
  const [tempThreshold,setTempThreshold]=useState(String(product.threshold));
  const [confirmRemove,setConfirmRemove]=useState(false);

  const pct=depot.capacity>0?Math.min((product.stock/depot.capacity)*100,100):0;
  const isLow=product.threshold>0&&product.stock<product.threshold;
  const barColor=isLow?T.red:pct>60?T.green:T.amber;

  const submitAddStock=()=>{
    const qty=Number(addQty);
    if(!qty||qty<=0)return;
    onAddStock(product.id,qty,addRef||`DEL-${Date.now().toString().slice(-6)}`);
    setAddQty("");setAddRef("");setMode(null);
  };
  const submitAdjust=()=>{
    const qty=Number(adjQty);
    if(!qty)return;
    onAdjustStock(product.id,qty,adjNote);
    setAdjQty("");setAdjNote("");setMode(null);
  };

  return (
    <div style={{border:`1px solid ${isLow?T.red:T.gray100}`,background:T.white,marginBottom:"12px",transition:"border-color 0.2s"}}>
      {/* Header */}
      <div style={{padding:"16px",borderBottom:mode?`1px solid ${T.gray100}`:"none"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"14px",flexWrap:isMobile?"wrap":"nowrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{background:T.black,color:T.white,fontSize:"12px",fontWeight:800,padding:"4px 10px"}}>{product.name}</div>
            {isLow&&<span style={{background:T.redLight,color:T.red,fontSize:"9px",fontWeight:800,padding:"2px 6px"}}>LOW STOCK</span>}
          </div>
          <div style={{display:"flex",gap:"6px",flexShrink:0,flexWrap:"wrap"}}>
            <button onClick={()=>setMode(mode==="add"?null:"add")} style={{background:mode==="add"?T.black:T.white,color:mode==="add"?T.white:T.black,border:`1px solid ${T.black}`,padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>+ Add Stock</button>
            <button onClick={()=>setMode(mode==="adjust"?null:"adjust")} style={{background:mode==="adjust"?T.gray800:T.white,color:mode==="adjust"?T.white:T.gray600,border:`1px solid ${T.gray200}`,padding:"6px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Adjust</button>
            {!confirmRemove?(
              <button onClick={()=>setConfirmRemove(true)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"6px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>✕</button>
            ):(
              <div style={{display:"flex",gap:"4px"}}>
                <button onClick={()=>onRemove(product.id)} style={{background:T.red,color:T.white,border:"none",padding:"6px 10px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Remove</button>
                <button onClick={()=>setConfirmRemove(false)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"6px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Stock level */}
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
          <span style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em"}}>Current Stock</span>
          <span style={{fontSize:"13px",fontWeight:800,color:isLow?T.red:T.black}}>
            {product.stock>=1000?`${(product.stock/1000).toFixed(1)}k`:product.stock} L
            {depot.capacity>0&&<span style={{fontSize:"10px",fontWeight:600,color:T.gray400,marginLeft:"6px"}}>({pct.toFixed(0)}% of capacity)</span>}
          </span>
        </div>
        <div style={{height:"10px",background:T.gray100,borderRadius:"5px",overflow:"hidden",position:"relative",marginBottom:"10px"}}>
          <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:"5px",transition:"width 0.4s"}}/>
          {depot.capacity>0&&product.threshold>0&&(
            <div style={{position:"absolute",top:0,bottom:0,left:`${Math.min((product.threshold/depot.capacity)*100,100)}%`,width:"2px",background:"#8A5C00"}}/>
          )}
        </div>

        {/* Editable fields */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"12px"}}>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Price per Litre (₦)</div>
            {editingPrice?(
              <div style={{display:"flex",gap:"4px"}}>
                <input value={tempPrice} onChange={e=>setTempPrice(e.target.value)} type="number"
                  style={{flex:1,border:`1px solid ${T.black}`,padding:"7px 10px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                <button onClick={()=>{onUpdatePrice(product.id,Number(tempPrice));setEditingPrice(false);}} style={{background:T.black,color:T.white,border:"none",padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F}}>Save</button>
                <button onClick={()=>{setTempPrice(String(product.pricePerLitre));setEditingPrice(false);}} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.gray400,padding:"7px 10px",fontSize:"11px",cursor:"pointer",fontFamily:F}}>✕</button>
              </div>
            ):(
              <div onClick={()=>setEditingPrice(true)} style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",padding:"7px 10px",border:`1px solid ${T.gray100}`,background:T.gray50}}>
                <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>₦{product.pricePerLitre.toLocaleString()}</span>
                <span style={{fontSize:"10px",color:T.blue,fontWeight:700}}>Edit</span>
              </div>
            )}
          </div>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Low Stock Alert (L)</div>
            {editingThreshold?(
              <div style={{display:"flex",gap:"4px"}}>
                <input value={tempThreshold} onChange={e=>setTempThreshold(e.target.value)} type="number"
                  style={{flex:1,border:`1px solid ${T.black}`,padding:"7px 10px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                <button onClick={()=>{onUpdateThreshold(product.id,Number(tempThreshold));setEditingThreshold(false);}} style={{background:T.black,color:T.white,border:"none",padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F}}>Save</button>
                <button onClick={()=>{setTempThreshold(String(product.threshold));setEditingThreshold(false);}} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.gray400,padding:"7px 10px",fontSize:"11px",cursor:"pointer",fontFamily:F}}>✕</button>
              </div>
            ):(
              <div onClick={()=>setEditingThreshold(true)} style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",padding:"7px 10px",border:`1px solid ${T.gray100}`,background:T.gray50}}>
                <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{product.threshold>=1000?`${(product.threshold/1000).toFixed(0)}k`:product.threshold} L</span>
                <span style={{fontSize:"10px",color:T.blue,fontWeight:700}}>Edit</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Stock panel */}
      {mode==="add"&&(
        <div style={{padding:"16px",background:T.gray50,borderTop:`1px solid ${T.gray100}`}}>
          <div style={{fontSize:"12px",fontWeight:800,color:T.black,marginBottom:"12px"}}>Add Stock — {product.name}</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"10px",marginBottom:"12px"}}>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Quantity (Litres)</div>
              <input type="number" value={addQty} onChange={e=>setAddQty(e.target.value)} placeholder="e.g. 33000"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
            </div>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Delivery Reference</div>
              <input type="text" value={addRef} onChange={e=>setAddRef(e.target.value)} placeholder="e.g. DEL-2026-041"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
            </div>
          </div>
          {addQty&&Number(addQty)>0&&(
            <div style={{background:T.greenLight,padding:"8px 12px",marginBottom:"10px",fontSize:"11px",color:T.greenDark,fontWeight:700}}>
              New stock: {((product.stock+Number(addQty))/1000).toFixed(1)}k L  ·  Value: ₦{((product.stock+Number(addQty))*product.pricePerLitre).toLocaleString('en-NG')}
            </div>
          )}
          <div style={{display:"flex",gap:"8px"}}>
            <button disabled={!addQty||Number(addQty)<=0} onClick={submitAddStock} style={{background:addQty&&Number(addQty)>0?T.green:T.gray200,color:addQty&&Number(addQty)>0?T.white:T.gray400,border:"none",padding:"10px 20px",fontSize:"12px",fontWeight:800,cursor:addQty&&Number(addQty)>0?"pointer":"not-allowed",fontFamily:F,minHeight:"42px"}}>Confirm Receipt</button>
            <button onClick={()=>setMode(null)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"10px 16px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Adjust Stock panel */}
      {mode==="adjust"&&(
        <div style={{padding:"16px",background:"#FAFAFA",borderTop:`1px solid ${T.gray100}`}}>
          <div style={{fontSize:"12px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Manual Adjustment — {product.name}</div>
          <div style={{fontSize:"11px",color:T.gray400,marginBottom:"12px"}}>Use positive values to increase, negative to decrease.</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"10px",marginBottom:"12px"}}>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Quantity (±L)</div>
              <input type="number" value={adjQty} onChange={e=>setAdjQty(e.target.value)} placeholder="e.g. -500 or +2000"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
            </div>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Reason / Note</div>
              <input type="text" value={adjNote} onChange={e=>setAdjNote(e.target.value)} placeholder="e.g. Meter calibration"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button disabled={!adjQty||Number(adjQty)===0} onClick={submitAdjust} style={{background:adjQty&&Number(adjQty)!==0?T.black:T.gray200,color:adjQty&&Number(adjQty)!==0?T.white:T.gray400,border:"none",padding:"10px 20px",fontSize:"12px",fontWeight:800,cursor:adjQty&&Number(adjQty)!==0?"pointer":"not-allowed",fontFamily:F,minHeight:"42px"}}>Apply Adjustment</button>
            <button onClick={()=>setMode(null)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"10px 16px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DepotInventory({depot,onUpdateDepot,isMobile}) {
  const [showAdd,setShowAdd]=useState(false);
  const [newP,setNewP]=useState({name:"",price:"",threshold:"5000",initStock:""});
  const AVAIL=["PMS","AGO","DPK","LPG","ATK"].filter(n=>!(depot.products||[]).map(p=>p.name).includes(n));

  const handleAddStock=(productId,qty,ref)=>{
    if(!qty||qty<=0) return;
    const prod=(depot.products||[]).find(p=>p.id===productId);
    if(!prod) return;
    const newStock=prod.stock+qty;
    if(depot.capacity>0&&newStock>depot.capacity){
      alert(`Cannot exceed depot capacity (${depot.capacity.toLocaleString()} L). Current: ${prod.stock.toLocaleString()} L`);
      return;
    }
    const updated=(depot.products||[]).map(p=>p.id===productId?{...p,stock:newStock}:p);
    const hist=[{id:Date.now(),date:new Date().toLocaleDateString("en-NG"),product:prod.name,qty,type:"delivery",ref},...(depot.stockHistory||[])];
    onUpdateDepot(depot.id,{products:updated,stockHistory:hist});
  };
  const handleAdjustStock=(productId,qty,note)=>{
    const prod=(depot.products||[]).find(p=>p.id===productId);
    if(!prod) return;
    const updated=(depot.products||[]).map(p=>p.id===productId?{...p,stock:Math.max(0,p.stock+qty)}:p);
    const hist=[{id:Date.now(),date:new Date().toLocaleDateString("en-NG"),product:prod.name,qty,type:"adjustment",ref:note||"Manual adjustment"},...(depot.stockHistory||[])];
    onUpdateDepot(depot.id,{products:updated,stockHistory:hist});
  };
  const handleUpdatePrice=(productId,price)=>{
    const val=Number(price);
    if(isNaN(val)||val<0) return;
    const updated=(depot.products||[]).map(p=>p.id===productId?{...p,pricePerLitre:val}:p);
    onUpdateDepot(depot.id,{products:updated});
  };
  const handleUpdateThreshold=(productId,threshold)=>{
    const val=Number(threshold);
    if(isNaN(val)||val<0) return;
    const updated=(depot.products||[]).map(p=>p.id===productId?{...p,threshold:val}:p);
    onUpdateDepot(depot.id,{products:updated});
  };
  const handleRemove=(productId)=>{
    const updated=(depot.products||[]).filter(p=>p.id!==productId);
    onUpdateDepot(depot.id,{products:updated});
  };
  const handleAddProduct=()=>{
    if(!newP.name.trim())return;
    const product={id:newP.name.toLowerCase().replace(/[^a-z0-9]/g,"_")+"_"+Date.now(),name:newP.name.trim(),pricePerLitre:Number(newP.price)||0,stock:Number(newP.initStock)||0,threshold:Number(newP.threshold)||5000};
    const hist=Number(newP.initStock)>0?[{id:Date.now(),date:new Date().toLocaleDateString("en-NG"),product:product.name,qty:Number(newP.initStock),type:"delivery",ref:"Initial stock"},...(depot.stockHistory||[])]:(depot.stockHistory||[]);
    onUpdateDepot(depot.id,{products:[...(depot.products||[]),product],stockHistory:hist});
    setShowAdd(false);setNewP({name:"",price:"",threshold:"5000",initStock:""});
  };

  return (
    <div>
      <SectionHead title="Products & Stock"
        sub={`${(depot.products||[]).length} product${(depot.products||[]).length!==1?"s":""} · Capacity: ${depot.capacity>0?depot.capacity.toLocaleString()+" L":"Not set"}`}
        right={<button onClick={()=>setShowAdd(!showAdd)} style={{background:T.black,color:T.white,border:"none",padding:"8px 16px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>{showAdd?"Cancel":"+ Add Product"}</button>}/>

      {/* Add product form */}
      {showAdd&&(
        <div style={{border:`1px solid ${T.black}`,background:T.white,padding:"18px",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.black,marginBottom:"14px"}}>New Product</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Product Name</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"6px"}}>
                {AVAIL.map(n=>(
                  <button key={n} onClick={()=>setNewP(p=>({...p,name:n}))} style={{padding:"6px 12px",border:`2px solid ${newP.name===n?T.black:T.gray200}`,background:newP.name===n?T.black:T.white,color:newP.name===n?T.white:T.gray600,fontFamily:F,fontSize:"12px",fontWeight:800,cursor:"pointer"}}>{n}</button>
                ))}
              </div>
              <input value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))} placeholder="Or type custom name"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"8px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:"8px"}}>
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Price per Litre (₦)</div>
                <input type="number" value={newP.price} onChange={e=>setNewP(p=>({...p,price:e.target.value}))} placeholder="e.g. 795"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"8px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Initial Stock (L)</div>
                <input type="number" value={newP.initStock} onChange={e=>setNewP(p=>({...p,initStock:e.target.value}))} placeholder="e.g. 33000 (can be 0)"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"8px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Low Stock Alert (L)</div>
                <input type="number" value={newP.threshold} onChange={e=>setNewP(p=>({...p,threshold:e.target.value}))} placeholder="e.g. 5000"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"8px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button disabled={!newP.name.trim()} onClick={handleAddProduct} style={{background:newP.name.trim()?T.black:T.gray200,color:newP.name.trim()?T.white:T.gray400,border:"none",padding:"11px 20px",fontSize:"12px",fontWeight:800,cursor:newP.name.trim()?"pointer":"not-allowed",fontFamily:F,minHeight:"42px"}}>Add Product</button>
            <button onClick={()=>setShowAdd(false)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"11px 16px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Product cards */}
      {(depot.products||[]).length===0&&!showAdd?(
        <div style={{border:`1px dashed ${T.gray200}`,padding:"36px",textAlign:"center"}}>
          <div style={{fontSize:"14px",fontWeight:700,color:T.gray400,marginBottom:"8px"}}>No products added yet</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"16px"}}>Add the products your depot handles to manage stock and set prices.</div>
          <button onClick={()=>setShowAdd(true)} style={{background:T.black,color:T.white,border:"none",padding:"10px 20px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>+ Add First Product</button>
        </div>
      ):(depot.products||[]).map(p=>(
        <ProductCard key={p.id} product={p} depot={depot}
          onAddStock={handleAddStock} onAdjustStock={handleAdjustStock}
          onUpdatePrice={handleUpdatePrice} onUpdateThreshold={handleUpdateThreshold}
          onRemove={handleRemove} isMobile={isMobile}/>
      ))}

      {/* Stock history */}
      {(depot.stockHistory||[]).length>0&&(
        <Card style={{marginTop:"8px"}}>
          <SectionHead title="Stock Movement Log" sub="Deliveries, dispatches & adjustments"/>
          {(depot.stockHistory||[]).slice(0,20).map((h,i)=>(
            <div key={h.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<Math.min((depot.stockHistory||[]).length,20)-1?`1px solid ${T.gray100}`:"none",gap:"12px",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"28px",height:"28px",background:h.qty>0?T.greenLight:h.type==="adjustment"?T.blueLight:T.redLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",flexShrink:0,fontWeight:700,color:h.qty>0?T.greenDark:h.type==="adjustment"?T.blue:T.red}}>
                  {h.qty>0?"↓":h.type==="adjustment"?"⇄":"↑"}
                </div>
                <div>
                  <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>
                    {h.type==="delivery"?"Stock Received":h.type==="adjustment"?"Manual Adjustment":"Dispatched"}
                    <span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"1px 5px",marginLeft:"6px"}}>{h.product}</span>
                  </div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{h.ref} · {h.date}</div>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:"13px",fontWeight:800,color:h.qty>0?T.greenDark:h.type==="adjustment"?T.black:T.red}}>
                  {h.qty>0?"+":""}{Math.abs(h.qty)>=1000?`${(h.qty/1000).toFixed(0)}k`:h.qty} L
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function DepotDetailView({onViewOrder,isMobile}) {
  const { id } = useParams();
  const { depots, handleUpdateDepot: onUpdateDepot } = useDepotContext();
  const depot = depots.find(d => d.id === id) || null;
  const [tab,setTab]=useState("overview");
  const initialTabSet = useRef(false);
  useEffect(()=>{
    if(depot&&!initialTabSet.current){
      if(["pending","submitted","rejected"].includes(depot.kyb))setTab("kyb");
      initialTabSet.current=true;
    }
  },[depot]);
  const GEAR="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
  const {depotOrders}=useVentrylStore();

  if(!depot) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",fontFamily:F}}>
      <div style={{fontSize:"12px",fontWeight:700,color:T.gray400,letterSpacing:"0.08em",textTransform:"uppercase"}}>Loading depot…</div>
    </div>
  );

  const DEPOT_ORDERS=depotOrders[depot.id]||[];
  const ongoingCount=DEPOT_ORDERS.filter(o=>["pending","confirmed","loading","in_transit","disputed"].includes(o.status)).length;
  const lowStockCount=(depot.products||[]).filter(p=>p.threshold>0&&p.stock<p.threshold).length;
  const TABS=[
    {id:"overview",label:"Overview",icon:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"},
    {id:"inventory",label:"Inventory",icon:"M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",badge:lowStockCount||null,badgeColor:T.red},
    {id:"inbox",label:"Order Inbox",icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",badge:ongoingCount||null},
    {id:"schedule",label:"Schedule",icon:"M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"},
    {id:"buyers",label:"Buyers",icon:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"},
    {id:"kyb",label:"KYB",icon:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",alert:depot.kyb!=="verified"},
    {id:"settings",label:"Settings",icon:GEAR},
  ];
  const isLocked=depot.kyb!=="verified"&&tab!=="kyb"&&tab!=="settings"&&tab!=="overview"&&tab!=="inventory";
  return (
    <div>
      <div style={{background:T.black,padding:isMobile?"16px":"20px 24px",marginBottom:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
          <div>
            <div style={{fontSize:"9px",fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"4px"}}>Depot</div>
            <div style={{fontSize:isMobile?"18px":"22px",fontWeight:800,color:T.white}}>{depot.name}</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{depot.location}{depot.license?` · ${depot.license}`:""}</div>
            {(depot.products||[]).length>0&&<div style={{fontSize:"10px",color:"#666",marginTop:"4px"}}>{(depot.products||[]).map(p=>p.name).join(" · ")}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:isMobile?"flex-start":"flex-end",gap:"6px"}}>
            <Badge status={depot.kyb==="verified"?"delivered":depot.kyb==="rejected"?"rejected":depot.kyb==="submitted"?"submitted":"pending"}/>
            {depot.kyb==="verified"&&depot.capacity>0&&<div style={{fontSize:"10px",color:T.gray400}}>{depot.capacity.toLocaleString()} L capacity</div>}
            {(depot.products||[]).length>0&&<div style={{fontSize:"10px",color:T.gray400}}>{(depot.products||[]).reduce((s,p)=>s+p.stock,0).toLocaleString()} L in stock</div>}
          </div>
        </div>
      </div>
      {depot.kyb==="pending"&&(
        <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"11px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:"12px",fontWeight:800,color:"#8A5C00"}}>KYB Verification Pending</div>
            <div style={{fontSize:"11px",color:"#8A5C00",marginTop:"1px"}}>Submit documents to start receiving orders.</div>
          </div>
          <button onClick={()=>setTab("kyb")} style={{background:"#8A5C00",color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"36px"}}>Complete KYB →</button>
        </div>
      )}
      {depot.kyb==="submitted"&&(
        <div style={{background:T.blueLight,border:`1px solid ${T.blue}20`,padding:"11px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:"12px",fontWeight:800,color:T.blue}}>KYB Under Review</div>
            <div style={{fontSize:"11px",color:T.blue,marginTop:"1px",opacity:0.8}}>Documents submitted — Ventryl is reviewing your depot. Usually 1–3 business days.</div>
          </div>
          <button onClick={()=>setTab("kyb")} style={{background:T.blue,color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"36px"}}>View Status →</button>
        </div>
      )}
      {depot.kyb==="rejected"&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"11px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:"12px",fontWeight:800,color:T.red}}>KYB Application Rejected</div>
            <div style={{fontSize:"11px",color:T.red,marginTop:"1px",opacity:0.8}}>{depot.kybRejectionReason||"Review the reason on the KYB tab and re-submit."}</div>
          </div>
          <button onClick={()=>setTab("kyb")} style={{background:T.red,color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"36px"}}>View & Re-submit →</button>
        </div>
      )}
      {lowStockCount>0&&depot.kyb==="verified"&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"9px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:T.red}}>{lowStockCount} product{lowStockCount!==1?"s":""} below low-stock threshold — reorder soon.</div>
          <button onClick={()=>setTab("inventory")} style={{background:T.red,color:T.white,border:"none",padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"32px"}}>Manage →</button>
        </div>
      )}
      <div style={{display:"flex",borderBottom:`1px solid ${T.gray100}`,marginBottom:"20px",overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{display:"flex",alignItems:"center",gap:"5px",padding:"10px 14px",border:"none",background:"none",borderBottom:tab===t.id?`2px solid ${T.black}`:"2px solid transparent",color:tab===t.id?T.black:T.gray400,fontFamily:F,fontSize:"12px",fontWeight:tab===t.id?800:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            <Icon d={t.icon} size={13}/>
            {isMobile?t.label.split(" ")[0]:t.label}
            {t.badge&&<span style={{background:t.badgeColor||T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"1px 4px",borderRadius:"8px",marginLeft:"2px"}}>{t.badge}</span>}
            {t.alert&&<span style={{width:"6px",height:"6px",background:T.amber,borderRadius:"50%",display:"inline-block",marginLeft:"3px"}}/>}
          </button>
        ))}
      </div>
      {isLocked?(
        <div style={{textAlign:"center",padding:"48px 20px"}}>
          <div style={{fontSize:"36px",marginBottom:"12px"}}>🔒</div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Awaiting KYB Approval</div>
          <div style={{fontSize:"13px",color:T.gray400,marginBottom:"20px",maxWidth:"320px",margin:"0 auto 20px"}}>This section unlocks once your depot KYB is verified.</div>
          <button onClick={()=>setTab("kyb")} style={{background:T.black,color:T.white,border:"none",padding:"12px 24px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>Complete KYB →</button>
        </div>
      ):(
        <div>
          {tab==="overview"&&<DepotOverview depot={depot} onUpdateDepot={onUpdateDepot} onViewOrder={onViewOrder} isMobile={isMobile}/>}
          {tab==="inventory"&&<DepotInventory depot={depot} onUpdateDepot={onUpdateDepot} isMobile={isMobile}/>}
          {tab==="inbox"&&<DepotInbox depotId={depot?.id} isMobile={isMobile} onViewOrder={id=>onViewOrder&&onViewOrder(id)}/>}
          {tab==="schedule"&&<TruckSched depot={depot} isMobile={isMobile}/>}
          {tab==="buyers"&&<BuyerNetwork depot={depot} isMobile={isMobile}/>}
          {tab==="kyb"&&<DepotKYBView depot={depot} isMobile={isMobile}/>}
          {tab==="settings"&&<SettingsModule portalType="depot" depot={depot} onUpdateDepot={onUpdateDepot} isMobile={isMobile}/>}
        </div>
      )}
    </div>
  );
}

export { DepotDetailView };
