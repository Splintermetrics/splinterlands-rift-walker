import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {normalize,isBattleCard} from '../data.js';
import {autoTeam,validateTeam,simulate,rng,RULES,MODIFIERS} from '../engine.js';
import {createRun,availableNodes,completeNode,rerollNode,rewardFor,REALMS,battleMana,graftCard,enemyFor,mysteryOutcome,claimVictory,finalizeRecruitment,campBoon,suggestLineup} from '../run.js';
import {starterRoster,rosterError,canField,recruitmentOffers,recruitCard,recruitPrice} from '../roster.js';

const definitions=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url),'utf8'));
const cards=definitions.filter(isBattleCard).map(d=>normalize(d));
const foundation=cards.filter(c=>c.editions.split(',').some(e=>['15','16'].includes(e)));
export const guestSource=foundation.filter(c=>c.type==='Monster'||['Fire','Earth','Life'].includes(c.element));
const cardPower=c=>(c.attack+c.magic+c.ranged)*2+c.health*.6+c.armor*.4+c.abilities.length*.8;
const allowed=(c,a)=>c.element==='Neutral'||c.element===a.element||c.element===a.secondary;

export function auditRoster(kind){
  if(kind==='suggested')return starterRoster(guestSource);
  const element=kind==='life'?'Life':kind==='fire'?'Fire':'Earth';
  const a=guestSource.find(c=>c.type==='Summoner'&&c.element===element);
  const units=guestSource.filter(c=>c.type==='Monster'&&allowed(c,a));
  const selected=[a.id];
  for(const stat of ['attack','ranged','magic']){
    const c=units.filter(c=>c[stat]>0&&!selected.includes(c.id)).sort((a,b)=>cardPower(b)-cardPower(a))[0];if(c)selected.push(c.id);
  }
  for(const c of units.sort((a,b)=>cardPower(b)/(b.mana||1)-cardPower(a)/(a.mana||1)))if(!selected.includes(c.id)&&selected.length<12)selected.push(c.id);
  assert.equal(rosterError(selected,guestSource),null);return selected;
}

function chooseTeam(run,enemy,strategy){
  const roster=guestSource.filter(c=>run.rosterIds.includes(c.id)),cap=battleMana(run),node=run.active;
  if(strategy==='suggest')return suggestLineup(run,roster,enemy);
  const commanders=roster.filter(c=>c.type==='Summoner');
  const candidates=[];
  for(const a of strategy==='button'?commanders.slice(0,1):commanders){
    const units=roster.filter(c=>c.type==='Monster'&&allowed(c,a)).map(c=>graftCard(run,c));
    for(let variant=0;variant<(strategy==='search'?8:1);variant++){
      let team=autoTeam(units,a,cap,node.rule,rng(node.seed+22+variant*71));
      if(node.modifier==='Fractured Loadout'&&team[1]?.rarity!==1){
        const common=team.findIndex((c,i)=>i>0&&c.rarity===1);
        if(common>=0)[team[1],team[common]]=[team[common],team[1]];else team=team.slice(0,1);
      }
      if(validateTeam(team,a,cap,node.rule,node.modifier,'Fire'))continue;
      const score=team.reduce((n,c)=>n+cardPower(c),0)+(node.rule==='Silenced Summoners'?0:(a.health||0)*team.length+(a.magic||0)*team.filter(c=>c.magic).length*2+(a.speed||0)*team.length*.3);
      const result=strategy==='search'?simulate({friendly:team,enemy:enemy.team,archon:a,enemyArchon:enemy.archon,rule:node.rule,modifier:node.modifier,seed:node.seed+449}):null;
      const rank=(result?.winner==='friendly'?10000:0)+(result?result.teams[0].filter(c=>!c.dead).reduce((n,c)=>n+c.health,0)*100:0)+score;
      candidates.push({archon:a,team,rank});
    }
  }
  return candidates.sort((a,b)=>b.rank-a.rank)[0];
}

function chooseRecruit(run,kind){
  const roster=guestSource.filter(c=>run.rosterIds.includes(c.id)),archons=roster.filter(c=>c.type==='Summoner');
  const offers=recruitmentOffers(run,guestSource,kind);
  const score=c=>c.type==='Summoner'?roster.filter(u=>canField(u,c)&&!archons.some(a=>canField(u,a))).length*2-3:cardPower(c)/(c.mana||1)+(c.abilities.includes('Heal')?2:0)+(c.health>=6?1:0);
  const c=offers.filter(c=>kind!=='merchant'||recruitPrice(c)<=run.shards).sort((a,b)=>score(b)-score(a))[0];
  if(c)assert.equal(recruitCard(run,guestSource,kind,c.id),true);
  return c;
}

