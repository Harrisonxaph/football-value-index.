"use client";
import {useEffect, useMemo, useState} from "react";
import type {DashboardData, TeamStats, LeagueCode} from "../lib/metrics";
import {LEAGUES} from "../lib/metrics";

type SortKey="valueIndex"|"pointsPer100m"|"points"|"goalDifference"|"goalsFor"|"goalsAgainst"|"valueEurM";
const COLORS:Record<LeagueCode,string>={PL:"#B8F26C",PD:"#F3BE72",SA:"#97A9FF",BL1:"#ED96AD",FL1:"#79D0D0"};
const money=(v:number|null)=>v===null?"—":`€${v.toLocaleString("en-GB",{maximumFractionDigits:0})}m`;
const number=(n:number|null,d=1)=>n===null?"—":n.toFixed(d);
function safeValue(v:number|null){return v===null?Number.NEGATIVE_INFINITY:v;}
function exportTemplate(rows:TeamStats[]) {
  const data=Object.fromEntries(rows.map(t=>[t.id, {valueEurM:null,asOf:"",source:""}]));
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const href=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=href;
  a.download="valuations-template.json";a.click();URL.revokeObjectURL(href);
}
function DotChart({teams,selectedId,onSelect}:{teams:TeamStats[];selectedId:string|null;onSelect:(id:string)=>void}) {
  const valued=teams.filter(t=>t.valueEurM!==null && t.played>0);
  if(!valued.length)return <div className="empty-graph">Add dated squad values to see the performance vs value chart.</div>;
  const maxX=Math.max(200,...valued.map(t=>t.valueEurM!))*1.08;
  const maxY=30;
  const W=760,H=330,left=56,right=16,top=20,bottom=38;
  const x=(v:number)=>left+(v/maxX)*(W-left-right);
  const y=(v:number)=>H-bottom-(v/maxY)*(H-top-bottom);
  return <div className="chart-scroll"><svg viewBox={`0 0 ${W} ${H}`} aria-label="Squad value versus points scatter chart" role="img">
    {[0,10,20,30].map(t=><g key={t}><line x1={left} y1={y(t)} x2={W-right} y2={y(t)} stroke="#293b35"/><text x={left-10} y={y(t)+4} textAnchor="end" fill="#9caea6" fontSize="12">{t}</text></g>)}
    {[0,0.25,0.5,0.75,1].map(t=><g key={t}><line x1={x(t*maxX)} x2={x(t*maxX)} y1={top} y2={H-bottom} stroke="#25362f"/><text x={x(t*maxX)} y={H-12} fill="#9caea6" textAnchor="middle" fontSize="12">€{Math.round(t*maxX)}m</text></g>)}
    {valued.map(t=><circle key={`${t.league}-${t.id}`} cx={x(t.valueEurM!)} cy={y(t.points)} r={selectedId===t.id?9:Math.max(4,5+Math.max(-10,t.goalDifference)/6)}
      fill={COLORS[t.league]} stroke={selectedId===t.id?"#ffffff":"#10231c"} strokeWidth={selectedId===t.id?3:1.5} opacity=".88"
      className="chart-point" tabIndex={0} onClick={()=>onSelect(t.id)} onKeyDown={e=>{if(e.key==="Enter")onSelect(t.id)}}>
      <title>{`${t.name}: ${t.points} pts, ${money(t.valueEurM)}, GD ${t.goalDifference>=0?"+":""}${t.goalDifference}`}</title>
    </circle>)}
    <text x={W/2} y={H-1} textAnchor="middle" fill="#bacbc2" fontSize="12">Squad value (€ millions)</text>
    <text x={16} y={H/2} transform={`rotate(-90 16 ${H/2})`} textAnchor="middle" fill="#bacbc2" fontSize="12">Last 10 points</text>
  </svg></div>;
}

