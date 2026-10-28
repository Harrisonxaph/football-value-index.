import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const badges=JSON.parse(readFileSync(new URL("../data/club-badges.json",import.meta.url),"utf8"));
test("badge mapping contains one pinned image per 2026/27 top-five club",()=>{
 const entries=Object.entries(badges);
 assert.equal(entries.length,96);
 const counts=Object.fromEntries(["PL","PD","SA","BL1","FL1"].map(c=>[c,entries.filter(([id])=>id.startsWith(c+":")).length]));
 assert.deepEqual(counts,{PL:20,PD:20,SA:20,BL1:18,FL1:18});
 assert.equal(new Set(entries.map(([,url])=>url)).size,96);
 for(const [id,link] of entries){
   assert.match(id,/^(PL|PD|SA|BL1|FL1):.+/);
   const url=new URL(link);
   assert.equal(url.protocol,"https:");
   assert.equal(url.hostname,"raw.githubusercontent.com");
   assert.match(url.pathname,/^\/JoseArroyave\/football-logos\/[0-9a-f]{40}\/logos\/(england|spain|italy|germany|france)\/.+\.svg$/i);
   assert.ok(!url.pathname.includes(".."));
 }
});
test("club-name exceptions map to distinct, intended crests",()=>{
 assert.match(badges["PL:Brighton & Hove Albion FC"],/Brighton\.svg$/);
 assert.match(badges["PD:RCD Espanyol de Barcelona"],/Espanyol\.svg$/);
 assert.match(badges["PD:FC Barcelona"],/Barcelona\.svg$/);
 assert.notEqual(badges["PD:RCD Espanyol de Barcelona"],badges["PD:FC Barcelona"]);
 assert.match(badges["SA:FC Internazionale Milano"],/Inter\.svg$/);
 assert.match(badges["SA:AC Milan"],/Milan\.svg$/);
 assert.match(badges["BL1:1. FC Köln"],/Cologne\.svg$/);
 assert.match(badges["FL1:Paris Saint-Germain FC"],/Paris_Saint-Germain_\%28PSG\%29\.svg$/);
});