export function playExpedition({seed,roster='suggested',route='safe',strategy='adaptive',restore=true,shopPolicy='usual'}){
  let run=createRun('guest',seed);run.rosterIds=auditRoster(roster);run.rosterLocked=true;run.screen='map';
  const record={seed,roster,route,strategy,realms:[...run.realms],battles:[],nodes:[],recruits:[],purchases:[],rules:[],modifiers:[],stalls:[],status:'active'};
  const original=JSON.stringify(guestSource);
  const finishRecruit=kind=>{
    const c=chooseRecruit(run,kind);if(c)record.recruits.push({act:run.act,kind,id:c.id,name:c.name});
    const next=finalizeRecruitment(run);
    if(next==='victory')run.status='victory';
    if(next==='intermission')assert.equal(campBoon(run,run.tokens<2?'token':'mana',true),true);
  };
  const applyGrafts=()=>{
    const units=guestSource.filter(c=>run.rosterIds.includes(c.id)&&c.type==='Monster').sort((a,b)=>cardPower(b)-cardPower(a));
    for(let i=run.inventory.length-1;i>=0;i--){
      const token=run.inventory[i],target=units.find(c=>!run.grafts[c.id]&&!c.abilities.includes(token.name));
      if(target){run.grafts[target.id]=token;run.inventory.splice(i,1);}
    }
  };
  for(let step=0;step<80&&run.status==='active';step++){
    assert.ok(run.shards>=0&&run.tokens>=0);
    assert.equal(new Set(run.rosterIds).size,run.rosterIds.length);
    if(restore){const before=JSON.stringify(run);run=JSON.parse(before);assert.equal(JSON.stringify(run),before);}
    const available=availableNodes(run);assert.ok(available.length);
    const preference=route==='elite'?{elite:0,mystery:1,fight:2,shop:3,camp:4,boss:0}:route==='merchant'?{shop:0,fight:1,camp:2,mystery:3,elite:4,boss:0}:{camp:0,mystery:1,fight:2,shop:3,elite:4,boss:0};
    run.active=[...available].sort((a,b)=>preference[a.type]-preference[b.type]||b.mana-a.mana)[0];
    const node=run.active;record.nodes.push({act:run.act,row:node.row,type:node.type,id:node.id});
    let type=node.type;
    if(type==='mystery'){
      type=mysteryOutcome(node);
      if(type==='shards'||type==='token'){
        if(type==='token')run.tokens++;else{const n=8+Math.floor(rng(node.seed+2)()*25);run.shards+=n;run.earned+=n;}
        completeNode(run);continue;
      }
      if(type==='recruit'){run.screen='recruit';run.recruitment={kind:'event',nodeId:node.id};finishRecruit('event');continue;}
    }
    if(type==='camp'){run.screen='camp';assert.equal(campBoon(run,run.tokens<2?'token':'mana'),true);continue;}
    if(type==='shop'){
      run.screen='shop';
      if(shopPolicy==='usual'||shopPolicy==='recruits'){
        const c=chooseRecruit(run,'merchant');if(c)record.purchases.push({act:run.act,kind:'recruit',price:recruitPrice(c),name:c.name});
      }
      if(shopPolicy==='usual'||shopPolicy==='supplies'){
        if(run.tokens<2&&run.shards>=40){run.shards-=40;run.tokens++;record.purchases.push({act:run.act,kind:'token',price:40});}
        else if(run.shards>=55){run.shards-=55;run.inventory.push({name:'Void Armor',scope:'act',act:run.act});record.purchases.push({act:run.act,kind:'ability',price:55});}
      }
      completeNode(run);continue;
    }
    run.screen='draft';applyGrafts();
    for(let attempt=0;attempt<30;attempt++){
      const enemy=enemyFor(run,foundation,cards),draft=chooseTeam(run,enemy,strategy);
      if(!draft){record.stalls.push({act:run.act,node:node.id,rule:node.rule,modifier:node.modifier});}
      assert.ok(enemy.team.length);assert.ok(enemy.team.reduce((n,c)=>n+c.mana,enemy.archon.mana)<=battleMana(run));
      let result;
      if(draft){
        assert.equal(validateTeam(draft.team,draft.archon,battleMana(run),node.rule,node.modifier,'Fire'),null);
        assert.ok(draft.team.every(c=>run.rosterIds.includes(c.id))&&run.rosterIds.includes(draft.archon.id));
        result=simulate({friendly:draft.team,enemy:enemy.team,archon:draft.archon,enemyArchon:enemy.archon,rule:node.rule,modifier:node.modifier,seed:node.seed+449});
        run.battles++;run.nextMana=0;
        for(const c of draft.team){const g=run.grafts[c.id];if(g&&(g.scope==='battle'||g.name==='Divine Shield'))delete run.grafts[c.id];}
      }else result={winner:'enemy',rounds:0};
      record.battles.push({act:run.act,realm:run.realms[run.act],row:node.row,type:node.type,rule:node.rule,modifier:node.modifier,attempt:node.attempt,winner:result.winner,rounds:result.rounds,enemyUnits:enemy.team.length,friendlyUnits:draft?.team.length||0});
      record.rules.push(node.rule);if(node.modifier)record.modifiers.push(node.modifier);
      if(result.winner==='friendly'){
        run.pending=result;run.screen='result';const before=run.shards,reward=claimVictory(run);assert.ok(reward);assert.equal(run.shards,before+reward.shards);assert.equal(claimVictory(run),null);
        const frozen=recruitmentOffers(run,guestSource,'reward').map(c=>c.id);
        if(restore){run=JSON.parse(JSON.stringify(run));assert.deepEqual(recruitmentOffers(run,guestSource,'reward').map(c=>c.id),frozen);}
        finishRecruit('reward');break;
      }
      if(node.modifier==='Bloodprice Shard')run.tokens=Math.max(0,run.tokens-1);
      if(!run.tokens){run.status='defeat';break;}
      rerollNode(run);applyGrafts();
    }
  }
  assert.notEqual(run.status,'active','The expedition never reached an ending.');
  assert.equal(JSON.stringify(guestSource),original,'Card stats must remain unmodified between battles.');
  if(run.status==='victory'){assert.equal(run.guardians,3);assert.equal(run.visited.length,24);}
  Object.assign(record,{status:run.status,guardians:run.guardians,wins:run.wins,earned:run.earned,shards:run.shards,rosterSize:run.rosterIds.length,rerolls:run.rerolls,endedAct:run.act});
  return record;
}

