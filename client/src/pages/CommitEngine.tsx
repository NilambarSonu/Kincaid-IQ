import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  Search, CheckCircle2, AlertTriangle, XCircle, ChevronRight,
  Zap, DollarSign, Shield, Pill, BarChart3, Users, Target,
  TrendingUp, RefreshCw, Building2, FileText, Star, ArrowRight,
  Lock, Activity, MapPin, Clock, Globe, Gavel, Scale, Landmark,
  ExternalLink, AlertCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, CartesianGrid, LineChart, Line
} from "recharts";

const BG="#F8FAFC", CARD="#0d1033", BORDER="#e2e8f0";
const TEXT1="#f0f4ff", TEXT2="#8b9dd4";
const ACCENT="#4f7dff", GREEN="#22c55e", AMBER="#f59e0b", RED="#ef4444";
const CYAN="#06b6d4", PURPLE="#a855f7", GOLD="#f59e0b";

const fmt=(n:number,d=0)=>n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(d||1)}M`:n>=1e3?`$${(n/1e3).toFixed(0)}K`:`$${n.toFixed(0)}`;
const fmtN=(n:number)=>n>=1e9?`${(n/1e9).toFixed(1)}B`:n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(0)}K`:`${n}`;
const pct=(n:number)=>`${n.toFixed(1)}%`;

function statusColor(s:string){return s==="GO"?GREEN:s==="NO-GO"?RED:AMBER;}
function statusIcon(s:string,sz=16){
  if(s==="GO") return <CheckCircle2 size={sz} color={GREEN}/>;
  if(s==="NO-GO") return <XCircle size={sz} color={RED}/>;
  return <AlertTriangle size={sz} color={AMBER}/>;
}

function KV({label,value,sub,color,big}:{label:string;value:string;sub?:string;color?:string;big?:boolean}){
  return(
    <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:"12px 16px"}}>
      <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:0.8,marginBottom:4}}>{label}</div>
      <div style={{color:color||TEXT1,fontSize:big?26:18,fontWeight:700}}>{value}</div>
      {sub&&<div style={{color:TEXT2,fontSize:11,marginTop:2}}>{sub}</div>}
    </div>
  );
}

function Badge({text,color}:{text:string;color:string}){
  return <span style={{background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700}}>{text}</span>;
}

