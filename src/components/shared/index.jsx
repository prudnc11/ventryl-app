import { useState, useEffect } from "react";
import { T, F } from "../../lib/tokens";

const STATUS_CFG = {
  delivered:{label:"Delivered",bg:T.greenLight,color:T.greenDark},
  in_transit:{label:"In Transit",bg:T.blueLight,color:T.blue},
  confirmed:{label:"Confirmed",bg:T.amberLight,color:"#8A5C00"},
  loading:{label:"Loading",bg:T.gray100,color:T.gray600},
  disputed:{label:"Disputed",bg:T.redLight,color:T.red},
  pending:{label:"Pending",bg:T.gray100,color:T.gray600},
  collected:{label:"Collected",bg:T.greenLight,color:T.greenDark},
  open:{label:"Available",bg:T.greenLight,color:T.greenDark},
};

function Badge({status}) {
  const c = STATUS_CFG[status]||{label:status,bg:T.gray100,color:T.gray600};
  return <span style={{background:c.bg,color:c.color,fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"4px",display:"inline-block",whiteSpace:"nowrap"}}>{c.label}</span>;
}

const ChartTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:T.black,padding:"10px 14px",borderRadius:"6px",fontFamily:F}}>
      <div style={{color:T.gray400,fontSize:"11px",marginBottom:"5px"}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:T.white,fontSize:"12px",fontWeight:700}}>{p.name}: {p.value}</div>)}
    </div>
  );
};

/* Nav icon SVG */
function Icon({d,size=18}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

/* Stat card */
function KpiCard({label,value,sub,alert,accent}) {
  return (
    <div style={{background:T.white,padding:"18px 20px",borderLeft:alert?`3px solid ${T.amber}`:accent?`3px solid ${accent}`:"none"}}>
      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>{label}</div>
      <div style={{fontSize:"24px",fontWeight:800,color:alert?"#8A5C00":T.black,letterSpacing:"-0.02em",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"5px",fontWeight:600}}>{sub}</div>}
    </div>
  );
}

/* Section header */
function SectionHead({title,sub,right}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px",gap:"12px",flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{title}</div>
        {sub&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{sub}</div>}
      </div>
      {right&&<div style={{flexShrink:0}}>{right}</div>}
    </div>
  );
}

/* Card wrapper */
function Card({children,pad=true,style={}}) {
  return <div style={{border:`1px solid ${T.gray100}`,background:T.white,...(pad?{padding:"20px"}:{}),marginBottom:"14px",...style}}>{children}</div>;
}

function Sidebar({navItems,active,setActive,identity,portalLabel,isMobile}) {
  if (isMobile) {
    return (
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.black,borderTop:"1px solid #1A1A1A",display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {navItems.map(n=>(
          <button key={n.id} onClick={()=>setActive(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px",background:"none",border:"none",cursor:"pointer",fontFamily:F,color:active===n.id?T.green:"#555",position:"relative",minHeight:"56px"}}>
            {n.badge&&<span style={{position:"absolute",top:"6px",right:"calc(50% - 14px)",background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"1px 4px",borderRadius:"8px",minWidth:"16px",textAlign:"center"}}>{n.badge}</span>}
            <Icon d={n.icon} size={20}/>
            <span style={{fontSize:"9px",fontWeight:700,marginTop:"3px",textTransform:"uppercase",letterSpacing:"0.04em"}}>{n.shortLabel||n.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{width:"210px",background:T.black,minHeight:"100vh",display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
      <div style={{padding:"24px 20px 20px",borderBottom:"1px solid #1A1A1A"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"30px",height:"30px",background:T.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>V</span>
          </div>
          <div>
            <div style={{fontSize:"14px",fontWeight:800,color:T.white}}>Ventryl</div>
            <div style={{fontSize:"9px",fontWeight:700,color:portalLabel==="Buyer Portal"?T.green:T.blue,letterSpacing:"0.1em",textTransform:"uppercase"}}>{portalLabel}</div>
          </div>
        </div>
      </div>
      <nav style={{padding:"14px 10px",flex:1}}>
        {navItems.map(n=>(
          <button key={n.id} onClick={()=>setActive(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:"9px",padding:"10px 12px",borderRadius:"5px",background:active===n.id?T.white:"transparent",color:active===n.id?T.black:"#888",border:"none",cursor:"pointer",marginBottom:"2px",fontFamily:F,fontSize:"12px",fontWeight:active===n.id?800:600,textAlign:"left",transition:"all 0.1s"}}>
            <Icon d={n.icon} size={15}/>
            <span style={{flex:1}}>{n.label}</span>
            {n.badge&&<span style={{background:T.red,color:T.white,fontSize:"10px",fontWeight:800,padding:"1px 5px",borderRadius:"10px"}}>{n.badge}</span>}
          </button>
        ))}
      </nav>
      <div style={{padding:"16px 20px",borderTop:"1px solid #1A1A1A"}}>
        <div style={{display:"flex",alignItems:"center",gap:"9px"}}>
          <div style={{width:"30px",height:"30px",background:identity.bg,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:800,color:identity.textColor||T.black,flexShrink:0}}>{identity.initials}</div>
          <div>
            <div style={{fontSize:"11px",fontWeight:800,color:T.white}}>{identity.name}</div>
            <div style={{fontSize:"10px",color:"#666"}}>{identity.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Top bar */
function Topbar({crumb,pills,isMobile,onMenuToggle,portalLabel}) {
  return (
    <div style={{background:T.white,borderBottom:`1px solid ${T.gray100}`,padding:`0 ${isMobile?"16px":"28px"}`,height:"52px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
        {isMobile&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginRight:"6px"}}>
            <div style={{width:"22px",height:"22px",background:T.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>V</span>
            </div>
          </div>
        )}
        <span style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>{isMobile?portalLabel:"Platform"}</span>
        <span style={{color:T.gray200}}>›</span>
        <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{crumb}</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"nowrap"}}>
        {pills?.filter((_,i)=>!isMobile||i<2).map((p,i)=>(
          <div key={i} style={{background:p.bg,color:p.color,fontSize:"10px",fontWeight:800,padding:"3px 8px",borderRadius:"3px",whiteSpace:"nowrap"}}>{p.label}</div>
        ))}
      </div>
    </div>
  );
}

export { STATUS_CFG, Badge, ChartTip, Icon, KpiCard, SectionHead, Card, Sidebar, Topbar };
