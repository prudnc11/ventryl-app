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

function DepotDash({isMobile}) {
  const [pms,setPms]=useState(795);
  const [ago,setAgo]=useState(1185);
  const [editing,setEditing]=useState(false);
  const col2=isMobile?"1fr":"1fr 1fr";
  return (
    <div>
      <div style={{background:T.black,padding:isMobile?"18px 16px":"24px 28px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
        <div>
          <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"4px"}}>Depot Dashboard</div>
          <div style={{fontSize:isMobile?"20px":"24px",fontWeight:800,color:T.white}}>Nepal Energies</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>Apapa, Lagos · NMDPRA: MDP/D/0042</div>
        </div>
        <div style={{textAlign:isMobile?"left":"right"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"3px"}}>Revenue (Mar)</div>
          <div style={{fontSize:isMobile?"22px":"28px",fontWeight:800,color:T.green}}>₦218M</div>
          <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>+10.1% vs Feb</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        <KpiCard label="Orders MTD" value="34" sub="28 fulfilled"/>
        <KpiCard label="Volume" value="1.12M L" sub="34 trucks"/>
        <KpiCard label="Pending" value="2" sub="SLA: 2h max" alert/>
        <KpiCard label="Avg. Rating" value="4.8 ★" sub="34 reviews"/>
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
          <SectionHead title="Inventory Status" sub="Current stock · Apapa"/>
          {[{prod:"PMS",current:61200,cap:85000},{prod:"Total",current:61200,cap:85000}].map(s=>(
            <div key={s.prod} style={{marginBottom:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{s.prod}</span>
                <span style={{fontSize:"11px",fontWeight:700,color:T.gray400}}>{(s.current/1000).toFixed(1)}k/{(s.cap/1000).toFixed(0)}k MT · <span style={{color:T.green,fontWeight:800}}>{Math.round(s.current/s.cap*100)}%</span></span>
              </div>
              <div style={{height:"7px",background:T.gray100,borderRadius:"4px",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(s.current/s.cap*100)}%`,background:T.green,borderRadius:"4px"}}/></div>
            </div>
          ))}
          <div style={{background:T.amberLight,padding:"10px 14px",marginTop:"6px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:"#8A5C00",marginBottom:"2px"}}>⚠ Restock in ~4 days</div>
            <div style={{fontSize:"11px",color:"#8A5C00"}}>Contact NNPC for next PMS allocation.</div>
          </div>
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.5fr 1fr",gap:"14px"}}>
        <Card>
          <SectionHead title="Revenue Trend" sub="₦ Millions · 6 months"/>
          <ResponsiveContainer width="100%" height={isMobile?150:170}>
            <AreaChart data={[]} margin={{top:4,right:0,bottom:0,left:-24}}>
              <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.15}/><stop offset="95%" stopColor={T.green} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.gray100}/>
              <XAxis dataKey="month" tick={{fill:T.gray400,fontSize:10,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.gray400,fontSize:10,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="revenue" stroke={T.green} strokeWidth={2.5} fill="url(#rg)" name="Revenue" dot={{fill:T.green,r:3,strokeWidth:0}}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHead title="Orders by Day" sub="This week"/>
          <ResponsiveContainer width="100%" height={isMobile?150:170}>
            <BarChart data={[]} barSize={7} margin={{left:-24,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.gray100} vertical={false}/>
              <XAxis dataKey="day" tick={{fill:T.gray400,fontSize:10,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="pms" fill={T.green} name="PMS" radius={[2,2,0,0]}/>
              <Bar dataKey="ago" fill={T.blue} name="AGO" radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

export { DepotDash };