export default function Home(){
  const [data,setData]=useState<DashboardData|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [league,setLeague]=useState<string>("ALL");
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState<SortKey>("points");
  const [selected,setSelected]=useState<string|null>(null);
  const [latestLoaded,setLatestLoaded]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try {
        const r=await fetch("/api/dashboard",{cache:"no-store"});
        const d=await r.json(); if(!r.ok)throw new Error(d.error||"Unable to load results");
        if(active){setData(d);setError(null);setLatestLoaded(new Date().toISOString());}
      }catch(e){if(active)setError(e instanceof Error?e.message:"Unexpected network error");}
      finally{if(active)setLoading(false);}
    };
    void load();const interval=setInterval(()=>{void load();},60*60*1000);
    return ()=>{active=false;clearInterval(interval)};
  },[]);
  const filtered=useMemo(()=>{
    if(!data)return [];
    return data.teams.filter(t=>(league==="ALL"||t.league===league)&&t.name.toLowerCase().includes(query.toLowerCase().trim()))
      .sort((a,b)=>{
        const av=sort==="goalsAgainst"?-a.goalsAgainst:safeValue(a[sort]);
        const bv=sort==="goalsAgainst"?-b.goalsAgainst:safeValue(b[sort]);
        return bv-av||b.points-a.points||a.name.localeCompare(b.name);
      });
  },[data,league,query,sort]);
  const qualified=filtered.filter(t=>t.valueEurM!==null);
  const topScorer=[...filtered].sort((a,b)=>b.goalsFor-a.goalsFor)[0];
  const mostEfficient=[...filtered].filter(t=>t.valueIndex!==null).sort((a,b)=>b.valueIndex!-a.valueIndex!)[0];
  const mostPoints=[...filtered].sort((a,b)=>b.points-a.points)[0];
  const selectedRow=filtered.find(t=>t.id===selected)??filtered[0];
  return <main className="shell">
    <header className="header">
      <div className="brand"><span className="brand-icon">↗</span><span>THE FOOTBALL <strong>VALUE INDEX</strong></span></div>
      <div className="header-right"><span className="season">2026/27 · EUROPE TOP 5</span><span className={`status ${data && !data.warning?"status-live":""}`}>● {loading?"LOADING":data?.warning?"DATA CAUTION":"OPEN DATA"}</span></div>
    </header>
    <section className="hero">
      <div><p className="eyebrow">FOOTBALL INTELLIGENCE / CLUB EFFICIENCY</p><h1>Results over <em>resources.</em></h1><p className="sub">Find the clubs delivering more on the pitch for less off it. Last 10 domestic league matches, compared with estimated squad market value.</p></div>
      <div className="date-panel"><span>DATA CHECK</span><strong>{data?.generatedAt?new Date(data.generatedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"}):"—"}</strong><small>{data?.generatedAt?new Date(data.generatedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"Europe/London"}):""} · UK time</small><small>Checks hourly · upstream daily</small></div>
    </section>
    {error&&<div className="alert error"><strong>Open-data feed unavailable.</strong> {error}</div>}
    {data?.warning&&<div className="alert"><strong>{"DATA QUALITY NOTICE"}</strong> {data.warning}</div>}
    {data?.teams.some(t=>t.valuationSource?.includes("NOT verified date"))&&<div className="alert"><strong>HISTORICAL SQUAD BENCHMARK · 6 JUL 2026 ARCHIVE</strong> These figures reflect archived 2025/26 club profiles, not current 2026/27 squads. The individual club valuation dates are not available. Rankings are provisional.</div>}
    <section className="metrics">
      <div className="metric"><span>TEAMS TRACKED</span><strong>{filtered.length}</strong><small>across {league==="ALL"?5:1} league{league==="ALL"?"s":""}</small></div>
      <div className="metric"><span>HIGHEST POINTS</span><strong>{mostPoints?`${mostPoints.points} / ${mostPoints.played*3}`:"—"}</strong><small>{mostPoints?.name??"Not loaded"}</small></div>
      <div className="metric"><span>BEST VALUE INDEX</span><strong>{mostEfficient?number(mostEfficient.valueIndex):"—"}</strong><small>{mostEfficient?.name??"Missing valuations"}</small></div>
      <div className="metric"><span>MOST GOALS</span><strong>{topScorer?.goalsFor??"—"}</strong><small>{topScorer?.name??"Not loaded"}</small></div>
    </section>
    {data?.freshness && <section className="freshness" aria-label="League data freshness">{data.freshness.map(f=><a key={f.league} href={f.sourceUrl} target="_blank" rel="noreferrer" className="freshness-item"><span>{LEAGUES.find(l=>l.code===f.league)?.name}</span><strong>{f.latestResult?`Last score ${new Date(f.latestResult+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short"})}`:"No scored games"}</strong><small>{f.outstandingPastFixtures} past fixtures missing scores ↗</small></a>)}</section>}
    <section className="filterbar"><div className="leaguebar"><button className={league==="ALL"?"active":""} onClick={()=>setLeague("ALL")}>All leagues</button>{LEAGUES.map(l=><button key={l.code} onClick={()=>setLeague(l.code)} className={league===l.code?"active":""}>{l.name}</button>)}</div><div className="filters"><input aria-label="Search club" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search club…"/><label>Rank by <select value={sort} onChange={e=>setSort(e.target.value as SortKey)}><option value="valueIndex">Adjusted Value Index</option><option value="pointsPer100m">Points / €100m</option><option value="points">Points</option><option value="goalDifference">Goal difference</option><option value="goalsFor">Goals scored</option><option value="goalsAgainst">Fewest conceded</option><option value="valueEurM">Squad value</option></select></label></div></section>
    <div className="workspace">
      <section className="panel scatter"><div className="panel-title"><div><p className="eyebrow">VALUE V PERFORMANCE</p><h2>Are they worth their weight?</h2></div><span className="muted">Bubble size reflects goal difference</span></div><DotChart teams={filtered} selectedId={selected} onSelect={setSelected}/><div className="legend">{LEAGUES.filter(l=>league==="ALL"||league===l.code).map(l=><span key={l.code}><i style={{background:COLORS[l.code]}}/>{l.name}</span>)}</div></section>
      <section className="panel insight"><p className="eyebrow">CLUB DEEP DIVE</p><h2>{selectedRow?.name??"Select a club"}</h2><p className="muted">{selectedRow?LEAGUES.find(x=>x.code===selectedRow.league)?.name:""} · Last {selectedRow?.played??0} games</p>
        {selectedRow?<><div className="insight-stats"><div><b>{selectedRow.points}</b><span>Points</span></div><div><b>{selectedRow.goalsFor}–{selectedRow.goalsAgainst}</b><span>GF / GA</span></div><div><b>{money(selectedRow.valueEurM)}</b><span>Squad value</span></div><div><b>{number(selectedRow.valueIndex)}</b><span>Value index</span></div></div><div className="form">{selectedRow.form.slice().reverse().map((r,i)=><span className={r.result.toLowerCase()} key={`${r.date}-${i}`} title={`${r.opponent} (${r.venue}): ${r.goalsFor}–${r.goalsAgainst}`}>{r.result}</span>)}</div><div className="matchlist">{selectedRow.form.slice(0,5).map((r,i)=><div key={`${r.date}-${i}`}><span>{new Date(r.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})} · {r.venue}</span><span>{r.opponent}</span><strong>{r.goalsFor}–{r.goalsAgainst}</strong></div>)}</div><p className="note">{selectedRow.valuationAsOf?(selectedRow.valuationSource?.includes("NOT verified date")?`Historic archive snapshot ${selectedRow.valuationAsOf} · individual club valuation date unknown`:`Value as of ${selectedRow.valuationAsOf}`):"Squad valuation not entered"}{selectedRow.valuationSource?` · Source: ${selectedRow.valuationSource}`:""}{selectedRow.provisional?" · Provisional: fewer than 10 games":""}</p></>:<div className="muted">No clubs available</div>}
      </section>
    </div>
    <section className="panel rankings"><div className="panel-title"><div><p className="eyebrow">CLUB RANKINGS</p><h2>European efficiency leaderboard</h2></div><button className="outline" onClick={()=>data&&exportTemplate(data.teams)} disabled={!data}>↓ Download valuation template</button></div><div className="tablewrap"><table><thead><tr><th>#</th><th>Club</th><th>League</th><th>Pld</th><th>Pts</th><th>GF</th><th>GA</th><th>GD</th><th>Value</th><th>Pts / €100m</th><th>Index</th></tr></thead><tbody>{filtered.map((t,i)=><tr key={`${t.league}-${t.id}`} className={selected===t.id?"selected":""} onClick={()=>setSelected(t.id)}><td className="rank">{i+1}</td><td className="club">{t.name}{t.provisional&&<sup title="Fewer than ten completed games">*</sup>}</td><td><span className="league-dot" style={{background:COLORS[t.league]}}/>{t.league}</td><td>{t.played}</td><td><strong>{t.points}</strong></td><td>{t.goalsFor}</td><td>{t.goalsAgainst}</td><td className={t.goalDifference>0?"pos":t.goalDifference<0?"neg":""}>{t.goalDifference>0?"+":""}{t.goalDifference}</td><td>{money(t.valueEurM)}</td><td>{number(t.pointsPer100m,2)}</td><td className="index"><b>{number(t.valueIndex)}</b></td></tr>)}</tbody></table></div><footer className="table-footer">{filtered.length} clubs · {qualified.length} with entered squad values · * fewer than 10 completed games. Scores are computed from domestic league fixtures only.</footer></section>
    <footer className="bottom"><span>VALUE INDEX METHODOLOGY</span><p>Adjusted Index = 100 × [75% × points share + 25% × goal-difference score] × √(league median squad value / club squad value). GD score = clamp(0.5 + goals-per-game difference ÷ 6, 0, 1). Missing valuations do not receive a value rank. League medians are recalculated from clubs with supplied values.</p><p className="muted">Results: OpenFootball public-domain match feed, which can be delayed or incomplete. Market values: dated, manually verified snapshots (not live valuations). Results refresh on an hourly cache; do not treat these as in-play scores. Last successful browser check: {latestLoaded?new Date(latestLoaded).toLocaleString("en-GB"):"pending"}.</p></footer>
  </main>;
}
