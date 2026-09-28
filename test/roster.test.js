import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize,isBattleCard} from '../data.js';
import {STARTER_LIMIT,starterRoster,rosterError,ensureRoster,recruitmentOffers,recruitCard,recruitPrice} from '../roster.js';
import {createRun,nextAct,rerollNode,suggestLineup,hasLegalLineup,enemyFor,battleMana} from '../run.js';
import {simulate,autoTeam,validateTeam,rng} from '../engine.js';

const details=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url),'utf8'));
const foundation=details.filter(d=>isBattleCard(d)&&d.editions.split(',').some(e=>['15','16'].includes(e))).map(d=>normalize(d));
const source=foundation.filter(c=>c.type==='Monster'||['Fire','Earth','Life'].includes(c.element));
const makeRun=()=>({...createRun('guest',42),rosterIds:starterRoster(source),rosterLocked:true,screen:'shop',active:{id:'0-3-0',row:3,lane:0,type:'shop',seed:92,mana:30},shards:100});

test('starter rosters stay within the limit and cover multiple attack types and commanders',()=>{
  const ids=starterRoster(source),cards=source.filter(c=>ids.includes(c.id));
  assert.equal(ids.length,STARTER_LIMIT);assert.equal(new Set(ids).size,ids.length);
  assert.equal(rosterError(ids,source),null);
  assert.ok(cards.filter(c=>c.type==='Summoner').length>=2);
  for(const stat of ['attack','ranged','magic'])assert.ok(cards.some(c=>c.type==='Monster'&&c[stat]>0));
});

test('roster validation rejects oversized, duplicate, missing, commanderless, and incompatible rosters',()=>{
  const a=source.find(c=>c.type==='Summoner'&&c.element==='Fire');
  const incompatible=source.filter(c=>c.type==='Monster'&&c.element==='Water').slice(0,3);
  assert.ok(rosterError(source.slice(0,13).map(c=>c.id),source));
  assert.ok(rosterError([a.id,a.id],source));assert.ok(rosterError([a.id,99999],source));
  assert.ok(rosterError(incompatible.map(c=>c.id),source));
  assert.ok(rosterError([a.id,...incompatible.map(c=>c.id)],source));
  const single=source.find(c=>c.type==='Monster'&&c.element==='Neutral');
  assert.equal(rosterError([a.id,single.id],[a,single]),null);
});

test('legacy saves retain progress, drafted units, and grafted cards when migrated',()=>{
  const run=createRun('guest',17),a=source.find(c=>c.type==='Summoner'),units=source.filter(c=>c.type==='Monster').slice(-6);
  Object.assign(run,{act:1,row:3,shards:72,archonId:a.id,draft:units.slice(0,4).map(c=>c.id),grafts:{[units[5].id]:{name:'Resurgence',scope:'run'}},screen:'draft'});
  assert.equal(ensureRoster(run,source),true);
  for(const id of [a.id,...run.draft,units[5].id])assert.ok(run.rosterIds.includes(id));
  assert.equal(run.act,1);assert.equal(run.row,3);assert.equal(run.shards,72);assert.equal(run.screen,'draft');
  const restored=JSON.parse(JSON.stringify(run));
  assert.equal(ensureRoster(restored,source),false);assert.deepEqual(restored.rosterIds,run.rosterIds);
});

test('legacy saves with many upgraded units retain those units and a usable Archon',()=>{
  const units=source.filter(c=>c.type==='Monster').slice(0,14),run=createRun('guest',12);
  run.grafts=Object.fromEntries(units.map(c=>[c.id,{name:'Resurgence',scope:'run'}]));
  ensureRoster(run,source);
  assert.ok(units.every(c=>run.rosterIds.includes(c.id)));
  assert.ok(source.some(c=>c.type==='Summoner'&&run.rosterIds.includes(c.id)));
  assert.equal(Object.keys(run.grafts).length,14);
});

test('owned roster recruitment retains owned levels and never grants cards outside the snapshot',()=>{
  const owned=source.map(c=>({...c,level:4})),run=makeRun();run.mode='collection';run.collectionSnapshot={username:'player',cards:owned};
  const offers=recruitmentOffers(run,owned,'merchant');
  assert.ok(offers.every(c=>c.level===4&&owned.some(o=>o.id===c.id)));
  assert.equal(recruitCard(run,owned,'merchant',offers[0].id),true);
  const restored=JSON.parse(JSON.stringify(run));ensureRoster(restored,owned);
  assert.ok(restored.collectionSnapshot.cards.every(c=>c.level===4));
  assert.equal(recruitCard(run,owned,'merchant',99999),false);
});

test('recruitment stock is distinct, compatible, excludes roster cards, and survives save/reload',()=>{
  const run=makeRun(),before=[...run.rosterIds];
  const offers=recruitmentOffers(run,source,'merchant');
  assert.equal(offers.length,3);assert.equal(new Set(offers.map(c=>c.id)).size,3);
  assert.ok(offers.every(c=>!before.includes(c.id)));
  const restored=JSON.parse(JSON.stringify(run));
  assert.deepEqual(recruitmentOffers(restored,source,'merchant'),offers);
  assert.deepEqual(recruitmentOffers(run,source,'merchant'),offers);
});