export function summarize(records){
  const groups={};for(const r of records){const key=`${r.roster}/${r.route}/${r.strategy}`,g=groups[key]??={runs:0,victories:0,guardians:0,rerolls:0,recruits:0,purchases:0,shards:0,stalls:0};g.runs++;g.victories+=r.status==='victory';g.guardians+=r.guardians;g.rerolls+=r.rerolls;g.recruits+=r.recruits.length;g.purchases+=r.purchases.length;g.shards+=r.earned;g.stalls+=r.stalls.length;}
  const guardians={};for(const r of records)for(const b of r.battles.filter(b=>b.type==='boss')){const key=`Act ${b.act+1}/${b.realm}`,g=guardians[key]??={attempts:0,wins:0};g.attempts++;g.wins+=b.winner==='friendly';}
  return {runs:records.length,victories:records.filter(r=>r.status==='victory').length,groups,guardians,rules:[...new Set(records.flatMap(r=>r.rules))],modifiers:[...new Set(records.flatMap(r=>r.modifiers))],stalls:records.flatMap(r=>r.stalls)};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const count=Number(process.argv[2]||60),label=process.argv[3]||'final',records=[];
  for(const roster of ['suggested','earth','life','fire'])for(const route of ['safe','elite','merchant'])for(let seed=1;seed<=count;seed++)records.push(playExpedition({seed:seed*7919,roster,route,strategy:'suggest'}));
  const summary=summarize(records);mkdirSync(new URL('../docs/testing/',import.meta.url),{recursive:true});
  const outcomes=records.map(({seed,roster,route,strategy,status,guardians,wins,earned,shards,rosterSize,rerolls,endedAct,purchases,stalls})=>({seed,roster,route,strategy,status,guardians,wins,earned,shards,rosterSize,rerolls,endedAct,purchases:purchases.length,stalls:stalls.length}));
  writeFileSync(new URL(`../docs/testing/${label}.json`,import.meta.url),JSON.stringify({summary,outcomes},null,2));
  console.log(JSON.stringify(summary,null,2));
}
