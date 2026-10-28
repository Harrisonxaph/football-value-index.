"use client";
import {useState} from "react";
import type {TeamStats} from "../lib/metrics";
import {LEAGUES} from "../lib/metrics";
import type {IntelligenceTable} from "../lib/intelligence";

type Metric={label:string;left:number|null;right:number|null;unit:string;decimals:number;reverse?:boolean};
const format=(v:number|null,d=1)=>(v===null||!Number.isFinite(v))?"—":v.toFixed(d);
const fmtMoney=(v:number|null)=>v===null?"—":"€"+v.toLocaleString("en-GB",{maximumFractionDigits:0})+"m";
const leagueName=(team:TeamStats)=>LEAGUES.find(l=>l.code===team.league)?.name??team.league;
function rollingPoints(team:TeamStats){
  const matches=[...team.form].reverse();
  return matches.map((_,i)=>{
    const recent=matches.slice(Math.max(0,i-4),i+1);
    if(recent.length<3)return null;
    const points=recent.reduce((s,r)=>s+(r.result==="W"?3:r.result==="D"?1:0),0);
    return points/recent.length;
  });
}
function HeadToHeadTrend({a,b}:{a:TeamStats;b:TeamStats}){
  const first=rollingPoints(a),second=rollingPoints(b);
  const width=660,height=215,left=36,right=22,top=16,bottom=39;
  const length=Math.max(first.length,second.length,2);
  const x=(i:number)=>left+i/(length-1)*(width-left-right);
  const y=(v:number)=>height-bottom-v/3*(height-top-bottom);
  const path=(data:(number|null)[])=>{
    let continuing=false;
    return data.map((v,i)=>{
      if(v===null){continuing=false;return "";}
      const cmd=continuing?"L":"M";
      continuing=true;
      return cmd+x(i).toFixed(1)+","+y(v).toFixed(1);
    }).join(" ");
  };
  return <div className="compare-trend">
    <div className="compare-legend"><span><i className="first"/> {a.name}</span><span><i className="second"/> {b.name}</span></div>
    <svg viewBox={"0 0 "+width+" "+height} role="img" aria-label="Five-match rolling points-per-match comparison by recorded game sequence">
      <title>Form progression: points per match across each club&apos;s last ten recorded fixtures, in match order rather than common calendar dates</title>
      {[0,1,2,3].map(n=><g key={n}><line x1={left} x2={width-right} y1={y(n)} y2={y(n)} stroke="#3a5145"/>
        <text x={left-9} y={y(n)+4} fill="#a8b9ad" fontSize="11" textAnchor="end">{n}</text></g>)}
      {Array.from({length},(_,i)=><g key={i}>{i%2===0 && <text x={x(i)} y={height-14} textAnchor="middle" fill="#a8b9ad" fontSize="11">{i+1}</text>}</g>)}
      <path d={path(first)} stroke="#B8F26C" strokeWidth="3" fill="none"/>
      <path d={path(second)} stroke="#97A9FF" strokeWidth="3" fill="none"/>
      {[[first,"#B8F26C"],[second,"#97A9FF"]].map(([series,color],idx)=>(series as (number|null)[]).map((v,i)=>
        v===null?null:<circle key={idx+"-"+i} cx={x(i)} cy={y(v)} r="3.5" fill={color as string}><title>{"Match "+(i+1)+": "+v.toFixed(2)+" PPG"}</title></circle>))}
      <text x={width/2} y={height-1} fill="#b9c9bd" fontSize="11" textAnchor="middle">Recorded match number in each club&apos;s last-ten window</text>
    </svg>
    <p className="note">Each line uses its own club&apos;s match sequence, not synchronized calendar dates. A point needs at least three results and covers at most the last five. Missing results are not counted.</p>
  </div>;
}

