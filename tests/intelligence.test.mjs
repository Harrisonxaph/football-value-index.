import test from "node:test";
import assert from "node:assert/strict";
import {calculateIntelligence,rankWithinLeague} from "../lib/intelligence.ts";

const make=(id,index,league="PL",played=5,value=100+index*45,points=6+index%4)=>
 ({id:league+":"+id,league,name:id,played,points,
  valueEurM:value,valueIndex:value===null?null:100-index});

const clubs=()=>Array.from({length:12},(_,i)=>make("Club"+i,i,"PL",5,100+i*45,i===0?15:i===11?0:6+i%4));

test("League percentile ranks high=100 and low=0; ties share averaged rank",()=>{
  const rows=[{id:"a",score:5},{id:"b",score:5},{id:"c",score:3},{id:"d",score:2},{id:"e",score:1}];
  assert.equal(rankWithinLeague(rows,"a").rank,1.5);
  assert.equal(rankWithinLeague(rows,"a").percentile,87.5);
  assert.equal(rankWithinLeague(rows,"c").percentile,50);
  assert.equal(rankWithinLeague(rows,"e").percentile,0);
  assert.equal(rankWithinLeague(rows,"missing"),null);
  assert.equal(rankWithinLeague(rows.slice(0,4),"a"),null);
});

test("Overperformance uses within-league valued peers, with own club left out",()=>{
  const arr=clubs();
  const out=calculateIntelligence(arr);
  const a=out["PL:Club0"];
  const last=out["PL:Club11"];
  assert.equal(a.peerCount,11);
  assert.equal(a.actualPPG,3);
  assert.equal(a.ppgPercentile,100);
  assert.equal(last.ppgPercentile,0);
  assert.ok(a.expectedPPG!==null && a.expectedPPG>=0 && a.expectedPPG<=3);
  assert.ok(a.aboveExpected>0);
  assert.ok(last.aboveExpected<0);
  const changed=clubs();changed[0]={...changed[0],points:0};
  const again=calculateIntelligence(changed)["PL:Club0"];
  assert.equal(a.expectedPPG,again.expectedPPG,"own points do not leak into expected model");
  assert.equal(a.aboveExpected-again.aboveExpected,3);
});

test("Unvalued clubs get form percentiles but no financial estimates or value percentile",()=>{
  const arr=[...clubs(),make("NoValue",99,"PL",5,null,10)];
  const row=calculateIntelligence(arr)["PL:NoValue"];
  assert.equal(row.expectedPPG,null);
  assert.equal(row.aboveExpected,null);
  assert.equal(row.valuePercentile,null);
  assert.ok(row.ppgPercentile!==null);
});

test("Model declines insufficient league peers and incomplete match samples",()=>{
  const tiny=clubs().slice(0,8);
  assert.equal(calculateIntelligence(tiny)[tiny[0].id].expectedPPG,null);
  const arr=[...clubs(),make("Incomplete",0,"PL",2,180,6)];
  const row=calculateIntelligence(arr)["PL:Incomplete"];
  assert.equal(row.ppgPercentile,null);
  assert.equal(row.aboveExpected,null);
  assert.equal(row.actualPPG,3);
});

test("Inter-league performance never affects within-league peer estimates",()=>{
  const arr=clubs();
  const before=calculateIntelligence(arr)["PL:Club0"];
  const withSpain=[...arr,...Array.from({length:12},(_,i)=>make("Spain"+i,i,"PD",5,1000+i*60,15))];
  const after=calculateIntelligence(withSpain)["PL:Club0"];
  assert.equal(before.expectedPPG,after.expectedPPG);
  assert.equal(before.ppgPercentile,after.ppgPercentile);
});
