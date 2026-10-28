import test from "node:test";
import assert from "node:assert/strict";
import {calculateClubTrends,valuePerformanceFit} from "../lib/trends.ts";
import {LEAGUES} from "../lib/metrics.ts";

const empty=()=>Object.fromEntries(LEAGUES.map(l=>[l.code,[]]));
const match=(date,league,home,away,hg,ag,finished=true)=>({
  date,homeId:league+":"+home,homeName:home,awayId:league+":"+away,awayName:away,
  homeGoals:hg,awayGoals:ag,finished
});

test("rolling PPG, goals scored/conceded, GD and real fixture dates",()=>{
  const f=empty();
  f.PL=[
    match("2026-09-01","PL","Alpha","Beta",2,0),
    match("2026-09-02","PL","Gamma","Delta",0,0),
    match("2026-09-08","PL","Alpha","Gamma",1,1),
    match("2026-09-09","PL","Beta","Delta",3,0),
    match("2026-09-15","PL","Alpha","Delta",0,1),
    match("2026-09-16","PL","Beta","Gamma",1,2),
    match("2026-09-22","PL","Alpha","Beta",5,0),
    match("2026-09-23","PL","Gamma","Delta",1,0),
  ];
  const out=calculateClubTrends(f);
  const alpha=out["PL:Alpha"];
  assert.deepEqual(alpha.map(x=>x.date),["2026-09-15","2026-09-22"]);
  assert.ok(Math.abs(alpha[0].club.ppg-4/3)<1e-10);
  assert.ok(Math.abs(alpha[1].club.ppg-7/4)<1e-10);
  assert.ok(Math.abs(alpha[1].club.gf-2)<1e-10);
  assert.ok(Math.abs(alpha[1].club.ga-.5)<1e-10);
  assert.ok(Math.abs(alpha[1].club.gd-1.5)<1e-10);
  assert.equal(alpha[0].leagueMean,null); // Only Alpha and Delta had 3 results yet.
  assert.equal(alpha[1].leagueClubs,4);
  assert.ok(Math.abs(alpha[1].leagueMean.ppg-(1.75+.75+(1+1+3)/3+(1+0+3)/3)/4)<1e-10);
  // Gamma/Delta have a new game September 23: it cannot affect the September 22 baseline.
  assert.equal(alpha[1].europeMean,null); // fewer than five qualifying clubs
});

test("missing, future or unscored fixtures do not become draws",()=>{
  const f=empty();
  f.PL=[
    match("2026-09-01","PL","Alpha","Beta",1,0),
    match("2026-09-02","PL","Alpha","Beta",null,null,false),
    match("2026-09-03","PL","Alpha","Beta",2,0),
    match("2026-09-04","PL","Alpha","Beta",0,0),
  ];
  const points=calculateClubTrends(f)["PL:Alpha"];
  assert.equal(points.length,1);
  assert.equal(points[0].date,"2026-09-04");
  assert.equal(points[0].club.ppg,7/3);
  assert.equal(points[0].matchesInWindow,3);
});

test("rolling form only uses five scored games and caps display at ten",()=>{
  const f=empty();
  f.PL=Array.from({length:12},(_,i)=>match("2026-09-"+String(i+1).padStart(2,"0"),"PL","Alpha","Beta",i<7?1:0,i<7?0:1));
  const points=calculateClubTrends(f)["PL:Alpha"];
  assert.equal(points.length,10);
  assert.equal(points[0].date,"2026-09-03");
  assert.equal(points.at(-1).date,"2026-09-12");
  assert.equal(points.at(-1).club.ppg,0); // last five are losses
  assert.equal(points.at(-1).matchesInWindow,5);
});

test("European mean weights clubs equally and only uses available scored games",()=>{
  const f=empty();
  for(const league of ["PL","PD","SA"]){
    f[league]=[
      match("2026-09-01",league,"A","B",1,0),
      match("2026-09-02",league,"A","B",1,0),
      match("2026-09-03",league,"A","B",1,0),
    ];
  }
  const p=calculateClubTrends(f)["PL:A"][0];
  assert.equal(p.europeClubs,6);
  assert.equal(p.leagueClubs,2);
  assert.equal(p.leagueMean,null);
  assert.ok(Math.abs(p.europeMean.ppg-1.5)<1e-10);
});

test("linear value trend includes only sufficiently complete valued clubs",()=>{
  const fit=valuePerformanceFit([
    {valueEurM:100,played:10,points:10},
    {valueEurM:200,played:10,points:20},
    {valueEurM:300,played:10,points:30},
    {valueEurM:null,played:10,points:30},
    {valueEurM:50,played:1,points:3},
  ]);
  assert.equal(fit.count,3);
  assert.equal(fit.meanValue,200);
  assert.equal(fit.meanPPG,2);
  assert.ok(Math.abs(fit.slope-.01)<1e-10);
  assert.ok(Math.abs(fit.intercept)<1e-10);
});
test("linear value trend declines insufficient sample or zero market-value spread",()=>{
  assert.equal(valuePerformanceFit([{valueEurM:100,played:10,points:10}]),null);
  assert.equal(valuePerformanceFit([
    {valueEurM:100,played:10,points:10},
    {valueEurM:100,played:10,points:20},
    {valueEurM:100,played:10,points:30},
  ]),null);
});