export default function ClubComparison({
  teams,selected,intelligence
}:{
  teams:TeamStats[];selected:TeamStats|null;intelligence:IntelligenceTable
}){
  const [leftId,setLeftId]=useState("");
  const [rightId,setRightId]=useState("");
  const available=[...teams].sort((a,b)=>a.league.localeCompare(b.league)||a.name.localeCompare(b.name));
  const a=available.find(t=>t.id===leftId)??selected??available[0];
  const b=available.find(t=>t.id===rightId && t.id!==a?.id) ??
    available.find(t=>t.league===a?.league && t.id!==a?.id) ??
    available.find(t=>t.id!==a?.id);
  if(!a||!b)return null;
  const ai=intelligence[a.id],bi=intelligence[b.id];
  const metrics:Metric[]=[
    {label:"Points per match",left:ai?.actualPPG??null,right:bi?.actualPPG??null,unit:"PPG",decimals:2},
    {label:"Points (recorded games)",left:a.points,right:b.points,unit:a.played+" vs "+b.played+" matches",decimals:0},
    {label:"Goals scored / game",left:a.played?a.goalsFor/a.played:null,right:b.played?b.goalsFor/b.played:null,unit:"per match",decimals:2},
    {label:"Goals conceded / game",left:a.played?a.goalsAgainst/a.played:null,right:b.played?b.goalsAgainst/b.played:null,unit:"per match · lower is better",decimals:2,reverse:true},
    {label:"Goal difference / game",left:a.played?a.goalDifference/a.played:null,right:b.played?b.goalDifference/b.played:null,unit:"per match",decimals:2},
    {label:"Historic squad value",left:a.valueEurM,right:b.valueEurM,unit:"€ millions · July 2026 archive",decimals:0},
    {label:"Adjusted Value Index",left:a.valueIndex,right:b.valueIndex,unit:"provisional",decimals:1},
    {label:"Above peer expectation",left:ai?.aboveExpected??null,right:bi?.aboveExpected??null,unit:"PPG above/below fitted league peers",decimals:2},
    {label:"League form percentile",left:ai?.ppgPercentile??null,right:bi?.ppgPercentile??null,unit:"within respective league",decimals:0},
    {label:"League value percentile",left:ai?.valuePercentile??null,right:bi?.valuePercentile??null,unit:"among clubs with values",decimals:0},
  ];
  return <section className="panel compare-panel" aria-label="Head-to-head club comparison">
    <div className="panel-title"><div><p className="eyebrow">CLUB VS CLUB</p><h2>Head-to-head comparison</h2></div><p className="muted compare-caption">Select two clubs from any league</p></div>
    <div className="compare-selectors">
      <label><span>Club A</span><select value={a.id} aria-label="First club" onChange={e=>setLeftId(e.target.value)}>
        {available.map(t=><option key={t.id} value={t.id}>{t.name} ({t.league})</option>)}
      </select><small>{leagueName(a)} · {a.played} recorded games</small></label>
      <label><span>Club B</span><select value={b.id} aria-label="Second club" onChange={e=>setRightId(e.target.value)}>
        {available.map(t=><option key={t.id} value={t.id} disabled={t.id===a.id}>{t.name} ({t.league})</option>)}
      </select><small>{leagueName(b)} · {b.played} recorded games</small></label>
    </div>
    <div className="compare-columns"><span>{a.name}</span><span>Measure</span><span>{b.name}</span></div>
    <div className="compare-grid">{metrics.map(metric=>{
      const winner=metric.left===null||metric.right===null||Math.abs(metric.left-metric.right)<1e-9?null:
        (metric.reverse?metric.left<metric.right:metric.left>metric.right)?"left":"right";
      const leftLabel=metric.label==="Historic squad value"?fmtMoney(metric.left):format(metric.left,metric.decimals);
      const rightLabel=metric.label==="Historic squad value"?fmtMoney(metric.right):format(metric.right,metric.decimals);
      return <div className="compare-line" key={metric.label}>
        <strong className={winner==="left"?"compare-leader":""}>{leftLabel}</strong>
        <div><b>{metric.label}</b><small>{metric.unit}</small></div>
        <strong className={winner==="right"?"compare-leader":""}>{rightLabel}</strong>
      </div>;
    })}</div>
    <h3 className="compare-form-title">Form progression</h3>
    <HeadToHeadTrend a={a} b={b}/>
    <p className="note">Points-per-game and goal rates account for different numbers of recorded results. Cross-league comparisons are not adjusted for league strength. Financial rankings use archived 2025/26 values, not current squad prices. A dash means there is insufficient qualifying data.</p>
  </section>;
}