/* ── Gate scorecard strip ───────────────────────────────────────────────── */
function GateStrip({gates,active,onSelect}:{gates:any;active:number;onSelect:(i:number)=>void}){
  const keys = Object.keys(gates);
  const labels = ["Intel Scan","Plan Inventory","Fee Intelligence","Risk Exposure","Market Position","Opportunity $","Commit"];
  const icons = [<Globe size={13}/>,<Building2 size={13}/>,<DollarSign size={13}/>,<Pill size={13}/>,<Shield size={13}/>,<Target size={13}/>,<Star size={13}/>];
  return(
    <div style={{display:"flex",gap:0,background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,overflow:"hidden",marginBottom:24}}>
      {keys.map((k,i)=>{
        const g=gates[k];
        const isActive=i===active;
        return(
          <button key={k} data-testid={`gate-btn-${i+1}`} onClick={()=>onSelect(i)}
            style={{flex:1,background:isActive?`${statusColor(g.status)}18`:"transparent",border:"none",borderRight:`1px solid ${BORDER}`,padding:"14px 6px",cursor:"pointer",textAlign:"center",borderBottom:isActive?`2px solid ${statusColor(g.status)}`:"2px solid transparent",transition:"all 0.15s"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              {statusIcon(g.status,14)}
              <span style={{color:isActive?statusColor(g.status):TEXT2,fontSize:10,fontWeight:isActive?700:400,lineHeight:1.2}}>{`G${i+1}`}</span>
              <span style={{color:isActive?TEXT1:TEXT2,fontSize:10,display:"flex",alignItems:"center",gap:3}}>{icons[i]}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Gate 1: Intel Scan ─────────────────────────────────────────────────── */
function Gate1({data}:{data:any}){
  const {edgar,dol,gates} = data;
  const g = gates.gate1_intel;
  return(
    <div>
      <GateHeader num={1} label="Intel Scan" status={g.status} note={g.note} score={g.score}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <div style={{color:TEXT2,fontSize:12,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>EDGAR Filing (SEC)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <KV label="Revenue" value={fmt(edgar.revenue)} sub={`FY${edgar.period?.slice(0,4)}`}/>
            <KV label="Net Income" value={fmt(edgar.net_income)} color={edgar.net_income>=0?GREEN:RED}/>
            <KV label="Total Assets" value={fmt(edgar.assets)}/>
            <KV label="Employees" value={fmtN(edgar.employees)}/>
          </div>
          <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:"12px 16px"}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              <Badge text={`SIC ${edgar.sic}`} color={ACCENT}/>
              <Badge text={edgar.sector} color={CYAN}/>
              <Badge text={`${edgar.city}, ${edgar.state}`} color={TEXT2}/>
            </div>
            <div style={{color:TEXT1,fontSize:13,fontWeight:600}}>{edgar.name}</div>
            <div style={{color:TEXT2,fontSize:12,marginTop:2}}>CIK: {edgar.cik} · EIN: {data.ein}</div>
          </div>
        </div>
        <div>
          <div style={{color:TEXT2,fontSize:12,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>DOL Form 5500 (DOL)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <KV label="Plans Filed" value={String(dol.plan_count)} sub={`FY${dol.latest_year}`}/>
            <KV label="Participants" value={fmtN(dol.participants)}/>
            <KV label="Plan Income" value={fmt(dol.total_income)}/>
            <KV label="Total Fees" value={fmt(dol.total_fees)} color={RED}/>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
            {dol.has_health&&<Badge text="Health Coverage" color={GREEN}/>}
            {dol.has_stop_loss&&<Badge text="Stop-Loss" color={CYAN}/>}
            {dol.has_drug&&<Badge text="Rx/Drug" color={PURPLE}/>}
            {!dol.has_stop_loss&&dol.participants>200&&<Badge text="⚠ Stop-Loss Gap" color={RED}/>}
          </div>
          <div style={{color:TEXT2,fontSize:12}}>Carriers on file: {dol.carriers.join(" · ")||"None filed"}</div>
        </div>
      </div>
      <div style={{marginTop:16}}>
        <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Year-over-Year Plan History</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data.history.map((h:any)=>({year:h.year,fees:Math.round(h.fees/1000),participants:Math.round(h.participants/100)}))}>
            <XAxis dataKey="year" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}K`}/>
            <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any,n:any)=>[n==="fees"?`$${v}K`:`${v*100}`,n]}/>
            <Bar dataKey="fees" name="fees" fill={ACCENT} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Gate 2: Plan Inventory ─────────────────────────────────────────────── */
function Gate2({data}:{data:any}){
  const {dol,gates} = data;
  const g = gates.gate2_inventory;
  return(
    <div>
      <GateHeader num={2} label="Plan Inventory" status={g.status} note={g.note} score={g.score}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KV label="Active Plans" value={String(dol.plan_count)} big/>
        <KV label="Total Participants" value={fmtN(dol.participants)} big/>
        <KV label="Broker Commissions" value={fmt(dol.broker_commissions)} color={RED} big/>
        <KV label="Welfare Premiums" value={fmt(dol.welfare_premiums)} big/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:14}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Fee Breakdown</div>
          {[["Investment Mgmt",dol.invest_fees,ACCENT],["Admin Services",dol.admin_fees,CYAN],["Legal Fees",dol.legal_fees,PURPLE],["Broker Commissions",dol.broker_commissions,RED],["Welfare Premiums",dol.welfare_premiums,GOLD]].map(([l,v,c]:any)=>v>0&&(
            <div key={l} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{color:TEXT2,fontSize:11}}>{l}</span>
                <span style={{color:c,fontSize:12,fontWeight:700}}>{fmt(v)}</span>
              </div>
              <div style={{background:`${BORDER}`,height:4,borderRadius:2,overflow:"hidden"}}>
                <div style={{width:`${Math.min(v/Math.max(dol.total_fees+dol.welfare_premiums,1)*100,100)}%`,height:"100%",background:c,borderRadius:2}}/>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Plan Coverage Flags</div>
          {[
            {label:"Health Coverage",ok:dol.has_health,note:dol.has_health?"Medical/dental/vision on file":"No health plan detected — gap risk"},
            {label:"Stop-Loss Protection",ok:dol.has_stop_loss,note:dol.has_stop_loss?"Catastrophic protection in place":`${fmtN(dol.participants)} participants without stop-loss`},
            {label:"Rx/Drug Benefit",ok:dol.has_drug,note:dol.has_drug?"Drug coverage confirmed":"No drug benefit — GLP-1 blind spot"},
            {label:"Multi-Plan Structure",ok:dol.plan_count>1,note:dol.plan_count>1?`${dol.plan_count} plans = complexity premium opportunity`:"Single plan — simpler engagement"},
          ].map(({label,ok,note})=>(
            <div key={label} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderBottom:`1px solid ${BORDER}`}}>
              {ok?<CheckCircle2 size={14} color={GREEN} style={{marginTop:1,flexShrink:0}}/>:<AlertTriangle size={14} color={RED} style={{marginTop:1,flexShrink:0}}/>}
              <div>
                <div style={{color:TEXT1,fontSize:12,fontWeight:600}}>{label}</div>
                <div style={{color:TEXT2,fontSize:11}}>{note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {dol.plan_details?.length>0&&(
        <div>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Individual Plans</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#ffffff06"}}>
              {["Plan","Participants","Fees","Broker","Carrier","Benefits"].map(h=><th key={h} style={{color:TEXT2,fontSize:10,textTransform:"uppercase",padding:"7px 10px",textAlign:"left",borderBottom:`1px solid ${BORDER}`}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {dol.plan_details.map((p:any,i:number)=>(
                <tr key={i} style={{borderBottom:`1px solid ${BORDER}`}}>
                  <td style={{padding:"7px 10px",color:TEXT1,fontWeight:600,fontSize:11}}>{p.plan_name?.slice(0,30)}</td>
                  <td style={{padding:"7px 10px",color:TEXT1}}>{(p.participants||0).toLocaleString()}</td>
                  <td style={{padding:"7px 10px",color:RED,fontWeight:600}}>{fmt(p.fees)}</td>
                  <td style={{padding:"7px 10px",color:AMBER}}>{fmt(p.broker)}</td>
                  <td style={{padding:"7px 10px",color:TEXT2,fontSize:11}}>{(p.carrier||"—").slice(0,22)}</td>
                  <td style={{padding:"7px 10px"}}>
                    <div style={{display:"flex",gap:4}}>
                      {p.has_health&&<Badge text="H" color={GREEN}/>}
                      {p.has_stop_loss&&<Badge text="SL" color={CYAN}/>}
                      {p.has_drug&&<Badge text="Rx" color={PURPLE}/>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Gate 3: Fee Intelligence ───────────────────────────────────────────── */
function Gate3({data,history}:{data:any;history:any[]}){
  const {fcr,edgar,dol,gates} = data;
  const g = gates.gate3_fcr;
  const barData=[{name:"This Plan",fees:Math.round(dol.total_fees/1000)},{name:"Sector Median",fees:Math.round(fcr.sector_bench_fees/1000)}];
  const histFeeData = history.map((h:any)=>({yr:String(h.year),fees:Math.round(h.total_fees/1000),broker:Math.round(h.broker_commissions/1000),admin:Math.round(h.admin_fees/1000)}));
  return(
    <div>
      <GateHeader num={3} label="Fee Intelligence" status={g.status} note={g.note} score={g.score}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <KV label="Fiduciary Cost Ratio" value={pct(fcr.fcr_pct)} color={fcr.fcr_pct>fcr.sector_median_fcr*1.5?RED:fcr.fcr_pct>fcr.sector_median_fcr?AMBER:GREEN} sub={`${pct(fcr.sector_median_fcr)} sector median`}/>
            <KV label="Fee Excess" value={fmt(fcr.fcr_excess)} color={fcr.fcr_excess>0?RED:GREEN} sub="vs peer median"/>
            <KV label="Recoverable (40%)" value={fmt(fcr.recoverable)} color={GREEN} big/>
            <KV label="Fee/Participant" value={`$${fcr.fee_per_participant}`} sub={`${fcr.sector_plans} sector peers`}/>
          </div>
          <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:14}}>
            <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Fiduciary Verdict</div>
            <Badge text={fcr.verdict} color={fcr.verdict==="Excessive"?RED:fcr.verdict==="Elevated"?AMBER:GREEN}/>
            <div style={{color:TEXT1,fontSize:13,marginTop:10,lineHeight:1.6}}>
              {edgar.name}'s plan fees are <strong style={{color:fcr.verdict==="Excessive"?RED:fcr.verdict==="Elevated"?AMBER:GREEN}}>{fcr.verdict.toLowerCase()}</strong> at {pct(fcr.fcr_pct)} of revenue vs. a {pct(fcr.sector_median_fcr)} sector median.
              {fcr.recoverable>0&&` Estimated ${fmt(fcr.recoverable)} recoverable through competitive restructuring.`}
            </div>
            <div style={{marginTop:12,color:TEXT2,fontSize:12}}>
              <strong style={{color:ACCENT}}>Engagement angle:</strong> "I can show you data from {fcr.sector_plans} comparable companies that suggests your plan fees are running at a multiple of what you should be paying. Let's review the numbers."
            </div>
          </div>
        </div>
        <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:16}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Plan Fees vs Sector Median ($K)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={70}>
              <XAxis dataKey="name" tick={{fill:TEXT2,fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}K`}/>
              <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${v}K`,"Fees"]}/>
              <Bar dataKey="fees" radius={[4,4,0,0]}><Cell fill={RED}/><Cell fill={GREEN}/></Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[["Invest",dol.invest_fees,ACCENT],["Admin",dol.admin_fees,CYAN],["Legal",dol.legal_fees,PURPLE]].map(([l,v,c]:any)=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{color:c,fontSize:14,fontWeight:700}}>{fmt(v||0)}</div>
                <div style={{color:TEXT2,fontSize:10}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {histFeeData.length>1&&(
        <div style={{marginTop:16,background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:10,padding:"16px 20px"}}>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>4-Year Fee Trend Drill-Down ($K) — Broker · Admin · Total</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={histFeeData} barSize={18} barGap={3}>
              <XAxis dataKey="yr" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}K`}/>
              <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any,n:any)=>[`$${v}K`,n]}/>
              <Bar dataKey="broker" name="Broker" radius={[3,3,0,0]} fill={AMBER}/>
              <Bar dataKey="admin" name="Admin" radius={[3,3,0,0]} fill={CYAN}/>
              <Bar dataKey="fees" name="Total" radius={[3,3,0,0]} fill={`${RED}99`}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center"}}>
            {[["Broker",AMBER],["Admin",CYAN],["Total",`${RED}99`]].map(([l,c]:any)=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:10,height:10,borderRadius:2,background:c}}/>
                <span style={{color:TEXT2,fontSize:10}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Gate 4: Risk Exposure ──────────────────────────────────────────────── */
function Gate4({data,history}:{data:any;history:any[]}){
  const {glp1,dol,risk,gates} = data;
  const g = gates.gate4_risk;
  const tierColor=(t:string)=>t==="Critical"?RED:t==="High"?AMBER:CYAN;
  const tc=tierColor(glp1.risk_tier);
  const proj=[{yr:"Year 1",cost:Math.round(glp1.annual_exposure/1e6)},{yr:"Year 2",cost:Math.round(glp1.annual_exposure*1.35/1e6)},{yr:"Year 3",cost:Math.round(glp1.annual_exposure*1.75/1e6)}];
  return(
    <div>
      <GateHeader num={4} label="Risk Exposure" status={g.status} note={g.note} score={g.score}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:10,padding:20,textAlign:"center",marginBottom:12}}>
            <div style={{color:TEXT2,fontSize:12,marginBottom:8}}>GLP-1 Risk Score</div>
            <div style={{fontSize:72,fontWeight:900,color:tc,lineHeight:1}}>{glp1.risk_score}</div>
            <div style={{marginTop:8}}><Badge text={glp1.risk_tier} color={tc}/></div>
            <div style={{color:TEXT2,fontSize:12,marginTop:10}}>Based on SIC workforce profile</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <KV label="At-Risk Members" value={fmtN(glp1.eligible_members)} color={tc}/>
            <KV label="Annual Exposure" value={fmt(glp1.annual_exposure)} color={tc}/>
            <KV label="3-Year Projection" value={fmt(glp1.exposure_3yr)} color={RED}/>
            <KV label="Intervention Saves" value={fmt(glp1.intervention_savings)} color={GREEN}/>
          </div>
        </div>
        <div>
          <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:14,marginBottom:12}}>
            <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>3-Year Cost Trajectory ($M)</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={proj} barSize={60}>
                <XAxis dataKey="yr" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}M`}/>
                <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${v}M`,"Projected"]}/>
                <Bar dataKey="cost" radius={[4,4,0,0]}><Cell fill={AMBER}/><Cell fill={RED}/><Cell fill={`${RED}cc`}/></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:14}}>
            <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Additional Risk Flags</div>
            {[
              {label:"Stop-Loss Gap",flag:risk.has_stop_loss_gap,note:risk.has_stop_loss_gap?`${fmtN(dol.participants)} participants exposed to catastrophic claims`:"Stop-loss coverage confirmed"},
              {label:"Carrier Commission Excess",flag:risk.carrier_risk==="High",note:`Commission rate: ${risk.commission_pct}% of plan income (${risk.carrier_risk} risk)`},
              {label:"Drug Benefit Blind Spot",flag:!dol.has_drug,note:dol.has_drug?"Drug benefit documented":"No Rx benefit on file — GLP-1 gap not measured"},
            ].map(({label,flag,note})=>(
              <div key={label} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"7px 0",borderBottom:`1px solid ${BORDER}`}}>
                {flag?<AlertTriangle size={13} color={RED} style={{marginTop:1,flexShrink:0}}/>:<CheckCircle2 size={13} color={GREEN} style={{marginTop:1,flexShrink:0}}/>}
                <div>
                  <div style={{color:TEXT1,fontSize:12,fontWeight:600}}>{label}</div>
                  <div style={{color:TEXT2,fontSize:11}}>{note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Gate 5: Market Position ────────────────────────────────────────────── */
function Gate5({data}:{data:any}){
  const {risk,dol,fcr,edgar,gates} = data;
  const g = gates.gate5_market;
  const riskColor=(r:string)=>r==="High"?RED:r==="Moderate"?AMBER:GREEN;
  return(
    <div>
      <GateHeader num={5} label="Market Position" status={g.status} note={g.note} score={g.score}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <KV label="Carrier Risk" value={risk.carrier_risk} color={riskColor(risk.carrier_risk)} big/>
            <KV label="Commission Rate" value={pct(risk.commission_pct)} color={risk.commission_pct>20?RED:AMBER} sub="of plan income"/>
            <KV label="Carriers on File" value={String(dol.carriers.length)} sub={dol.carriers[0]?.slice(0,20)||"Unknown"}/>
            <KV label="Broker Commission" value={fmt(dol.broker_commissions)} color={RED}/>
          </div>
          <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:14}}>
            <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Carrier Intelligence</div>
            {dol.carriers.map((c:string,i:number)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${BORDER}`}}>
                <span style={{color:TEXT1,fontSize:12}}>{c.slice(0,35)}</span>
                <Badge text={i===0?"Primary":"Secondary"} color={i===0?ACCENT:TEXT2}/>
              </div>
            ))}
            {dol.carriers.length===0&&<div style={{color:TEXT2,fontSize:12}}>No carriers identified in most recent filing</div>}
          </div>
        </div>
        <div>
          <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:14,marginBottom:12}}>
            <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Competitive Position Analysis</div>
            {[
              {label:"Fee position vs sector",status:fcr.verdict,note:`${pct(fcr.fcr_pct)} FCR vs ${pct(fcr.sector_median_fcr)} median`,flag:fcr.verdict!=="Aligned"},
              {label:"Broker commission",status:risk.carrier_risk,note:`${pct(risk.commission_pct)} of plan income — industry norm is 10-15%`,flag:risk.commission_pct>15},
              {label:"Stop-loss coverage",status:dol.has_stop_loss?"Protected":"Exposed",note:dol.has_stop_loss?"Catastrophic risk managed":"No stop-loss detected",flag:!dol.has_stop_loss},
              {label:"Plan structure",status:dol.plan_count>1?"Multi-Plan":"Single Plan",note:dol.plan_count>1?`${dol.plan_count} plans suggest plan design opportunity`:"Simple structure",flag:false},
            ].map(({label,status,note,flag})=>(
              <div key={label} style={{padding:"8px 0",borderBottom:`1px solid ${BORDER}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{color:TEXT1,fontSize:12,fontWeight:600}}>{label}</span>
                  <Badge text={status} color={flag?RED:GREEN}/>
                </div>
                <div style={{color:TEXT2,fontSize:11}}>{note}</div>
              </div>
            ))}
          </div>
          <div style={{background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,borderRadius:8,padding:14}}>
            <div style={{color:ACCENT,fontSize:12,fontWeight:700,marginBottom:6}}>Opening Angle</div>
            <div style={{color:TEXT1,fontSize:13,lineHeight:1.6}}>
              "We've benchmarked {fcr.sector_plans}+ companies in your sector using DOL Form 5500 filings. Your current plan cost structure suggests there may be {fmt(fcr.recoverable)} in recoverable fees — would you be open to a 30-minute review?"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Gate 6: Opportunity Sizing ─────────────────────────────────────────── */
function Gate6({data}:{data:any}){
  const {opportunity,fcr,glp1,edgar,dol,gates} = data;
  const g = gates.gate6_opportunity;
  const waterfall=[
    {label:"Fee Recovery Commission",value:opportunity.fee_recovery_commission,color:ACCENT},
    {label:"GLP-1 Stewardship Mgmt",value:opportunity.glp1_commission,color:PURPLE},
    {label:"Total Year 1",value:opportunity.total_first_year,color:GREEN},
    {label:"3-Year Value",value:opportunity.three_year_value,color:GOLD},
  ];
  return(
    <div>
      <GateHeader num={6} label="Opportunity Sizing" status={g.status} note={g.note} score={g.score}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <div style={{background:`${GREEN}11`,border:`1px solid ${GREEN}33`,borderRadius:10,padding:20,textAlign:"center",marginBottom:16}}>
            <div style={{color:TEXT2,fontSize:12,marginBottom:6}}>Estimated First-Year Commission</div>
            <div style={{fontSize:52,fontWeight:900,color:GREEN,lineHeight:1}}>{fmt(opportunity.total_first_year)}</div>
            <div style={{color:TEXT2,fontSize:12,marginTop:8}}>3-Year Total: <strong style={{color:GOLD}}>{fmt(opportunity.three_year_value)}</strong></div>
          </div>
          {waterfall.map(({label,value,color})=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${BORDER}`}}>
              <span style={{color:TEXT2,fontSize:12}}>{label}</span>
              <span style={{color,fontSize:15,fontWeight:700}}>{fmt(value)}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{background:"#ffffff06",border:`1px solid ${BORDER}`,borderRadius:8,padding:14,marginBottom:12}}>
            <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Commission Model</div>
            {[
              {label:"Fee recovery basis",value:`${fmt(fcr.recoverable)} recoverable`,note:"20% commission on proven savings"},
              {label:"GLP-1 stewardship basis",value:`${fmtN(glp1.eligible_members)} members`,note:"5% on managed intervention savings"},
              {label:"Plan size",value:`${fmtN(dol.participants)} participants`,note:"Larger plans = more opportunity complexity"},
              {label:"Revenue scale",value:fmt(edgar.revenue),note:"Aligns organizational gravity for proposal"},
            ].map(({label,value,note})=>(
              <div key={label} style={{padding:"7px 0",borderBottom:`1px solid ${BORDER}`}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:TEXT1,fontSize:12,fontWeight:600}}>{label}</span>
                  <span style={{color:ACCENT,fontSize:12,fontWeight:700}}>{value}</span>
                </div>
                <div style={{color:TEXT2,fontSize:11}}>{note}</div>
              </div>
            ))}
          </div>
          <div style={{background:`${GREEN}11`,border:`1px solid ${GREEN}33`,borderRadius:8,padding:14}}>
            <div style={{color:GREEN,fontSize:12,fontWeight:700,marginBottom:6}}>Revenue Projection</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={[{yr:"Y1",v:opportunity.total_first_year/1000},{yr:"Y2",v:opportunity.total_first_year*1.2/1000},{yr:"Y3",v:opportunity.total_first_year*1.35/1000}]} barSize={50}>
                <XAxis dataKey="yr" tick={{fill:TEXT2,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:TEXT2,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}K`}/>
                <Tooltip contentStyle={{background:CARD,border:`1px solid ${BORDER}`,color:TEXT1}} formatter={(v:any)=>[`$${Number(v)}K`,""]}/>
                <Bar dataKey="v" fill={GREEN} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Gate 7: Commitment Proposal ────────────────────────────────────────── */
function Gate7({data}:{data:any}){
  const [,navigate] = useLocation();
  const {edgar,dol,fcr,glp1,risk,opportunity,gates,go_count,composite_score} = data;
  const g = gates.gate7_commit;
  const scoreColor = composite_score>=70?GREEN:composite_score>=45?AMBER:RED;
  const allGates = Object.values(gates) as any[];
  const goCount = allGates.filter(g=>g.status==="GO").length;
  const narrative = `KINCAID HEALTH VERIFY™ — PROSPECT ANALYSIS SUMMARY
Company: ${edgar.name}
EIN: ${data.ein} | SIC: ${edgar.sic} | ${edgar.sector}
Analysis Date: ${new Date().toLocaleDateString()}

KEY FINDINGS:

1. FIDUCIARY COST RATIO: ${edgar.name}'s plan fees represent ${pct(fcr.fcr_pct)} of revenue — ${fcr.verdict.toLowerCase()} vs the ${pct(fcr.sector_median_fcr)} sector median across ${fcr.sector_plans} comparable plans. Estimated recoverable: ${fmt(fcr.recoverable)}.

2. GLP-1 EXPOSURE: Risk score ${glp1.risk_score}/100 (${glp1.risk_tier}). With ${fmtN(dol.participants)} plan participants, estimated ${fmtN(glp1.eligible_members)} GLP-1 eligible members carry ${fmt(glp1.annual_exposure)} annual exposure with a 3-year trajectory of ${fmt(glp1.exposure_3yr)} without intervention. Stewardship saves an estimated ${fmt(glp1.intervention_savings)}.

3. CARRIER INTELLIGENCE: ${dol.carriers[0]||"Primary carrier"} identified. Commission rate of ${pct(risk.commission_pct)} of plan income (${risk.carrier_risk} risk tier). ${risk.has_stop_loss_gap?`Stop-loss gap: ${fmtN(dol.participants)} participants without catastrophic protection.`:"Stop-loss coverage in place."}

4. OPPORTUNITY SIZING: Estimated first-year commission ${fmt(opportunity.total_first_year)} (fee recovery + GLP-1 stewardship). 3-year relationship value: ${fmt(opportunity.three_year_value)}.

GATE CLEARANCE: ${goCount}/7 gates cleared | Composite score: ${composite_score}/100

RECOMMENDED NEXT STEP: Schedule a 30-minute fiduciary benchmark review with the CFO/HR Director. Present the DOL-sourced fee comparison against ${fcr.sector_plans} sector peers.

—Kincaid Health | SHRACK-7742 | Kincaid Health VERIFY™`;
  return(
    <div>
      <GateHeader num={7} label="Commit & Proposal" status={g.status} note={g.note} score={g.score}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <div style={{background:"#ffffff06",border:`1px solid ${scoreColor}33`,borderRadius:10,padding:20,textAlign:"center",marginBottom:16}}>
            <div style={{color:TEXT2,fontSize:12,marginBottom:6}}>KincaidCommit™ Score</div>
            <div style={{fontSize:68,fontWeight:900,color:scoreColor,lineHeight:1}}>{composite_score}</div>
            <div style={{color:TEXT2,fontSize:12,marginTop:6}}>Gate Clearance: <strong style={{color:GREEN}}>{goCount}/7</strong></div>
            <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
              {allGates.map((gate:any,i:number)=>(
                <div key={i} style={{width:28,height:28,borderRadius:"50%",background:`${statusColor(gate.status)}22`,border:`2px solid ${statusColor(gate.status)}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{color:statusColor(gate.status),fontSize:9,fontWeight:800}}>G{i+1}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {allGates.map((gate:any,i:number)=>(
              <div key={i} style={{background:"#ffffff06",border:`1px solid ${statusColor(gate.status)}33`,borderRadius:6,padding:"8px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  {statusIcon(gate.status,12)}
                  <span style={{color:statusColor(gate.status),fontSize:10,fontWeight:700}}>Gate {i+1}</span>
                </div>
                <div style={{color:TEXT2,fontSize:10,lineHeight:1.3}}>{gate.note?.slice(0,55)}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{color:TEXT2,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Executive Proposal Narrative</div>
          <textarea readOnly value={narrative} data-testid="textarea-proposal"
            style={{width:"100%",background:"#ffffff06",border:`1px solid ${BORDER}`,color:TEXT1,borderRadius:8,padding:"14px 16px",fontSize:11,lineHeight:1.7,height:340,resize:"none",fontFamily:"'JetBrains Mono','SF Mono',monospace",outline:"none",boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button data-testid="btn-copy-proposal" onClick={()=>navigator.clipboard?.writeText(narrative)}
              style={{flex:1,background:`${ACCENT}22`,border:`1px solid ${ACCENT}44`,color:ACCENT,borderRadius:8,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
              Copy Narrative
            </button>
            <button data-testid="btn-export-proposal"
              onClick={async()=>{
                const {jsPDF} = await import("jspdf");
                const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"letter"});
                const W=216, lm=18, rm=18, tw=W-lm-rm;
                // Header bar
                doc.setFillColor(7,9,28); doc.rect(0,0,W,40,"F");
                doc.setTextColor(79,125,255); doc.setFontSize(18); doc.setFont("helvetica","bold");
                doc.text("KINCAID HEALTH VERIFY™",lm,16);
                doc.setTextColor(240,244,255); doc.setFontSize(10); doc.setFont("helvetica","normal");
                doc.text(`KincaidCommit Engine™ — 7-Gate Prospect Analysis`,lm,24);
                doc.setFontSize(8); doc.setTextColor(139,157,212);
                doc.text(`Generated ${new Date().toLocaleDateString()} · SHRACK-7742 · Kincaid Health`,lm,32);
                // Composite score badge
                const sc2=composite_score>=70?"#22c55e":composite_score>=45?"#f59e0b":"#ef4444";
                const [r2,g2,b2]=[parseInt(sc2.slice(1,3),16),parseInt(sc2.slice(3,5),16),parseInt(sc2.slice(5,7),16)];
                doc.setFillColor(r2,g2,b2); doc.roundedRect(W-50,8,38,24,3,3,"F");
                doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont("helvetica","bold");
                doc.text(String(composite_score),W-36,20,{align:"center"});
                doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.text("/ 100",W-28,27,{align:"center"});
                let y=50;
                // Company info
                doc.setTextColor(240,244,255); doc.setFontSize(14); doc.setFont("helvetica","bold");
                doc.text(edgar.name||"",lm,y); y+=7;
                doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(139,157,212);
                doc.text(`EIN: ${data.ein}  ·  SIC: ${edgar.sic}  ·  ${edgar.sector}  ·  ${edgar.city||""}, ${edgar.state||""}`,lm,y); y+=12;
                // Key metrics row
                const metrics=[
                  ["Revenue",fmt(edgar.revenue)],["Participants",fmtN(dol.participants)],
                  ["Total Fees",fmt(dol.total_fees)],["GLP-1 Score",`${glp1.risk_score}/100`],
                  ["Opportunity",fmt(opportunity.total_first_year)],["3-Yr Value",fmt(opportunity.three_year_value)],
                ];
                const mw=tw/3; const my=y;
                metrics.forEach(([l,v],i)=>{
                  const col=i%3, row=Math.floor(i/3);
                  const bx=lm+col*mw, by=my+row*16;
                  doc.setFillColor(13,16,51); doc.roundedRect(bx,by,mw-4,13,2,2,"F");
                  doc.setTextColor(139,157,212); doc.setFontSize(7); doc.setFont("helvetica","normal");
                  doc.text(String(l),bx+4,by+5);
                  doc.setTextColor(240,244,255); doc.setFontSize(10); doc.setFont("helvetica","bold");
                  doc.text(String(v),bx+4,by+11);
                });
                y+=38;
                // Gate scorecard table
                doc.setTextColor(139,157,212); doc.setFontSize(8); doc.setFont("helvetica","bold");
                doc.text("7-GATE SCORECARD",lm,y); y+=6;
                const gateRows=Object.entries(gates) as [string,any][];
                const gLabels=["Intel Scan","Plan Inventory","Fee Intelligence","Risk Exposure","Market Position","Opportunity $","Commit"];
                gateRows.forEach(([_k,gt],i)=>{
                  const sc3=gt.status==="GO"?[34,197,94]:gt.status==="NO-GO"?[239,68,68]:[245,158,11];
                  doc.setFillColor(13,16,51); doc.rect(lm,y,tw,10,"F");
                  doc.setFillColor(...sc3 as [number, number, number]); doc.rect(lm,y,3,10,"F");
                  doc.setTextColor(240,244,255); doc.setFontSize(8); doc.setFont("helvetica","bold");
                  doc.text(`Gate ${i+1}: ${gLabels[i]}`,lm+6,y+6);
                  doc.setFont("helvetica","normal"); doc.setTextColor(139,157,212);
                  const noteStr=(gt.note||"").slice(0,70);
                  doc.text(noteStr,lm+50,y+6);
                  doc.setTextColor(...sc3 as [number, number, number]); doc.text(`${gt.status} (${gt.score})`,lm+tw-25,y+6,{align:"right"});
                  y+=11;
                });
                y+=8;
                // Narrative
                doc.setTextColor(139,157,212); doc.setFontSize(8); doc.setFont("helvetica","bold");
                doc.text("EXECUTIVE NARRATIVE",lm,y); y+=5;
                doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(200,210,240);
                const narLines=doc.splitTextToSize(narrative,tw);
                narLines.slice(0,40).forEach((line:string)=>{doc.text(line,lm,y);y+=4.2;});
                // Footer
                const fY=270;
                doc.setDrawColor(30,40,100); doc.line(lm,fY,W-rm,fY);
                doc.setFontSize(7); doc.setTextColor(80,100,160);
                doc.text("Kincaid Health VERIFY™ · Fiduciary-grade analysis from 937K+ DOL Form 5500 filings",lm,fY+5);
                doc.save(`KincaidCommit_${edgar.name?.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`);
              }}
              style={{flex:1,background:`${GREEN}22`,border:`1px solid ${GREEN}44`,color:GREEN,borderRadius:8,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>
              ⬇ Export PDF
            </button>
          </div>
          <button data-testid="btn-open-war-room"
            onClick={()=>navigate(`/war-room?ein=${encodeURIComponent(data.ein)}&name=${encodeURIComponent(edgar.name||data.ein)}`)}
            style={{width:"100%",marginTop:10,background:`${GOLD}18`,border:`1px solid ${GOLD}55`,color:GOLD,borderRadius:8,padding:"11px 0",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <Target size={15}/> Open in War Room
            <ArrowRight size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared: Gate header ─────────────────────────────────────────────────── */
function GateHeader({num,label,status,note,score}:{num:number;label:string;status:string;note:string;score:number}){
  const sc = statusColor(status);
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${BORDER}`}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{background:`${sc}22`,border:`2px solid ${sc}`,borderRadius:"50%",width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{color:sc,fontWeight:900,fontSize:14}}>G{num}</span>
        </div>
        <div>
          <div style={{color:TEXT1,fontSize:18,fontWeight:800}}>{label}</div>
          <div style={{color:TEXT2,fontSize:12,marginTop:2}}>{note}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{textAlign:"right"}}>
          <div style={{color:sc,fontSize:28,fontWeight:900}}>{score}</div>
          <div style={{color:TEXT2,fontSize:10,marginTop:-2}}>/ 100</div>
        </div>
        <div style={{background:`${sc}22`,border:`1px solid ${sc}44`,borderRadius:8,padding:"8px 14px",display:"flex",alignItems:"center",gap:6}}>
          {statusIcon(status,16)}
          <span style={{color:sc,fontSize:14,fontWeight:800}}>{status}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Company search ─────────────────────────────────────────────────────── */
function CommitSearch({onSelect}:{onSelect:(ein:string,name:string)=>void}){
  const [q,setQ]=useState("");
  const [dq,setDq]=useState("");
  const {data,isLoading}=useQuery<any>({queryKey:["/api/commit/search",dq],queryFn:async()=>{const r=await fetch(`/api/commit/search?q=${encodeURIComponent(dq)}`,{credentials:"include"});return r.json();},enabled:dq.length>=2});
  const handleInput=(v:string)=>{setQ(v);setTimeout(()=>setDq(v),350);};
  return(
    <div>
      <div style={{position:"relative",marginBottom:12}}>
        <Search size={16} color={TEXT2} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}/>
        <input data-testid="input-commit-search" value={q} onChange={e=>handleInput(e.target.value)}
          placeholder="Search any public company to launch 7-gate analysis (Marriott, IDEXX, WEX, Publix…)"
          style={{width:"100%",background:CARD,border:`1px solid ${ACCENT}44`,borderRadius:8,color:TEXT1,fontSize:14,padding:"14px 14px 14px 42px",outline:"none",boxSizing:"border-box"}}/>
        {isLoading&&<RefreshCw size={14} color={TEXT2} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",animation:"spin 1s linear infinite"}}/>}
      </div>
      {data?.results?.length>0&&(
        <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,overflow:"hidden",maxHeight:360,overflowY:"auto"}}>
          {data.results.map((r:any)=>(
            <button key={r.ein} data-testid={`btn-commit-${r.ein}`} onClick={()=>{onSelect(r.ein,r.name);setQ("");setDq("");}}
              style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${BORDER}`,padding:"12px 16px",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}
              onMouseOver={e=>(e.currentTarget.style.background=`${ACCENT}11`)} onMouseOut={e=>(e.currentTarget.style.background="transparent")}>
              <div>
                <div style={{color:TEXT1,fontSize:13,fontWeight:600}}>{r.name}</div>
                <div style={{color:TEXT2,fontSize:11}}>{r.sector} · {r.city}, {r.state} · EIN {r.ein}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {r.has_dol?<Badge text="DOL + EDGAR" color={GREEN}/>:<Badge text="EDGAR only" color={AMBER}/>}
                <ArrowRight size={14} color={TEXT2}/>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Federal Intelligence mini-panel ────────────────────────────────────── */
function FederalIntelPanel({companyName}:{companyName:string}){
  const {data,isLoading}=useQuery<any>({
    queryKey:["/api/federal-intel/scan",companyName],
    queryFn:async()=>{const r=await fetch(`/api/federal-intel/scan?name=${encodeURIComponent(companyName)}`,{credentials:"include"});if(!r.ok)throw new Error("Federal scan failed");return r.json();},
    enabled:!!companyName,
    staleTime:600_000,
  });

  const signalColor=(s:string)=>s==="HIGH"?RED:s==="ELEVATED"?AMBER:s==="WATCH"?CYAN:GREEN;
  const statusColor=(s:string)=>s==="FLAGGED"?RED:s==="WATCH"?CYAN:s==="CLEAR"?GREEN:TEXT2;

  return(
    <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"18px 22px",marginTop:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Shield size={15} color={RED}/>
          <span style={{color:TEXT1,fontSize:13,fontWeight:700}}>Federal Risk Intelligence™</span>
          <span style={{color:TEXT2,fontSize:11,padding:"2px 8px",background:"#ffffff08",borderRadius:10}}>
            OIG · SAM.gov · CourtListener · DOL
          </span>
        </div>
        <Link href="/federal-intelligence">
          <a style={{color:ACCENT,fontSize:11,display:"flex",alignItems:"center",gap:4,textDecoration:"none"}}>
            Full scan <ExternalLink size={11}/>
          </a>
        </Link>
      </div>

      {isLoading&&(
        <div style={{display:"flex",alignItems:"center",gap:6,color:TEXT2,fontSize:12}}>
          <RefreshCw size={12} style={{animation:"spin 1s linear infinite"}}/>
          Scanning federal databases…
        </div>
      )}

      {data&&(
        <>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{
              background:`${signalColor(data.risk_signal)}18`,
              border:`1px solid ${signalColor(data.risk_signal)}44`,
              borderRadius:8,
              padding:"6px 14px",
              display:"flex",alignItems:"center",gap:6,
            }}>
              {data.risk_signal==="CLEAR"&&<CheckCircle2 size={13} color={GREEN}/>}
              {data.risk_signal==="WATCH"&&<AlertCircle size={13} color={CYAN}/>}
              {data.risk_signal==="ELEVATED"&&<AlertTriangle size={13} color={AMBER}/>}
              {data.risk_signal==="HIGH"&&<XCircle size={13} color={RED}/>}
              <span style={{color:signalColor(data.risk_signal),fontWeight:800,fontSize:12,letterSpacing:0.5}}>
                {data.risk_signal}
              </span>
            </div>
            <span style={{color:TEXT2,fontSize:12}}>
              {data.total_hits} total {data.total_hits===1?"record":"records"} · {data.sources_flagged} {data.sources_flagged===1?"source":"sources"} flagged
            </span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
            {data.sources?.map((s:any,i:number)=>(
              <div key={i} style={{
                background:"#ffffff05",
                border:`1px solid ${statusColor(s.status)}22`,
                borderRadius:8,
                padding:"10px 12px",
                display:"flex",alignItems:"center",gap:8,
              }}>
                {s.source.includes("OIG")&&<Shield size={13} color="#f43f5e"/>}
                {s.source.includes("SAM")&&<Landmark size={13} color="#8b5cf6"/>}
                {s.source.includes("Court")&&<Gavel size={13} color={CYAN}/>}
                {s.source.includes("DOL")&&<Scale size={13} color={AMBER}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:TEXT1,fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.source}</div>
                  <div style={{color:statusColor(s.status),fontSize:10,fontWeight:700}}>
                    {s.status==="NO_KEY"?"KEY REQUIRED":s.status}
                    {s.hits>0&&` · ${s.hits} hit${s.hits===1?"":"s"}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main CommitEngine page ─────────────────────────────────────────────── */
export default function CommitEngine(){
  const [ein,setEin]=useState("");
  const [name,setName]=useState("");
  const [gate,setGate]=useState(0);
  const [location] = useLocation();

  // Read ?ein= and ?name= from URL params for deep-link from Prospecting
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const urlEin = params.get("ein");
    const urlName = params.get("name");
    if(urlEin && !ein){setEin(urlEin);setName(urlName||urlEin);setGate(0);}
  },[location]);

  const {data,isLoading,error}=useQuery<any>({
    queryKey:["/api/commit/analyze",ein],
    queryFn:async()=>{const r=await fetch(`/api/commit/analyze/${ein}`,{credentials:"include"});if(!r.ok){const e=await r.json();throw new Error(e.detail||"Analysis failed")}return r.json();},
    enabled:!!ein,
    staleTime:300_000,
  });

  // Fetch plan history for drill-down charts
  const {data:histData}=useQuery<any>({
    queryKey:["/api/commit/history",ein],
    queryFn:async()=>{const r=await fetch(`/api/commit/history/${ein}`,{credentials:"include"});return r.json();},
    enabled:!!ein,
    staleTime:300_000,
  });

  const handleSelect=(e:string,n:string)=>{setEin(e);setName(n);setGate(0);};

  return(
    <div style={{background:BG,minHeight:"100vh",color:TEXT1,fontFamily:"system-ui,-apple-system,sans-serif",padding:"24px 28px"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
          <Zap size={22} color={GOLD}/>
          <h1 style={{margin:0,fontSize:22,fontWeight:800}}>KincaidCommit Engine™</h1>
          <span style={{background:`${GOLD}22`,color:GOLD,border:`1px solid ${GOLD}44`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700}}>7-GATE · FIDUCIARY-GRADE</span>
        </div>
        <p style={{margin:0,color:TEXT2,fontSize:13}}>
          Structured 7-gate prospect analysis — chains DOL × EDGAR intelligence, GLP-1 risk, carrier analysis, and opportunity sizing into an executive-grade commitment proposal.
        </p>
      </div>

      {!ein?(
        <div>
          <CommitSearch onSelect={handleSelect}/>
          <div style={{marginTop:28,display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10}}>
            {[
              {n:1,label:"Intel Scan",desc:"EDGAR + DOL 5500 match confirmation",icon:<Globe size={16}/>},
              {n:2,label:"Plan Inventory",desc:"Plans, carriers, benefit flags",icon:<Building2 size={16}/>},
              {n:3,label:"Fee Intelligence",desc:"FCR vs sector, recoverable $",icon:<DollarSign size={16}/>},
              {n:4,label:"Risk Exposure",desc:"GLP-1 score, stop-loss gap",icon:<Pill size={16}/>},
              {n:5,label:"Market Position",desc:"Carrier risk, opening angle",icon:<Shield size={16}/>},
              {n:6,label:"Opportunity $",desc:"Commission model, 3-yr value",icon:<Target size={16}/>},
              {n:7,label:"Commit",desc:"Proposal narrative, export",icon:<Star size={16}/>},
            ].map(({n,label,desc,icon})=>(
              <div key={n} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
                <div style={{color:GOLD,marginBottom:8}}>{icon}</div>
                <div style={{color:TEXT1,fontSize:11,fontWeight:700,marginBottom:3}}>Gate {n}</div>
                <div style={{color:ACCENT,fontSize:11,marginBottom:4}}>{label}</div>
                <div style={{color:TEXT2,fontSize:10,lineHeight:1.4}}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:20,color:TEXT2,fontSize:13}}>
            Quick launch: <span style={{color:TEXT2}}>Try </span>
            {["WEX INC","IDEXX LABORATORIES","Marriott International","Asbury Automotive"].map(n=>(
              <button key={n} onClick={()=>handleInput(n)} style={{background:`${ACCENT}11`,border:`1px solid ${ACCENT}33`,color:ACCENT,borderRadius:6,padding:"4px 12px",fontSize:12,cursor:"pointer",marginLeft:6}}>{n}</button>
            ))}
          </div>
        </div>
      ):(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <button onClick={()=>{setEin("");setName("");setGate(0);}} style={{background:"none",border:`1px solid ${BORDER}`,color:TEXT2,cursor:"pointer",fontSize:12,borderRadius:6,padding:"5px 12px"}}>← New search</button>
            <div style={{color:TEXT1,fontSize:15,fontWeight:700}}>{name}</div>
            <div style={{color:TEXT2,fontSize:12}}>EIN: {ein}</div>
            {isLoading&&<div style={{display:"flex",alignItems:"center",gap:6,color:TEXT2,fontSize:12}}><RefreshCw size={12} color={TEXT2} style={{animation:"spin 1s linear infinite"}}/>Running 7-gate analysis…</div>}
          </div>
          {error&&<div style={{color:RED,padding:16,background:`${RED}11`,borderRadius:8,border:`1px solid ${RED}33`}}>Analysis failed: {(error as Error).message}</div>}
          {data&&(
            <>
              <GateStrip gates={data.gates} active={gate} onSelect={setGate}/>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"22px 24px"}}>
                {gate===0&&<Gate1 data={data}/>}
                {gate===1&&<Gate2 data={data}/>}
                {gate===2&&<Gate3 data={data} history={histData?.history||data.history||[]}/>}
                {gate===3&&<Gate4 data={data} history={histData?.history||data.history||[]}/>}
                {gate===4&&<Gate5 data={data}/>}
                {gate===5&&<Gate6 data={data}/>}
                {gate===6&&<Gate7 data={data}/>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:14}}>
                <button onClick={()=>setGate(Math.max(0,gate-1))} disabled={gate===0}
                  style={{background:gate===0?"#ffffff08":CARD,border:`1px solid ${BORDER}`,color:gate===0?TEXT2:TEXT1,borderRadius:8,padding:"10px 20px",cursor:gate===0?"not-allowed":"pointer",fontSize:13,fontWeight:600}}>
                  ← Previous Gate
                </button>
                <span style={{color:TEXT2,fontSize:12,alignSelf:"center"}}>Gate {gate+1} of 7 · KincaidCommit™ Score: <strong style={{color:data.composite_score>=70?GREEN:data.composite_score>=45?AMBER:RED}}>{data.composite_score}</strong></span>
                <button onClick={()=>setGate(Math.min(6,gate+1))} disabled={gate===6}
                  style={{background:gate===6?"#ffffff08":`${ACCENT}22`,border:`1px solid ${gate===6?BORDER:ACCENT}44`,color:gate===6?TEXT2:ACCENT,borderRadius:8,padding:"10px 20px",cursor:gate===6?"not-allowed":"pointer",fontSize:13,fontWeight:700}}>
                  Next Gate →
                </button>
              </div>
              <FederalIntelPanel companyName={name}/>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function handleInput(n: string) {
  const el = document.querySelector('[data-testid="input-commit-search"]') as HTMLInputElement;
  if (el) { el.value = n; el.dispatchEvent(new Event("input",{bubbles:true})); }
}
