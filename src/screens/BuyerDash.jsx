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

function BuyerDash({onOrder,isMobile}) {
  const col2 = isMobile ? "1fr" : "1fr 1.3fr";
  const {buyerOrders,priceHistory}=useVentrylStore();
  const activeOrders=buyerOrders.filter(o=>o.status!=="delivered"&&o.status!=="collected"&&o.status!=="cancelled"&&o.status!=="rejected");
  return (
    <div>
      {/* Hero */}
      <div style={{background:T.black,padding:isMobile?"18px 16px":"24px 28px",marginBottom:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"4px"}}>Buyer Dashboard</div>
            <div style={{fontSize:isMobile?"20px":"24px",fontWeight:800,color:T.white}}>Chukwuma Fuels Ltd</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>RC-1092843 · Lagos · KYB ✓</div>
          </div>
          <div style={{textAlign:isMobile?"left":"right"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"3px"}}>Wallet Balance</div>
            <div style={{fontSize:isMobile?"22px":"28px",fontWeight:800,color:T.green}}>₦25,830,000</div>
            <button style={{marginTop:"8px",background:T.green,color:T.black,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>+ Fund Wallet</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        {[{l:"Orders MTD",v:"7",sub:"3 delivered"},{l:"Volume",v:"363k L",sub:"₦280.5M"},{l:"Avg. Price",v:"₦795/L",sub:"PMS · Mar"},{l:"Credit (VCS)",v:"720",sub:"Silver tier"}].map(k=>(
          <KpiCard key={k.l} label={k.l} value={k.v} sub={k.sub}/>
        ))}
      </div>

      {/* Active orders + chart */}
      <div style={{display:"grid",gridTemplateColumns:col2,gap:"14px",marginBottom:"14px"}}>
        <Card pad={false}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.gray100}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Active Orders</div>
          </div>
          {activeOrders.map((o,i,arr)=>(
            <div key={o.id} style={{padding:"13px 18px",borderBottom:i<arr.length-1?`1px solid ${T.gray100}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"7px",gap:"8px"}}>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div>
                  <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{o.depot} · {o.product} · {(o.vol/1000).toFixed(0)}k L</div>
                </div>
                <Badge status={o.status}/>
              </div>
              <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}>
                <div style={{height:"100%",width:`${o.progress}%`,background:o.status==="in_transit"?T.blue:T.amber,borderRadius:"2px"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
                <span style={{fontSize:"10px",color:T.gray400}}>{o.progress}% done</span>
                <span style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>₦{(o.value||0).toLocaleString('en-NG')}</span>
              </div>
            </div>
          ))}
          <div style={{padding:"12px 18px"}}>
            <button onClick={onOrder} style={{width:"100%",background:T.black,color:T.white,border:"none",padding:"11px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>+ Place New Order</button>
          </div>
        </Card>

        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
            <div>
              <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Price Trend — 7 Days</div>
              <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>₦/Litre · PMS & AGO</div>
            </div>
            <div style={{background:T.amberLight,color:"#8A5C00",fontSize:"10px",fontWeight:800,padding:"4px 8px"}}>📈 Rising next week</div>
          </div>
          <ResponsiveContainer width="100%" height={isMobile?150:180}>
            <LineChart data={priceHistory} margin={{top:4,right:0,bottom:0,left:-24}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.gray100}/>
              <XAxis dataKey="day" tick={{fill:T.gray400,fontSize:9,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.gray400,fontSize:9,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false} domain={[780,810]}/>
              <Tooltip content={<ChartTip/>}/>
              <Line type="monotone" dataKey="pms" stroke={T.green} strokeWidth={2.5} name="PMS" dot={{fill:T.green,r:3,strokeWidth:0}}/>
              <Line type="monotone" dataKey="ago" stroke={T.blue} strokeWidth={2} name="AGO" dot={{fill:T.blue,r:3,strokeWidth:0}} strokeDasharray="5 3"/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:"12px",marginTop:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"5px"}}><div style={{width:"10px",height:"2px",background:T.green}}/><span style={{fontSize:"10px",fontWeight:600,color:T.gray400}}>PMS ₦795</span></div>
            <div style={{display:"flex",alignItems:"center",gap:"5px"}}><div style={{width:"10px",height:"2px",background:T.blue}}/><span style={{fontSize:"10px",fontWeight:600,color:T.gray400}}>AGO ₦1,185</span></div>
          </div>
        </Card>
      </div>

      {/* Order history - cards on mobile */}
      <Card pad={false}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.gray100}`}}><div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Order History</div></div>
        {isMobile?(
          buyerOrders.map((o,i)=>(
            <div key={o.id} style={{padding:"14px 18px",borderBottom:i<buyerOrders.length-1?`1px solid ${T.gray100}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{o.depot} · {o.product}</div>
                </div>
                <Badge status={o.status}/>
              </div>
              <div style={{display:"flex",gap:"16px"}}>
                <span style={{fontSize:"11px",color:T.gray600,fontWeight:700}}>{(o.vol/1000).toFixed(0)}k L</span>
                <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>₦{(o.value||0).toLocaleString('en-NG')}</span>
                <span style={{fontSize:"11px",color:T.gray400}}>{o.placed}</span>
              </div>
            </div>
          ))
        ):(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.gray100}`}}>{["Order","Depot","Product","Volume","Value","Placed","Status"].map(h=><th key={h} style={{padding:"9px 18px",fontFamily:F,fontSize:"10px",fontWeight:700,color:T.gray400,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
            <tbody>{buyerOrders.map((o,i)=>(
              <tr key={o.id} style={{borderBottom:i<buyerOrders.length-1?`1px solid ${T.gray100}`:"none"}}>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</td>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"12px",color:T.gray800}}>{o.depot}</td>
                <td style={{padding:"12px 18px"}}><span style={{background:T.gray100,color:T.black,fontSize:"10px",fontWeight:800,padding:"3px 7px"}}>{o.product}</span></td>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"12px",color:T.gray600}}>{(o.vol/1000).toFixed(0)}k L</td>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>₦{(o.value||0).toLocaleString('en-NG')}</td>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"11px",color:T.gray400}}>{o.placed}</td>
                <td style={{padding:"12px 18px"}}><Badge status={o.status}/></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export { BuyerDash };
