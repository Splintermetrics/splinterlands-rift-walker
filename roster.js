import {rng} from './engine.js';

export const STARTER_LIMIT=12;
export const recruitPrice=card=>[0,20,30,45,65][card.rarity]||30;
export const canField=(unit,archon)=>unit.type==='Monster'&&(unit.element==='Neutral'||unit.element===archon.element||unit.element===archon.secondary||['Dragon','Neutral'].includes(archon.element));

export function starterRoster(source,priority=[]){
  const chosen=[...new Set(priority)].filter(id=>source.some(c=>c.id===id));
  const add=c=>{if(c&&!chosen.includes(c.id)&&chosen.length<STARTER_LIMIT)chosen.push(c.id);};
  const commanders=source.filter(c=>c.type==='Summoner');
  const first=commanders.find(c=>chosen.includes(c.id))||commanders[0];
  if(first&&!chosen.includes(first.id)&&chosen.length>=STARTER_LIMIT)chosen.push(first.id);
  else add(first);
  const second=commanders.find(c=>c.element!==first?.element);
  add(second);
  const units=source.filter(c=>c.type==='Monster').sort((a,b)=>a.mana-b.mana||a.id-b.id);
  for(const a of [first,second].filter(Boolean))for(const stat of ['attack','ranged','magic'])add(units.find(c=>canField(c,a)&&c[stat]>0&&!chosen.includes(c.id)));
  for(const c of units.filter(c=>[first,second].some(a=>a&&canField(c,a))))add(c);
  return chosen;
}

export function rosterError(ids,source){
  if(ids.length>STARTER_LIMIT)return `Choose at most ${STARTER_LIMIT} cards.`;
  if(new Set(ids).size!==ids.length||ids.some(id=>!source.some(c=>c.id===id)))return 'Choose available cards only, once each.';
  const selected=source.filter(c=>ids.includes(c.id)),commanders=selected.filter(c=>c.type==='Summoner');
  if(!commanders.length)return 'Include at least one Archon.';
  if(!commanders.some(a=>{
    const available=source.filter(c=>canField(c,a)).length;
    return available>0&&selected.filter(c=>canField(c,a)).length>=Math.min(3,available);
  }))return 'Include at least three compatible units for an Archon (or all available if fewer).';
  return null;
}

export function ensureRoster(run,source){
  if(!run)return false;
  if(Array.isArray(run.rosterIds)){
    const ids=run.rosterIds.filter(id=>source.some(c=>c.id===id));
    if(ids.length===run.rosterIds.length)return false;
    run.rosterIds=ids;return true;
  }
  // Preserve cards that were already drafted or upgraded in pre-roster saves.
  const priority=[run.archonId,run.battleArchon?.id,...(run.draft||[]),...(run.friendly||[]).map(c=>c.id),...Object.keys(run.grafts||{}).map(Number)].filter(Boolean);
  run.rosterIds=starterRoster(source,priority);run.rosterLocked=true;run.rosterMigrated=true;
  return true;
}

export function recruitmentOffers(run,source,kind){
  const node=run.active;if(!node)return [];
  node.recruits??={};
  if(!node.recruits[kind]){
    const commanders=source.filter(c=>c.type==='Summoner'&&run.rosterIds.includes(c.id));
    const candidates=source.filter(c=>!run.rosterIds.includes(c.id)&&(c.type==='Summoner'||commanders.some(a=>canField(c,a))));
    const random=rng(node.seed+({reward:1401,merchant:2401,event:3401}[kind]||0)),ids=[];
    while(candidates.length&&ids.length<3)ids.push(candidates.splice(Math.floor(random()*candidates.length),1)[0].id);
    node.recruits[kind]=ids;
  }
  return node.recruits[kind].map(id=>source.find(c=>c.id===id)).filter(Boolean);
}

export function recruitCard(run,source,kind,id){
  if(!run?.rosterLocked||!['reward','merchant','event'].includes(kind)||!run.active)return false;
  if(kind==='merchant'&&run.screen!=='shop'||kind!=='merchant'&&(run.screen!=='recruit'||run.recruitment?.kind!==kind||run.recruitment?.nodeId!==run.active.id))return false;
  const c=recruitmentOffers(run,source,kind).find(c=>c.id===id);
  if(!c||run.rosterIds.includes(id))return false;
  const price=kind==='merchant'?recruitPrice(c):0;
  if(run.shards<price)return false;
  run.shards-=price;run.rosterIds.push(id);
  return true;
}
