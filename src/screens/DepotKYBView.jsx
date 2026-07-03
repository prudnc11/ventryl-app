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

function DepotKYBView({depot,isMobile}) {
  const {user}=useAuthStore();
  const {loadOwnerDepots}=useVentrylStore();
  const [files,setFiles]=useState({});       // { key: File }
  const [uploaded,setUploaded]=useState({}); // { key: filename } — confirmed uploads
  const [uploading,setUploading]=useState({});
  const [uploadErr,setUploadErr]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [submitted,setSubmitted]=useState(depot.kyb==="submitted"||depot.kyb==="verified");
  const [submitErr,setSubmitErr]=useState("");
  const [loadingDocs,setLoadingDocs]=useState(true);

  // Load already-uploaded docs from DB on mount
  useEffect(()=>{
    if(!depot.id){setLoadingDocs(false);return;}
    (async()=>{
      const {data}=await supabase.from("kyb_documents").select("type,file_name").eq("depot_id",depot.id);
      if(data&&data.length>0){
        const map={};
        data.forEach(d=>{map[d.type]=d.file_name;});
        setUploaded(map);
      }
      setLoadingDocs(false);
    })();
  },[depot.id]);

  const DOCS=[
    {key:"nmdpra_license",  label:"NMDPRA License Certificate",        required:true,  hint:"Current, unexpired license from the Dept. of Petroleum Resources"},
    {key:"cac_cert",        label:"CAC Registration (Form C02/C07)",   required:true,  hint:"Certificate of Incorporation from the Corporate Affairs Commission"},
    {key:"tax_clearance",   label:"FIRS Tax Clearance Certificate",    required:true,  hint:"Tax clearance for the last 3 fiscal years"},
    {key:"env_permit",      label:"DPR Environmental Permit",          required:true,  hint:"Valid environmental permit for the depot facility"},
    {key:"proof_of_address",label:"Utility Bill (Depot Address)",      required:false, hint:"Recent bill confirming the depot's physical address"},
  ];
  const reqDocs=DOCS.filter(d=>d.required);
  const doneCount=reqDocs.filter(d=>uploaded[d.key]).length;
  const allRequired=doneCount===reqDocs.length;

  const handleUpload=async(doc,file)=>{
    if(!file||!user) return;
    setUploading(u=>({...u,[doc.key]:true}));
    setUploadErr(e=>({...e,[doc.key]:""}));
    try{
      await kybApi.uploadDocument(depot.id,user.id,doc.key,file);
      setUploaded(u=>({...u,[doc.key]:file.name}));
      setFiles(f=>({...f,[doc.key]:file}));
    }catch(e){
      setUploadErr(err=>({...err,[doc.key]:e.message||"Upload failed"}));
    }finally{
      setUploading(u=>({...u,[doc.key]:false}));
    }
  };

  const handleSubmit=async()=>{
    if(!allRequired||!depot.id) return;
    setSubmitting(true);
    setSubmitErr("");
    try{
      await kybApi.submit(depot.id);
      setSubmitted(true);
      if(user?.id) loadOwnerDepots(user.id); // refresh store so depot.kyb reflects 'submitted'
    }catch(e){
      setSubmitErr(e.message||"Submission failed. Try again.");
    }finally{
      setSubmitting(false);
    }
  };

  if(loadingDocs) return <div style={{padding:"40px",textAlign:"center",fontSize:"12px",color:T.gray400,fontFamily:F}}>Loading documents…</div>;

  if(submitted) return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{width:"56px",height:"56px",background:T.greenLight,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:"22px"}}>✓</div>
      <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Documents Submitted</div>
      <div style={{fontSize:"13px",color:T.gray400,maxWidth:"360px",margin:"0 auto 24px"}}>Your KYB documents are under review. Verification typically takes 1–3 business days. You'll receive an SMS and email when approved.</div>
      <div style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"14px 18px",display:"inline-block",textAlign:"left",minWidth:"240px"}}>
        <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"8px"}}>Review Timeline</div>
        {[["Submitted","Now",T.green],["Document Check","Day 1",T.gray400],["Compliance Review","Day 1–2",T.gray400],["Approval","Day 2–3",T.gray400]].map(([l,t,c])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"12px",padding:"6px 0",borderBottom:`1px solid ${T.gray100}`}}>
            <span style={{fontWeight:600,color:T.black}}>{l}</span><span style={{color:c,fontWeight:700}}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const isRejected = depot.kyb === 'rejected';

  return (
    <div>
      {isRejected ? (
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"16px 18px",marginBottom:"20px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.red,marginBottom:"6px"}}>KYB Application Rejected</div>
          {depot.kybRejectionReason && (
            <div style={{background:T.white,border:`1px solid ${T.red}30`,padding:"10px 12px",marginBottom:"8px"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px"}}>Reason from Ventryl</div>
              <div style={{fontSize:"13px",color:T.black,fontWeight:600,lineHeight:1.5}}>{depot.kybRejectionReason}</div>
            </div>
          )}
          <div style={{fontSize:"11px",color:T.red,opacity:0.8}}>Please address the issue above, replace the relevant documents, and re-submit for review.</div>
        </div>
      ) : (
        <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"14px 18px",marginBottom:"20px"}}>
          <div style={{fontSize:"12px",fontWeight:800,color:"#8A5C00",marginBottom:"2px"}}>KYB Verification Required</div>
          <div style={{fontSize:"11px",color:"#8A5C00"}}>{depot.name} cannot receive orders until KYB documents are approved by Ventryl.</div>
        </div>
      )}

      {DOCS.map(doc=>{
        const done=!!uploaded[doc.key];
        const busy=!!uploading[doc.key];
        const err=uploadErr[doc.key];
        return (
          <div key={doc.key} style={{border:`1px solid ${done?T.green:err?T.red:T.gray100}`,background:T.white,padding:"16px",marginBottom:"10px",transition:"border-color 0.2s"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px",flexWrap:"wrap"}}>
                  <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{doc.label}</span>
                  {doc.required&&<span style={{background:T.redLight,color:T.red,fontSize:"9px",fontWeight:800,padding:"1px 5px"}}>REQUIRED</span>}
                </div>
                <div style={{fontSize:"11px",color:T.gray400}}>{doc.hint}</div>
                {done&&<div style={{fontSize:"11px",color:T.greenDark,fontWeight:700,marginTop:"5px"}}>✓ {uploaded[doc.key]}</div>}
                {err&&<div style={{fontSize:"11px",color:T.red,fontWeight:700,marginTop:"5px"}}>{err}</div>}
                {busy&&<div style={{fontSize:"11px",color:T.blue,fontWeight:700,marginTop:"5px"}}>Uploading…</div>}
              </div>
              <label style={{background:busy?T.gray200:done?T.greenLight:T.black,color:busy?T.gray400:done?T.greenDark:T.white,padding:"8px 16px",fontSize:"11px",fontWeight:800,cursor:busy?"not-allowed":"pointer",fontFamily:F,flexShrink:0,minHeight:"38px",display:"flex",alignItems:"center",border:"none"}}>
                {busy?"Uploading…":done?"✓ Replace":"Upload"}
                <input type="file" style={{display:"none"}} accept=".pdf,.jpg,.jpeg,.png" disabled={busy}
                  onChange={e=>e.target.files[0]&&handleUpload(doc,e.target.files[0])}/>
              </label>
            </div>
          </div>
        );
      })}

      <div style={{marginTop:"20px"}}>
        <div style={{fontSize:"11px",color:T.gray400,marginBottom:"8px",fontWeight:600}}>{doneCount}/{reqDocs.length} required documents uploaded</div>
        <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden",marginBottom:"16px"}}>
          <div style={{height:"100%",width:`${reqDocs.length>0?(doneCount/reqDocs.length)*100:0}%`,background:allRequired?T.green:T.amber,transition:"width 0.3s"}}/>
        </div>
        {submitErr&&<div style={{fontSize:"12px",color:T.red,fontWeight:700,marginBottom:"10px"}}>{submitErr}</div>}
        <button disabled={!allRequired||submitting} onClick={handleSubmit}
          style={{background:allRequired&&!submitting?T.black:T.gray200,color:allRequired&&!submitting?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:allRequired&&!submitting?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"48px"}}>
          {submitting?"Submitting…":"Submit for Verification →"}
        </button>
      </div>
    </div>
  );
}

export { DepotKYBView };
