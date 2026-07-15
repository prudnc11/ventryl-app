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
import { printTransactionReceipt } from "../lib/documents";
import { openPaystackPopup, verifyAndCreditWallet, FUND_PRESETS } from "../lib/payment";
import { useOrderRealtime, useDepotInboxRealtime, useProfileRealtime } from "../lib/realtime";
import { useDepotContext } from "../context/DepotContext";

function BuyerWallet({isMobile}) {
  const {user:authUser,profile:authProfile}=useAuthStore();
  const {walletNGN,loadWallet,buyerOrders}=useVentrylStore();
  useEffect(()=>{if(authUser?.id)loadWallet(authUser.id);},[authUser?.id]);
  const [currency,setCurrency]=useState("NGN");
  const [activeCurrencies,setActiveCurrencies]=useState(()=>{
    try{ const s=localStorage.getItem("vtl_active_currencies"); return s?JSON.parse(s):["NGN","USD","USDT"]; }catch{return ["NGN","USD","USDT"];}
  });
  const toggleCurrency=(code)=>{
    if(code==="NGN") return;
    setActiveCurrencies(prev=>{
      const next=prev.includes(code)?prev.filter(c=>c!==code):[...prev,code];
      localStorage.setItem("vtl_active_currencies",JSON.stringify(next));
      if(!next.includes(currency)) setCurrency("NGN");
      return next;
    });
  };
  const moveCurrency=(code,dir)=>{
    setActiveCurrencies(prev=>{
      const i=prev.indexOf(code);
      if(i<0) return prev;
      const j=i+dir;
      if(j<0||j>=prev.length) return prev;
      const next=[...prev];
      [next[i],next[j]]=[next[j],next[i]];
      localStorage.setItem("vtl_active_currencies",JSON.stringify(next));
      return next;
    });
  };
  const [showCurrencyManager,setShowCurrencyManager]=useState(false);
  // Demo balances for non-NGN currencies (session only)
  const [demoBalances,setDemoBalances]=useState({});
  const [showFund,setShowFund]=useState(false);
  const [showWithdraw,setShowWithdraw]=useState(false);
  const [fundAmt,setFundAmt]=useState("");
  const [fundDone,setFundDone]=useState(false);
  const [fundErr,setFundErr]=useState("");
  const [fundLoading,setFundLoading]=useState(false);
  const [withdrawAmt,setWithdrawAmt]=useState("");
  const [withdrawDone,setWithdrawDone]=useState(false);

  const isDev=import.meta.env.DEV;

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

  const handleDevCredit=async()=>{
    const amt=parseFloat(fundAmt);
    const minAmt=currency==="BTC"?0.0001:currency==="NGN"?1000:1;
    if(!amt||amt<minAmt){setFundErr(`Minimum top-up is ${ALL_CURRENCIES[currency]?.fmt(minAmt)||minAmt}`);return;}
    if(!authUser){setFundErr("Not authenticated.");return;}
    setFundLoading(true);
    setFundErr("");
    try{
      if(currency==="NGN"){
        const ref=`DEV-${Date.now().toString(36).toUpperCase()}`;
        const { error }=await supabase.rpc('wallet_credit',{
          p_user_id:authUser.id,
          p_amount:amt,
          p_description:`Dev top-up — ₦${amt.toLocaleString('en-NG')}`,
          p_reference:ref,
        });
        if(error) throw new Error(error.message);
        await loadWallet(authUser.id);
      } else {
        // Demo credit for non-NGN currencies (session-only)
        setDemoBalances(prev=>({...prev,[currency]:(prev[currency]||0)+amt}));
      }
      setFundDone(true);
    }catch(e){
      setFundErr(e.message||"Credit failed");
    }finally{
      setFundLoading(false);
    }
  };

  const ALL_CURRENCIES={
    NGN:{symbol:"₦",label:"Nigerian Naira",balance:walletNGN?.balanceNGN??0,fmt:(n)=>`₦${n.toLocaleString('en-NG')}`,rate:null,flag:"🇳🇬",txn:walletNGN?.txn??[],minFund:1000},
    USD:{symbol:"$",label:"US Dollar",balance:demoBalances.USD||0,fmt:(n)=>`$${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,rate:"1 USD = ₦1,638",flag:"🇺🇸",txn:[],minFund:1},
    USDT:{symbol:"₮",label:"Tether (USDT)",balance:demoBalances.USDT||0,fmt:(n)=>`${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} USDT`,rate:"1 USDT ≈ $1.00",flag:"₮",txn:[],minFund:1},
    EUR:{symbol:"€",label:"Euro",balance:demoBalances.EUR||0,fmt:(n)=>`€${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,rate:"1 EUR = ₦1,780",flag:"🇪🇺",txn:[],minFund:1},
    GBP:{symbol:"£",label:"British Pound",balance:demoBalances.GBP||0,fmt:(n)=>`£${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,rate:"1 GBP = ₦2,090",flag:"🇬🇧",txn:[],minFund:1},
    BTC:{symbol:"₿",label:"Bitcoin",balance:demoBalances.BTC||0,fmt:(n)=>`${n.toFixed(8)} BTC`,rate:"1 BTC ≈ $67,200",flag:"₿",txn:[],minFund:0.0001},
    USDC:{symbol:"",label:"USD Coin",balance:demoBalances.USDC||0,fmt:(n)=>`${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} USDC`,rate:"1 USDC ≈ $1.00",flag:"◉",txn:[],minFund:1},
  };
  const ALL_CURRENCY_CODES=Object.keys(ALL_CURRENCIES);

  const cur=ALL_CURRENCIES[currency];
  const TABS=activeCurrencies.filter(c=>ALL_CURRENCIES[c]);

  return (
    <div>
      {/* Hero header */}
      <div style={{background:T.black,padding:isMobile?"18px 16px":"24px 28px",marginBottom:"14px"}}>
        {/* Currency tabs */}
        <div style={{display:"flex",gap:"0",marginBottom:"20px",borderBottom:"1px solid #222",alignItems:"center"}}>
          {TABS.map(tab=>{
            const active=currency===tab;
            return (
              <button key={tab} onClick={()=>setCurrency(tab)}
                style={{padding:"8px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:active?800:600,color:active?T.white:"#666",borderBottom:`2px solid ${active?T.green:"transparent"}`,marginBottom:"-1px",transition:"all 0.15s"}}>
                {ALL_CURRENCIES[tab].flag} {tab}
              </button>
            );
          })}
          <button onClick={()=>setShowCurrencyManager(true)}
            style={{marginLeft:"auto",background:"#1a1a1a",border:"1px solid #333",color:T.gray400,fontSize:"10px",fontWeight:700,padding:"4px 10px",cursor:"pointer",fontFamily:F,marginBottom:"2px"}}>
            + Manage
          </button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"24px"}}>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"6px"}}>Available Balance · {cur.label}</div>
            <div style={{fontSize:isMobile?"28px":"36px",fontWeight:800,color:T.green,letterSpacing:"-0.02em",lineHeight:1}}>{cur.fmt(cur.balance)}</div>
            {cur.rate&&<div style={{fontSize:"11px",color:"#888",marginTop:"5px"}}>{cur.rate}</div>}
            <div style={{display:"flex",gap:"10px",marginTop:"16px"}}>
              <button onClick={()=>{setShowFund(true);setFundDone(false);setFundAmt("");setFundErr("");}} style={{background:T.green,color:T.black,border:"none",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>+ Fund {currency}</button>
              <button onClick={()=>{setShowWithdraw(true);setWithdrawDone(false);setWithdrawAmt("");}} style={{background:"transparent",color:T.white,border:"1px solid #333",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>Withdraw</button>
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
      <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(TABS.length,isMobile?2:4)},1fr)`,gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        {TABS.map(tab=>{
          const c=ALL_CURRENCIES[tab];
          const active=currency===tab;
          return (
            <div key={tab} onClick={()=>setCurrency(tab)}
              style={{background:active?T.black:T.white,padding:"14px 16px",cursor:"pointer",transition:"background 0.15s"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:active?T.gray400:"#8C8C8C",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>{c.flag} {tab}</div>
              <div style={{fontSize:"15px",fontWeight:800,color:active?T.green:T.black,lineHeight:1}}>{c.fmt(c.balance)}</div>
              {c.rate&&<div style={{fontSize:"9px",color:active?"#666":T.gray400,marginTop:"3px"}}>{c.rate}</div>}
            </div>
          );
        })}
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
            <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
              <div style={{fontSize:"13px",fontWeight:800,color:t.type==="credit"?T.greenDark:t.type==="paid"?T.blue:T.black}}>{t.amount}</div>
              <button onClick={()=>printTransactionReceipt({
                txnId:t.id,
                type:t.type==="credit"?"topup":t.type==="paid"?"debit":"debit",
                amount:parseFloat(String(t.amount).replace(/[^0-9.]/g,''))||0,
                currency,
                description:t.desc,
                date:t.date,
                userName:authProfile?.full_name||authProfile?.company_name||"",
                userCompany:authProfile?.company_name||"",
              })} title="Print receipt"
                style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:T.gray400,fontSize:"14px",lineHeight:1}}>
                🖨
              </button>
            </div>
          </div>
        ))}
      </Card>

      {/* Fund modal */}
      {showFund&&(()=>{
        const fc=ALL_CURRENCIES[currency];
        const presets=currency==="NGN"?FUND_PRESETS
          :currency==="BTC"?[{label:"0.001",naira:0.001},{label:"0.01",naira:0.01},{label:"0.1",naira:0.1},{label:"1",naira:1}]
          :[{label:`${fc.symbol}100`,naira:100},{label:`${fc.symbol}500`,naira:500},{label:`${fc.symbol}1,000`,naira:1000},{label:`${fc.symbol}5,000`,naira:5000},{label:`${fc.symbol}10,000`,naira:10000}];
        return (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"420px",width:"100%",padding:"28px"}}>
            {fundDone?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:"32px",marginBottom:"14px"}}>✓</div>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Wallet Funded!</div>
                <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>Your {currency} wallet has been credited.{currency!=="NGN"?" (Demo balance — session only)":""}</div>
                <button onClick={()=>{setShowFund(false);setFundDone(false);setFundAmt("");}} style={{background:T.black,color:T.white,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%"}}>Done</button>
              </div>
            ):(
              <>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Fund {currency} Wallet</div>
                <div style={{fontSize:"11px",color:T.gray400,marginBottom:"18px"}}>
                  Secure payment via Kredibank · Instant credit
                </div>
                {/* Quick presets */}
                <div style={{display:"flex",flexWrap:"wrap",gap:"7px",marginBottom:"14px"}}>
                  {presets.map(p=>(
                    <button key={p.label} onClick={()=>setFundAmt(String(p.naira))}
                      style={{background:fundAmt===String(p.naira)?T.black:T.white,color:fundAmt===String(p.naira)?T.white:T.black,border:`1px solid ${fundAmt===String(p.naira)?T.black:T.gray200}`,padding:"6px 12px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F}}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Amount ({currency})</div>
                <input type="number" value={fundAmt} onChange={e=>{setFundAmt(e.target.value);setFundErr("");}}
                  placeholder={currency==="BTC"?"e.g. 0.01":"e.g. 5000"}
                  step={currency==="BTC"?"0.0001":"1"}
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"12px 14px",fontFamily:F,fontSize:"15px",fontWeight:700,color:T.black,outline:"none",marginBottom:"10px",boxSizing:"border-box"}}/>
                {fundErr&&<div style={{fontSize:"11px",color:T.red,fontWeight:600,marginBottom:"10px"}}>{fundErr}</div>}
                <div style={{background:T.gray50,padding:"10px 14px",fontSize:"11px",color:T.gray400,marginBottom:"16px",lineHeight:1.5}}>
                  Secure payment via Kredibank. Your card/bank details are never stored on Ventryl.
                </div>
                <div style={{display:"flex",gap:"8px",flexDirection:"column"}}>
                  <button
                    onClick={handleDevCredit}
                    disabled={!fundAmt||fundLoading}
                    style={{background:fundAmt&&!fundLoading?T.green:T.gray200,color:fundAmt&&!fundLoading?T.white:T.gray400,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:fundAmt&&!fundLoading?"pointer":"not-allowed",fontFamily:F,minHeight:"44px"}}>
                    {fundLoading?"Processing…":"Pay with Kredibank →"}
                  </button>
                  <button onClick={()=>{setShowFund(false);setFundErr("");setFundAmt("");}} style={{background:"none",color:T.black,border:`1px solid ${T.gray200}`,padding:"11px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
        );
      })()}

      {/* Currency manager modal */}
      {showCurrencyManager&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"420px",width:"100%",padding:"24px",fontFamily:F,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
              <div style={{fontSize:"16px",fontWeight:800,color:T.black}}>Manage Wallets</div>
              <button onClick={()=>setShowCurrencyManager(false)} style={{background:"none",border:"none",fontSize:"18px",cursor:"pointer",color:T.gray400,padding:"2px",lineHeight:1}}>✕</button>
            </div>
            <div style={{fontSize:"11px",color:T.gray400,marginBottom:"16px"}}>Toggle currencies and drag to reorder your wallet tabs.</div>
            {/* Active currencies — reorderable */}
            {activeCurrencies.length>0&&(
              <div style={{marginBottom:"14px"}}>
                <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Active — drag to reorder</div>
                {activeCurrencies.map((code,idx)=>{
                  const c=ALL_CURRENCIES[code];
                  if(!c) return null;
                  const isNGN=code==="NGN";
                  return (
                    <div key={code} style={{display:"flex",alignItems:"center",gap:"6px",padding:"10px 12px",border:`1px solid ${T.green}40`,background:T.greenLight+"30",marginBottom:"4px",transition:"all 0.15s"}}>
                      {/* Up/Down arrows */}
                      <div style={{display:"flex",flexDirection:"column",gap:"1px",flexShrink:0}}>
                        <button onClick={()=>moveCurrency(code,-1)} disabled={idx===0}
                          style={{background:"none",border:"none",cursor:idx===0?"default":"pointer",padding:"1px 4px",fontSize:"11px",color:idx===0?T.gray200:T.gray600,lineHeight:1}}>▲</button>
                        <button onClick={()=>moveCurrency(code,1)} disabled={idx===activeCurrencies.length-1}
                          style={{background:"none",border:"none",cursor:idx===activeCurrencies.length-1?"default":"pointer",padding:"1px 4px",fontSize:"11px",color:idx===activeCurrencies.length-1?T.gray200:T.gray600,lineHeight:1}}>▼</button>
                      </div>
                      <span style={{fontSize:"16px",width:"24px",textAlign:"center"}}>{c.flag}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{code} <span style={{fontWeight:600,color:T.gray400}}>· {c.label}</span></div>
                      </div>
                      <button onClick={()=>toggleCurrency(code)} disabled={isNGN}
                        style={{width:"18px",height:"18px",border:`2px solid ${isNGN?T.gray200:T.green}`,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:isNGN?"default":"pointer",opacity:isNGN?0.5:1,padding:0}}>
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={T.white} strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Inactive currencies */}
            {ALL_CURRENCY_CODES.filter(c=>!activeCurrencies.includes(c)).length>0&&(
              <div>
                <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Available</div>
                {ALL_CURRENCY_CODES.filter(c=>!activeCurrencies.includes(c)).map(code=>{
                  const c=ALL_CURRENCIES[code];
                  return (
                    <div key={code} onClick={()=>toggleCurrency(code)}
                      style={{display:"flex",alignItems:"center",gap:"6px",padding:"10px 12px",border:`1px solid ${T.gray100}`,background:T.white,marginBottom:"4px",cursor:"pointer",transition:"all 0.15s"}}>
                      <div style={{width:"22px",flexShrink:0}}/>
                      <span style={{fontSize:"16px",width:"24px",textAlign:"center"}}>{c.flag}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{code} <span style={{fontWeight:600,color:T.gray400}}>· {c.label}</span></div>
                        {c.rate&&<div style={{fontSize:"9px",color:T.gray400}}>{c.rate}</div>}
                      </div>
                      <div style={{width:"18px",height:"18px",border:`2px solid ${T.gray200}`,background:T.white,flexShrink:0}}/>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={()=>setShowCurrencyManager(false)}
              style={{background:T.black,color:T.white,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%",marginTop:"14px"}}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {showWithdraw&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"400px",width:"100%",padding:"28px",fontFamily:F,textAlign:"center"}}>
            <div style={{fontSize:"32px",marginBottom:"14px"}}>🏦</div>
            <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Withdrawals Coming Soon</div>
            <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px",lineHeight:1.6}}>
              Bank withdrawals are being integrated with our payment partner. You will be able to withdraw funds to your linked bank account shortly.
            </div>
            <button onClick={()=>setShowWithdraw(false)} style={{background:T.black,color:T.white,border:"none",padding:"11px 24px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

export { BuyerWallet };
