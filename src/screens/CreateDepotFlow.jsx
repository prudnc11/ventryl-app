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

function DepotFormInput({label,value,onChange,type="text",hint,placeholder}) {
  return (
    <div style={{marginBottom:"16px"}}>
      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{label}</div>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 14px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
        onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
      {hint&&<div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>{hint}</div>}
    </div>
  );
}

const KYB_DOCS=[
  {key:"nmdpra_license",  label:"NMDPRA License Certificate",        required:true,  hint:"Current, unexpired license from the Dept. of Petroleum Resources"},
  {key:"cac_cert",        label:"CAC Registration (Form C02/C07)",   required:true,  hint:"Certificate of Incorporation from the Corporate Affairs Commission"},
  {key:"tax_clearance",   label:"FIRS Tax Clearance Certificate",    required:true,  hint:"Tax clearance for the last 3 fiscal years"},
  {key:"env_permit",      label:"DPR Environmental Permit",          required:true,  hint:"Valid environmental permit for the depot facility"},
  {key:"proof_of_address",label:"Utility Bill (Depot Address)",      required:false, hint:"Recent bill confirming the depot's physical address"},
];

function CreateDepotFlow({onCreateDepot,onDone,onCancel,isMobile}) {
  const {user}=useAuthStore();
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({name:"",location:"",state:"",lga:"",address:"",license:"",expiry:"",products:[],capacity:"",contactName:"",contactPhone:"",contactEmail:"",contactRole:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toggleProduct=p=>set("products",form.products.includes(p)?form.products.filter(x=>x!==p):[...form.products,p]);

  // Created depot (set after step 3 → 4 transition)
  const [createdDepot,setCreatedDepot]=useState(null);
  const [creating,setCreating]=useState(false);
  const [createErr,setCreateErr]=useState("");

  // KYB doc upload state
  const [uploaded,setUploaded]=useState({});   // { key: filename }
  const [uploading,setUploading]=useState({});
  const [uploadErr,setUploadErr]=useState({});

  // KYB submit state
  const [submitting,setSubmitting]=useState(false);
  const [submitErr,setSubmitErr]=useState("");
  const [submitted,setSubmitted]=useState(false);

  const canStep1=form.name.trim()&&form.location.trim()&&form.state.trim();
  const canStep2=form.license.trim()&&form.expiry&&form.products.length>0;
  const canStep3=form.contactName.trim()&&form.contactPhone.trim();
  const reqDocs=KYB_DOCS.filter(d=>d.required);
  const allRequiredUploaded=reqDocs.every(d=>uploaded[d.key]);

  const LABELS=["Details","License","Contact","Documents","Submit"];

  const goToKYB=async()=>{
    if(!canStep3) return;
    setCreating(true);
    setCreateErr("");
    try{
      // ── Diagnostic: verify session before attempting insert ──
      const {data:{session},error:sessErr}=await supabase.auth.getSession();
      console.log('[CreateDepot] session:', session?.user?.id, 'sessErr:', sessErr);
      if(!session) throw new Error('Session expired — please sign out and sign back in.');
      // ── End diagnostic ──
      const depot=await onCreateDepot(form);
      setCreatedDepot(depot);
      setStep(4);
    }catch(e){
      console.error('[CreateDepotFlow] create failed:', e.name, e.message, e);
      setCreateErr(e.message||"Failed to create depot. Please try again.");
    }finally{
      setCreating(false);
    }
  };

  const handleUpload=async(doc,file)=>{
    if(!file||!user||!createdDepot) return;
    setUploading(u=>({...u,[doc.key]:true}));
    setUploadErr(e=>({...e,[doc.key]:""}));
    try{
      await kybApi.uploadDocument(createdDepot.id,user.id,doc.key,file);
      setUploaded(u=>({...u,[doc.key]:file.name}));
    }catch(e){
      setUploadErr(err=>({...err,[doc.key]:e.message||"Upload failed"}));
    }finally{
      setUploading(u=>({...u,[doc.key]:false}));
    }
  };

  const handleSubmitKYB=async()=>{
    if(!createdDepot) return;
    setSubmitting(true);
    setSubmitErr("");
    try{
      await kybApi.submit(createdDepot.id);
      setSubmitted(true);
    }catch(e){
      setSubmitErr(e.message||"Submission failed. Try again.");
    }finally{
      setSubmitting(false);
    }
  };

  const btnBase={border:"none",fontFamily:F,cursor:"pointer",width:"100%",minHeight:"48px",fontSize:"13px",fontWeight:800,padding:"13px"};

  return (
    <div style={{maxWidth:"560px",margin:"0 auto",padding:isMobile?"0":"0 8px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"24px"}}>
        <div style={{fontSize:"18px",fontWeight:800,color:T.black}}>Create New Depot</div>
        <button onClick={onCancel} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,padding:0}}>Cancel ✕</button>
      </div>

      {/* Step indicator */}
      <div style={{display:"flex",alignItems:"center",marginBottom:"28px"}}>
        {LABELS.map((s,i,arr)=>(
          <div key={s} style={{display:"flex",alignItems:"center",flex:i<arr.length-1?"1":"0"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px",whiteSpace:"nowrap"}}>
              <div style={{width:"24px",height:"24px",borderRadius:"50%",background:step>i+1?T.green:step===i+1?T.black:T.gray200,color:step>=i+1?T.white:T.gray400,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:800,flexShrink:0,transition:"all 0.2s"}}>{step>i+1?"✓":i+1}</div>
              {!isMobile&&<span style={{fontSize:"11px",fontWeight:700,color:step===i+1?T.black:T.gray400}}>{s}</span>}
            </div>
            {i<arr.length-1&&<div style={{flex:1,height:"2px",background:step>i+1?T.green:T.gray200,margin:"0 8px",transition:"background 0.2s"}}/>}
          </div>
        ))}
      </div>

      {/* Step 1: Depot Details */}
      {step===1&&(
        <div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"18px"}}>Depot Details</div>
          <DepotFormInput label="Depot Name" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Nepal Energies" hint="Official registered name of your depot"/>
          <DepotFormInput label="State *" value={form.state} onChange={e=>set("state",e.target.value)} placeholder="e.g. Lagos" hint="Nigerian state where the depot is located"/>
          <DepotFormInput label="City / LGA" value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Apapa"/>
          <DepotFormInput label="Full Address" value={form.address} onChange={e=>set("address",e.target.value)} placeholder="e.g. Tank Farm Road, Apapa, Lagos"/>
          <button disabled={!canStep1} onClick={()=>setStep(2)} style={{...btnBase,background:canStep1?T.black:T.gray200,color:canStep1?T.white:T.gray400,cursor:canStep1?"pointer":"not-allowed"}}>Continue →</button>
        </div>
      )}

      {/* Step 2: License & Products */}
      {step===2&&(
        <div>
          <button onClick={()=>setStep(1)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"18px"}}>License & Products</div>
          <DepotFormInput label="NMDPRA License No." value={form.license} onChange={e=>set("license",e.target.value)} placeholder="e.g. DL-2024-APR-0099" hint="Department of Petroleum Resources license number"/>
          <DepotFormInput label="License Expiry Date" value={form.expiry} onChange={e=>set("expiry",e.target.value)} type="date"/>
          <DepotFormInput label="Tank Capacity (Litres)" value={form.capacity} onChange={e=>set("capacity",e.target.value)} type="number" placeholder="e.g. 85000"/>
          <div style={{marginBottom:"16px"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Products Handled</div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {["PMS","AGO","DPK","LPG"].map(p=>{const on=form.products.includes(p);return(
                <button key={p} onClick={()=>toggleProduct(p)} style={{padding:"9px 18px",border:`2px solid ${on?T.black:T.gray200}`,background:on?T.black:T.white,color:on?T.white:T.gray400,fontFamily:F,fontSize:"13px",fontWeight:800,cursor:"pointer"}}>{p}</button>
              );})}
            </div>
          </div>
          <button disabled={!canStep2} onClick={()=>setStep(3)} style={{...btnBase,background:canStep2?T.black:T.gray200,color:canStep2?T.white:T.gray400,cursor:canStep2?"pointer":"not-allowed"}}>Continue →</button>
        </div>
      )}

      {/* Step 3: Operations Contact */}
      {step===3&&(
        <div>
          <button onClick={()=>setStep(2)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Operations Contact</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>Person responsible for day-to-day depot operations.</div>
          <DepotFormInput label="Full Name *" value={form.contactName} onChange={e=>set("contactName",e.target.value)} placeholder="e.g. Aminu Bello"/>
          <DepotFormInput label="Phone Number *" value={form.contactPhone} onChange={e=>set("contactPhone",e.target.value)} placeholder="e.g. +234 803 000 0000" hint="Must be reachable during loading operations"/>
          <DepotFormInput label="Email Address" value={form.contactEmail} onChange={e=>set("contactEmail",e.target.value)} placeholder="e.g. ops@nepalenergies.ng" type="email"/>
          <DepotFormInput label="Role / Designation" value={form.contactRole} onChange={e=>set("contactRole",e.target.value)} placeholder="e.g. Operations Manager"/>
          {createErr&&<div style={{color:"#c0392b",fontSize:"12px",fontWeight:600,marginBottom:"12px",padding:"10px 14px",background:"#fef2f2",border:"1px solid #fca5a5"}}>{createErr}</div>}
          <button disabled={!canStep3||creating} onClick={goToKYB} style={{...btnBase,background:canStep3&&!creating?T.black:T.gray200,color:canStep3&&!creating?T.white:T.gray400,cursor:canStep3&&!creating?"pointer":"not-allowed"}}>
            {creating?"Creating depot…":"Continue →"}
          </button>
        </div>
      )}

      {/* Step 4: KYB Documents */}
      {step===4&&(
        <div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>KYB Documents</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"16px"}}>Upload required documents to verify your depot. Required docs are marked with *.</div>
          <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"11px 14px",marginBottom:"18px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
            Depot created. Upload documents now or skip and submit them later from the KYB tab.
          </div>
          {KYB_DOCS.map(doc=>{
            const isUploaded=!!uploaded[doc.key];
            const isUploading=!!uploading[doc.key];
            const err=uploadErr[doc.key];
            return(
              <div key={doc.key} style={{border:`1px solid ${isUploaded?T.green:T.gray200}`,padding:"14px 16px",marginBottom:"10px",background:isUploaded?T.greenLight:T.white}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"12px",fontWeight:800,color:T.black,marginBottom:"2px"}}>{doc.label}{doc.required&&<span style={{color:"#c0392b"}}> *</span>}</div>
                    <div style={{fontSize:"11px",color:T.gray400,marginBottom:"6px"}}>{doc.hint}</div>
                    {isUploaded&&<div style={{fontSize:"11px",color:T.green,fontWeight:700}}>✓ {uploaded[doc.key]}</div>}
                    {err&&<div style={{fontSize:"11px",color:"#c0392b",fontWeight:600}}>{err}</div>}
                  </div>
                  <label style={{flexShrink:0,cursor:isUploading?"not-allowed":"pointer"}}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} disabled={isUploading} onChange={e=>{const f=e.target.files?.[0];if(f)handleUpload(doc,f);e.target.value="";}}/>
                    <div style={{padding:"7px 14px",border:`1px solid ${isUploaded?T.green:T.gray200}`,background:isUploaded?T.green:T.white,color:isUploaded?T.white:T.black,fontSize:"11px",fontWeight:800,whiteSpace:"nowrap"}}>
                      {isUploading?"Uploading…":isUploaded?"Replace":"Upload"}
                    </div>
                  </label>
                </div>
              </div>
            );
          })}
          <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
            <button onClick={()=>setStep(5)} style={{...btnBase,background:T.gray100,color:T.gray400,flex:"0 0 auto",width:"auto",padding:"13px 20px"}}>Skip for now</button>
            <button disabled={!allRequiredUploaded} onClick={()=>setStep(5)} style={{...btnBase,flex:1,background:allRequiredUploaded?T.green:T.gray200,color:allRequiredUploaded?T.white:T.gray400,cursor:allRequiredUploaded?"pointer":"not-allowed"}}>
              Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {step===5&&(
        <div>
          {!submitted?(
            <>
              <button onClick={()=>setStep(4)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
              <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"16px"}}>Review & Submit</div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Depot Info</div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
                {[["Depot Name",form.name],["Location",form.location],["Address",form.address||"—"],["NMDPRA License",form.license],["License Expiry",form.expiry||"—"],["Capacity",form.capacity?`${Number(form.capacity).toLocaleString()} L`:"—"],["Products",form.products.join(", ")||"—"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600}}>{k}</span><span style={{color:T.black,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Operations Contact</div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
                {[["Name",form.contactName],["Phone",form.contactPhone],["Email",form.contactEmail||"—"],["Role",form.contactRole||"—"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600}}>{k}</span><span style={{color:T.black,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Documents</div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"16px"}}>
                {KYB_DOCS.map(doc=>{
                  const done=!!uploaded[doc.key];
                  return(
                    <div key={doc.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                      <span style={{color:T.gray400,fontWeight:600}}>{doc.label}{doc.required&&<span style={{color:"#c0392b"}}> *</span>}</span>
                      <span style={{color:done?T.green:"#c0392b",fontWeight:800}}>{done?"✓ Uploaded":doc.required?"Missing":"—"}</span>
                    </div>
                  );
                })}
              </div>
              {!allRequiredUploaded&&(
                <div style={{background:"#fef2f2",border:"1px solid #fca5a5",padding:"11px 14px",marginBottom:"14px",fontSize:"11px",color:"#c0392b",fontWeight:600}}>
                  Some required documents are missing. You can still submit the depot for KYB review later from the KYB tab.
                </div>
              )}
              {submitErr&&<div style={{color:"#c0392b",fontSize:"12px",fontWeight:600,marginBottom:"12px",padding:"10px 14px",background:"#fef2f2",border:"1px solid #fca5a5"}}>{submitErr}</div>}
              <div style={{display:"flex",gap:"10px"}}>
                {!allRequiredUploaded&&(
                  <button onClick={()=>onDone(createdDepot?.id)} style={{...btnBase,background:T.gray100,color:T.black,flex:"0 0 auto",width:"auto",padding:"13px 20px"}}>Go to Depot</button>
                )}
                <button disabled={!allRequiredUploaded||submitting} onClick={handleSubmitKYB} style={{...btnBase,flex:1,background:allRequiredUploaded&&!submitting?T.green:T.gray200,color:allRequiredUploaded&&!submitting?T.white:T.gray400,cursor:allRequiredUploaded&&!submitting?"pointer":"not-allowed"}}>
                  {submitting?"Submitting…":"Submit for KYB Review →"}
                </button>
              </div>
            </>
          ):(
            <div style={{textAlign:"center",padding:"32px 20px"}}>
              <div style={{width:"56px",height:"56px",background:T.greenLight,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:"22px"}}>✓</div>
              <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Documents Submitted!</div>
              <div style={{fontSize:"13px",color:T.gray400,maxWidth:"360px",margin:"0 auto 24px"}}>Your KYB documents are under review. Verification typically takes 1–3 business days. You'll receive an SMS and email when approved.</div>
              <div style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"14px 18px",marginBottom:"24px",textAlign:"left"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"8px"}}>Review Timeline</div>
                {[["Submitted","Now",T.green],["Document Check","Day 1",T.gray400],["Compliance Review","Day 1–2",T.gray400],["Approval","Day 2–3",T.gray400]].map(([l,t,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"12px",padding:"6px 0",borderBottom:`1px solid ${T.gray100}`}}>
                    <span style={{fontWeight:600,color:T.black}}>{l}</span><span style={{color:c,fontWeight:700}}>{t}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>onDone(createdDepot?.id)} style={{...btnBase,background:T.black,color:T.white}}>Go to Depot →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { CreateDepotFlow };
