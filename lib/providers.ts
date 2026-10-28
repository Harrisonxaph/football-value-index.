import {LEAGUES} from "./metrics.ts";
import type {Fixture, LeagueCode} from "./metrics.ts";

export const SOURCE_REPO = "https://github.com/openfootball/football.json";
const RAW = "https://raw.githubusercontent.com/openfootball/football.json/master";
const FILES: Record<LeagueCode,string> = {PL:"en.1",PD:"es.1",SA:"it.1",BL1:"de.1",FL1:"fr.1"};

type RawScore = {ft?:unknown}|number[]|null;
type RawMatch = {date?:unknown; time?:unknown; team1?:unknown; team2?:unknown; score?:RawScore};
type RawLeague = {name?:unknown; matches?:unknown};
export type LeagueFreshness = {league:LeagueCode; fetchedAt:string; latestResult:string|null;
  played:number; outstandingPastFixtures:number; sourceUrl:string};

function finalScore(raw:unknown):[number,number]|null {
  let score = raw;
  if(score && typeof score === "object" && !Array.isArray(score)) score = (score as {ft?:unknown}).ft;
  if(!Array.isArray(score) || score.length !== 2 ||
    !score.every(n=>Number.isInteger(n) && n >= 0 && n <= 40)) return null;
  return [score[0] as number,score[1] as number];
}

export function parseOpenFootball(raw:unknown, code:LeagueCode, today:string):Fixture[] {
  if(!raw || typeof raw !== "object" || !Array.isArray((raw as RawLeague).matches))
    throw new Error(`${code}: invalid OpenFootball fixture document`);
  return ((raw as {matches:RawMatch[]}).matches).map((m,index)=>{
    if(typeof m.date!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(m.date) ||
      typeof m.team1!=="string" || !m.team1.trim() || typeof m.team2!=="string" || !m.team2.trim())
      throw new Error(`${code}: invalid fixture at row ${index+1}`);
    // The upstream feed sometimes has blank scores even for dates already passed.
    // A published full-time score is required; never convert an absent score to 0–0.
    const score = m.date <= today ? finalScore(m.score) : null;
    return {
      date:m.date, homeId:`${code}:${m.team1.trim()}`,homeName:m.team1.trim(),
      awayId:`${code}:${m.team2.trim()}`,awayName:m.team2.trim(),
      homeGoals:score?.[0]??null, awayGoals:score?.[1]??null,
      finished:score!==null
    };
  });
}

export async function fetchOpenFixtures(season:number, today = new Date().toISOString().slice(0,10)):
  Promise<{fixtures:Record<LeagueCode,Fixture[]>; freshness:LeagueFreshness[]}> {
  const fetchedAt=new Date().toISOString();
  const results = await Promise.all(LEAGUES.map(async ({code}) => {
    const sourceUrl=`${RAW}/${season}-${String((season+1)%100).padStart(2,"0")}/${FILES[code]}.json`;
    const response=await fetch(sourceUrl,{next:{revalidate:3600}} as RequestInit);
    if(!response.ok) throw new Error(`${code}: OpenFootball returned HTTP ${response.status} (${sourceUrl})`);
    const raw = await response.json() as RawLeague;
    const games=parseOpenFootball(raw,code,today);
    const finished=games.filter(g=>g.finished);
    const latestResult=finished.length ? finished.map(g=>g.date).sort().at(-1)! : null;
    return {code,games,freshness:{league:code,fetchedAt,latestResult,played:finished.length,
      outstandingPastFixtures:games.filter(g=>!g.finished && g.date<today).length,sourceUrl}};
  }));
  return {fixtures:Object.fromEntries(results.map(r=>[r.code,r.games])) as Record<LeagueCode,Fixture[]>,
    freshness:results.map(r=>r.freshness)};
}
