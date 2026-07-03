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

function TeamSettings({depot,isMobile}) {
  const {user:authUser}=useAuthStore();
  const ROLES=[
    {id:"admin",     label:"Admin",      desc:"Full platform access — manage team, orders, finances, settings", color:T.black},
    {id:"manager",   label:"Manager",    desc:"Manage orders, inventory, buyers and team members",             color:T.blue},
    {id:"supervisor",label:"Supervisor", desc:"Manage orders and update inventory",                            color:"#9B59B6"},
    {id:"staff",     label:"Staff",      desc:"View and update order status only",                             color:T.green},
    {id:"viewer",    label:"Viewer",     desc:"Read-only access — no edits allowed",                          color:T.gray400},
  ];
  const roleColor=id=>ROLES.find(r=>r.id===id)?.color||T.gray400;
  const roleLabel=id=>ROLES.find(r=>r.id===id)?.label||id;

  const [allRows,setAllRows]=useState([]);
  const [loading,setLoading]=useState(false);
  const [actionError,setActionError]=useState(null);

  const reload=async()=>{
    if(!depot?.id) return;
    setLoading(true);
    try{ setAllRows(await teamMembersApi.list(depot.id)); }
    catch(e){ setActionError(e.message); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ reload(); },[depot?.id]);

  const members=allRows.filter(r=>r.status!=="pending");
  const invites=allRows.filter(r=>r.status==="pending");

  // Invite modal state
  const [showInvite,setShowInvite]=useState(false);
  const [invForm,setInvForm]=useState({name:"",email:"",role:"staff"});
  const [invSent,setInvSent]=useState(false);
  const [inviting,setInviting]=useState(false);

  // Edit member state
  const [editId,setEditId]=useState(null);
  const [editRole,setEditRole]=useState("");
  const [saving,setSaving]=useState(false);

  // Remove confirmation
  const [removeTarget,setRemoveTarget]=useState(null);

  const activeCount=members.filter(m=>m.status==="active").length;
  const initials=n=>(n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  const sendInvite=async()=>{
    if(!invForm.email.trim()||!depot?.id) return;
    setInviting(true);setActionError(null);
    try{
      await teamMembersApi.invite({depotId:depot.id,email:invForm.email.trim(),name:invForm.name.trim(),role:invForm.role,invitedBy:authUser?.id,depotName:depot.name});
      await reload();
      setInvSent(true);
    }catch(e){setActionError(e.message);}
    finally{setInviting(false);}
  };
  const closeInvite=()=>{setShowInvite(false);setInvForm({name:"",email:"",role:"staff"});setInvSent(false);};

  const saveEdit=async()=>{
    setSaving(true);setActionError(null);
    try{
      await teamMembersApi.updateRole(editId,editRole);
      await reload();
      setEditId(null);
    }catch(e){setActionError(e.message);}
    finally{setSaving(false);}
  };

  const toggleStatus=async(id,current)=>{
    setActionError(null);
    try{
      await teamMembersApi.setStatus(id,current==="active"?"inactive":"active");
      await reload();
    }catch(e){setActionError(e.message);}
  };

  const confirmRemove=async()=>{
    setActionError(null);
    try{
      await teamMembersApi.remove(removeTarget.id);
      await reload();
      setRemoveTarget(null);
    }catch(e){setActionError(e.message);}
  };

  const revokeInvite=async(id)=>{
    setActionError(null);
    try{
      await teamMembersApi.revokeInvite(id);
      await reload();
    }catch(e){setActionError(e.message);}
  };

  // Resend is UI-only (no email service wired yet)
  const resendInvite=()=>{};

  return (
    <div>
      {actionError&&<div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"10px 14px",marginBottom:"12px",fontSize:"12px",color:T.red,fontWeight:700}}>{actionError}</div>}
      {loading&&<div style={{padding:"8px 0",fontSize:"12px",color:T.gray400,fontWeight:600,marginBottom:"8px"}}>Loading…</div>}

      {/* ── Invite Modal ── */}
      {showInvite&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,width:"100%",maxWidth:"460px"}}>
            {!invSent?(
              <>
                <div style={{background:T.black,padding:"18px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:"14px",fontWeight:800,color:T.white}}>Invite Team Member</div>
                  <button onClick={closeInvite} style={{background:"none",border:"none",color:T.gray400,fontSize:"18px",cursor:"pointer",lineHeight:1,padding:"2px 6px"}}>×</button>
                </div>
                <div style={{padding:"20px"}}>
                  <div style={{marginBottom:"14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"5px"}}>Full Name</div>
                    <input value={invForm.name} onChange={e=>setInvForm(f=>({...f,name:e.target.value}))}
                      placeholder="e.g. Fatima Musa"
                      style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",color:T.black,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{marginBottom:"14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"5px"}}>Email Address *</div>
                    <input value={invForm.email} onChange={e=>setInvForm(f=>({...f,email:e.target.value}))}
                      placeholder="e.g. fatima@company.com" type="email"
                      style={{width:"100%",border:`1px solid ${invForm.email?T.gray200:T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",color:T.black,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{marginBottom:"20px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"8px"}}>Role & Access Level</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                      {ROLES.map(r=>(
                        <button key={r.id} onClick={()=>setInvForm(f=>({...f,role:r.id}))}
                          style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 12px",border:`2px solid ${invForm.role===r.id?r.color:T.gray100}`,background:invForm.role===r.id?"#F8F8F8":T.white,cursor:"pointer",textAlign:"left",fontFamily:F,transition:"border-color 0.1s"}}>
                          <div style={{width:"8px",height:"8px",borderRadius:"50%",background:r.color,flexShrink:0}}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{r.label}</div>
                            <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{r.desc}</div>
                          </div>
                          {invForm.role===r.id&&<span style={{fontSize:"14px",color:r.color}}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={sendInvite} disabled={!invForm.email.trim()||inviting}
                    style={{width:"100%",background:invForm.email.trim()&&!inviting?T.black:T.gray200,color:invForm.email.trim()&&!inviting?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:invForm.email.trim()&&!inviting?"pointer":"not-allowed",fontFamily:F,minHeight:"48px"}}>
                    {inviting?"Sending…":"Send Invite →"}
                  </button>
                </div>
              </>
            ):(
              <div style={{padding:"36px 28px",textAlign:"center"}}>
                <div style={{width:"56px",height:"56px",background:T.greenLight,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:"24px"}}>✓</div>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Invite Sent!</div>
                <div style={{fontSize:"12px",color:T.gray400,lineHeight:1.6,marginBottom:"6px"}}>
                  An invite email has been sent to <strong style={{color:T.black}}>{invForm.email}</strong>
                </div>
                <div style={{fontSize:"11px",color:T.gray400,marginBottom:"24px"}}>
                  They'll appear under Pending Invites until they accept.
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={()=>{setInvSent(false);setInvForm({name:"",email:"",role:"staff"});}}
                    style={{flex:1,background:T.black,color:T.white,border:"none",padding:"12px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
                    Invite Another
                  </button>
                  <button onClick={closeInvite}
                    style={{flex:1,background:T.white,color:T.black,border:`1px solid ${T.gray200}`,padding:"12px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Remove Confirmation ── */}
      {removeTarget&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,width:"100%",maxWidth:"360px",padding:"28px"}}>
            <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Remove {removeTarget.name}?</div>
            <div style={{fontSize:"12px",color:T.gray600,lineHeight:1.6,marginBottom:"20px"}}>
              They will immediately lose access to this depot. This action cannot be undone.
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={confirmRemove}
                style={{flex:1,background:T.red,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                Remove
              </button>
              <button onClick={()=>setRemoveTarget(null)}
                style={{flex:1,background:T.white,color:T.black,border:`1px solid ${T.gray200}`,padding:"12px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>Team & Users</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{activeCount} active · {members.length} member{members.length!==1?"s":""} · {invites.length} pending invite{invites.length!==1?"s":""}</div>
        </div>
        <button onClick={()=>setShowInvite(true)}
          style={{background:T.black,color:T.white,border:"none",padding:"10px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>
          + Invite User
        </button>
      </div>

      {/* ── Active Members ── */}
      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Members ({members.length})</div>
      {members.map(m=>(
        <div key={m.id} style={{border:`1px solid ${T.gray100}`,background:T.white,marginBottom:"8px",overflow:"hidden",opacity:m.status==="inactive"?0.65:1,transition:"opacity 0.2s"}}>
          <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
            {/* Avatar + info */}
            <div style={{display:"flex",alignItems:"center",gap:"12px",flex:1,minWidth:0}}>
              <div style={{width:"38px",height:"38px",borderRadius:"50%",background:m.status==="active"?roleColor(m.role)+"22":T.gray100,border:`2px solid ${m.status==="active"?roleColor(m.role):T.gray200}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:800,color:m.status==="active"?roleColor(m.role):T.gray400,flexShrink:0}}>
                {initials(m.name)}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:"13px",fontWeight:800,color:T.black,display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap"}}>
                  {m.name}
                  {m.status==="inactive"&&<span style={{fontSize:"9px",fontWeight:700,color:T.gray400,background:T.gray100,padding:"1px 6px"}}>INACTIVE</span>}
                </div>
                <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.email}</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>Joined {m.joined_at?new Date(m.joined_at).toLocaleDateString("en-NG",{month:"short",day:"numeric",year:"numeric"}):new Date(m.created_at).toLocaleDateString("en-NG",{month:"short",day:"numeric",year:"numeric"})}</div>
              </div>
            </div>
            {/* Role badge + actions */}
            <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0,flexWrap:"wrap"}}>
              <span style={{fontSize:"10px",fontWeight:800,color:roleColor(m.role),background:roleColor(m.role)+"18",padding:"3px 9px",whiteSpace:"nowrap"}}>
                {roleLabel(m.role)}
              </span>
              <button onClick={()=>{setEditId(m.id);setEditRole(m.role);}}
                style={{background:"none",border:`1px solid ${T.gray200}`,color:T.gray600,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                Edit
              </button>
              <button onClick={()=>toggleStatus(m.id,m.status)}
                style={{background:"none",border:`1px solid ${m.status==="active"?T.gray200:T.green}`,color:m.status==="active"?T.gray600:T.green,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                {m.status==="active"?"Deactivate":"Activate"}
              </button>
              <button onClick={()=>setRemoveTarget(m)}
                style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                Remove
              </button>
            </div>
          </div>

          {/* Inline edit row */}
          {editId===m.id&&(
            <div style={{borderTop:`1px solid ${T.gray100}`,background:T.gray50,padding:"14px 16px"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"10px"}}>Change Role</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
                {ROLES.map(r=>(
                  <button key={r.id} onClick={()=>setEditRole(r.id)}
                    style={{padding:"6px 12px",border:`2px solid ${editRole===r.id?r.color:T.gray200}`,background:editRole===r.id?r.color+"18":T.white,color:editRole===r.id?r.color:T.gray600,fontFamily:F,fontSize:"11px",fontWeight:editRole===r.id?800:600,cursor:"pointer",transition:"all 0.1s"}}>
                    {r.label}
                  </button>
                ))}
              </div>
              {editRole&&<div style={{fontSize:"10px",color:T.gray400,marginBottom:"12px"}}>{ROLES.find(r=>r.id===editRole)?.desc}</div>}
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={saveEdit} disabled={saving}
                  style={{background:saving?T.gray200:T.black,color:saving?T.gray400:T.white,border:"none",padding:"8px 18px",fontSize:"12px",fontWeight:800,cursor:saving?"not-allowed":"pointer",fontFamily:F,minHeight:"36px"}}>
                  {saving?"Saving…":"Save Changes ✓"}
                </button>
                <button onClick={()=>setEditId(null)}
                  style={{background:T.white,color:T.gray400,border:`1px solid ${T.gray200}`,padding:"8px 14px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Pending Invites ── */}
      {invites.length>0&&(
        <div style={{marginTop:"20px"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Pending Invites ({invites.length})</div>
          {invites.map(inv=>(
            <div key={inv.id} style={{border:`1px dashed ${T.gray200}`,background:T.white,padding:"12px 16px",marginBottom:"8px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <div style={{width:"38px",height:"38px",borderRadius:"50%",background:T.amberLight,border:`2px dashed ${T.amber}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",flexShrink:0}}>
                  ✉
                </div>
                <div>
                  <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{inv.email}</div>
                  <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>
                    <span style={{color:"#8A5C00",fontWeight:700,marginRight:"8px"}}>⏳ Pending</span>
                    Invited as <strong>{roleLabel(inv.role)}</strong> · Sent {new Date(inv.created_at).toLocaleDateString("en-NG",{month:"short",day:"numeric",year:"numeric"})}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                <button onClick={()=>resendInvite(inv.id)}
                  style={{background:"none",border:`1px solid ${T.gray200}`,color:T.black,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                  Resend
                </button>
                <button onClick={()=>revokeInvite(inv.id)}
                  style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Roles reference ── */}
      <div style={{marginTop:"24px",border:`1px solid ${T.gray100}`,background:T.gray50,padding:"16px"}}>
        <div style={{fontSize:"11px",fontWeight:800,color:T.black,marginBottom:"10px"}}>Role Permissions</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)",gap:"8px"}}>
          {ROLES.map(r=>(
            <div key={r.id} style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:r.color,marginTop:"4px",flexShrink:0}}/>
              <div>
                <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{r.label}</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { TeamSettings };
