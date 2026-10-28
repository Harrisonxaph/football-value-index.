export type LeagueCode = "PL" | "PD" | "SA" | "BL1" | "FL1";
export const LEAGUES: { code: LeagueCode; name: string; country: string }[] = [
  { code: "PL", name: "Premier League", country: "England" },
  { code: "PD", name: "La Liga", country: "Spain" },
  { code: "SA", name: "Serie A", country: "Italy" },
  { code: "BL1", name: "Bundesliga", country: "Germany" },
  { code: "FL1", name: "Ligue 1", country: "France" },
];
export type ValueRecord = { valueEurM: number | null; asOf: string; source: string };
export type Valuations = Record<string, ValueRecord>;
export type Fixture = {
  date: string; homeId: string; homeName: string; awayId: string; awayName: string;
  homeGoals: number | null; awayGoals: number | null; finished: boolean;
};
export type TeamResult = {
  date: string; opponent: string; venue: "H" | "A";
  goalsFor: number; goalsAgainst: number; result: "W" | "D" | "L";
};
export type TeamStats = {
  id: string; league: LeagueCode; name: string; played: number; points: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number;
  valueEurM: number | null; valuationAsOf: string | null; valuationSource: string | null;
  pointsPer100m: number | null; valueIndex: number | null; form: TeamResult[];
  provisional: boolean;
};
export type LeagueFreshness = {league:LeagueCode; fetchedAt:string; latestResult:string|null;
  played:number; outstandingPastFixtures:number; sourceUrl:string};
export type DashboardData = { mode:"open-data"; season:number; generatedAt:string;
  source:string; teams:TeamStats[]; freshness:LeagueFreshness[]; warning?:string };

export function median(values:number[]):number|null {
  if(!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const i=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[i] : (sorted[i-1]+sorted[i])/2;
}
export const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));

export function calculateDashboard(input:Record<LeagueCode,Fixture[]>,valuations:Valuations):TeamStats[] {
  const byTeam=new Map<string,{id:string;league:LeagueCode;name:string;form:TeamResult[]}>();
  for(const {code} of LEAGUES) for(const game of input[code]) for(const home of [true,false]) {
    const id=home?game.homeId:game.awayId;
    const name=home?game.homeName:game.awayName;
    const key=`${code}:${id}`;
    if(!byTeam.has(key)) byTeam.set(key,{id,league:code,name,form:[]});
    if(!game.finished || game.homeGoals===null || game.awayGoals===null) continue;
    const gf=home?game.homeGoals:game.awayGoals;
    const ga=home?game.awayGoals:game.homeGoals;
    byTeam.get(key)!.form.push({date:game.date,opponent:home?game.awayName:game.homeName,
      venue:home?"H":"A",goalsFor:gf,goalsAgainst:ga,result:gf>ga?"W":gf===ga?"D":"L"});
  }
  const all=[...byTeam.values()].map((t):TeamStats=>{
    const form=t.form.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
    const points=form.reduce((s,x)=>s+(x.result==="W"?3:x.result==="D"?1:0),0);
    const goalsFor=form.reduce((s,x)=>s+x.goalsFor,0);
    const goalsAgainst=form.reduce((s,x)=>s+x.goalsAgainst,0);
    const record=valuations[t.id];
    // Require a date, a source, and a strictly positive value for the entry to be rankable.
    const value=record && Number.isFinite(record.valueEurM) && record.valueEurM!>0 &&
      typeof record.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.asOf) &&
      typeof record.source === "string" && record.source.trim()
      ? record.valueEurM : null;
    return {id:t.id,league:t.league,name:t.name,played:form.length,points,
      goalsFor,goalsAgainst,goalDifference:goalsFor-goalsAgainst,
      valueEurM:value,valuationAsOf:value===null?null:record.asOf,
      valuationSource:value===null?null:record.source,
      pointsPer100m:value===null || !form.length?null:100*points/value,
      valueIndex:null,form,provisional:form.length<10};
  });
  const leagueMedians=Object.fromEntries(LEAGUES.map(l=>[l.code,median(all.filter(t=>t.league===l.code)
    .flatMap(t=>t.valueEurM===null?[]:[t.valueEurM]))])) as Record<LeagueCode,number|null>;
  for(const t of all) {
    if(!t.played || t.valueEurM===null) continue;
    // No cross-league synthetic baseline: insufficient valuation data => null score.
    const baseline=leagueMedians[t.league];
    if(baseline===null) continue;
    const pointsShare=t.points/(t.played*3);
    const gdScore=clamp(0.5+(t.goalDifference/t.played)/6,0,1);
    t.valueIndex=100*(0.75*pointsShare+0.25*gdScore)*Math.sqrt(baseline/t.valueEurM);
  }
  return all.sort((a,b)=>b.points-a.points || b.goalDifference-a.goalDifference || a.name.localeCompare(b.name));
}
