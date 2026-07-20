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
import { kyc as kycApi, kyb as kybApi, notifications as notifApi, depots as depotsApi, profiles as profilesApi, orders as ordersApi, negotiations as negotiationsApi, teamMembers as teamMembersApi, companies as companiesApi } from "../lib/api";
import { supabase } from "../lib/supabase";
import { printWaybill, printInvoice } from "../lib/documents";
import { openPaystackPopup, verifyAndCreditWallet, FUND_PRESETS } from "../lib/payment";
import { useOrderRealtime, useDepotInboxRealtime, useProfileRealtime } from "../lib/realtime";
import { useDepotContext } from "../context/DepotContext";

function DepotFormInput({label,value,onChange,type="text",hint,placeholder,required}) {
  return (
    <div style={{marginBottom:"16px"}}>
      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{label}{required&&<span style={{color:"#c0392b"}}> *</span>}</div>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 14px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
        onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
      {hint&&<div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>{hint}</div>}
    </div>
  );
}

const KYB_DOCS_DEPOT=[
  {key:"nmdpra_license",  label:"NMDPRA License Certificate",        required:true,  hint:"Current, unexpired license from the Dept. of Petroleum Resources"},
  {key:"cac_cert",        label:"CAC Registration (Form C02/C07)",   required:true,  hint:"Certificate of Incorporation from the Corporate Affairs Commission"},
  {key:"tax_clearance",   label:"FIRS Tax Clearance Certificate",    required:true,  hint:"Tax clearance for the last 3 fiscal years"},
  {key:"env_permit",      label:"DPR Environmental Permit",          required:true,  hint:"Valid environmental permit for the depot facility"},
  {key:"proof_of_address",label:"Utility Bill (Depot Address)",      required:false, hint:"Recent bill confirming the depot's physical address"},
];

const KYB_DOCS_STOCK_POINT=[
  {key:"lease_agreement", label:"Throughput / Lease Agreement",      required:true,  hint:"Signed lease or throughput agreement for this stock point"},
  {key:"cac_cert",        label:"CAC Registration (Form C02/C07)",   required:true,  hint:"Certificate of Incorporation from the Corporate Affairs Commission"},
  {key:"tax_clearance",   label:"FIRS Tax Clearance Certificate",    required:true,  hint:"Tax clearance for the last 3 fiscal years"},
  {key:"proof_of_address",label:"Utility Bill (Location Address)",   required:false, hint:"Recent bill confirming the location's physical address"},
];

