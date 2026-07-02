import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Building2, TrendingUp, Shield, Pill, BarChart3, AlertTriangle,
  CheckCircle2, DollarSign, Users, Zap, ChevronRight, RefreshCw, Globe,
  ChevronDown, ChevronUp, TrendingDown, Activity, MapPin, Target
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  CartesianGrid, Legend, Cell, PieChart, Pie, Area, AreaChart, ReferenceLine
} from "recharts";

const BG="#07091c", CARD="#0d1033", BORDER="rgba(255,255,255,0.08)";
const TEXT1="#f0f4ff", TEXT2="#8b9dd4", ACCENT="#4f7dff";
const GREEN="#22c55e", AMBER="#f59e0b", RED="#ef4444", PURPLE="#a855f7", CYAN="#06b6d4";
const PALETTE=[ACCENT,CYAN,GREEN,AMBER,PURPLE,RED,"#f472b6","#34d399","#fb923c","#818cf8"];

const fmt=(n:number,d=0)=>n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(d||1)}M`:n>=1e3?`$${(n/1e3).toFixed(0)}K`:`$${n.toFixed(0)}`;
const fmtN=(n:number)=>n>=1e9?`${(n/1e9).toFixed(1)}B`:n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(0)}K`:`${n}`;
const pct=(n:number)=>`${n.toFixed(1)}%`;
const yoyColor=(n:number|null)=>!n?TEXT2:n>0?RED:GREEN;
const yoyArrow=(n:number|null)=>!n?"":n>0?`▲${n.toFixed(1)}%`:`▼${Math.abs(n).toFixed(1)}%`;

const verdictColor=(v:string)=>v==="Excessive"||v==="Misaligned"||v==="Critical"?RED:v==="Elevated"||v==="Watch"||v==="High"?AMBER:GREEN;
const riskColor=(s:number)=>s>=70?RED:s>=40?AMBER:GREEN;

function KV({label,value,sub,color,yoy}:{label:string;value:string;sub?:string;color?:string;yoy?:number|null}){
  return(
    <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:"14px 16px",minWidth:140}}>
      <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
      <div style={{color:color||TEXT1,fontSize:20,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{value}</div>
      {yoy!=null&&<div style={{color:yoyColor(yoy),fontSize:11,marginTop:2,fontWeight:600}}>{yoyArrow(yoy)}</div>}
      {sub&&<div style={{color:TEXT2,fontSize:11,marginTop:2}}>{sub}</div>}
    </div>
  );
}
function Badge({text,color}:{text:string;color:string}){
  return <span style={{background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600}}>{text}</span>;
}
function Flag({text}:{text:string}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:`${AMBER}11`,border:`1px solid ${AMBER}33`,borderRadius:6,marginBottom:4}}>
      <AlertTriangle size={12} color={AMBER}/>
      <span style={{color:TEXT1,fontSize:12}}>{text}</span>
    </div>
  );
}
function Section({title,icon,children,defaultOpen=true}:{title:string;icon?:any;children:any;defaultOpen?:boolean}){
  const [open,setOpen]=useState(defaultOpen);
  return(
    <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,marginBottom:14,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:"none",border:"none",cursor:"pointer",borderBottom:open?`1px solid ${BORDER}`:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,color:TEXT1,fontWeight:700,fontSize:14}}>
          {icon}{title}
        </div>
        {open?<ChevronUp size={16} color={TEXT2}/>:<ChevronDown size={16} color={TEXT2}/>}
      </button>
      {open&&<div style={{padding:"16px 18px"}}>{children}</div>}
    </div>
  );
}

/* ── Company search ─────────────────────────────────────────────────────── */
function CompanySearch({onSelect}:{onSelect:(ein:string,name:string)=>void}){
  const [q,setQ]=useState("");
  const [debouncedQ,setDebouncedQ]=useState("");
  const {data,isLoading}=useQuery<any>({
    queryKey:["/api/cross-intel/search",debouncedQ],
    queryFn:async()=>{const r=await fetch(`/api/cross-intel/search?q=${encodeURIComponent(debouncedQ)}&limit=20`,{credentials:"include"});return r.json();},
    enabled:debouncedQ.length>=2,
  });
  const handleInput=(v:string)=>{setQ(v);const t=setTimeout(()=>setDebouncedQ(v),400);return()=>clearTimeout(t);};
  return(
    <div style={{maxWidth:720}}>
      <div style={{position:"relative",marginBottom:12}}>
        <Search size={16} color={TEXT2} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}/>
        <input data-testid="input-company-search" value={q} onChange={e=>handleInput(e.target.value)}
          placeholder="Search public company (WEX, Asbury Automotive, IDEXX, Marriott…)"
          style={{width:"100%",background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,color:TEXT1,fontSize:14,padding:"12px 14px 12px 40px",outline:"none",boxSizing:"border-box"}}/>
        {isLoading&&<RefreshCw size={14} color={TEXT2} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",animation:"spin 1s linear infinite"}}/>}
      </div>
      {data?.results?.length>0&&(
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,overflow:"hidden",maxHeight:380,overflowY:"auto"}}>
          {data.results.map((r:any)=>(
            <button key={r.ein} data-testid={`btn-company-${r.ein}`} onClick={()=>{onSelect(r.ein,r.name);setQ("");setDebouncedQ("");}}
              style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${BORDER}`,padding:"12px 16px",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}
              onMouseOver={e=>(e.currentTarget.style.background=`${ACCENT}11`)} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
              <div>
                <div style={{color:TEXT1,fontSize:13,fontWeight:600}}>{r.name}</div>
                <div style={{color:TEXT2,fontSize:11}}>{r.sector} · {r.city}, {r.state} · EIN {r.ein}</div>
              </div>
              <div style={{textAlign:"right"}}>
                {r.has_plan_data?<Badge text={`${fmtN(r.participants)} participants`} color={GREEN}/>:<Badge text="EDGAR only" color={TEXT2}/>}
              </div>
            </button>
          ))}
        </div>
      )}
      {debouncedQ.length>=2&&data?.results?.length===0&&(
        <div style={{color:TEXT2,fontSize:13,padding:"10px 0"}}>No matched companies for "{debouncedQ}"</div>
      )}
    </div>
  );
}

/* ── Plan History panel ─────────────────────────────────────────────────── */
function PlanHistoryPanel({ein}:{ein:string}){
  const {data,isLoading}=useQuery<any>({
    queryKey:["/api/cross-intel/company/history",ein],
    queryFn:async()=>{const r=await fetch(`/api/cross-intel/company/${ein}/history`,{credentials:"include"});return r.json();},
    enabled:!!ein,
  });
  if(isLoading)return <div style={{color:TEXT2,fontSize:13}}>Loading plan history…</div>;
  if(!data?.history?.length)return <div style={{color:TEXT2,fontSize:13}}>No multi-year history found.</div>;
  const chartData=data.history.map((h:any)=>({year:h.year,fees:Math.round(h.total_fees/1000),income:Math.round(h.total_income/1000),participants:h.participants}));
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Total Fees Trend ($K)</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <CartesianGrid stroke={BORDER} strokeDasharray="3 3"/>
              <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}K`}/>
              <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${Number(v)}K`,"Fees"]}/>
              <Area type="monotone" dataKey="fees" stroke={ACCENT} fill={`${ACCENT}22`} strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Participant Count Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid stroke={BORDER} strokeDasharray="3 3"/>
              <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[fmtN(Number(v)),"Participants"]}/>
              <Line type="monotone" dataKey="participants" stroke={GREEN} strokeWidth={2} dot={{r:4,fill:GREEN}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"#ffffff06"}}>
              {["Year","Plans","Participants","Plan Income","Total Fees","YoY Fees","Broker Comm.","Carriers"].map(h=>(
                <th key={h} style={{color:TEXT2,textAlign:"left",padding:"8px 10px",borderBottom:`1px solid ${BORDER}`,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.history.map((h:any)=>(
              <tr key={h.year} style={{borderBottom:`1px solid ${BORDER}`}}
                onMouseOver={e=>(e.currentTarget.style.background=`${ACCENT}08`)} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                <td style={{padding:"8px 10px",color:TEXT1,fontWeight:700}}>{h.year}</td>
                <td style={{padding:"8px 10px",color:TEXT2}}>{h.plan_count}</td>
                <td style={{padding:"8px 10px",color:TEXT1}}>{(h.participants||0).toLocaleString()}</td>
                <td style={{padding:"8px 10px",color:TEXT1}}>{fmt(h.total_income)}</td>
                <td style={{padding:"8px 10px",color:RED,fontWeight:600}}>{fmt(h.total_fees)}</td>
                <td style={{padding:"8px 10px",color:yoyColor(h.yoy_fee_pct),fontWeight:600}}>{yoyArrow(h.yoy_fee_pct)||"—"}</td>
                <td style={{padding:"8px 10px",color:AMBER}}>{fmt(h.broker_commissions)}</td>
                <td style={{padding:"8px 10px",color:TEXT2,fontSize:11,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.carriers||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.plan_details?.length>0&&(
        <div style={{marginTop:14}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Individual Plans ({data.latest_year})</div>
          {data.plan_details.map((p:any,i:number)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${BORDER}`}}>
              <div>
                <div style={{color:TEXT1,fontSize:12,fontWeight:600}}>{p.plan_name?.slice(0,45)}</div>
                <div style={{display:"flex",gap:6,marginTop:4}}>
                  {p.has_health&&<Badge text="Health" color={GREEN}/>}
                  {p.has_stop_loss&&<Badge text="Stop-Loss" color={CYAN}/>}
                  {p.has_drug&&<Badge text="Rx" color={PURPLE}/>}
                  <span style={{color:TEXT2,fontSize:11}}>{p.carrier?.slice(0,30)}</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:TEXT1,fontSize:13}}>{(p.participants||0).toLocaleString()} participants</div>
                <div style={{color:RED,fontSize:12,fontWeight:600}}>{fmt(p.fees)} fees</div>
                <div style={{color:AMBER,fontSize:11}}>{fmt(p.broker_commissions)} broker</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Peer comparison panel ──────────────────────────────────────────────── */
