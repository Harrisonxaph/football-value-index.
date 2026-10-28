"use client";
import type {TeamStats} from "../lib/metrics";
import type {IntelligenceTable} from "../lib/intelligence";

const fmt=(v:number|null,decimals=2)=>v===null?"—":v.toFixed(decimals);
function Percentile({label,value,rank,sample}:{label:string;value:number|null;rank:number|null;sample:number}){
  return <div className="intelligence-percentile">
    <div><span>{label}</span><strong>{value===null?"—":Math.round(value)+"th"}</strong></div>
    <div role="img" aria-label={value===null?label+" unavailable":label+" "+Math.round(value)+"th percentile"} className="intelligence-track">
      <span style={{width:(value??0)+"%"}}/>
    </div>
    <small>{value===null?"Insufficient qualifying clubs":("Rank "+rank?.toFixed(1)+" of "+sample+" eligible clubs")}</small>
  </div>;
}
export default function ValueIntelligence({selected,teams,intelligence}:{
  selected:TeamStats|null;teams:TeamStats[];intelligence:IntelligenceTable
}){
  const values=teams.filter(t=>intelligence[t.id]?.aboveExpected!==null &&
    intelligence[t.id]?.aboveExpected!==undefined).sort((a,b)=>
    (intelligence[b.id]?.aboveExpected??-999)-(intelligence[a.id]?.aboveExpected??-999));
  const leader=values[0];
  if(!selected)return null;
  const row=intelligence[selected.id];
  if(!row)return null;
  const delta=row.aboveExpected;
  const positive=delta!==null && delta>=0;
  const actual=row.actualPPG;
  const expected=row.expectedPPG;
  return <section className="panel intelligence-panel" aria-label="Value intelligence and within-league percentiles">
    <div className="panel-title">
      <div><p className="eyebrow">VALUE INTELLIGENCE</p><h2>{selected.name} · Overperformance</h2></div>
      <span className="intelligence-pill">Historical value benchmark · Provisional</span>
    </div>
    <p className="muted intelligence-intro">How many points per match is this club gaining above or below the level estimated from comparably valued clubs in its own league?</p>
    <div className="intelligence-stats">
      <div><span>Actual PPG</span><strong>{fmt(actual)}</strong><small>{selected.played} recorded matches</small></div>
      <div><span>Peer-estimated PPG</span><strong>{fmt(expected)}</strong><small>{row.peerCount} eligible league peers</small></div>
      <div><span>Above expected</span><strong className={delta===null?"":positive?"trend-pos":"trend-neg"}>{delta===null?"—":(delta>0?"+":"")+fmt(delta)}</strong><small>{delta===null?"Unavailable":positive?"Above peer benchmark":"Below peer benchmark"}</small></div>
    </div>
    {delta===null&&<p className="note intelligence-explain">A score requires a dated squad-value estimate, at least three recorded league matches and eight qualifying valued clubs in the same league (excluding this club). No estimate is shown if these criteria are not met.</p>}
    <div className="intelligence-ranks">
      <Percentile label="League PPG percentile" value={row.ppgPercentile} rank={row.ppgRank} sample={row.leaguePpgSample}/>
      <Percentile label="League Value Index percentile" value={row.valuePercentile} rank={row.valueRank} sample={row.leagueValueSample}/>
    </div>
    {leader&&<p className="intelligence-leader"><b>Biggest positive deviation among available clubs:</b> {leader.name} ({(intelligence[leader.id].aboveExpected??0)>0?"+":""}{fmt(intelligence[leader.id].aboveExpected)} PPG). <span>This is a model comparison, not a verified forecast.</span></p>}
    <p className="note">Expected PPG uses a regularised fit of points per game against log squad market value, trained on other eligible clubs in the same league (the selected club is excluded). The dataset currently includes incomplete 2026/27 match results and archived 2025/26 squad values. Percentiles rank within each league; 100th is best. They use recorded matches, not guaranteed complete fixture histories.</p>
  </section>;
}
