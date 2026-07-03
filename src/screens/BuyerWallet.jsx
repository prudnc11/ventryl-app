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

function BuyerWallet({isMobile}) {
  const {user:authUser,profile:authProfile}=useAuthStore();
  const {walletNGN,loadWallet,buyerOrders}=useVentrylStore();
  useEffect(()=>{if(authUser?.id)loadWallet(authUser.id);},[authUser?.id]);
  const [currency,setCurrency]=useState("NGN");
  const [showFund,setShowFund]=useState(false);
  const [showWithdraw,setShowWithdraw]=useState(false);
  const [fundAmt,setFundAmt]=useState("");
  const [fundDone,setFundDone]=useState(false);
  const [fundErr,setFundErr]=useState("");
  const [fundLoading,setFundLoading]=useState(false);
  const [withdrawAmt,setWithdrawAmt]=useState("");
  const [withdrawDone,setWithdrawDone]=useState(false);

  const handlePaystackFund=async()=>{
    const amt=parseInt(fundAmt);
    if(!amt||amt<1000){setFundErr("Minimum top-up is ₦1,000");return;}
    if(!authUser||!authProfile?.email){setFundErr("Please complete your profile before topping up.");return;}
    setFundLoading(true);
    setFundErr("");
    try{
      await openPaystackPopup({
        email:authProfile.email,
        amountKobo:amt*100,
        metadata:{"user_id":authUser.id,"purpose":"wallet_topup"},
        onSuccess:async(response)=>{
          try{
            await verifyAndCreditWallet(response.reference,authUser.id);
            await loadWallet(authUser.id);
            setFundDone(true);
          }catch(e){
            setFundErr(e.message||"Payment verified but wallet credit failed. Contact support.");
          }finally{
            setFundLoading(false);
          }
        },
        onClose:()=>{setFundLoading(false);},
      });
    }catch(e){
      setFundErr(e.message||"Payment failed");
      setFundLoading(false);
    }
  };

  const CURRENCIES={
    NGN:{symbol:"₦",label:"Nigerian Naira",balance:walletNGN?.balanceNGN??0,fmt:(n)=>`₦${n.toLocaleString('en-NG')}`,rate:null,flag:"🇳🇬",
      txn:walletNGN?.txn??[],},
    USD:{symbol:"$",label:"US Dollar",balance:15770.42,fmt:(n)=>`$${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,rate:"1 USD = ₦1,638",flag:"🇺🇸",
      txn:[
        {id:"TXN-D421",desc:"Wallet Funding (Bank Transfer)",amount:"+$10,000.00",date:"Mar 10",type:"credit"},
        {id:"TXN-D418",desc:"Order VTL-00841 — Payment",amount:"-$43,772.00",date:"Mar 8",type:"debit"},
      ]},
    USDT:{symbol:"",label:"Tether (USDT)",balance:15770.42,fmt:(n)=>`${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} USDT`,rate:"1 USDT ≈ $1.00",flag:"₮",
      txn:[
        {id:"TXN-U421",desc:"USDT Deposit (On-chain)",amount:"+10,000 USDT",date:"Mar 10",type:"credit"},
        {id:"TXN-U420",desc:"Order VTL-00840 (converted to NGN)",amount:"-23,872.14 USDT",date:"Mar 9",type:"debit"},
      ]},
  };

  const cur=CURRENCIES[currency];
  const TABS=["NGN","USD","USDT"];

  return (
    <div>
      {/* Hero header */}
      <div style={{background:T.black,padding:isMobile?"18px 16px":"24px 28px",marginBottom:"14px"}}>
        {/* Currency tabs */}
        <div style={{display:"flex",gap:"0",marginBottom:"20px",borderBottom:"1px solid #222"}}>
          {TABS.map(tab=>(
            <button key={tab} onClick={()=>setCurrency(tab)} style={{padding:"8px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:currency===tab?800:600,color:currency===tab?T.white:"#666",borderBottom:`2px solid ${currency===tab?T.green:"transparent"}`,marginBottom:"-1px",transition:"all 0.15s"}}>
              {CURRENCIES[tab].flag} {tab}
            </button>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"24px"}}>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"6px"}}>Available Balance · {cur.label}</div>
            <div style={{fontSize:isMobile?"28px":"36px",fontWeight:800,color:T.green,letterSpacing:"-0.02em",lineHeight:1}}>{cur.fmt(cur.balance)}</div>
            {cur.rate&&<div style={{fontSize:"11px",color:"#888",marginTop:"5px"}}>{cur.rate}</div>}
            <div style={{display:"flex",gap:"10px",marginTop:"16px"}}>
              <button onClick={()=>{setShowFund(true);setFundDone(false);setFundAmt("");}} style={{background:T.green,color:T.black,border:"none",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>+ Fund</button>
              <button onClick={()=>{setShowWithdraw(true);setWithdrawDone(false);setWithdrawAmt("");}} style={{background:"transparent",color:T.white,border:"1px solid #333",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>Withdraw</button>
              {currency!=="NGN"&&<button style={{background:"transparent",color:T.white,border:"1px solid #333",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>Convert</button>}
            </div>
          </div>
          {/* Active orders summary */}
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"10px"}}>Active Orders</div>
            {buyerOrders.filter(o=>o.status!=="delivered"&&o.status!=="collected"&&o.status!=="cancelled"&&o.status!=="rejected").map(o=>(
              <div key={o.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1A1A1A",fontSize:"12px"}}>
                <div><span style={{color:T.white,fontWeight:700}}>{o.id}</span><span style={{color:T.gray400,marginLeft:"6px"}}>{o.product}</span></div>
                <Badge status={o.status}/>
              </div>
            ))}
            {buyerOrders.filter(o=>o.status!=="delivered"&&o.status!=="collected"&&o.status!=="cancelled"&&o.status!=="rejected").length===0&&<div style={{fontSize:"12px",color:"#555"}}>No active orders</div>}
          </div>
        </div>
      </div>

      {/* Balances across currencies */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        {TABS.map(tab=>(
          <div key={tab} onClick={()=>setCurrency(tab)} style={{background:currency===tab?T.black:T.white,padding:"16px 18px",cursor:"pointer",transition:"background 0.15s"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:currency===tab?T.gray400:"#8C8C8C",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>{CURRENCIES[tab].flag} {tab}</div>
            <div style={{fontSize:"16px",fontWeight:800,color:currency===tab?T.green:T.black,lineHeight:1}}>{CURRENCIES[tab].fmt(CURRENCIES[tab].balance)}</div>
            {CURRENCIES[tab].rate&&<div style={{fontSize:"9px",color:currency===tab?"#666":T.gray400,marginTop:"3px"}}>{CURRENCIES[tab].rate}</div>}
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <Card pad={false}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Transaction History</div>
          <span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"2px 7px"}}>{cur.label}</span>
        </div>
        {cur.txn.map((t,i)=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px",borderBottom:i<cur.txn.length-1?`1px solid ${T.gray100}`:"none",gap:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"32px",height:"32px",background:t.type==="credit"?T.greenLight:t.type==="paid"?T.blueLight:T.gray100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0}}>
                {t.type==="credit"?"↓":t.type==="paid"?"✓":"↑"}
              </div>
              <div>
                <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{isMobile?t.desc.split("—")[0]:t.desc}</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{t.id} · {t.date}</div>
              </div>
            </div>
            <div style={{fontSize:"13px",fontWeight:800,color:t.type==="credit"?T.greenDark:t.type==="paid"?T.blue:T.black,flexShrink:0}}>{t.amount}</div>
          </div>
        ))}
      </Card>

      {/* Fund modal */}
      {showFund&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"420px",width:"100%",padding:"28px"}}>
            {fundDone?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:"32px",marginBottom:"14px"}}>✓</div>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Wallet Funded!</div>
                <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>Your NGN wallet has been credited. Balance will refresh on next login if not shown immediately.</div>
                <button onClick={()=>{setShowFund(false);setFundDone(false);setFundAmt("");}} style={{background:T.black,color:T.white,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%"}}>Done</button>
              </div>
            ):(
              <>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Fund NGN Wallet</div>
                <div style={{fontSize:"11px",color:T.gray400,marginBottom:"18px"}}>Secure payment via Paystack · Instant credit</div>
                {/* Quick presets */}
                <div style={{display:"flex",flexWrap:"wrap",gap:"7px",marginBottom:"14px"}}>
                  {FUND_PRESETS.map(p=>(
                    <button key={p.label} onClick={()=>setFundAmt(String(p.naira))}
                      style={{background:fundAmt===String(p.naira)?T.black:T.white,color:fundAmt===String(p.naira)?T.white:T.black,border:`1px solid ${fundAmt===String(p.naira)?T.black:T.gray200}`,padding:"6px 12px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F}}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Custom Amount (NGN)</div>
                <input type="number" value={fundAmt} onChange={e=>{setFundAmt(e.target.value);setFundErr("");}}
                  placeholder="e.g. 5000000"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"12px 14px",fontFamily:F,fontSize:"15px",fontWeight:700,color:T.black,outline:"none",marginBottom:"10px",boxSizing:"border-box"}}/>
                {fundErr&&<div style={{fontSize:"11px",color:T.red,fontWeight:600,marginBottom:"10px"}}>{fundErr}</div>}
                <div style={{background:T.gray50,padding:"10px 14px",fontSize:"11px",color:T.gray400,marginBottom:"16px",lineHeight:1.5}}>
                  You will be redirected to Paystack's secure checkout. Your card/bank details are never stored on Ventryl.
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button
                    onClick={currency==="NGN"?handlePaystackFund:()=>setFundDone(true)}
                    disabled={!fundAmt||fundLoading}
                    style={{flex:1,background:fundAmt&&!fundLoading?T.green:T.gray200,color:fundAmt&&!fundLoading?T.white:T.gray400,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:fundAmt&&!fundLoading?"pointer":"not-allowed",fontFamily:F,minHeight:"44px"}}>
                    {fundLoading?"Opening Paystack…":currency==="NGN"?"Pay with Paystack →":"Confirm"}
                  </button>
                  <button onClick={()=>{setShowFund(false);setFundErr("");setFundAmt("");}} style={{flex:1,background:"none",color:T.black,border:`1px solid ${T.gray200}`,padding:"11px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {showWithdraw&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"400px",width:"100%",padding:"28px"}}>
            {withdrawDone?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:"32px",marginBottom:"14px"}}>✓</div>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Withdrawal Submitted</div>
                <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>Processing within 1 business day. You'll receive a confirmation SMS.</div>
                <button onClick={()=>setShowWithdraw(false)} style={{background:T.black,color:T.white,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%"}}>Done</button>
              </div>
            ):(
              <>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Withdraw {cur.label}</div>
                <div style={{fontSize:"11px",color:T.gray400,marginBottom:"20px"}}>Available: {cur.fmt(cur.balance)}</div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Amount ({currency})</div>
                <input type="number" value={withdrawAmt} onChange={e=>setWithdrawAmt(e.target.value)} placeholder="Enter amount"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"12px 14px",fontFamily:F,fontSize:"15px",fontWeight:700,color:T.black,outline:"none",marginBottom:"16px"}}/>
                <div style={{background:T.gray50,padding:"10px 14px",fontSize:"11px",color:T.gray400,marginBottom:"20px"}}>
                  {currency==="NGN"&&"To: GTBank · 0081 234 567 · Chukwuma Fuels"}
                  {currency==="USD"&&"To: Chase · Account ending 4321"}
                  {currency==="USDT"&&"To: TRC-20 wallet · Paste your address below"}
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={()=>setWithdrawDone(true)} disabled={!withdrawAmt} style={{flex:1,background:withdrawAmt?T.black:T.gray200,color:withdrawAmt?T.white:T.gray400,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:withdrawAmt?"pointer":"not-allowed",fontFamily:F,minHeight:"44px"}}>Withdraw</button>
                  <button onClick={()=>setShowWithdraw(false)} style={{flex:1,background:"none",color:T.black,border:`1px solid ${T.gray200}`,padding:"11px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { BuyerWallet };