test('merchant recruitment spends shards once, expands the roster, and keeps stock fixed',()=>{
  const run=makeRun(),offers=recruitmentOffers(run,source,'merchant'),c=offers[0],before=run.shards;
  assert.equal(recruitCard(run,source,'merchant',c.id),true);
  assert.equal(run.shards,before-recruitPrice(c));assert.equal(run.rosterIds.length,STARTER_LIMIT+1);
  assert.equal(recruitCard(run,source,'merchant',c.id),false);assert.equal(run.shards,before-recruitPrice(c));
  assert.deepEqual(recruitmentOffers(run,source,'merchant'),offers);
  run.shards=0;assert.equal(recruitCard(run,source,'merchant',offers[1].id),false);
  assert.equal(recruitCard(run,source,'merchant',99999),false);
});

test('free battle and event recruitment requires the saved offer and matching encounter',()=>{
  for(const kind of ['reward','event']){
    const run=makeRun();run.screen='recruit';run.shards=0;run.recruitment={kind,nodeId:run.active.id};
    const c=recruitmentOffers(run,source,kind)[0];
    assert.equal(recruitCard(run,source,kind,c.id),true);assert.equal(run.shards,0);
    assert.equal(recruitCard(run,source,kind,c.id),false);
    const other=recruitmentOffers(run,source,kind)[1];run.recruitment.nodeId='wrong';
    assert.equal(recruitCard(run,source,kind,other.id),false);
  }
  const run=makeRun(),c=recruitmentOffers(run,source,'reward')[0];
  assert.equal(recruitCard(run,source,'reward',c.id),false);
});

test('rosters and run-long grafts persist through rerolls and act changes',()=>{
  const run=makeRun();run.map[3][0]=run.active;
  const ids=[...run.rosterIds];run.grafts[ids[2]]={name:'Resurgence',scope:'run'};
  rerollNode(run);assert.deepEqual(run.rosterIds,ids);
  nextAct(run);assert.deepEqual(run.rosterIds,ids);assert.equal(run.grafts[ids[2]].name,'Resurgence');
});

test('roster lineups remain legal across rulesets and battle injuries do not mutate roster stats',()=>{
  const run=makeRun(),cards=source.filter(c=>run.rosterIds.includes(c.id)),a=cards.find(c=>c.type==='Summoner');
  const units=cards.filter(c=>c.type==='Monster'&&(c.element==='Neutral'||c.element===a.element));
  for(const rule of ['Standard','Keep Your Distance','Lost Magic','Broken Arrows']){
    const team=autoTeam(units,a,28,rule,rng(5));assert.equal(validateTeam(team,a,28,rule,null,'Fire'),null);
    const before=structuredClone(cards);
    simulate({friendly:team,enemy:team,archon:a,enemyArchon:a,rule,seed:5});
    assert.deepEqual(cards,before);
  }
});

test('lineup suggestion fields a valid team for every guest ruleset and modifier',()=>{
  const roster=source.filter(c=>starterRoster(source).includes(c.id)),run=createRun('guest',18);
  run.rosterIds=roster.map(c=>c.id);run.rosterLocked=true;
  const rules=['Standard','Keep Your Distance','Lost Magic','Broken Arrows','Reverse Speed','Equal Opportunity','Explosive Weaponry','Silenced Summoners','Unprotected','Close Range'];
  const modifiers=[null,'Fractured Loadout','Unstable Rift','Rift Surge','Corrupted Mana','Echo','Bloodprice Shard','Rift Anomaly'];
  for(const rule of rules)for(const modifier of modifiers){
    const node={type:'fight',row:0,lane:0,mana:32,seed:771,rule,modifier};run.active=node;
    const enemy=enemyFor(run,foundation,foundation);
    const suggestion=suggestLineup(run,roster,enemy);
    assert.ok(suggestion,`${rule} / ${modifier}`);
    assert.equal(validateTeam(suggestion.team,suggestion.archon,battleMana(run),rule,modifier,suggestion.paired),null);
    assert.equal(hasLegalLineup(run,roster,node),true);
  }
});

test('unplayable encounters are detected before commitment and can be rerolled',()=>{
  const a={id:1,type:'Summoner',element:'Fire',mana:3,health:0,attack:0,magic:0,ranged:0,speed:0,armor:0,abilities:[]};
  const units=[2,3,4].map(id=>({id,type:'Monster',element:'Fire',mana:4,health:5,attack:0,magic:1,ranged:0,speed:2,armor:0,rarity:1,abilities:[]}));
  const roster=[a,...units],run=createRun('guest',11);
  assert.equal(rosterError(roster.map(c=>c.id),roster),null);
  run.rosterIds=roster.map(c=>c.id);run.rosterLocked=true;
  run.active={id:'0-0-1',row:0,lane:1,type:'fight',mana:28,seed:100,rule:'Lost Magic',modifier:null,attempt:0};
  assert.equal(hasLegalLineup(run,roster,run.active),false);
  rerollNode(run);
  assert.equal(hasLegalLineup(run,roster,run.active),true);
});

test('the expedition audit completes three acts with deterministic saves',async()=>{
  const {playExpedition}=await import('../scripts/audit-expeditions.mjs');
  for(const seed of [7919,23757,47514]){
    const first=playExpedition({seed,route:'safe',strategy:'suggest'});
    const restored=playExpedition({seed,route:'safe',strategy:'suggest'});
    assert.deepEqual(restored,first);
    assert.equal(first.status,'victory');
    assert.equal(first.guardians,3);
    assert.ok(first.recruits.length>=3);
  }
});
