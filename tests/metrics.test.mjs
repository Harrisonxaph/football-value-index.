import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDashboard,median,LEAGUES} from '../lib/metrics.ts';
import {parseOpenFootball} from '../lib/providers.ts';
const empty=()=>Object.fromEntries(LEAGUES.map(l=>[l.code,[]]));
const match=(date,homeGoals,awayGoals,finished=true)=>({date,homeId:'PL:Alpha',homeName:'Alpha',awayId:'PL:Beta',awayName:'Beta',homeGoals,awayGoals,finished});
const dated=(valueEurM)=>({valueEurM,asOf:'2026-06-12',source:'Historical public data'});
test('median handles odd/even and empty samples',()=>{
  assert.equal(median([]),null);assert.equal(median([50,10,30]),30);assert.equal(median([4,2]),3);
});
test('points, goals, difference and venue are correct',()=>{
  const data=empty();data.PL=[match('2026-09-01',3,1),match('2026-09-08',1,1),match('2026-09-15',0,2),match('2026-09-22',null,null,false)];
  const t=calculateDashboard(data,{'PL:Alpha':dated(100)}).find(r=>r.id==='PL:Alpha');
  assert.equal(t.points,4);assert.equal(t.goalsFor,4);assert.equal(t.goalsAgainst,4);
  assert.equal(t.goalDifference,0);assert.equal(t.played,3);assert.equal(t.pointsPer100m,4);
  assert.equal(t.form[0].result,'L');assert.equal(t.form[2].result,'W');assert.equal(t.provisional,true);
});
test('last 10 completed games ignores older results',()=>{
  const data=empty();data.PL=Array.from({length:12},(_,i)=>match(`2026-09-${String(i+1).padStart(2,'0')}`,i===0?0:1,i===0?3:0));
  const t=calculateDashboard(data,{}).find(r=>r.id==='PL:Alpha');
  assert.equal(t.played,10);assert.equal(t.points,30);assert.equal(t.goalsFor,10);assert.equal(t.provisional,false);
});
test('missing, zero, undated valuations never get ranked',()=>{
  const data=empty();data.PL=[match('2026-09-01',1,0)];
  const rows=calculateDashboard(data,{'PL:Alpha':{valueEurM:100,asOf:'',source:'manual'},'PL:Beta':dated(0)});
  assert.equal(rows.find(r=>r.id==='PL:Alpha').valueIndex,null);
  assert.equal(rows.find(r=>r.id==='PL:Beta').pointsPer100m,null);
});
test('the lower-value club gets higher index for identical performance',()=>{
  const data=empty();data.PL=[match('2026-09-01',1,1)];
  const rows=calculateDashboard(data,{'PL:Alpha':dated(100),'PL:Beta':dated(400)});
  assert.ok(rows.find(r=>r.id==='PL:Alpha').valueIndex>rows.find(r=>r.id==='PL:Beta').valueIndex);
});
test('openfootball parses fulltime objects and score arrays, not missing scores',()=>{
  const doc={matches:[
    {date:'2026-09-01',team1:'Alpha',team2:'Beta',score:{ht:[0,0],ft:[1,0]}},
    {date:'2026-09-02',team1:'Beta',team2:'Alpha',score:[0,0]},
    {date:'2026-09-03',team1:'Alpha',team2:'Beta'},
    {date:'2026-12-01',team1:'Alpha',team2:'Beta',score:{ft:[4,0]}}
  ]};
  const parsed=parseOpenFootball(doc,'PL','2026-10-28');
  assert.deepEqual(parsed.map(x=>x.finished),[true,true,false,false]);
  assert.deepEqual([parsed[1].homeGoals,parsed[1].awayGoals],[0,0]);
  assert.equal(parsed[2].homeGoals,null);
});
test('corrupt openfootball rows cause a visible data error',()=>{
  assert.throws(()=>parseOpenFootball({matches:[{date:'bad'}]},'PL','2026-10-28'),/invalid fixture/);
});
