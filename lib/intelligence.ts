import type {TeamStats,LeagueCode} from "./metrics.ts";

export type IntelligenceRow={
  id:string;
  actualPPG:number|null;
  expectedPPG:number|null;
  aboveExpected:number|null;
  peerCount:number;
  ppgPercentile:number|null;
  valuePercentile:number|null;
  ppgRank:number|null;
  valueRank:number|null;
  leaguePpgSample:number;
  leagueValueSample:number;
};

export type IntelligenceTable=Record<string,IntelligenceRow>;
const MIN_MATCHES=3;
const MIN_PEERS=8;
const MIN_PERCENTILE_CLUBS=5;
const clamp=(v:number)=>Math.min(3,Math.max(0,v));

/** Rank descending, with equal scores receiving the same average rank and percentile. */
export function rankWithinLeague(
  rows:{id:string;score:number}[],id:string,minClubs=MIN_PERCENTILE_CLUBS
):{percentile:number;rank:number;sample:number}|null{
  if(rows.length<minClubs)return null;
  const own=rows.find(t=>t.id===id);
  if(!own || !Number.isFinite(own.score))return null;
  const above=rows.filter(t=>t.score>own.score+1e-9).length;
  const tied=rows.filter(t=>Math.abs(t.score-own.score)<=1e-9).length;
  const rank=above+1+(tied-1)/2;
  return {percentile:100*(rows.length-rank)/(rows.length-1),rank,sample:rows.length};
}

/**
 * Historical-value performance context:
 * - Uses points/game (not total points) to account for unequal scored fixtures.
 * - Expected PPG is a descriptive league-only log(squad-value) regression,
 *   excluding the target club from its peers to avoid self-influence.
 * - Ridge smoothing prevents implausibly steep slopes in small samples.
 * - No values are fabricated if the club lacks a benchmark, has <3 matches,
 *   or has fewer than 8 valued league peers with >=3 matches.
 * - League percentiles include only comparable, eligible teams.
 */
export function calculateIntelligence(teams:TeamStats[]):IntelligenceTable{
  const eligible=teams.filter(t=>t.played>=MIN_MATCHES);
  const ppg=(t:TeamStats)=>t.points/t.played;
  const valued=eligible.filter(t=>t.valueEurM!==null && Number.isFinite(t.valueEurM) && t.valueEurM>0 &&
    t.valueIndex!==null && Number.isFinite(t.valueIndex));
  const byLeague=new Map<LeagueCode,TeamStats[]>();
  const valuedByLeague=new Map<LeagueCode,TeamStats[]>();
  for(const t of eligible)byLeague.set(t.league,[...(byLeague.get(t.league)??[]),t]);
  for(const t of valued)valuedByLeague.set(t.league,[...(valuedByLeague.get(t.league)??[]),t]);

  const out:IntelligenceTable={};
  for(const team of teams){
    const league=byLeague.get(team.league)??[];
    const leagueValued=valuedByLeague.get(team.league)??[];
    const ppgRank=team.played>=MIN_MATCHES?
      rankWithinLeague(league.map(t=>({id:t.id,score:ppg(t)})),team.id):null;
    const valueRank=team.valueIndex!==null && team.played>=MIN_MATCHES?
      rankWithinLeague(leagueValued.map(t=>({id:t.id,score:t.valueIndex!})),team.id):null;

    let expectedPPG:number|null=null;
    let peerCount=0;
    if(team.played>=MIN_MATCHES && team.valueEurM!==null && team.valueEurM>0){
      const peers=leagueValued.filter(t=>t.id!==team.id);
      peerCount=peers.length;
      if(peers.length>=MIN_PEERS){
        const xs=peers.map(t=>Math.log(t.valueEurM!));
        const ys=peers.map(ppg);
        const meanX=xs.reduce((s,n)=>s+n,0)/xs.length;
        const meanY=ys.reduce((s,n)=>s+n,0)/ys.length;
        const numerator=xs.reduce((s,x,i)=>s+(x-meanX)*(ys[i]-meanY),0);
        const square=xs.reduce((s,x)=>s+(x-meanX)**2,0);
        const ridge=peers.length*0.25;
        const slope=numerator/(square+ridge);
        expectedPPG=clamp(meanY+slope*(Math.log(team.valueEurM)-meanX));
      }
    }
    const actualPPG=team.played?ppg(team):null;
    out[team.id]={
      id:team.id,actualPPG,expectedPPG,
      aboveExpected:expectedPPG===null || actualPPG===null?null:actualPPG-expectedPPG,
      peerCount,ppgPercentile:ppgRank?.percentile??null,
      valuePercentile:valueRank?.percentile??null,
      ppgRank:ppgRank?.rank??null,valueRank:valueRank?.rank??null,
      leaguePpgSample:ppgRank?.sample??league.length,
      leagueValueSample:valueRank?.sample??leagueValued.length,
    };
  }
  return out;
}
