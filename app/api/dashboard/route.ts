import {NextResponse} from "next/server";
import valuationsData from "../../../data/valuations.json";
import {calculateDashboard,DashboardData,Valuations,LEAGUES} from "../../../lib/metrics";
import {fetchOpenFixtures,SOURCE_REPO} from "../../../lib/providers";

export const runtime="nodejs";
export async function GET(){
  const season=Number(process.env.FOOTBALL_SEASON||2026);
  if(!Number.isInteger(season)||season<2020||season>2100)
    return NextResponse.json({error:"Invalid FOOTBALL_SEASON"},{status:500});
  try{
    const {fixtures,freshness}=await fetchOpenFixtures(season);
    const today=new Date().toISOString().slice(0,10);
    const gaps=freshness.filter(f=>f.outstandingPastFixtures>0);
    const stale=freshness.filter(f=>!f.latestResult || (Date.parse(`${today}T00:00:00Z`)-Date.parse(`${f.latestResult}T00:00:00Z`))/(864e5)>10);
    const teams=calculateDashboard(fixtures,valuationsData as Valuations);
    const valued=teams.filter(t=>t.valueEurM!==null).length;
    const notes=[];
    if(stale.length)notes.push(`Latest recorded result is over 10 days old (or absent) in ${stale.map(f=>LEAGUES.find(l=>l.code===f.league)?.name).join(", ")}. Upstream data may be incomplete.`);
    if(gaps.length)notes.push(`Some past fixtures have no scores in ${gaps.map(f=>LEAGUES.find(l=>l.code===f.league)?.name).join(", ")}; they are excluded, not counted as draws.`);
    if(valued<teams.length)notes.push(`${valued} of ${teams.length} clubs have validated, dated squad valuations. Value-based rankings only cover those clubs.`);
    const body:DashboardData={mode:"open-data",season,generatedAt:new Date().toISOString(),source:SOURCE_REPO,
      teams,freshness,warning:notes.join(" ")||undefined};
    return NextResponse.json(body,{headers:{"Cache-Control":"public, s-maxage=3600, stale-while-revalidate=300"}});
  }catch(e){
    const message=e instanceof Error?e.message:"Unexpected OpenFootball error";
    return NextResponse.json({error:message},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
