import {LEAGUES} from "./metrics.ts";
import type {Fixture, LeagueCode, TeamStats} from "./metrics.ts";

export type TrendMetric = "ppg" | "gf" | "ga" | "gd";
export type TrendRates = Record<TrendMetric, number>;
export type TrendPoint = {
  date: string;
  club: TrendRates;
  leagueMean: TrendRates | null;
  europeMean: TrendRates | null;
  leagueClubs: number;
  europeClubs: number;
  matchesInWindow: number;
};
export type ClubTrends = Record<string, TrendPoint[]>;

type Recorded = {date:string; gf:number; ga:number; points:number};
type TeamHistory = {id:string; league:LeagueCode; matches:Recorded[]};
const average=(values:number[])=>values.reduce((s,n)=>s+n,0)/values.length;

function lastWindow(matches:Recorded[], through:string, window:number, minimum:number): {rates:TrendRates;count:number}|null {
  const eligible=matches.filter(m=>m.date<=through).slice(-window);
  if(eligible.length<minimum)return null;
  const count=eligible.length;
  return {count,rates:{
    ppg:eligible.reduce((s,m)=>s+m.points,0)/count,
    gf:eligible.reduce((s,m)=>s+m.gf,0)/count,
    ga:eligible.reduce((s,m)=>s+m.ga,0)/count,
    gd:eligible.reduce((s,m)=>s+m.gf-m.ga,0)/count,
  }};
}

function meanRates(rates:TrendRates[]):TrendRates {
  return {
    ppg:average(rates.map(r=>r.ppg)),
    gf:average(rates.map(r=>r.gf)),
    ga:average(rates.map(r=>r.ga)),
    gd:average(rates.map(r=>r.gd)),
  };
}

/**
 * Date-aligned league and European form comparisons.
 * For each club's last ten scored league fixtures, compute form on that real
 * fixture date (not on a fictional weekly schedule). Clubs have equal weight in
 * means and must have at least 3 scored games by that date.
 *
 * The first/last five scored league games are used for each rolling window.
 * Because fixtures may be missing full-time scores upstream, this is based on
 * RECORDED completed games, not verified full match history.
 */
export function calculateClubTrends(
  fixtures:Record<LeagueCode,Fixture[]>,
  window=5, minimum=3, display=10,
):ClubTrends {
  if(!Number.isInteger(window)||window<1||!Number.isInteger(minimum)||minimum<1||minimum>window||
     !Number.isInteger(display)||display<1)throw new Error("Invalid trend windows");
  const byClub=new Map<string,TeamHistory>();
  for(const {code} of LEAGUES){
    for(const match of fixtures[code] ?? []){
      for(const [id] of [[match.homeId],[match.awayId]]){
        if(!byClub.has(id))byClub.set(id,{id,league:code,matches:[]});
      }
      if(!match.finished||match.homeGoals===null||match.awayGoals===null)continue;
      const results:[string,number,number][]=[
        [match.homeId,match.homeGoals,match.awayGoals],
        [match.awayId,match.awayGoals,match.homeGoals],
      ];
      for(const [id,gf,ga] of results){
        byClub.get(id)!.matches.push({date:match.date,gf,ga,points:gf>ga?3:gf===ga?1:0});
      }
    }
  }
  const histories=[...byClub.values()];
  for(const item of histories)item.matches.sort((a,b)=>a.date.localeCompare(b.date));
  const ratesByDate=new Map<string,Map<string,{rates:TrendRates;count:number}>>();
  function atDate(date:string){
    const cached=ratesByDate.get(date);
    if(cached)return cached;
    const snapshot=new Map<string,{rates:TrendRates;count:number}>();
    for(const t of histories){
      const item=lastWindow(t.matches,date,window,minimum);
      if(item)snapshot.set(t.id,item);
    }
    ratesByDate.set(date,snapshot);
    return snapshot;
  }
  const out:ClubTrends={};
  for(const team of histories){
    out[team.id]=[];
    for(const m of team.matches.slice(-display)){
      const snap=atDate(m.date);
      const club=snap.get(team.id);
      if(!club)continue;
      const sameLeague:TrendRates[]=[];
      const acrossEurope:TrendRates[]=[];
      for(const other of histories){
        const record=snap.get(other.id);
        if(!record)continue;
        acrossEurope.push(record.rates);
        if(other.league===team.league)sameLeague.push(record.rates);
      }
      out[team.id].push({
        date:m.date,club:club.rates,
        leagueMean:sameLeague.length>=3?meanRates(sameLeague):null,
        europeMean:acrossEurope.length>=5?meanRates(acrossEurope):null,
        leagueClubs:sameLeague.length,
        europeClubs:acrossEurope.length,
        matchesInWindow:club.count,
      });
    }
  }
  return out;
}

export type ValueFit={slope:number;intercept:number;count:number;meanValue:number;meanPPG:number};

/** Descriptive OLS trend line; incomplete (<3 recorded games) or unvalued clubs are omitted. */
export function valuePerformanceFit(
  teams:Pick<TeamStats,"valueEurM"|"played"|"points">[]
):ValueFit|null {
  const rows=teams.filter(t=>t.played>=3 && t.valueEurM!==null && Number.isFinite(t.valueEurM) &&
    t.valueEurM>0 && Number.isFinite(t.points)).map(t=>({x:t.valueEurM!,y:t.points/t.played}));
  if(rows.length<3)return null;
  const meanValue=average(rows.map(t=>t.x));
  const meanPPG=average(rows.map(t=>t.y));
  const denom=rows.reduce((s,r)=>s+(r.x-meanValue)**2,0);
  if(denom<1e-8)return null;
  const slope=rows.reduce((s,r)=>s+(r.x-meanValue)*(r.y-meanPPG),0)/denom;
  return {slope,intercept:meanPPG-slope*meanValue,count:rows.length,meanValue,meanPPG};
}