function isValidUrl(str) {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

function CreateDepotFlow({onCreateDepot,onDone,onCancel,isMobile}) {
  const {user}=useAuthStore();
  const {ownerCompany,ownerCompanyLoaded,loadOwnerCompany}=useVentrylStore();

  // Load existing company on mount
  useEffect(()=>{if(user?.id&&!ownerCompanyLoaded)loadOwnerCompany(user.id);},[user?.id]);

  const [step,setStep]=useState(1);
  const [form,setForm]=useState({
    // Company fields
    companyName:"",companyWebsite:"",companyLogo:null,
    // Location fields
    locationType:"depot", // "depot" | "stock_point"
    name:"",location:"",state:"",lga:"",address:"",
    // Depot verification
    license:"",expiry:"",
    // Stock Point verification
    leaseExpiry:"",leaseFile:null,leaseFileName:"",
    // Shared
    products:[],capacity:"",vatPercent:"7.5",
    contactName:"",contactPhone:"",contactEmail:"",contactRole:""
  });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toggleProduct=p=>set("products",form.products.includes(p)?form.products.filter(x=>x!==p):[...form.products,p]);

  // Company state
  const [companyId,setCompanyId]=useState(null);
  const [companyCreating,setCompanyCreating]=useState(false);
  const [companyErr,setCompanyErr]=useState("");
  const hasExistingCompany=!!ownerCompany;

  // Set company ID if already exists
  useEffect(()=>{if(ownerCompany){setCompanyId(ownerCompany.id);}},[ownerCompany]);

  // Created depot (set after step 4 → 5 transition)
  const [createdDepot,setCreatedDepot]=useState(null);
  const [creating,setCreating]=useState(false);
  const [createErr,setCreateErr]=useState("");

  // Lease upload state
  const [leaseUploading,setLeaseUploading]=useState(false);
  const [leaseUploadErr,setLeaseUploadErr]=useState("");
  const [leaseUploadedPath,setLeaseUploadedPath]=useState(null);

  // KYB doc upload state
  const [uploaded,setUploaded]=useState({});
  const [uploading,setUploading]=useState({});
  const [uploadErr,setUploadErr]=useState({});

  // KYB submit state
  const [submitting,setSubmitting]=useState(false);
  const [submitErr,setSubmitErr]=useState("");
  const [submitted,setSubmitted]=useState(false);

  // Validation
  const canStep1=hasExistingCompany||(form.companyName.trim()&&(!form.companyWebsite.trim()||isValidUrl(form.companyWebsite.trim())));
  const canStep2=form.name.trim()&&form.state.trim();
  const canStep3=form.locationType==="depot"
    ?(form.license.trim()&&form.expiry&&form.products.length>0)
    :(form.leaseExpiry&&form.products.length>0);
  const canStep4=form.contactName.trim()&&form.contactPhone.trim();

  const KYB_DOCS=form.locationType==="depot"?KYB_DOCS_DEPOT:KYB_DOCS_STOCK_POINT;
  const reqDocs=KYB_DOCS.filter(d=>d.required);
  const allRequiredUploaded=reqDocs.every(d=>uploaded[d.key]);

  const LABELS=["Company","Location","Verification","Contact","Documents","Submit"];

  // Step 1 → 2: Create or use existing company
  const goToStep2=async()=>{
    if(hasExistingCompany){setStep(2);return;}
    if(!form.companyName.trim()){setCompanyErr("Company name is required.");return;}
    if(form.companyWebsite.trim()&&!isValidUrl(form.companyWebsite.trim())){setCompanyErr("Please enter a valid URL (e.g. https://example.com).");return;}
    setCompanyCreating(true);
    setCompanyErr("");
    try{
      const company=await companiesApi.create({
        ownerId:user.id,
        name:form.companyName.trim(),
        website:form.companyWebsite.trim()||null,
        logoFile:form.companyLogo,
      });
      setCompanyId(company.id);
      await loadOwnerCompany(user.id);
      setStep(2);
    }catch(e){
      setCompanyErr(e.message||"Failed to create company.");
    }finally{
      setCompanyCreating(false);
    }
  };

  // Handle lease agreement upload (Stock Point step 3)
  const handleLeaseUpload=async(file)=>{
    if(!file||!user) return;
    setLeaseUploading(true);
    setLeaseUploadErr("");
    try{
      // We'll store it temporarily — actual depot ID assigned after creation
      set("leaseFile",file);
      set("leaseFileName",file.name);
    }catch(e){
      setLeaseUploadErr(e.message||"Upload failed");
    }finally{
      setLeaseUploading(false);
    }
  };

  const goToKYB=async()=>{
    if(!canStep4) return;
    setCreating(true);
    setCreateErr("");
    try{
      const {data:{session},error:sessErr}=await supabase.auth.getSession();
      if(!session) throw new Error('Session expired — please sign out and sign back in.');

      // Upload lease agreement if stock point
      let leaseUrl=null;
      if(form.locationType==="stock_point"&&form.leaseFile){
        // Use a temp ID for path, will be associated after creation
        const compressed=form.leaseFile;
        const ext=compressed.name.split('.').pop().toLowerCase();
        const path=`${user.id}/lease-temp-${Date.now()}.${ext}`;
        const {error:upErr}=await supabase.storage
          .from('kyb-documents')
          .upload(path,compressed,{upsert:true,contentType:compressed.type});
        if(upErr) throw new Error(upErr.message||"Failed to upload lease agreement");
        leaseUrl=path;
      }

      const depot=await onCreateDepot({...form,companyId,leaseAgreementUrl:leaseUrl});
      setCreatedDepot(depot);
      setStep(5);
    }catch(e){
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
        <div style={{fontSize:"18px",fontWeight:800,color:T.black}}>Create New Location</div>
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

      {/* Step 1: Company */}
      {step===1&&(
        <div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Company</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"18px"}}>Your company owns all depot locations you register.</div>

          {!ownerCompanyLoaded?(
            <div style={{padding:"32px",textAlign:"center",fontSize:"13px",color:T.gray400}}>Loading...</div>
          ):hasExistingCompany?(
            <div style={{border:`1px solid ${T.green}`,background:T.greenLight,padding:"16px",marginBottom:"16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                {ownerCompany.logo_url&&<img src={ownerCompany.logo_url} alt="" style={{width:"40px",height:"40px",objectFit:"contain",borderRadius:"4px",background:T.white,border:`1px solid ${T.gray100}`}}/>}
                <div>
                  <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{ownerCompany.name}</div>
                  {ownerCompany.website&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{ownerCompany.website}</div>}
                  <div style={{fontSize:"10px",color:T.greenDark,fontWeight:700,marginTop:"4px"}}>✓ Company registered</div>
                </div>
              </div>
            </div>
          ):(
            <>
              <DepotFormInput label="Company Name" value={form.companyName} onChange={e=>set("companyName",e.target.value)} placeholder="e.g. Nepal Petroleum Ltd." hint="Registered business name" required/>
              <DepotFormInput label="Website" value={form.companyWebsite} onChange={e=>set("companyWebsite",e.target.value)} placeholder="e.g. https://nepalenergies.ng" hint="Must be a valid URL starting with http:// or https://"/>
              <div style={{marginBottom:"16px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Company Logo</div>
                <label style={{display:"inline-block",cursor:"pointer"}}>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" style={{display:"none"}} onChange={e=>{
                    const f=e.target.files?.[0];
                    if(f){
                      if(f.size>2*1024*1024){setCompanyErr("Logo must be under 2MB.");return;}
                      set("companyLogo",f);
                    }
                    e.target.value="";
                  }}/>
                  <div style={{padding:"8px 16px",border:`1px solid ${T.gray200}`,background:T.white,fontSize:"11px",fontWeight:800,color:T.black}}>
                    {form.companyLogo?`✓ ${form.companyLogo.name}`:"Upload Logo"}
                  </div>
                </label>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>JPG, PNG, WebP, or SVG · Max 2MB</div>
              </div>
            </>
          )}
          {companyErr&&<div style={{color:"#c0392b",fontSize:"12px",fontWeight:600,marginBottom:"12px",padding:"10px 14px",background:"#fef2f2",border:"1px solid #fca5a5"}}>{companyErr}</div>}
          <button disabled={!canStep1||companyCreating} onClick={goToStep2} style={{...btnBase,background:canStep1&&!companyCreating?T.black:T.gray200,color:canStep1&&!companyCreating?T.white:T.gray400,cursor:canStep1&&!companyCreating?"pointer":"not-allowed"}}>
            {companyCreating?"Creating company…":"Continue →"}
          </button>
        </div>
      )}

      {/* Step 2: Location Details */}
      {step===2&&(
        <div>
          <button onClick={()=>setStep(1)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Location Details</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"18px"}}>Register a depot or stock point under {ownerCompany?.name||form.companyName}.</div>

          {/* Location Type Toggle */}
          <div style={{marginBottom:"18px"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Location Type</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              {[
                {id:"depot",label:"Depot",sub:"NMDPRA-licensed petroleum depot"},
                {id:"stock_point",label:"Stock Point",sub:"Leased or throughput storage location"},
              ].map(opt=>{
                const active=form.locationType===opt.id;
                return(
                  <div key={opt.id} role="button" tabIndex={0} onClick={()=>set("locationType",opt.id)}
                    style={{border:`2px solid ${active?T.black:T.gray200}`,background:active?T.black:T.white,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s"}}>
                    <div style={{fontSize:"13px",fontWeight:800,color:active?T.white:T.black,marginBottom:"3px"}}>{opt.label}</div>
                    <div style={{fontSize:"10px",color:active?"rgba(255,255,255,0.6)":T.gray400,lineHeight:1.4}}>{opt.sub}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <DepotFormInput label={`${form.locationType==="depot"?"Depot":"Stock Point"} Name`} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Nepal Energies Apapa" hint="Official registered name" required/>
          <DepotFormInput label="State" value={form.state} onChange={e=>set("state",e.target.value)} placeholder="e.g. Lagos" hint="Nigerian state" required/>
          <DepotFormInput label="City / LGA" value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Apapa"/>
          <DepotFormInput label="Full Address" value={form.address} onChange={e=>set("address",e.target.value)} placeholder="e.g. Tank Farm Road, Apapa, Lagos"/>
          <button disabled={!canStep2} onClick={()=>setStep(3)} style={{...btnBase,background:canStep2?T.black:T.gray200,color:canStep2?T.white:T.gray400,cursor:canStep2?"pointer":"not-allowed"}}>Continue →</button>
        </div>
      )}

      {/* Step 3: Verification & Products */}
      {step===3&&(
        <div>
          <button onClick={()=>setStep(2)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>
            {form.locationType==="depot"?"License & Products":"Lease & Products"}
          </div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"18px"}}>
            {form.locationType==="depot"
              ?"Provide your NMDPRA license details and select products."
              :"Upload your throughput or lease agreement and select products."}
          </div>

          {form.locationType==="depot"?(
            <>
              <DepotFormInput label="NMDPRA License No." value={form.license} onChange={e=>set("license",e.target.value)} placeholder="e.g. DL-2024-APR-0099" hint="Department of Petroleum Resources license number" required/>
              <DepotFormInput label="License Expiry Date" value={form.expiry} onChange={e=>set("expiry",e.target.value)} type="date" required/>
            </>
          ):(
            <>
              {/* Lease agreement upload */}
              <div style={{marginBottom:"16px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Throughput / Lease Agreement <span style={{color:"#c0392b"}}>*</span></div>
                <label style={{display:"inline-block",cursor:leaseUploading?"not-allowed":"pointer"}}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} disabled={leaseUploading} onChange={e=>{
                    const f=e.target.files?.[0];if(f)handleLeaseUpload(f);e.target.value="";
                  }}/>
                  <div style={{padding:"8px 16px",border:`1px solid ${form.leaseFileName?T.green:T.gray200}`,background:form.leaseFileName?T.greenLight:T.white,fontSize:"11px",fontWeight:800,color:form.leaseFileName?T.greenDark:T.black}}>
                    {leaseUploading?"Uploading…":form.leaseFileName?`✓ ${form.leaseFileName}`:"Upload Agreement"}
                  </div>
                </label>
                {leaseUploadErr&&<div style={{fontSize:"11px",color:"#c0392b",marginTop:"4px"}}>{leaseUploadErr}</div>}
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>PDF, JPG, or PNG</div>
              </div>
              <DepotFormInput label="Lease / Agreement Expiry Date" value={form.leaseExpiry} onChange={e=>set("leaseExpiry",e.target.value)} type="date" required/>
            </>
          )}

          <DepotFormInput label="Tank Capacity (Litres)" value={form.capacity} onChange={e=>set("capacity",e.target.value)} type="number" placeholder="e.g. 85000"/>
          <DepotFormInput label="VAT Rate (%)" value={form.vatPercent} onChange={e=>set("vatPercent",e.target.value)} type="number" placeholder="7.5" hint="Value Added Tax percentage applied to orders. Default is 7.5%"/>
          <div style={{marginBottom:"16px"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Products Handled</div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {["PMS","AGO","DPK","LPG"].map(p=>{const on=form.products.includes(p);return(
                <button key={p} onClick={()=>toggleProduct(p)} style={{padding:"9px 18px",border:`2px solid ${on?T.black:T.gray200}`,background:on?T.black:T.white,color:on?T.white:T.gray400,fontFamily:F,fontSize:"13px",fontWeight:800,cursor:"pointer"}}>{p}</button>
              );})}
            </div>
          </div>
          <button disabled={!canStep3} onClick={()=>setStep(4)} style={{...btnBase,background:canStep3?T.black:T.gray200,color:canStep3?T.white:T.gray400,cursor:canStep3?"pointer":"not-allowed"}}>Continue →</button>
        </div>
      )}

      {/* Step 4: Operations Contact */}
      {step===4&&(
        <div>
          <button onClick={()=>setStep(3)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Operations Contact</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>Person responsible for day-to-day operations.</div>
          <DepotFormInput label="Full Name" value={form.contactName} onChange={e=>set("contactName",e.target.value)} placeholder="e.g. Aminu Bello" required/>
          <DepotFormInput label="Phone Number" value={form.contactPhone} onChange={e=>set("contactPhone",e.target.value)} placeholder="e.g. +234 803 000 0000" hint="Must be reachable during loading operations" required/>
          <DepotFormInput label="Email Address" value={form.contactEmail} onChange={e=>set("contactEmail",e.target.value)} placeholder="e.g. ops@nepalenergies.ng" type="email"/>
          <DepotFormInput label="Role / Designation" value={form.contactRole} onChange={e=>set("contactRole",e.target.value)} placeholder="e.g. Operations Manager"/>
          {createErr&&<div style={{color:"#c0392b",fontSize:"12px",fontWeight:600,marginBottom:"12px",padding:"10px 14px",background:"#fef2f2",border:"1px solid #fca5a5"}}>{createErr}</div>}
          <button disabled={!canStep4||creating} onClick={goToKYB} style={{...btnBase,background:canStep4&&!creating?T.black:T.gray200,color:canStep4&&!creating?T.white:T.gray400,cursor:canStep4&&!creating?"pointer":"not-allowed"}}>
            {creating?"Creating location…":"Continue →"}
          </button>
        </div>
      )}

      {/* Step 5: KYB Documents */}
      {step===5&&(
        <div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>KYB Documents</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"16px"}}>Upload required documents to verify your {form.locationType==="depot"?"depot":"stock point"}. Required docs are marked with *.</div>
          <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"11px 14px",marginBottom:"18px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
            {form.locationType==="depot"?"Depot":"Stock Point"} created. Upload documents now or skip and submit them later from the KYB tab.
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
            <button onClick={()=>setStep(6)} style={{...btnBase,background:T.gray100,color:T.gray400,flex:"0 0 auto",width:"auto",padding:"13px 20px"}}>Skip for now</button>
            <button disabled={!allRequiredUploaded} onClick={()=>setStep(6)} style={{...btnBase,flex:1,background:allRequiredUploaded?T.green:T.gray200,color:allRequiredUploaded?T.white:T.gray400,cursor:allRequiredUploaded?"pointer":"not-allowed"}}>
              Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Review & Submit */}
      {step===6&&(
        <div>
          {!submitted?(
            <>
              <button onClick={()=>setStep(5)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
              <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"16px"}}>Review & Submit</div>

              {/* Company Info */}
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Company</div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
                {[["Company",ownerCompany?.name||form.companyName],["Website",ownerCompany?.website||form.companyWebsite||"—"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600}}>{k}</span><span style={{color:T.black,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Location Info */}
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Location Info</div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
                {[
                  ["Type",form.locationType==="depot"?"Depot":"Stock Point"],
                  ["Name",form.name],
                  ["Location",form.location],
                  ["Address",form.address||"—"],
                  ...(form.locationType==="depot"
                    ?[["NMDPRA License",form.license],["License Expiry",form.expiry||"—"]]
                    :[["Lease Agreement",form.leaseFileName||"—"],["Lease Expiry",form.leaseExpiry||"—"]]
                  ),
                  ["Capacity",form.capacity?`${Number(form.capacity).toLocaleString()} L`:"—"],
                  ["VAT Rate",`${form.vatPercent||7.5}%`],
                  ["Products",form.products.join(", ")||"—"],
                ].map(([k,v])=>(
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
                  Some required documents are missing. You can still submit for KYB review later from the KYB tab.
                </div>
              )}
              {submitErr&&<div style={{color:"#c0392b",fontSize:"12px",fontWeight:600,marginBottom:"12px",padding:"10px 14px",background:"#fef2f2",border:"1px solid #fca5a5"}}>{submitErr}</div>}
              <div style={{display:"flex",gap:"10px"}}>
                {!allRequiredUploaded&&(
                  <button onClick={()=>onDone(createdDepot?.id)} style={{...btnBase,background:T.gray100,color:T.black,flex:"0 0 auto",width:"auto",padding:"13px 20px"}}>Go to Location</button>
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
              <button onClick={()=>onDone(createdDepot?.id)} style={{...btnBase,background:T.black,color:T.white}}>Go to Location →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { CreateDepotFlow };