function PeerComparisonPanel({ein}:{ein:string}){
  const {data,isLoading}=useQuery<any>({
    queryKey:["/api/cross-intel/company/peers",ein],
    queryFn:async()=>{const r=await fetch(`/api/cross-intel/company/${ein}/peers`,{credentials:"include"});return r.json();},
    enabled:!!ein,
  });
  if(isLoading)return <div style={{color:TEXT2,fontSize:13}}>Finding sector peers…</div>;
  if(!data?.peers?.length)return <div style={{color:TEXT2,fontSize:13}}>No comparable peers found in this sector.</div>;
  const sorted=[...data.peers].sort((a,b)=>a.participants-b.participants);
  const chartData=sorted.map((p:any)=>({name:p.name?.split(" ")[0]||"?",participants:p.participants,fees:Math.round(p.fees/1000),fpp:p.fee_per_participant}));
  return(
    <div>
      <div style={{color:TEXT2,fontSize:12,marginBottom:12}}>
        8 closest peers by SIC + participant size (SIC {data.sic} · target: {(data.target_participants||0).toLocaleString()} participants)
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:14}}>
        <div>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Participant Count Comparison</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical" barSize={14}>
              <XAxis type="number" tick={{fill:TEXT2,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fill:TEXT2,fontSize:10}} axisLine={false} tickLine={false} width={70}/>
              <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[fmtN(Number(v)),"Participants"]}/>
              <Bar dataKey="participants" radius={[0,3,3,0]}>
                {chartData.map((_:any,i:number)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Fees per Participant ($)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical" barSize={14}>
              <XAxis type="number" tick={{fill:TEXT2,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
              <YAxis type="category" dataKey="name" tick={{fill:TEXT2,fontSize:10}} axisLine={false} tickLine={false} width={70}/>
              <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${Number(v)}`,"$/participant"]}/>
              <Bar dataKey="fpp" radius={[0,3,3,0]}>
                {chartData.map((_:any,i:number)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"#ffffff06"}}>
              {["Company","EIN","Participants","Plan Income","Total Fees","Fee/Participant","Broker Comm."].map(h=>(
                <th key={h} style={{color:TEXT2,textAlign:"left",padding:"8px 10px",borderBottom:`1px solid ${BORDER}`,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.peers.map((p:any)=>(
              <tr key={p.ein} style={{borderBottom:`1px solid ${BORDER}`}}
                onMouseOver={e=>(e.currentTarget.style.background=`${ACCENT}08`)} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                <td style={{padding:"8px 10px",color:TEXT1,fontWeight:600}}>{p.name?.slice(0,32)}</td>
                <td style={{padding:"8px 10px",color:TEXT2}}>{p.ein}</td>
                <td style={{padding:"8px 10px",color:TEXT1}}>{(p.participants||0).toLocaleString()}</td>
                <td style={{padding:"8px 10px",color:TEXT1}}>{fmt(p.total_income)}</td>
                <td style={{padding:"8px 10px",color:RED,fontWeight:600}}>{fmt(p.fees)}</td>
                <td style={{padding:"8px 10px",color:p.fee_per_participant>500?AMBER:GREEN,fontWeight:600}}>${(p.fee_per_participant||0).toLocaleString()}</td>
                <td style={{padding:"8px 10px",color:AMBER}}>{fmt(p.broker_commissions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Full company profile ───────────────────────────────────────────────── */
function FcrModule({fcr,edgar,dol}:any){
  const barData=[{name:"This Plan",fees:Math.round(fcr.total_fees/1000)},{name:"Sector Median",fees:Math.round(edgar.revenue*fcr.sector_median_fcr/100/1000)}];
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <KV label="Fiduciary Cost Ratio" value={pct(fcr.fcr_pct)} color={fcr.fcr_pct>fcr.sector_median_fcr*1.5?RED:fcr.fcr_pct>fcr.sector_median_fcr?AMBER:GREEN} sub={`${pct(fcr.sector_median_fcr)} sector median`}/>
          <KV label="Total Plan Fees" value={fmt(fcr.total_fees)} sub="Invest + Admin + Legal"/>
          <KV label="EBITDA Impact" value={pct(fcr.ebitda_impact_pct)} color={fcr.ebitda_impact_pct>5?RED:AMBER} sub="% of estimated EBITDA"/>
          <KV label="Recoverable" value={fmt(fcr.recoverable)} color={GREEN} sub="40% capture rate"/>
        </div>
        <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:"14px 16px"}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Verdict</div>
          <Badge text={fcr.verdict} color={verdictColor(fcr.verdict)}/>
          <div style={{color:TEXT1,fontSize:13,marginTop:10}}>
            Plan fees represent <strong style={{color:verdictColor(fcr.verdict)}}>{pct(fcr.fcr_pct)}</strong> of company revenue vs a <strong style={{color:GREEN}}>{pct(fcr.sector_median_fcr)}</strong> sector median.
            {fcr.recoverable>0&&` Estimated ${fmt(fcr.recoverable)} recoverable through restructuring.`}
          </div>
          <div style={{marginTop:12}}>
            {[["Investment Mgmt",dol.invest_fees],["Admin Services",dol.admin_fees],["Legal",dol.legal_fees]].map(([l,v]:any)=>v>0&&(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${BORDER}`}}>
                <span style={{color:TEXT2,fontSize:12}}>{l}</span>
                <span style={{color:TEXT1,fontSize:12,fontWeight:600}}>{fmt(v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
        <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Plan Fees vs Sector Median ($K)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} barSize={60}>
            <XAxis dataKey="name" tick={{fill:TEXT2,fontSize:12}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${v}K`,"Fees"]}/>
            <Bar dataKey="fees" radius={[4,4,0,0]}><Cell fill={RED}/><Cell fill={GREEN}/></Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{marginTop:12,color:TEXT2,fontSize:12}}>
          Sector percentile: <strong style={{color:fcr.fcr_percentile>75?RED:AMBER}}>{fcr.fcr_percentile}th</strong> — fees are higher than {fcr.fcr_percentile}% of sector peers.
        </div>
      </div>
    </div>
  );
}

function MaModule({ma,dol,edgar}:any){
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div>
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16,marginBottom:12}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>M&A Risk Score</div>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
            <div style={{fontSize:52,fontWeight:800,color:riskColor(ma.ma_risk_score)}}>{ma.ma_risk_score}</div>
            <div>
              <Badge text={ma.ma_risk_score>=60?"HIGH RISK":ma.ma_risk_score>=30?"MODERATE":"LOW RISK"} color={riskColor(ma.ma_risk_score)}/>
              <div style={{color:TEXT2,fontSize:12,marginTop:4}}>Benefits due diligence</div>
            </div>
          </div>
          {ma.key_flags.map((f:string,i:number)=><Flag key={i} text={f}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["Funding Ratio",`${ma.plan_funding_ratio}%`,ma.plan_funding_ratio<80?RED:ma.plan_funding_ratio<100?AMBER:GREEN],
            ["Plan Underfunding",fmt(ma.plan_underfunding),ma.plan_underfunding>0?RED:GREEN],
            ["EDGAR Pension Gap",fmt(ma.pension_gap_edgar),ma.pension_gap_edgar>1e6?AMBER:GREEN],
            ["Broker Commissions",fmt(ma.broker_commissions),ma.carrier_risk==="High"?RED:AMBER],
            ["Plan Liabilities",fmt(ma.total_plan_liabilities),TEXT1],
            ["Welfare Premiums",fmt(ma.welfare_premiums),TEXT1],
          ].map(([l,v,c]:any)=>(
            <div key={l} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:"12px 14px"}}>
              <div style={{color:TEXT2,fontSize:11}}>{l}</div>
              <div style={{color:c,fontSize:18,fontWeight:700}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16,marginBottom:12}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Carrier Intelligence</div>
          <div style={{color:TEXT1,fontSize:15,fontWeight:600,marginBottom:8}}>{dol.carrier||"Unknown Carrier"}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <Badge text={`Risk: ${ma.carrier_risk}`} color={ma.carrier_risk==="High"?RED:ma.carrier_risk==="Medium"?AMBER:GREEN}/>
            {dol.has_health&&<Badge text="Health" color={GREEN}/>}
            {dol.has_stop_loss&&<Badge text="Stop-Loss" color={CYAN}/>}
            {dol.has_drug&&<Badge text="Rx" color={PURPLE}/>}
          </div>
          {ma.stop_loss_gap&&(
            <div style={{background:`${RED}11`,border:`1px solid ${RED}33`,borderRadius:6,padding:10,marginBottom:10}}>
              <AlertTriangle size={14} color={RED} style={{display:"inline",marginRight:6}}/>
              <span style={{color:TEXT1,fontSize:12}}>Stop-loss gap: {fmtN(dol.participants)} participants without catastrophic coverage</span>
            </div>
          )}
        </div>
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Due Diligence Checklist</div>
          {[{l:"Plan funding verified",ok:ma.plan_funding_ratio>=100},{l:"No carrier commission excess",ok:ma.carrier_risk!=="High"},
            {l:"Stop-loss in place",ok:!ma.stop_loss_gap},{l:"ERISA compliance (no pension gap)",ok:ma.pension_gap_edgar<1e6},
            {l:"Welfare premiums documented",ok:ma.welfare_premiums>0}].map(({l,ok})=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${BORDER}`}}>
              {ok?<CheckCircle2 size={14} color={GREEN}/>:<AlertTriangle size={14} color={RED}/>}
              <span style={{color:ok?TEXT1:AMBER,fontSize:12}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExecModule({exec,edgar,dol}:any){
  const chartData=[{name:"Revenue",value:edgar.revenue/1e6},{name:"Labor Expense",value:exec.labor_expense/1e6},{name:"Share Comp",value:exec.share_comp_expense/1e6},{name:"Plan Fees",value:(dol.total_fees||0)/1e6}].filter(d=>d.value>0);
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <KV label="Labor Expense" value={fmt(exec.labor_expense)} sub="Total workforce cost"/>
          <KV label="Share-Based Comp" value={fmt(exec.share_comp_expense)} sub={`${pct(exec.exec_labor_ratio_pct)} of labor`} color={exec.exec_labor_ratio_pct>20?RED:exec.exec_labor_ratio_pct>12?AMBER:GREEN}/>
          <KV label="Cost / Employee" value={fmt(exec.cost_per_employee)} sub={`${fmtN(exec.employees)} total`}/>
          <KV label="Plan Cost / Participant" value={fmt(exec.plan_cost_per_participant)} sub={`${fmtN(exec.plan_participants)} covered`}/>
        </div>
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Governance Verdict</div>
          <Badge text={exec.verdict} color={verdictColor(exec.verdict)}/>
          {exec.governance_flag&&<div style={{marginTop:10}}><Flag text={`Share comp (${pct(exec.exec_labor_ratio_pct)}) exceeds governance threshold while plan costs run ${fmt(exec.plan_cost_per_participant)}/participant`}/></div>}
          <div style={{color:TEXT1,fontSize:13,marginTop:10}}>
            {exec.exec_labor_ratio_pct>15?`Executive equity awards represent ${pct(exec.exec_labor_ratio_pct)} of total labor — potential misalignment with rank-and-file benefit investment.`:`Labor cost structure is aligned. Share-based compensation at ${pct(exec.exec_labor_ratio_pct)} of labor is within governance norms.`}
          </div>
        </div>
      </div>
      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
        <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Capital Allocation ($M)</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical" barSize={20}>
            <XAxis type="number" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
            <YAxis type="category" dataKey="name" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} width={100}/>
            <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${Number(v).toFixed(1)}M`,""]}/>
            <Bar dataKey="value" radius={[0,4,4,0]}>{chartData.map((_:any,i:number)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Glp1Module({glp1,edgar,dol}:any){
  const tierColors:Record<string,string>={Critical:RED,High:AMBER,Moderate:CYAN,Low:GREEN};
  const color=tierColors[glp1.risk_tier]||GREEN;
  const proj3yr=[{year:"Year 1",cost:glp1.projected_annual_cost/1e6},{year:"Year 2",cost:glp1.projected_annual_cost*1.35/1e6},{year:"Year 3",cost:glp1.projected_annual_cost*1.75/1e6}];
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div>
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:20,marginBottom:12,textAlign:"center"}}>
          <div style={{color:TEXT2,fontSize:12,marginBottom:8}}>GLP-1 Risk Score</div>
          <div style={{fontSize:72,fontWeight:900,color,lineHeight:1}}>{glp1.risk_score}</div>
          <div style={{marginTop:8}}><Badge text={glp1.risk_tier} color={color}/></div>
          <div style={{color:TEXT2,fontSize:12,marginTop:8}}>Based on {glp1.sector} workforce profile (SIC {glp1.sic_code})</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <KV label="At-Risk Members" value={fmtN(glp1.at_risk_members_est)} sub="Est. GLP-1 eligible" color={color}/>
          <KV label="Annual Cost" value={fmt(glp1.projected_annual_cost)} sub="$18K/patient/yr" color={color}/>
          <KV label="18-Month Projection" value={fmt(glp1.projected_annual_cost*1.5)} color={AMBER}/>
          <KV label="3-Year Projection" value={fmt(glp1.projected_annual_cost*1.75)} color={RED}/>
        </div>
      </div>
      <div>
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16,marginBottom:12}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>3-Year Cost Trajectory ($M)</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={proj3yr} barSize={50}>
              <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
              <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${Number(v).toFixed(1)}M`,"Projected"]}/>
              <Bar dataKey="cost" radius={[4,4,0,0]}><Cell fill={AMBER}/><Cell fill={RED}/><Cell fill={`${RED}cc`}/></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Intervention ROI Estimate</div>
          {[{label:"Without intervention (3yr)",value:fmt(glp1.projected_annual_cost*1.75),color:RED},
            {label:"GLP-1 stewardship program cost",value:fmt(glp1.at_risk_members_est*2400),color:AMBER},
            {label:"Net savings (3yr)",value:fmt(Math.max(0,glp1.projected_annual_cost*1.75-glp1.projected_annual_cost*1.35-glp1.at_risk_members_est*2400)),color:GREEN},
            {label:"ROI",value:glp1.projected_annual_cost>0?`${Math.round((glp1.projected_annual_cost*0.4-glp1.at_risk_members_est*2400)/Math.max(glp1.at_risk_members_est*2400,1)*100)}%`:"N/A",color:GREEN},
          ].map(({label,value,color:c})=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${BORDER}`}}>
              <span style={{color:TEXT2,fontSize:12}}>{label}</span>
              <span style={{color:c,fontSize:13,fontWeight:700}}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompanyProfile({ein,name}:{ein:string;name:string}){
  const [mod,setMod]=useState<"fcr"|"ma"|"exec"|"glp1">("fcr");
  const {data,isLoading}=useQuery<any>({
    queryKey:["/api/cross-intel/company",ein],
    queryFn:async()=>{const r=await fetch(`/api/cross-intel/company/${ein}`,{credentials:"include"});return r.json();},
    enabled:!!ein,
  });
  if(isLoading)return <div style={{color:TEXT2,padding:32,textAlign:"center"}}>Loading cross-dataset profile…</div>;
  if(!data||data.error)return <div style={{color:RED,padding:16}}>No data found for EIN {ein}</div>;
  const {edgar,dol,modules,risk_flags}=data;
  const mods=[{key:"fcr",label:"Cost Ratio",icon:<DollarSign size={13}/>},{key:"ma",label:"M&A Diligence",icon:<Shield size={13}/>},{key:"exec",label:"Exec vs Plan",icon:<Users size={13}/>},{key:"glp1",label:"GLP-1 Exposure",icon:<Pill size={13}/>}] as const;
  return(
    <div>
      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:"18px 22px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{color:TEXT1,fontSize:20,fontWeight:700}}>{edgar.name||dol.sponsor||name}</div>
            <div style={{color:TEXT2,fontSize:13,marginTop:3}}>EIN {ein} · {edgar.sector||"Unknown"} · {edgar.city}, {edgar.state}{edgar.sic&&` · SIC ${edgar.sic}`}</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {risk_flags.length>0&&<Badge text={`${risk_flags.length} Risk Flags`} color={RED}/>}
            {dol.plan_name&&<Badge text="DOL 5500 Matched" color={GREEN}/>}
            {edgar.cik&&<Badge text="EDGAR Matched" color={ACCENT}/>}
          </div>
        </div>
        <div style={{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}}>
          {edgar.revenue>0&&<KV label="Revenue (EDGAR)" value={fmt(edgar.revenue)} sub={`FY${edgar.period?.toString().slice(0,4)}`}/>}
          {edgar.net_income!==0&&<KV label="Net Income" value={fmt(edgar.net_income)} color={edgar.net_income>=0?GREEN:RED}/>}
          {edgar.assets>0&&<KV label="Total Assets" value={fmt(edgar.assets)}/>}
          {edgar.employees>0&&<KV label="Employees" value={fmtN(edgar.employees)}/>}
          {dol.total_income>0&&<KV label="Plan Income (DOL)" value={fmt(dol.total_income)}/>}
          {dol.participants>0&&<KV label="Plan Participants" value={fmtN(dol.participants)}/>}
        </div>
      </div>
      <div style={{display:"flex",gap:2,marginBottom:14,background:CARD,padding:4,borderRadius:8,border:`1px solid ${BORDER}`,width:"fit-content"}}>
        {mods.map(m=>(
          <button key={m.key} data-testid={`tab-module-${m.key}`} onClick={()=>setMod(m.key)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all 0.15s",background:mod===m.key?ACCENT:"transparent",color:mod===m.key?"#fff":TEXT2}}>
            {m.icon}{m.label}
          </button>
        ))}
      </div>
      {mod==="fcr"&&<FcrModule fcr={modules.fiduciary_cost_ratio} edgar={edgar} dol={dol}/>}
      {mod==="ma"&&<MaModule ma={modules.ma_diligence} dol={dol} edgar={edgar}/>}
      {mod==="exec"&&<ExecModule exec={modules.exec_vs_plan} edgar={edgar} dol={dol}/>}
      {mod==="glp1"&&<Glp1Module glp1={modules.glp1_exposure} edgar={edgar} dol={dol}/>}
      <div style={{marginTop:18}}>
        <Section title="Plan History — Year-over-Year" icon={<TrendingUp size={15} color={ACCENT}/>} defaultOpen={false}>
          <PlanHistoryPanel ein={ein}/>
        </Section>
        <Section title="Sector Peer Comparison" icon={<BarChart3 size={15} color={CYAN}/>} defaultOpen={false}>
          <PeerComparisonPanel ein={ein}/>
        </Section>
      </div>
    </div>
  );
}

/* ── Sector Benchmark tab ───────────────────────────────────────────────── */
const SIC_OPTIONS=[
  {value:6022,label:"6022 — State Commercial Banks"},{value:6021,label:"6021 — National Commercial Banks"},
  {value:5812,label:"5812 — Eating & Drinking Places"},{value:8011,label:"8011 — Offices of Physicians"},
  {value:7372,label:"7372 — Prepackaged Software"},{value:3674,label:"3674 — Semiconductors"},
  {value:3559,label:"3559 — Special Industry Machinery"},{value:4813,label:"4813 — Telephone Communications"},
  {value:5411,label:"5411 — Grocery Stores"},{value:7011,label:"7011 — Hotels & Motels"},
  {value:4213,label:"4213 — Trucking, Except Local"},{value:2911,label:"2911 — Petroleum Refining"},
  {value:3714,label:"3714 — Motor Vehicle Parts"},{value:6311,label:"6311 — Life Insurance"},
  {value:5511,label:"5511 — New and Used Car Dealers"},{value:2835,label:"2835 — Pharmaceuticals"},
  {value:7389,label:"7389 — Business Services"},{value:8099,label:"8099 — Health Services"},
  {value:4210,label:"4210 — Local/LH Trucking"},{value:5141,label:"5141 — Groceries, Wholesale"},
];

function SectorBenchmarkTab(){
  const [sic,setSic]=useState(6022);
  const {data,isLoading}=useQuery<any>({queryKey:["/api/cross-intel/sector",sic],queryFn:async()=>{const r=await fetch(`/api/cross-intel/sector/${sic}`,{credentials:"include"});return r.json();}});
  const {data:bd,isLoading:bdLoading}=useQuery<any>({queryKey:["/api/cross-intel/sector/breakdown",sic],queryFn:async()=>{const r=await fetch(`/api/cross-intel/sector/${sic}/breakdown`,{credentials:"include"});return r.json();}});
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap"}}>
        <label style={{color:TEXT2,fontSize:13}}>Sector (SIC):</label>
        <select data-testid="select-sic" value={sic} onChange={e=>setSic(Number(e.target.value))}
          style={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1,borderRadius:8,padding:"8px 14px",fontSize:13,outline:"none"}}>
          {SIC_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(isLoading||bdLoading)&&<RefreshCw size={14} color={TEXT2} style={{animation:"spin 1s linear infinite"}}/>}
      </div>
      {data&&!data.error&&(
        <>
          <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
            <KV label="Companies" value={fmtN(data.company_count)}/>
            <KV label="Matched Plans" value={fmtN(data.benchmark.plan_count)}/>
            <KV label="Avg Plan Income" value={fmt(data.benchmark.avg_income)}/>
            <KV label="Median Fees" value={fmt(data.benchmark.median_fees)}/>
            <KV label="P25 Fees" value={fmt(data.benchmark.p25_fees)} color={GREEN}/>
            <KV label="P75 Fees" value={fmt(data.benchmark.p75_fees)} color={AMBER}/>
            <KV label="P90 Fees" value={fmt(data.benchmark.p90_fees)} color={RED}/>
            <KV label="Avg Participants" value={fmtN(data.benchmark.avg_participants)}/>
            <KV label="Total Commissions" value={fmt(data.benchmark.total_commissions)} color={RED}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            {data.trends?.length>0&&(
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
                <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Avg Fees Trend</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.trends}>
                    <CartesianGrid stroke={BORDER} strokeDasharray="3 3"/>
                    <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/>
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[fmt(v),"Avg Fees"]}/>
                    <Line type="monotone" dataKey="avg_fees" stroke={ACCENT} strokeWidth={2} dot={{fill:ACCENT,r:4}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {bd?.fee_breakdown&&(
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
                <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Average Fee Breakdown</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[{name:"Invest",value:Math.round(bd.fee_breakdown.avg_invest/1000)},{name:"Admin",value:Math.round(bd.fee_breakdown.avg_admin/1000)},{name:"Legal",value:Math.round(bd.fee_breakdown.avg_legal/1000)},{name:"Broker",value:Math.round(bd.fee_breakdown.avg_broker/1000)},{name:"Welfare",value:Math.round(bd.fee_breakdown.avg_welfare/1000)}].filter(d=>d.value>0)} barSize={40}>
                    <XAxis dataKey="name" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}K`}/>
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${v}K`,""]}/>
                    <Bar dataKey="value" radius={[4,4,0,0]}>{[ACCENT,CYAN,GREEN,AMBER,PURPLE].map((c,i)=><Cell key={i} fill={c}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
                  <span style={{color:TEXT2,fontSize:11}}>Stop-loss: <strong style={{color:bd.fee_breakdown.stop_loss_pct>20?GREEN:AMBER}}>{bd.fee_breakdown.stop_loss_pct}%</strong> of plans</span>
                  <span style={{color:TEXT2,fontSize:11}}>Health: <strong style={{color:GREEN}}>{bd.fee_breakdown.health_pct}%</strong> of plans</span>
                </div>
              </div>
            )}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {bd?.histogram?.length>0&&(
              <Section title="Fee Distribution Histogram" icon={<BarChart3 size={14} color={ACCENT}/>}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bd.histogram} barSize={35}>
                    <XAxis dataKey="bucket" tick={{fill:TEXT2,fontSize:9}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`${v} plans`,""]}/>
                    <Bar dataKey="count" radius={[4,4,0,0]}>
                      {bd.histogram.map((_:any,i:number)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            )}
            {bd?.by_state?.length>0&&(
              <Section title="By State Breakdown" icon={<MapPin size={14} color={CYAN}/>}>
                <div style={{maxHeight:220,overflowY:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr>{["State","Plans","Participants","Avg Fees","Commissions"].map(h=><th key={h} style={{color:TEXT2,textAlign:"left",padding:"4px 8px",borderBottom:`1px solid ${BORDER}`,fontSize:10,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {bd.by_state.map((r:any)=>(
                        <tr key={r.state} style={{borderBottom:`1px solid ${BORDER}`}}>
                          <td style={{padding:"5px 8px",color:TEXT1,fontWeight:700}}>{r.state}</td>
                          <td style={{padding:"5px 8px",color:TEXT2}}>{r.plan_count}</td>
                          <td style={{padding:"5px 8px",color:TEXT1}}>{(r.participants||0).toLocaleString()}</td>
                          <td style={{padding:"5px 8px",color:RED}}>{fmt(r.avg_fees)}</td>
                          <td style={{padding:"5px 8px",color:AMBER}}>{fmt(r.total_commissions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </div>
          {data.top_plans?.length>0&&(
            <Section title="Top Plans by Fee Size" icon={<DollarSign size={14} color={RED}/>}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["Sponsor","Plan Name","Participants","Total Fees","Income"].map(h=><th key={h} style={{color:TEXT2,textAlign:"left",padding:"6px 10px",borderBottom:`1px solid ${BORDER}`,fontSize:11,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.top_plans.map((p:any)=>(
                    <tr key={p.ein} style={{borderBottom:`1px solid ${BORDER}`}}
                      onMouseOver={e=>(e.currentTarget.style.background=`${ACCENT}08`)} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                      <td style={{padding:"7px 10px",color:TEXT1,fontWeight:600}}>{p.sponsor?.slice(0,28)}</td>
                      <td style={{padding:"7px 10px",color:TEXT2,fontSize:11}}>{p.plan_name?.slice(0,30)}</td>
                      <td style={{padding:"7px 10px",color:TEXT1}}>{(p.participants||0).toLocaleString()}</td>
                      <td style={{padding:"7px 10px",color:RED,fontWeight:700}}>{fmt(p.total_fees)}</td>
                      <td style={{padding:"7px 10px",color:TEXT1}}>{fmt(p.total_income)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

/* ── Carrier Risk tab ───────────────────────────────────────────────────── */
const CARRIER_TIERS=[
  {label:"Enterprise (>$50M)",condition:"TOTAL_INCOME_AMT >= 50000000"},
  {label:"Large ($10M–$50M)",condition:"TOTAL_INCOME_AMT >= 10000000 AND TOTAL_INCOME_AMT < 50000000"},
  {label:"Mid ($1M–$10M)",condition:"TOTAL_INCOME_AMT >= 1000000 AND TOTAL_INCOME_AMT < 10000000"},
  {label:"Small ($100K–$1M)",condition:"TOTAL_INCOME_AMT >= 100000 AND TOTAL_INCOME_AMT < 1000000"},
  {label:"Micro (<$100K)",condition:"TOTAL_INCOME_AMT > 0 AND TOTAL_INCOME_AMT < 100000"},
];

function CarrierDetailDrill({tier}:{tier:{label:string;condition:string}}){
  const {data,isLoading}=useQuery<any>({
    queryKey:["/api/cross-intel/carrier-detail",tier.condition],
    queryFn:async()=>{const r=await fetch(`/api/cross-intel/carrier-detail?tier_condition=${encodeURIComponent(tier.condition)}`,{credentials:"include"});return r.json();},
  });
  if(isLoading)return <div style={{color:TEXT2,fontSize:12,padding:12}}>Loading carrier detail…</div>;
  if(!data)return null;
  const hhi=data.hhi||0;
  const hhiColor=hhi>2500?RED:hhi>1500?AMBER:GREEN;
  return(
    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${BORDER}`}}>
      <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{background:`${hhiColor}11`,border:`1px solid ${hhiColor}33`,borderRadius:8,padding:"12px 18px"}}>
          <div style={{color:TEXT2,fontSize:11}}>HHI Concentration Index</div>
          <div style={{color:hhiColor,fontSize:24,fontWeight:800}}>{hhi.toFixed(0)}</div>
          <div style={{color:TEXT2,fontSize:11}}>{data.concentration}</div>
        </div>
      </div>
      {/* Market share bar */}
      <div style={{marginBottom:14}}>
        <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Market Share by Commission</div>
        {data.carriers.map((c:any,i:number)=>(
          <div key={c.name} style={{marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
              <span style={{color:TEXT1,fontSize:11,fontWeight:600}}>{c.name?.slice(0,35)}</span>
              <span style={{color:PALETTE[i%PALETTE.length],fontSize:12,fontWeight:700}}>{c.market_share_pct}%</span>
            </div>
            <div style={{background:`${BORDER}`,height:6,borderRadius:3,overflow:"hidden"}}>
              <div style={{width:`${Math.min(c.market_share_pct,100)}%`,height:"100%",background:PALETTE[i%PALETTE.length],borderRadius:3,transition:"width 0.5s"}}/>
            </div>
            <div style={{color:TEXT2,fontSize:10,marginTop:1}}>{c.plan_count} plans · {fmt(c.total_commissions)} · avg {fmt(c.avg_commission)}/plan · {Math.round(c.avg_participants)} avg participants</div>
          </div>
        ))}
      </div>
      {/* Top-3 carrier trends */}
      {data.top3_trends?.length>0&&(
        <div>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Commission Trend — Top 3 Carriers (2020–2023)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart>
              <CartesianGrid stroke={BORDER} strokeDasharray="3 3"/>
              <XAxis dataKey="year" type="number" domain={[2020,2023]} tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>String(v)}/>
              <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`}/>
              <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any,n:any)=>[fmt(Number(v)),n]}/>
              <Legend wrapperStyle={{color:TEXT2,fontSize:11}}/>
              {data.top3_trends.map((t:any,i:number)=>(
                <Line key={t.carrier} data={t.by_year.filter((y:any)=>y.year<=2023)} dataKey="commissions" name={t.carrier?.slice(0,20)} stroke={PALETTE[i]} strokeWidth={2} dot={{r:3}}/>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CarrierRiskTab(){
  const {data,isLoading}=useQuery<any>({
    queryKey:["/api/cross-intel/carrier-risk"],
    queryFn:async()=>{const r=await fetch("/api/cross-intel/carrier-risk",{credentials:"include"});return r.json();},
  });
  const [expanded,setExpanded]=useState<string|null>(null);
  const tierColor=(t:string)=>t.includes("Enterprise")?RED:t.includes("Large")?AMBER:t.includes("Mid")?CYAN:ACCENT;
  return(
    <div>
      {isLoading&&<div style={{color:TEXT2,padding:32}}>Analyzing carrier concentration…</div>}
      {data?.tiers&&(
        <>
          <div style={{color:TEXT2,fontSize:13,marginBottom:20}}>
            {data.total_companies.toLocaleString()} plans across 5 income tiers. Click any tier to drill into carrier market share, HHI concentration, and year-over-year trends.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {data.tiers.map((tier:any)=>{
              const tc=CARRIER_TIERS.find(t=>tier.tier.startsWith(t.label.split("(")[0].trim()));
              const isOpen=expanded===tier.tier;
              return(
                <div key={tier.tier} style={{background:CARD,border:`1px solid ${expanded===tier.tier?tierColor(tier.tier):BORDER}`,borderRadius:10,overflow:"hidden",transition:"border-color 0.2s"}}>
                  <div style={{padding:"14px 18px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <Building2 size={16} color={tierColor(tier.tier)}/>
                        <span style={{color:TEXT1,fontSize:15,fontWeight:700}}>{tier.tier}</span>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <Badge text={`${(tier.company_count||0).toLocaleString()} companies`} color={tierColor(tier.tier)}/>
                        <Badge text={`${(tier.plan_count||0).toLocaleString()} plans`} color={TEXT2}/>
                        <button onClick={()=>setExpanded(isOpen?null:tier.tier)} data-testid={`btn-expand-${tier.tier}`}
                          style={{background:`${tierColor(tier.tier)}22`,border:`1px solid ${tierColor(tier.tier)}44`,color:tierColor(tier.tier),borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                          {isOpen?<><ChevronUp size={12}/>Collapse</>:<><ChevronDown size={12}/>Drill Down</>}
                        </button>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      {tier.carriers.slice(0,6).map((c:any,i:number)=>(
                        <div key={c.name} style={{background:"#ffffff08",border:`1px solid ${BORDER}`,borderRadius:8,padding:"10px 14px",flex:"1 1 160px"}}>
                          <div style={{color:TEXT1,fontSize:12,fontWeight:600}}>{c.name?.slice(0,26)}</div>
                          <div style={{color:PALETTE[i],fontSize:15,fontWeight:700,marginTop:3}}>{fmt(c.total_commissions)}</div>
                          <div style={{color:TEXT2,fontSize:10}}>{c.plan_count} plans · {fmt(c.avg_commission)} avg</div>
                        </div>
                      ))}
                    </div>
                    {isOpen&&tc&&<CarrierDetailDrill tier={tc}/>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── GLP-1 tab ──────────────────────────────────────────────────────────── */
const GLP1_SECTORS=[
  {prefix:"4",label:"Trucking / Transport"},{prefix:"54",label:"Grocery / Food Stores"},
  {prefix:"58",label:"Eating & Drinking"},{prefix:"70",label:"Hotels & Hospitality"},
  {prefix:"23",label:"Apparel Manufacturing"},{prefix:"34",label:"Fabricated Metals"},
  {prefix:"56",label:"Apparel Retail"},{prefix:"55",label:"Auto Dealers"},
];

function Glp1Tab(){
  const [sPrefix,setSPrefix]=useState("4");
  const {data:glpData,isLoading:glpLoading}=useQuery<any>({
    queryKey:["/api/cross-intel/glp1-exposure"],
    queryFn:async()=>{const r=await fetch("/api/cross-intel/glp1-exposure?min_participants=500&limit=50",{credentials:"include"});return r.json();},
  });
  const {data:stateData,isLoading:stateLoading}=useQuery<any>({
    queryKey:["/api/cross-intel/glp1-by-state",sPrefix],
    queryFn:async()=>{const r=await fetch(`/api/cross-intel/glp1-by-state?sic_prefix=${sPrefix}`,{credentials:"include"});return r.json();},
  });
  const tierColor=(t:string)=>t==="Critical"?RED:t==="High"?AMBER:CYAN;
  const topStates=stateData?.by_state?.slice(0,10)||[];
  const stateChartData=topStates.map((s:any)=>({state:s.state,exposure:Math.round(s.projected_annual_cost/1e6),participants:Math.round(s.total_participants/1000)}));
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:24}}>
        {/* Company-level exposure table */}
        <div>
          <div style={{color:TEXT1,fontSize:15,fontWeight:700,marginBottom:4}}>Public Company Exposure Ranking</div>
          <div style={{color:TEXT2,fontSize:12,marginBottom:12}}>{glpData?.total||0} high-risk companies with 500+ plan participants</div>
          {glpLoading&&<div style={{color:TEXT2,fontSize:13}}>Scoring…</div>}
          {glpData?.companies&&(
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,overflow:"hidden",maxHeight:460,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#ffffff06",position:"sticky",top:0}}>
                  {["Company","Tier","Score","Participants","Annual Exposure"].map(h=><th key={h} style={{color:TEXT2,fontSize:10,textTransform:"uppercase",padding:"8px 10px",textAlign:"left",borderBottom:`1px solid ${BORDER}`,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {glpData.companies.map((c:any)=>(
                    <tr key={c.ein} style={{borderBottom:`1px solid ${BORDER}`}}
                      onMouseOver={e=>(e.currentTarget.style.background=`${ACCENT}08`)} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
                      <td style={{padding:"8px 10px"}}>
                        <div style={{color:TEXT1,fontSize:12,fontWeight:600}}>{c.name?.slice(0,26)}</div>
                        <div style={{color:TEXT2,fontSize:10}}>{c.sector} · {c.state}</div>
                      </td>
                      <td style={{padding:"8px 10px"}}><Badge text={c.risk_tier} color={tierColor(c.risk_tier)}/></td>
                      <td style={{padding:"8px 10px",color:tierColor(c.risk_tier),fontWeight:700,fontSize:14}}>{c.glp1_risk_score}</td>
                      <td style={{padding:"8px 10px",color:TEXT1,fontSize:12}}>{(c.participants||0).toLocaleString()}</td>
                      <td style={{padding:"8px 10px",color:RED,fontSize:13,fontWeight:700}}>{fmt(c.projected_annual_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* State breakdown */}
        <div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{color:TEXT1,fontSize:15,fontWeight:700}}>State-Level Exposure</div>
            <select value={sPrefix} onChange={e=>setSPrefix(e.target.value)} data-testid="select-sic-prefix"
              style={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1,borderRadius:6,padding:"6px 10px",fontSize:12,outline:"none"}}>
              {GLP1_SECTORS.map(s=><option key={s.prefix} value={s.prefix}>{s.label}</option>)}
            </select>
            {stateLoading&&<RefreshCw size={12} color={TEXT2} style={{animation:"spin 1s linear infinite"}}/>}
          </div>
          {stateData&&(
            <>
              <div style={{display:"flex",gap:10,marginBottom:12}}>
                <KV label="Total Participants" value={fmtN(stateData.total_participants||0)}/>
                <KV label="Total GLP-1 Exposure" value={fmt(stateData.total_glp1_exposure||0)} color={RED}/>
              </div>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:14,marginBottom:12}}>
                <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Top 10 States — Projected Exposure ($M)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stateChartData} barSize={22}>
                    <XAxis dataKey="state" tick={{fill:TEXT2,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${v}M`,"Exposure"]}/>
                    <Bar dataKey="exposure" radius={[4,4,0,0]}>{stateChartData.map((_:any,i:number)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,overflow:"hidden",maxHeight:280,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:"#ffffff06",position:"sticky",top:0}}>
                    {["State","Employers","Plans","Participants","Avg Part","Stop-Loss%","Drug%","GLP-1 Exposure"].map(h=><th key={h} style={{color:TEXT2,fontSize:9,textTransform:"uppercase",padding:"7px 8px",textAlign:"left",borderBottom:`1px solid ${BORDER}`,whiteSpace:"nowrap"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {stateData.by_state.map((r:any)=>(
                      <tr key={r.state} style={{borderBottom:`1px solid ${BORDER}`}}>
                        <td style={{padding:"6px 8px",color:TEXT1,fontWeight:700}}>{r.state}</td>
                        <td style={{padding:"6px 8px",color:TEXT2}}>{r.employer_count}</td>
                        <td style={{padding:"6px 8px",color:TEXT2}}>{r.plan_count}</td>
                        <td style={{padding:"6px 8px",color:TEXT1}}>{(r.total_participants||0).toLocaleString()}</td>
                        <td style={{padding:"6px 8px",color:TEXT2}}>{r.avg_participants}</td>
                        <td style={{padding:"6px 8px",color:r.stop_loss_pct>15?GREEN:RED}}>{r.stop_loss_pct}%</td>
                        <td style={{padding:"6px 8px",color:r.drug_benefit_pct>50?GREEN:AMBER}}>{r.drug_benefit_pct}%</td>
                        <td style={{padding:"6px 8px",color:RED,fontWeight:700}}>{fmt(r.projected_annual_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── National Trends tab ────────────────────────────────────────────────── */
function NationalTrendsTab(){
  const {data,isLoading}=useQuery<any>({queryKey:["/api/cross-intel/year-trends"],queryFn:async()=>{const r=await fetch("/api/cross-intel/year-trends",{credentials:"include"});return r.json();}});
  const {data:deep,isLoading:dLoading}=useQuery<any>({queryKey:["/api/cross-intel/trends/deep"],queryFn:async()=>{const r=await fetch("/api/cross-intel/trends/deep",{credentials:"include"});return r.json();}});
  const trends2023=data?.trends?.find((t:any)=>t.year===2023)||{};
  return(
    <div>
      {(isLoading||dLoading)&&<div style={{color:TEXT2,padding:16}}>Loading national trend data…</div>}
      {data?.trends&&(
        <>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
            <KV label="2023 Active Plans" value={fmtN(trends2023.plans||0)}/>
            <KV label="Total Participants" value={fmtN(trends2023.participants||0)}/>
            <KV label="Total Plan Income" value={fmt(trends2023.total_income||0)}/>
            <KV label="Total Plan Fees" value={fmt(trends2023.total_fees||0)} color={RED}/>
            <KV label="Broker Commissions" value={fmt(trends2023.broker_commissions||0)} color={AMBER}/>
            <KV label="Welfare Premiums" value={fmt(trends2023.welfare_premiums||0)} color={CYAN}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
              <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Total Plan Fees by Year ($B)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.trends.filter((t:any)=>t.year<=2023)}>
                  <CartesianGrid stroke={BORDER} strokeDasharray="3 3"/>
                  <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1e9).toFixed(0)}B`}/>
                  <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[fmt(v),"Total Fees"]}/>
                  <Bar dataKey="total_fees" fill={ACCENT} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
              <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Broker Commissions vs Welfare Premiums ($B)</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.trends.filter((t:any)=>t.year<=2023)}>
                  <CartesianGrid stroke={BORDER} strokeDasharray="3 3"/>
                  <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1e9).toFixed(0)}B`}/>
                  <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[fmt(v),""]}/>
                  <Legend wrapperStyle={{color:TEXT2,fontSize:11}}/>
                  <Line type="monotone" dataKey="broker_commissions" name="Broker Commissions" stroke={RED} strokeWidth={2} dot={{r:3}}/>
                  <Line type="monotone" dataKey="welfare_premiums" name="Welfare Premiums" stroke={GREEN} strokeWidth={2} dot={{r:3}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
      {deep?.trends&&(
        <>
          <Section title="Per-Participant Cost Trend" icon={<Users size={14} color={CYAN}/>}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <div style={{color:TEXT2,fontSize:11,marginBottom:8}}>Fees per Participant — National Average</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={deep.trends}>
                    <CartesianGrid stroke={BORDER} strokeDasharray="3 3"/>
                    <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${Number(v).toFixed(2)}`,"Fees/participant"]}/>
                    <Area type="monotone" dataKey="fees_per_participant" stroke={RED} fill={`${RED}22`} strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div style={{color:TEXT2,fontSize:11,marginBottom:8}}>Fee Type Split (Invest / Admin / Legal) $B</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={deep.trends}>
                    <CartesianGrid stroke={BORDER} strokeDasharray="3 3"/>
                    <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1e9).toFixed(0)}B`}/>
                    <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[fmt(v),""]}/>
                    <Legend wrapperStyle={{color:TEXT2,fontSize:11}}/>
                    <Bar dataKey="invest_fees" name="Investment Mgmt" stackId="a" fill={ACCENT}/>
                    <Bar dataKey="admin_fees" name="Admin Svcs" stackId="a" fill={CYAN}/>
                    <Bar dataKey="legal_fees" name="Legal" stackId="a" fill={PURPLE} radius={[2,2,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>
          <Section title="Year-over-Year Change Analysis" icon={<TrendingUp size={14} color={AMBER}/>}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:"#ffffff06"}}>
                  {["Year","Plans","Employers","Participants","Total Fees","YoY Fees","Fees/Participant","YoY F/P","Broker Comm.","YoY Broker","Stop-Loss%","Drug%"].map(h=><th key={h} style={{color:TEXT2,fontSize:10,textTransform:"uppercase",padding:"8px 10px",textAlign:"left",borderBottom:`1px solid ${BORDER}`,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {deep.trends.map((t:any)=>(
                    <tr key={t.year} style={{borderBottom:`1px solid ${BORDER}`}}>
                      <td style={{padding:"8px 10px",color:TEXT1,fontWeight:700}}>{t.year}</td>
                      <td style={{padding:"8px 10px",color:TEXT2}}>{(t.plan_count||0).toLocaleString()}</td>
                      <td style={{padding:"8px 10px",color:TEXT2}}>{(t.employer_count||0).toLocaleString()}</td>
                      <td style={{padding:"8px 10px",color:TEXT1}}>{fmtN(t.total_participants||0)}</td>
                      <td style={{padding:"8px 10px",color:RED,fontWeight:600}}>{fmt(t.total_fees||0)}</td>
                      <td style={{padding:"8px 10px",color:yoyColor(t.yoy_fee_pct??null),fontWeight:600}}>{t.yoy_fee_pct!=null?yoyArrow(t.yoy_fee_pct):"—"}</td>
                      <td style={{padding:"8px 10px",color:TEXT1}}>${(t.fees_per_participant||0).toFixed(2)}</td>
                      <td style={{padding:"8px 10px",color:yoyColor(t.yoy_fpp_pct??null),fontWeight:600}}>{t.yoy_fpp_pct!=null?yoyArrow(t.yoy_fpp_pct):"—"}</td>
                      <td style={{padding:"8px 10px",color:AMBER}}>{fmt(t.broker_commissions||0)}</td>
                      <td style={{padding:"8px 10px",color:yoyColor(t.yoy_broker_pct??null),fontWeight:600}}>{t.yoy_broker_pct!=null?yoyArrow(t.yoy_broker_pct):"—"}</td>
                      <td style={{padding:"8px 10px",color:t.stop_loss_pct>15?GREEN:RED}}>{t.stop_loss_pct}%</td>
                      <td style={{padding:"8px 10px",color:t.drug_pct>60?GREEN:AMBER}}>{t.drug_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
const TABS=[
  {key:"company",label:"Company Intel",icon:<Building2 size={14}/>},
  {key:"sector",label:"Sector Benchmark",icon:<BarChart3 size={14}/>},
  {key:"carrier",label:"Carrier Risk",icon:<Shield size={14}/>},
  {key:"glp1",label:"GLP-1 Exposure",icon:<Pill size={14}/>},
  {key:"trends",label:"National Trends",icon:<Globe size={14}/>},
] as const;

export default function CrossIntelligence(){
  const [tab,setTab]=useState<string>("company");
  const [selectedEin,setSelectedEin]=useState("");
  const [selectedName,setSelectedName]=useState("");
  return(
    <div style={{background:BG,minHeight:"100vh",color:TEXT1,fontFamily:"system-ui,-apple-system,sans-serif",padding:"24px 28px"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
          <Zap size={22} color={ACCENT}/>
          <h1 style={{margin:0,fontSize:22,fontWeight:800}}>DOL × EDGAR Intelligence Center</h1>
          <span style={{background:`${ACCENT}22`,color:ACCENT,border:`1px solid ${ACCENT}44`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700}}>937K PLANS · 2,014 PUBLIC CO.</span>
        </div>
        <p style={{margin:0,color:TEXT2,fontSize:13}}>
          Cross-reference 937,000 DOL Form 5500 filings with SEC EDGAR public company data via EIN join. Six analytical modules with deep drill-downs for every layer.
        </p>
      </div>
      <div style={{display:"flex",gap:2,marginBottom:22,background:CARD,padding:4,borderRadius:10,border:`1px solid ${BORDER}`,width:"fit-content"}}>
        {TABS.map(t=>(
          <button key={t.key} data-testid={`tab-main-${t.key}`} onClick={()=>setTab(t.key)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all 0.15s",background:tab===t.key?ACCENT:"transparent",color:tab===t.key?"#fff":TEXT2}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab==="company"&&(
        <div>
          <CompanySearch onSelect={(ein,name)=>{setSelectedEin(ein);setSelectedName(name);}}/>
          {selectedEin?(
            <div style={{marginTop:20}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <button onClick={()=>{setSelectedEin("");setSelectedName("");}} style={{background:"none",border:`1px solid ${BORDER}`,color:TEXT2,cursor:"pointer",fontSize:12,borderRadius:6,padding:"5px 10px"}}>← New search</button>
              </div>
              <CompanyProfile ein={selectedEin} name={selectedName}/>
            </div>
          ):(
            <div style={{marginTop:28,color:TEXT2,fontSize:13}}>
              Search any public company to activate all 6 analytical modules + plan history + peer comparison.
              <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
                {["WEX INC","ASBURY AUTOMOTIVE","Marriott International","IDEXX LABORATORIES","CAMDEN NATIONAL"].map(n=>(
                  <span key={n} style={{background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,color:ACCENT,borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer"}}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tab==="sector"&&<SectorBenchmarkTab/>}
      {tab==="carrier"&&<CarrierRiskTab/>}
      {tab==="glp1"&&<Glp1Tab/>}
      {tab==="trends"&&<NationalTrendsTab/>}
    </div>
  );
}
