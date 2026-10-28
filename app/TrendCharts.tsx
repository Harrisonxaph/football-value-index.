"use client";
import {useState} from "react";
import type {TeamStats} from "../lib/metrics";
import type {ClubTrends,TrendMetric,TrendPoint,TrendRates} from "../lib/trends";

const SETTINGS:Record<TrendMetric,{label:string;unit:string}>={
  ppg:{label:"Points per match",unit:"pts/match"},
  gf:{label:"Goals scored per match",unit:"goals/match"},
  ga:{label:"Goals conceded per match",unit:"goals/match"},
  gd:{label:"Goal difference per match",unit:"GD/match"},
};
const THEMES=[
  {id:"club",label:"Selected club",color:"#B8F26C",dash:""},
  {id:"leagueMean",label:"League mean",color:"#F3BE72",dash:"9 5"},
  {id:"europeMean",label:"Top-five mean",color:"#98A8FF",dash:"3 6"},
] as const;
type SeriesKey=typeof THEMES[number]["id"];
const displayDate=(date:string)=>new Date(date+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"});
const fmt=(n:number)=>n.toFixed(2);
const read=(p:TrendPoint,k:SeriesKey):TrendRates|null=>p[k];

export default function TrendCharts({selected,trends}:{selected:TeamStats|null;trends:ClubTrends|undefined}){
  const [metric,setMetric]=useState<TrendMetric>("ppg");
  const [inspectedDate,setInspectedDate]=useState<string|null>(null);
  const points=selected ? (trends?.[selected.id]??[]) : [];
  const setting=SETTINGS[metric];
  if(!selected || !points.length)return <section className="panel form-trend" aria-label="Club performance trends">
    <p className="eyebrow">FORM VS THE MEAN</p><h2>Rolling form comparison</h2>
    <p className="muted">No trend yet. At least three recorded completed league matches are needed for the selected club.</p>
  </section>;

  const current=points.find(p=>p.date===inspectedDate)??points[points.length-1];
  const W=760,H=320,left=58,right=24,top=22,bottom=48;
  const x=(i:number)=>left+(points.length===1?0.5:i/(points.length-1))*(W-left-right);
  const vals=points.flatMap(p=>THEMES.flatMap(t=>{const r=read(p,t.id);return r?[r[metric]]:[]}));
  const lower=metric==="ppg"?0:Math.min(0,...vals);
  const upper=metric==="ppg"?3:Math.max(1,...vals);
  const pad=upper===lower?0.5:(upper-lower)*0.12;
  const minY=metric==="ppg"?0:lower-pad;
  const maxY=metric==="ppg"?3:upper+pad;
  const y=(v:number)=>H-bottom-(v-minY)/(maxY-minY)*(H-top-bottom);
  const ticks=Array.from({length:5},(_,i)=>minY+(maxY-minY)*i/4);
  const linePath=(kind:SeriesKey)=>{
    let ongoing=false;
    return points.map((p,i)=>{
      const rates=read(p,kind);
      if(!rates){ongoing=false;return "";}
      const prefix=ongoing?"L":"M";
      ongoing=true;
      return prefix+x(i).toFixed(1)+","+y(rates[metric]).toFixed(1);
    }).join(" ");
  };
  const diff=current.leagueMean?current.club[metric]-current.leagueMean[metric]:null;
  const good=diff!==null && (metric==="ga"?diff<=0:diff>=0);
  const diffText=diff===null?"Mean unavailable":
    Math.abs(diff)<0.005?"Level with league mean":
    Math.abs(diff).toFixed(2)+(diff>0?" above":" below")+" league mean · "+(good?"better":"worse")+" on this measure";

  return <section className="panel form-trend" aria-label="Club performance trends">
    <div className="panel-title trend-heading">
      <div><p className="eyebrow">FORM VS THE MEAN</p><h2>{selected.name} · Rolling form</h2>
        <p className="muted trend-explainer">Five most recent recorded league matches at each match date, with at least three needed to qualify.</p></div>
      <label className="trend-control">Compare
        <select aria-label="Choose trend metric" value={metric} onChange={e=>setMetric(e.target.value as TrendMetric)}>
          {Object.entries(SETTINGS).map(([key,val])=><option key={key} value={key}>{val.label}</option>)}
        </select>
      </label>
    </div>
    <div className="trend-chart-scroller">
      <svg viewBox={"0 0 "+W+" "+H} role="img" aria-label={selected.name+" "+setting.label+" versus league and top-five league means over real match dates"}>
        <title>{selected.name+": "+setting.label+" rolling form against league and European means"}</title>
        {ticks.map((t,i)=><g key={i}><line x1={left} x2={W-right} y1={y(t)} y2={y(t)} stroke="#31453c" strokeWidth="1"/>
          <text x={left-10} y={y(t)+4} textAnchor="end" fill="#9db0a5" fontSize="12">{t.toFixed(1)}</text></g>)}
        {points.map((p,i)=><g key={p.date}>
          <line x1={x(i)} x2={x(i)} y1={top} y2={H-bottom} stroke="#283b31" strokeDasharray="2 6"/>
          {(i===0 || i===points.length-1 || (points.length<=7?i%2===0:i%3===0)) &&
            <text x={x(i)} y={H-20} fill="#a8bcb0" fontSize="11" textAnchor="middle">{displayDate(p.date)}</text>}
        </g>)}
        {THEMES.map(t=><g key={t.id}>
          <path d={linePath(t.id)} fill="none" stroke={t.color} strokeWidth={t.id==="club"?3.5:2.6} strokeDasharray={t.dash || undefined} strokeLinejoin="round" strokeLinecap="round"/>
          {points.map((p,i)=>{
            const rates=read(p,t.id);
            return rates?<circle key={p.date} cx={x(i)} cy={y(rates[metric])} r={p.date===current.date?(t.id==="club"?6.5:4):3}
              fill={t.color} stroke="#13221d" strokeWidth="1.5">
              <title>{displayDate(p.date)+" · "+t.label+": "+fmt(rates[metric])+" "+setting.unit}</title>
            </circle>:null;
          })}
        </g>)}
      </svg>
    </div>
    <div className="trend-legend">{THEMES.map(t=><span key={t.id}><i style={{background:t.color}}/>{t.label}</span>)}</div>
    <p className="trend-helper">Tap a match date to inspect its comparison:</p>
    <div className="trend-dates" role="group" aria-label="Select match date for detailed comparison">
      {points.map(p=><button key={p.date} type="button" className={p.date===current.date?"chosen":""}
        aria-pressed={p.date===current.date} onClick={()=>setInspectedDate(p.date)}>{displayDate(p.date)}</button>)}
    </div>
    <div className="trend-summary" aria-live="polite">
      <div><span>{selected.name}</span><strong>{fmt(current.club[metric])}</strong><small>{setting.unit}</small></div>
      <div><span>League mean</span><strong>{current.leagueMean?fmt(current.leagueMean[metric]):"—"}</strong><small>{current.leagueClubs} qualifying clubs</small></div>
      <div><span>Top-five mean</span><strong>{current.europeMean?fmt(current.europeMean[metric]):"—"}</strong><small>{current.europeClubs} qualifying clubs</small></div>
      <div><span>Difference vs league</span><strong className={diff===null?"":good?"trend-pos":"trend-neg"}>{diff===null?"—":(diff>0?"+":"")+fmt(diff)}</strong><small>{diffText}</small></div>
    </div>
    <p className="note trend-note">Each mean equally weights qualifying clubs with at least three scored matches, using up to their latest five league matches on the selected club&apos;s match date. Baselines use date-level, not kickoff-time, alignment. Unscored fixtures are excluded. These are form trends, not squad-value changes or a historic Value Index. Upstream scores may be delayed.</p>
  </section>;
}
