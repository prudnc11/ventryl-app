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
import { TeamSettings } from "./TeamSettings";

function Toggle({on,onChange}) {
  return (
    <div onClick={()=>onChange(!on)} style={{width:"38px",height:"22px",background:on?T.green:T.gray200,borderRadius:"11px",cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
      <div style={{width:"16px",height:"16px",background:T.white,borderRadius:"50%",position:"absolute",top:"3px",left:on?"19px":"3px",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.18)"}}/>
    </div>
  );
}

function FieldRow({label,value,onChange,editable=true,verified=false,type="text",hint}) {
  // Controlled if onChange provided, otherwise uncontrolled with internal state
  const [localVal,setLocalVal]=useState(value||"");
  const isControlled=typeof onChange==="function";
  const displayVal=isControlled?value:localVal;
  const handleChange=e=>{
    if(isControlled) onChange(e);
    else setLocalVal(e.target.value);
  };
  return (
    <div style={{marginBottom:"16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
        <span style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
        {verified&&<span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:800,padding:"1px 5px"}}>VERIFIED</span>}
      </div>
      {editable?(
        <input type={type} value={displayVal} onChange={handleChange}
          style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 14px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
          onFocus={e=>e.target.style.borderColor=T.black}
          onBlur={e=>e.target.style.borderColor=T.gray200}/>
      ):(
        <div style={{border:`1px solid ${T.gray100}`,padding:"10px 14px",fontSize:"13px",fontWeight:700,color:T.gray600,background:T.gray50}}>{displayVal||"—"}</div>
      )}
      {hint&&<div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>{hint}</div>}
    </div>
  );
}

function SettingsBlock({title,children}) {
  return (
    <div style={{marginBottom:"24px"}}>
      <div style={{fontSize:"10px",fontWeight:800,color:T.black,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"12px",paddingBottom:"8px",borderBottom:`2px solid ${T.black}`}}>{title}</div>
      {children}
    </div>
  );
}

function NotifRow({label,sub,on,onChange}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${T.gray100}`}}>
      <div>
        <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{label}</div>
        {sub&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{sub}</div>}
      </div>
      <Toggle on={on} onChange={onChange}/>
    </div>
  );
}

function SettingsModule({portalType,isMobile,depot,onUpdateDepot}) {
  const [tab,setTab]=useState("profile");
  const [saved,setSaved]=useState(false);
  const [notif,setNotif]=useState({orderUpdates:true,priceAlerts:true,slaWarnings:true,deliveryConfirm:true,emailCh:true,smsCh:true,pushCh:false,weeklyReport:portalType==="depot"});
  const [twoFA,setTwoFA]=useState(true);
  const [showPwForm,setShowPwForm]=useState(false);
  const [bays,setBays]=useState(depot?._raw?.bays||[]);
  const [removeTargetProduct,setRemoveTargetProduct]=useState(null);


  const {user:authUser,profile:authProfile,setProfile}=useAuthStore();
  const {walletNGN}=useVentrylStore();
  const isBuyer=portalType==="buyer";

  // Profile form state — seeded from real DB profile
  const [profileForm,setProfileForm]=useState({
    fullName:"",companyName:"",phone:"",state:"",lga:"",cacNumber:"",
    contactPerson:"",jobTitle:"",email:"",address:"",
  });
  const [profileSaving,setProfileSaving]=useState(false);
  const [profileLoaded,setProfileLoaded]=useState(false);
  useEffect(()=>{
    if(!authProfile||profileLoaded) return;
    setProfileForm({
      fullName:authProfile.full_name||"",
      companyName:authProfile.company_name||"",
      phone:authProfile.phone||"",
      state:authProfile.state||"",
      lga:authProfile.lga||"",
      cacNumber:authProfile.cac_number||"",
      contactPerson:authProfile.full_name||"",
      jobTitle:authProfile.job_title||"",
      email:authUser?.email||"",
      address:authProfile.address||"",
    });
    setProfileLoaded(true);
  },[authProfile,profileLoaded]);

  const handleSaveProfile=async()=>{
    if(!authUser) return;
    setProfileSaving(true);
    try{
      const updated=await profilesApi.update(authUser.id,{
        full_name:profileForm.fullName,
        company_name:profileForm.companyName,
        phone:profileForm.phone,
        state:profileForm.state,
        lga:profileForm.lga,
        cac_number:profileForm.cacNumber,
      });
      setProfile({...authProfile,...updated});
      setSaved(true);
      setTimeout(()=>setSaved(false),2200);
    }catch(e){
      console.error("Failed to save profile",e);
    }finally{
      setProfileSaving(false);
    }
  };
  const pf=(k)=>profileForm[k];
  const sp=(k)=>e=>setProfileForm(f=>({...f,[k]:e.target.value}));

  // Notification prefs: seed from DB profile, fall back to defaults
  const [notifLoaded,setNotifLoaded]=useState(false);
  const [notifSaving,setNotifSaving]=useState(false);
  useEffect(()=>{
    if(!authUser||notifLoaded) return;
    notifApi.getPrefs(authUser.id).then(prefs=>{
      if(prefs) setNotif(p=>({...p,...prefs}));
      setNotifLoaded(true);
    }).catch(()=>setNotifLoaded(true));
  },[authUser,notifLoaded]);

  const handleSaveNotifPrefs=async()=>{
    if(!authUser) return handleSave();
    setNotifSaving(true);
    try{
      await notifApi.savePrefs(authUser.id,notif);
      setProfile({...authProfile,notif_prefs:notif});
      setSaved(true);
      setTimeout(()=>setSaved(false),2200);
    }catch(e){
      console.error("Failed to save notif prefs",e);
    }finally{
      setNotifSaving(false);
    }
  };

  // Settings realtime: auto-update profile when kyc_status or notif_prefs change remotely
  useProfileRealtime(authUser?.id,(payload)=>{
    if(payload?.new) setProfile(p=>({...p,...payload.new}));
  });

  // KYC state (buyer settings)
  const [kycFiles,setKycFiles]=useState({});
  const [kycUploaded,setKycUploaded]=useState({});
  const [kycUploading,setKycUploading]=useState({});
  const [kycUploadErr,setKycUploadErr]=useState({});
  const [kycSubmitting,setKycSubmitting]=useState(false);
  const [kycSubmitted,setKycSubmitted]=useState(authProfile?.kyc_status==="submitted"||authProfile?.kyc_status==="verified");
  const [kycSubmitErr,setKycSubmitErr]=useState("");

  const KYC_DOCS=[
    {key:"nin",            label:"NIN / National ID",          required:true,  hint:"National Identity Number slip or NIN card"},
    {key:"cac_cert",       label:"CAC Certificate",            required:true,  hint:"Certificate of Incorporation — required for company accounts"},
    {key:"proof_of_address",label:"Proof of Address",          required:true,  hint:"Utility bill or bank statement — not older than 3 months"},
  ];
  const kycReqDocs=KYC_DOCS.filter(d=>d.required);
  const kycDoneCount=kycReqDocs.filter(d=>kycUploaded[d.key]).length;
  const kycAllDone=kycDoneCount===kycReqDocs.length;

  const handleKycUpload=async(doc,file)=>{
    if(!file||!authUser) return;
    setKycUploading(u=>({...u,[doc.key]:true}));
    setKycUploadErr(e=>({...e,[doc.key]:""}));
    try{
      await kycApi.uploadDocument(authUser.id,doc.key,file);
      setKycUploaded(u=>({...u,[doc.key]:file.name}));
      setKycFiles(f=>({...f,[doc.key]:file}));
    }catch(e){
      setKycUploadErr(err=>({...err,[doc.key]:e.message||"Upload failed"}));
    }finally{
      setKycUploading(u=>({...u,[doc.key]:false}));
    }
  };

  const handleKycSubmit=async()=>{
    if(!kycAllDone||!authUser) return;
    setKycSubmitting(true);
    setKycSubmitErr("");
    try{
      await kycApi.submit(authUser.id);
      setKycSubmitted(true);
      setProfile({...authProfile,kyc_status:"submitted"});
    }catch(e){
      setKycSubmitErr(e.message||"Submission failed. Try again.");
    }finally{
      setKycSubmitting(false);
    }
  };

  const TABS=isBuyer?[
    {id:"profile",label:"Company Profile",icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"},
    {id:"verification",label:"Verification",icon:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",alert:authProfile&&authProfile.kyc_status==="pending"},
    {id:"notifications",label:"Notifications",icon:"M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"},
    {id:"wallet",label:"Wallet & Payment",icon:"M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"},
    {id:"security",label:"Security",icon:"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"},
  ]:[
    {id:"profile",label:"Depot Profile",icon:"M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"},
    {id:"notifications",label:"Notifications",icon:"M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"},
    {id:"bays",label:"Loading Bays",icon:"M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"},
    {id:"products",label:"Products",icon:"M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"},
    {id:"team",label:"Team & Users",icon:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"},
  ];

  const handleSave=()=>{setSaved(true);setTimeout(()=>setSaved(false),2200);};
  const SaveBtn=({label="Save Changes"})=>(
    <button onClick={handleSave} style={{background:saved?T.green:T.black,color:T.white,border:"none",padding:"12px 28px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px",transition:"background 0.2s",marginTop:"6px"}}>
      {saved?"✓ Saved":label}
    </button>
  );

  const content={
    profile:(
      <div>
        {isBuyer?(
          <>
            <SettingsBlock title="Company Information">
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <FieldRow label="Company Name" value={pf("companyName")} onChange={sp("companyName")} verified={authProfile?.kyc_status==="verified"} editable={authProfile?.kyc_status!=="verified"}/>
                <FieldRow label="RC / CAC Number" value={pf("cacNumber")} onChange={sp("cacNumber")} verified={authProfile?.kyc_status==="verified"} editable={authProfile?.kyc_status!=="verified"}/>
                <FieldRow label="State" value={pf("state")} onChange={sp("state")}/>
                <FieldRow label="LGA" value={pf("lga")} onChange={sp("lga")}/>
              </div>
              {authProfile?.kyc_status==="verified"&&<div style={{fontSize:"10px",color:T.gray400,fontWeight:600,marginTop:"-8px",marginBottom:"4px"}}>Verified fields are locked. Contact support to update.</div>}
            </SettingsBlock>
            <SettingsBlock title="Contact Details">
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <FieldRow label="Full Name" value={pf("fullName")} onChange={sp("fullName")}/>
                <FieldRow label="Phone Number" value={pf("phone")} onChange={sp("phone")} type="tel"/>
                <FieldRow label="Email Address" value={pf("email")} editable={false}/>
              </div>
              <FieldRow label="Business Address" value={pf("address")} onChange={sp("address")}/>
            </SettingsBlock>
          </>
        ):(
          <>
            <SettingsBlock title="Depot Information">
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <FieldRow label="Depot Name" value={depot?.name||""} verified editable={false}/>
                <FieldRow label="NMDPRA License" value={depot?.license||""} verified editable={false}/>
                <FieldRow label="Total Capacity (L)" value={depot?.capacity?(depot.capacity).toLocaleString():"—"} editable={false}/>
                <FieldRow label="License Expiry" value={depot?._raw?.license_expiry||"—"} editable={false}/>
              </div>
              <div style={{fontSize:"10px",color:T.gray400,fontWeight:600,marginTop:"-8px",marginBottom:"4px"}}>Verified fields are locked. Contact your account manager to update.</div>
            </SettingsBlock>
            <SettingsBlock title="Location & Contact">
              <FieldRow label="Address" value={depot?.location||""}/>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <FieldRow label="Operations Contact" value={depot?._raw?.contact_name||""}/>
                <FieldRow label="Phone" value={depot?._raw?.contact_phone||""} type="tel"/>
                <FieldRow label="Email" value={depot?._raw?.contact_email||""} type="email"/>
              </div>
            </SettingsBlock>
            <SettingsBlock title="Active Products">
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"10px"}}>
                {(depot?.products||[]).length===0?(
                  <span style={{fontSize:"12px",color:T.gray400,fontWeight:600}}>No products configured. Go to Products tab to add.</span>
                ):(depot?.products||[]).map(p=>(
                  <span key={p.id} style={{padding:"6px 14px",background:T.black,color:T.white,fontSize:"12px",fontWeight:800,display:"inline-flex",alignItems:"center",gap:"6px"}}>
                    {p.name}
                    <span style={{fontSize:"10px",color:T.gray400}}>₦{p.pricePerLitre?.toLocaleString()}/L</span>
                  </span>
                ))}
              </div>
              <button onClick={()=>setTab("products")} style={{background:"none",border:`1px solid ${T.gray200}`,padding:"7px 14px",fontSize:"11px",fontWeight:700,color:T.gray600,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Manage Products →</button>
            </SettingsBlock>
          </>
        )}
        {isBuyer?(
          <button onClick={handleSaveProfile} disabled={profileSaving} style={{background:saved?T.green:T.black,color:T.white,border:"none",padding:"12px 28px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px",transition:"background 0.2s",marginTop:"6px",opacity:profileSaving?0.6:1}}>
            {profileSaving?"Saving…":saved?"✓ Saved":"Save Changes"}
          </button>
        ):(
          <SaveBtn/>
        )}
      </div>
    ),

    notifications:(
      <div>
        <SettingsBlock title="Order Alerts">
          <NotifRow label="Order status updates" sub="Confirmation, dispatch, and delivery changes" on={notif.orderUpdates} onChange={v=>setNotif(n=>({...n,orderUpdates:v}))}/>
          <NotifRow label="SLA warnings" sub="Alert when approaching response deadline" on={notif.slaWarnings} onChange={v=>setNotif(n=>({...n,slaWarnings:v}))}/>
          <NotifRow label="Delivery confirmation" sub={isBuyer?"Notify when depot confirms dispatch":"Notify when buyer confirms receipt"} on={notif.deliveryConfirm} onChange={v=>setNotif(n=>({...n,deliveryConfirm:v}))}/>
          {isBuyer?(
            <NotifRow label="Price alerts" sub="Notify when depot prices change significantly" on={notif.priceAlerts} onChange={v=>setNotif(n=>({...n,priceAlerts:v}))}/>
          ):(
            <NotifRow label="Weekly summary report" sub="Volume, revenue, and utilisation digest" on={notif.weeklyReport} onChange={v=>setNotif(n=>({...n,weeklyReport:v}))}/>
          )}
        </SettingsBlock>
        <SettingsBlock title="Channels">
          <NotifRow label="Email" sub={isBuyer?"emeka@chukwumafuels.com":"ops@nepal-energies.com"} on={notif.emailCh} onChange={v=>setNotif(n=>({...n,emailCh:v}))}/>
          <NotifRow label="SMS" sub={authProfile?.phone||isBuyer?"+234 803 456 7890":"+234 802 345 6789"} on={notif.smsCh} onChange={v=>setNotif(n=>({...n,smsCh:v}))}/>
          <NotifRow label="Push notifications" sub="Browser and mobile push" on={notif.pushCh} onChange={v=>setNotif(n=>({...n,pushCh:v}))}/>
        </SettingsBlock>
        <button onClick={handleSaveNotifPrefs} disabled={notifSaving}
          style={{background:saved?T.green:T.black,color:T.white,border:"none",padding:"12px 28px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px",transition:"background 0.2s",marginTop:"6px",opacity:notifSaving?0.6:1}}>
          {notifSaving?"Saving…":saved?"✓ Saved":"Save Preferences"}
        </button>
      </div>
    ),

    wallet:(
      <div>
        <SettingsBlock title="Payout Wallet">
          <div style={{background:T.black,padding:"20px 22px",marginBottom:"14px"}}>
            <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>Available Balance</div>
            <div style={{fontSize:"30px",fontWeight:800,color:T.green,letterSpacing:"-0.02em"}}>{walletNGN?`₦${walletNGN.balanceNGN.toLocaleString('en-NG')}`:"—"}</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"4px"}}>Settlement Account · Auto-managed</div>
          </div>
          <div style={{border:`1px solid ${T.gray100}`,marginBottom:"12px"}}>
            {[["Account Name",authProfile?.company_name||"—"],["Account Number",authProfile?.bank_account||"—"],["Bank",authProfile?.bank_name||"—"],["Account Type","Settlement Account"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                <span style={{color:T.gray400,fontWeight:600}}>{k}</span>
                <span style={{color:T.black,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
          <button style={{background:T.green,color:T.black,border:"none",padding:"10px 20px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>+ Fund Wallet</button>
        </SettingsBlock>
        <SettingsBlock title="Withdrawal Account">
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
            <FieldRow label="Bank Name" value={authProfile?.bank_name||""}/>
            <FieldRow label="Account Number" value={authProfile?.bank_account||""}/>
          </div>
          <FieldRow label="Account Name" value={authProfile?.company_name||""} editable={false}/>
          <div style={{background:T.amberLight,padding:"10px 14px",marginBottom:"6px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
            Changes to your bank account require 48h verification.
          </div>
        </SettingsBlock>
        <SettingsBlock title="Spending Limits">
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
            <FieldRow label="Max order value (₦)" value="100,000,000" hint="Per single order"/>
            <FieldRow label="Daily transaction limit (₦)" value="250,000,000"/>
          </div>
        </SettingsBlock>
        <SaveBtn/>
      </div>
    ),

    bays:(
      <div>
        <SettingsBlock title="Bay Configuration">
          {bays.map((bay,i)=>(
            <div key={bay.id} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"16px",marginBottom:"12px",opacity:bay.active?1:0.6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{bay.id}</div>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>{bay.active?"Active":"Inactive"}</span>
                  <Toggle on={bay.active} onChange={v=>setBays(p=>p.map((b,j)=>j===i?{...b,active:v}:b))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <div style={{marginBottom:"12px"}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Capacity per Slot</div>
                  <div style={{border:`1px solid ${T.gray100}`,padding:"10px 14px",fontSize:"13px",fontWeight:700,color:T.gray600,background:T.gray50}}>{bay.capacity.toLocaleString()} L</div>
                </div>
                <div style={{marginBottom:"12px"}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Operating Hours</div>
                  <input value={bay.hours} onChange={e=>setBays(p=>p.map((b,j)=>j===i?{...b,hours:e.target.value}:b))}
                    style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 14px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
                </div>
              </div>
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Products</div>
                <div style={{display:"flex",gap:"7px",flexWrap:"wrap"}}>
                  {["PMS","AGO","DPK"].map(p=>{
                    const active=bay.products.includes(p);
                    return (
                      <button key={p} onClick={()=>setBays(prev=>prev.map((b,j)=>j===i?{...b,products:active?b.products.filter(x=>x!==p):[...b.products,p]}:b))}
                        style={{padding:"7px 16px",border:`2px solid ${active?T.black:T.gray200}`,background:active?T.black:T.white,color:active?T.white:T.gray400,fontFamily:F,fontSize:"12px",fontWeight:800,cursor:"pointer"}}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </SettingsBlock>
        <SaveBtn label="Save Bay Config"/>
      </div>
    ),

    products:(()=>{
      const ALL_PRODUCTS=[
        {id:"pms",  name:"PMS",  fullName:"Premium Motor Spirit",        unit:"L",  defaultPrice:795,  defaultThreshold:10000},
        {id:"ago",  name:"AGO",  fullName:"Automotive Gas Oil",          unit:"L",  defaultPrice:1185, defaultThreshold:8000},
        {id:"dpk",  name:"DPK",  fullName:"Dual Purpose Kerosene",       unit:"L",  defaultPrice:1338, defaultThreshold:5000},
        {id:"lpg",  name:"LPG",  fullName:"Liquefied Petroleum Gas",     unit:"kg", defaultPrice:1048, defaultThreshold:3000},
        {id:"atk",  name:"ATK",  fullName:"Aviation Turbine Kerosene",   unit:"L",  defaultPrice:1885, defaultThreshold:2500},
      ];
      const activeIds=new Set((depot?.products||[]).map(p=>p.id));
      const activeProducts=depot?.products||[];

      const toggleProduct=(pid)=>{
        if(!depot||!onUpdateDepot)return;
        if(activeIds.has(pid)){
          onUpdateDepot(depot.id,{products:activeProducts.filter(p=>p.id!==pid)});
        } else {
          const meta=ALL_PRODUCTS.find(p=>p.id===pid);
          if(!meta)return;
          onUpdateDepot(depot.id,{products:[...activeProducts,{id:meta.id,name:meta.name,pricePerLitre:meta.defaultPrice,stock:0,threshold:meta.defaultThreshold}]});
        }
      };

      const updateProductField=(pid,field,val)=>{
        if(!depot||!onUpdateDepot)return;
        onUpdateDepot(depot.id,{products:activeProducts.map(p=>p.id===pid?{...p,[field]:Number(val)||val}:p)});
      };

      return (
        <div>
          <SettingsBlock title="Available Products">
            <div style={{fontSize:"11px",color:T.gray400,fontWeight:600,marginBottom:"14px"}}>Toggle products on or off. Active products appear on your depot dashboard, inventory, and marketplace listing.</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"10px",marginBottom:"6px"}}>
              {ALL_PRODUCTS.map(meta=>{
                const on=activeIds.has(meta.id);
                return (
                  <div key={meta.id} onClick={()=>toggleProduct(meta.id)} style={{border:`2px solid ${on?T.black:T.gray100}`,background:on?T.black:T.white,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all 0.15s"}}>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:800,color:on?T.white:T.black}}>{meta.name}</div>
                      <div style={{fontSize:"10px",color:on?T.gray400:"#999",marginTop:"2px"}}>{meta.fullName}</div>
                    </div>
                    <div style={{width:"20px",height:"20px",borderRadius:"50%",border:`2px solid ${on?T.white:T.gray300}`,background:on?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {on&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.black} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingsBlock>

          {activeProducts.length>0&&(
            <SettingsBlock title="Product Configuration">
              <div style={{fontSize:"11px",color:T.gray400,fontWeight:600,marginBottom:"14px"}}>Set pricing and low-stock thresholds for each active product. Changes are reflected immediately on your dashboard.</div>
              {activeProducts.map(p=>(
                <div key={p.id} style={{border:`1px solid ${T.gray100}`,padding:"16px",marginBottom:"10px",background:T.white}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                      <div style={{background:T.black,color:T.white,padding:"4px 10px",fontSize:"11px",fontWeight:800}}>{p.name}</div>
                      <div style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>{ALL_PRODUCTS.find(m=>m.id===p.id)?.fullName}</div>
                    </div>
                    <button onClick={()=>setRemoveTargetProduct(p)} style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"5px 10px",fontSize:"10px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"30px"}}>Remove</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:"12px"}}>
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Price per Litre (₦)</div>
                      <input type="number" value={p.pricePerLitre} onChange={e=>updateProductField(p.id,"pricePerLitre",e.target.value)}
                        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Current Stock (L)</div>
                      <input type="number" value={p.stock} onChange={e=>updateProductField(p.id,"stock",e.target.value)}
                        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Low-Stock Alert (L)</div>
                      <input type="number" value={p.threshold} onChange={e=>updateProductField(p.id,"threshold",e.target.value)}
                        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                    </div>
                  </div>
                  {p.stock<p.threshold&&p.stock>0&&(
                    <div style={{marginTop:"10px",background:T.amberLight,padding:"8px 12px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
                      ⚠ Stock below threshold — reorder soon
                    </div>
                  )}
                  {p.stock===0&&(
                    <div style={{marginTop:"10px",background:T.redLight,padding:"8px 12px",fontSize:"11px",color:T.red,fontWeight:600}}>
                      ✕ Out of stock
                    </div>
                  )}
                </div>
              ))}
            </SettingsBlock>
          )}

          {activeProducts.length===0&&(
            <div style={{textAlign:"center",padding:"32px 20px",border:`1px dashed ${T.gray200}`,marginTop:"4px"}}>
              <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"6px"}}>No products added yet</div>
              <div style={{fontSize:"12px",color:T.gray400}}>Toggle products above to add them to your depot.</div>
            </div>
          )}
        </div>
      );
    })(),

    team:(<TeamSettings depot={depot} isMobile={isMobile}/>),

    security:(
      <div>
        <SettingsBlock title="Two-Factor Authentication">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:`1px solid ${T.gray100}`}}>
            <div>
              <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>2FA via SMS</div>
              <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{isBuyer?"+234 803 456 7890":"+234 802 345 6789"} · Required on every login</div>
            </div>
            <Toggle on={twoFA} onChange={setTwoFA}/>
          </div>
          {!twoFA&&(
            <div style={{background:T.redLight,padding:"10px 14px",marginTop:"10px",fontSize:"11px",color:T.red,fontWeight:600}}>
              Disabling 2FA reduces account security. Your wallet requires 2FA for all transactions.
            </div>
          )}
        </SettingsBlock>
        <SettingsBlock title="Password">
          {showPwForm?(
            <div>
              {[["Current Password","password"],["New Password","password"],["Confirm New Password","password"]].map(([l,t])=>(
                <FieldRow key={l} label={l} value="" type={t}/>
              ))}
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={()=>{handleSave();setTimeout(()=>setShowPwForm(false),1400);}} style={{background:saved?T.green:T.black,color:T.white,border:"none",padding:"11px 20px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>{saved?"✓ Updated":"Update Password"}</button>
                <button onClick={()=>setShowPwForm(false)} style={{background:T.white,color:T.gray400,border:`1px solid ${T.gray200}`,padding:"11px 20px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Cancel</button>
              </div>
            </div>
          ):(
            <button onClick={()=>setShowPwForm(true)} style={{background:T.white,color:T.black,border:`1px solid ${T.gray200}`,padding:"11px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Change Password →</button>
          )}
        </SettingsBlock>
        <SettingsBlock title="Active Sessions">
          {[{device:"MacBook Pro · Chrome",location:"Lagos, Nigeria",time:"Current session",current:true},{device:"iPhone 14 · Safari",location:"Lagos, Nigeria",time:"2h ago",current:false}].map(s=>(
            <div key={s.device} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${T.gray100}`,gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
              <div>
                <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{s.device}</div>
                <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{s.location} · {s.time}</div>
              </div>
              {s.current?(
                <span style={{background:T.greenLight,color:T.greenDark,fontSize:"10px",fontWeight:800,padding:"3px 8px",flexShrink:0}}>ACTIVE NOW</span>
              ):(
                <button style={{background:T.white,color:T.red,border:`1px solid ${T.red}`,padding:"5px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"32px"}}>Revoke</button>
              )}
            </div>
          ))}
        </SettingsBlock>
        <SettingsBlock title="API Access">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
            <div>
              <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>API Key</div>
              <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>For ERP and system integrations</div>
            </div>
            <button style={{background:T.black,color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"36px"}}>Regenerate Key</button>
          </div>
          <div style={{background:T.gray50,border:`1px solid ${T.gray100}`,padding:"11px 14px",fontFamily:"monospace",fontSize:"12px",color:T.gray400,letterSpacing:"0.04em",wordBreak:"break-all"}}>
            vtl_live_••••••••••••••••••••••••••••••••••••
          </div>
          <div style={{fontSize:"10px",color:T.gray400,marginTop:"6px",fontWeight:600}}>Keep your API key secret. Do not share it publicly.</div>
        </SettingsBlock>
      </div>
    ),
    verification:(()=>{
      const status=authProfile?.kyc_status;
      if(status==="verified") return (
        <div>
          <div style={{background:T.greenLight,border:`1px solid ${T.green}`,padding:"18px 20px",display:"flex",alignItems:"center",gap:"14px",marginBottom:"24px"}}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <div>
              <div style={{fontSize:"14px",fontWeight:800,color:T.greenDark}}>Identity Verified</div>
              <div style={{fontSize:"12px",color:T.greenDark,marginTop:"2px",opacity:0.8}}>Your account is fully verified. You can now create and manage depots.</div>
            </div>
          </div>
          <SettingsBlock title="Submitted Documents">
            {KYC_DOCS.map(doc=>(
              <div key={doc.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${T.gray100}`}}>
                <div>
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{doc.label}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{doc.hint}</div>
                </div>
                <Badge status="delivered"/>
              </div>
            ))}
          </SettingsBlock>
        </div>
      );
      if(status==="submitted") return (
        <div>
          <div style={{background:"#fffbeb",border:"1px solid #f59e0b",padding:"18px 20px",display:"flex",alignItems:"center",gap:"14px",marginBottom:"24px"}}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div>
              <div style={{fontSize:"14px",fontWeight:800,color:"#92400e"}}>Under Review</div>
              <div style={{fontSize:"12px",color:"#92400e",marginTop:"2px",opacity:0.8}}>Your documents are being reviewed. This typically takes 1–3 business days.</div>
            </div>
          </div>
          <SettingsBlock title="Submitted Documents">
            {KYC_DOCS.map(doc=>(
              <div key={doc.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${T.gray100}`}}>
                <div>
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{doc.label}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{doc.hint}</div>
                </div>
                <Badge status="pending"/>
              </div>
            ))}
          </SettingsBlock>
        </div>
      );
      return (
        <div>
          <div style={{background:T.gray50,border:`1px solid ${T.gray100}`,padding:"16px 18px",marginBottom:"22px"}}>
            <div style={{fontSize:"13px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Identity Verification (KYC)</div>
            <div style={{fontSize:"12px",color:T.gray400,lineHeight:1.6}}>
              Upload the required documents to verify your identity. All documents are encrypted and stored securely.
              Verification is required before you can create or manage depots.
            </div>
            <div style={{marginTop:"12px",display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{flex:1,height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}>
                <div style={{width:`${(kycDoneCount/kycReqDocs.length)*100}%`,height:"100%",background:kycAllDone?T.green:T.black,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontSize:"11px",fontWeight:700,color:T.gray400,flexShrink:0}}>{kycDoneCount}/{kycReqDocs.length} uploaded</div>
            </div>
          </div>
          <SettingsBlock title="Required Documents">
            {KYC_DOCS.map(doc=>{
              const uploaded=kycUploaded[doc.key];
              const uploading=kycUploading[doc.key];
              const err=kycUploadErr[doc.key];
              return(
                <div key={doc.key} style={{padding:"14px 0",borderBottom:`1px solid ${T.gray100}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap"}}>
                        <span style={{fontSize:"13px",fontWeight:700,color:T.black}}>{doc.label}</span>
                        {doc.required&&<span style={{fontSize:"9px",fontWeight:800,color:T.red,background:"#fff1f2",padding:"2px 6px"}}>REQUIRED</span>}
                        {uploaded&&<span style={{fontSize:"9px",fontWeight:800,color:T.green,background:T.greenLight,padding:"2px 6px"}}>✓ UPLOADED</span>}
                      </div>
                      <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>{doc.hint}</div>
                      {uploaded&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"3px",fontStyle:"italic"}}>{uploaded}</div>}
                      {err&&<div style={{fontSize:"11px",color:T.red,marginTop:"4px",fontWeight:600}}>{err}</div>}
                    </div>
                    <label style={{flexShrink:0,cursor:uploading?"not-allowed":"pointer"}}>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:"none"}}
                        disabled={uploading}
                        onChange={e=>{const f=e.target.files?.[0];if(f)handleKycUpload(doc,f);e.target.value="";}}
                      />
                      <div style={{background:uploaded?T.white:T.black,color:uploaded?T.black:T.white,border:`1px solid ${uploaded?T.gray200:T.black}`,padding:"8px 14px",fontSize:"11px",fontWeight:800,fontFamily:F,minWidth:"90px",textAlign:"center",opacity:uploading?0.6:1,minHeight:"36px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {uploading?"Uploading…":uploaded?"Re-upload":"Upload"}
                      </div>
                    </label>
                  </div>
                </div>
              );
            })}
          </SettingsBlock>
          {kycSubmitErr&&<div style={{color:T.red,fontSize:"12px",fontWeight:600,marginBottom:"10px"}}>{kycSubmitErr}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:"20px"}}>
            <button
              disabled={!kycAllDone||kycSubmitting}
              onClick={handleKycSubmit}
              style={{background:kycAllDone?(kycSubmitting?"#6b7280":T.black):T.gray200,color:kycAllDone?T.white:T.gray400,border:"none",padding:"13px 28px",fontSize:"13px",fontWeight:800,cursor:kycAllDone&&!kycSubmitting?"pointer":"not-allowed",fontFamily:F,minHeight:"46px",transition:"background 0.2s"}}
            >
              {kycSubmitting?"Submitting…":"Submit for Verification →"}
            </button>
          </div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"10px",textAlign:"right"}}>PDF, JPEG, PNG or WebP · max 10 MB per file</div>
        </div>
      );
    })(),
  };

  const activeTab=TABS.find(t=>t.id===tab);
  const SUBTITLES={
    profile:"Account information and verification documents",
    notifications:"Control which alerts you receive and how",
    wallet:"Multi-currency wallet, bank accounts, and spending limits",
    bays:"Configure bay availability, hours, and products",
    products:"Add, remove, and configure products available at this depot",
    team:"Manage team members and their access levels",
    security:"Password, 2FA, sessions, and API credentials",
    verification:"Upload KYC documents to verify your identity",
  };

  return (
    <>
    {removeTargetProduct&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:T.white,maxWidth:"360px",width:"100%",padding:"28px",fontFamily:F}}>
          <div style={{width:"40px",height:"40px",background:T.redLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",marginBottom:"14px"}}>✕</div>
          <div style={{fontSize:"15px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Remove {removeTargetProduct.name}?</div>
          <div style={{fontSize:"12px",color:T.gray600,lineHeight:1.6,marginBottom:"20px"}}>
            <strong>{removeTargetProduct.name} ({removeTargetProduct.fullName||removeTargetProduct.name})</strong> will be removed from your depot listing and marketplace. Existing active orders will not be affected.
          </div>
          <div style={{display:"flex",gap:"10px"}}>
            <button
              onClick={()=>{
                if(depot&&onUpdateDepot)
                  onUpdateDepot(depot.id,{products:(depot.products||[]).filter(p=>p.id!==removeTargetProduct.id)});
                setRemoveTargetProduct(null);
              }}
              style={{flex:1,background:T.red,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
              Remove
            </button>
            <button onClick={()=>setRemoveTargetProduct(null)}
              style={{flex:1,background:T.white,color:T.black,border:`1px solid ${T.gray200}`,padding:"12px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    <div style={{display:"flex",gap:"20px",alignItems:"flex-start",flexDirection:isMobile?"column":"row"}}>
      <div style={{width:isMobile?"100%":"196px",flexShrink:0}}>
        <div style={{background:T.white,border:`1px solid ${T.gray100}`,overflow:"hidden"}}>
          {TABS.map((t,i)=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:"9px",padding:"12px 14px",background:tab===t.id?T.black:T.white,color:tab===t.id?T.white:T.gray600,border:"none",borderBottom:i<TABS.length-1?`1px solid ${T.gray100}`:"none",cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:tab===t.id?800:600,textAlign:"left"}}>
              <Icon d={t.icon} size={14}/>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{marginBottom:"20px"}}>
          <div style={{fontSize:"16px",fontWeight:800,color:T.black}}>{activeTab?.label}</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>{SUBTITLES[tab]}</div>
        </div>
        {content[tab]}
      </div>
    </div>
    </>
  );
}

// Defined at module level so its identity is stable across renders (avoids focus-loss bug)

export { SettingsModule };
