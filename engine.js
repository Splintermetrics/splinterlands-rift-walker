export const SUPPORTED = new Set(['Reach','Sneak','Snipe','Opportunity','Flying','Dodge','True Strike','Thorns','Blast','Heal','Tank Heal','Void','Shield','Divine Shield','Double Strike','Life Leech','Weaken','Strengthen','Slow','Swiftness','Taunt','Cleanse','Backfire','Untrainable','Void Armor','Piercing','Resurgence','Resurrect','Magic Reflect','Return Fire','Affliction','Scavenger','Last Stand','Inspire','Demoralize','Headwinds','Silence','Protect','Close Range','Phase','Poison','Camouflage','Cripple','Immunity']);
export const RULES = {
  Standard:'Normal attack and positioning rules apply.',
  'Reverse Speed':'Slower units act first. Speed accuracy is reversed.',
  'Keep Your Distance':'Melee attackers cannot enter this battle.',
  'Lost Magic':'Magic attackers cannot enter this battle.',
  'Broken Arrows':'Ranged attackers cannot enter this battle.',
  'Equal Opportunity':'Every unit gains Opportunity: target the lowest health enemy.',
  'Explosive Weaponry':'Every unit gains Blast: splash damage hits adjacent targets.',
  'Silenced Summoners':'Archon buffs and abilities have no effect.',
  Unprotected:'All armor is removed and cannot be restored.',
  'Close Range':'Ranged units can attack from the front position.'
};
export const MODIFIERS = {
  'Unstable Rift':'The ruleset changes once at the start of round 2.',
  Echo:'The first fallen friendly unit returns at 1 HP for one basic attack.',
  'Rift Surge':'+5 mana for this encounter. Shard rewards take a reroll-style penalty.',
  'Corrupted Mana':'Each buyback adds 2 to this encounter’s mana cap.',
  'Fractured Loadout':'The second slot must be a Common unit.',
  'Bloodprice Shard':'Double shards. Defeat immediately consumes one Rift Token.',
  'Rift Anomaly':'Archon effects are silenced for round 1, then return.'
};
export function rng(seed) { let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;}; }
export const pick=(items,random)=>items[Math.floor(random()*items.length)];
export const eligible=(c,rule)=> !(rule==='Keep Your Distance'&&c.attack>0 || rule==='Lost Magic'&&c.magic>0 || rule==='Broken Arrows'&&c.ranged>0);
export function validateTeam(team,archon,cap,rule,modifier,pairedElement,slots=6) {
  if (!archon) return 'Choose an Archon.';
  if (!team.length) return 'Add at least one unit to your team.';
  if (team.length>slots) return 'Your loadout has too many units.';
  if (new Set(team.map(c=>c.id)).size!==team.length) return 'Each unit can be selected only once.';
  if (team.some(c=> !eligible(c,rule))) return 'A unit conflicts with the active ruleset.';
  if (team.some(c=> c.element!=='Neutral' && c.element!==archon.element && c.element!==archon.secondary && !(['Dragon','Neutral'].includes(archon.element)&&c.element===pairedElement))) return 'A unit is outside your Archon’s elements.';
  if (team.reduce((n,c)=>n+c.mana,archon.mana)>cap) return 'Your team exceeds the mana cap.';
  if (modifier==='Fractured Loadout'&&team[1]&&team[1].rarity!==1) return 'Slot 2 is locked to Common units.';
  return null;
}
export function autoTeam(pool,archon,cap,rule,random=rng(1),limit=6,initial=[]) {
  let team=[...initial],remaining=cap-archon.mana-team.reduce((s,c)=>s+c.mana,0);
  const available=pool.filter(c=>eligible(c,rule)&&!team.some(t=>t.id===c.id));
  const score=c=>(c.attack+c.magic+c.ranged)*2+c.health*.6+c.armor*.4+c.abilities.length*.8;
  if (!team.length) {
    const tanks=available.filter(c=>c.mana<=remaining).map(c=>({c,s:c.health+c.armor+(c.attack?3:0)+(c.ranged?-4:0)+random()*2})).sort((a,b)=>b.s-a.s);
    if(tanks.length){team.push(tanks[0].c);remaining-=tanks[0].c.mana;}
  }
  while(team.length<limit) {
    const candidates=available.filter(c=>!team.some(t=>t.id===c.id)&&c.mana<=remaining).map(c=>({c,s:(score(c)/(c.mana||1))*(c.attack&&!c.abilities.some(a=>['Reach','Sneak','Opportunity'].includes(a))&&rule!=='Equal Opportunity'?.35:1)+random()*.7})).sort((a,b)=>b.s-a.s);
    if(!candidates.length)break;team.push(candidates[0].c);remaining-=candidates[0].c.mana;
  }
  const reachIndex=team.findIndex((c,i)=>i>0&&c.attack>0&&c.abilities.includes('Reach'));
  if(reachIndex>1)[team[1],team[reachIndex]]=[team[reachIndex],team[1]];
  return team;
}
export function draftTeam(pool,archon,cap,rule,modifier,random=rng(1),initial=[]){
  let team=autoTeam(pool,archon,cap,rule,random,6,initial);
  if(modifier==='Fractured Loadout'&&team[1]?.rarity!==1){
    const common=team.findIndex((c,i)=>i>0&&c.rarity===1);
    if(common>=0)[team[1],team[common]]=[team[common],team[1]];
    else{
      const front=team[0],remaining=cap-archon.mana-front.mana;
      const substitute=pool.filter(c=>c.id!==front.id&&c.rarity===1&&eligible(c,rule)&&c.mana<=remaining).sort((a,b)=>(b.attack+b.magic+b.ranged+b.health*.3)-(a.attack+a.magic+a.ranged+a.health*.3))[0];
      team=substitute?autoTeam(pool,archon,cap,rule,random,6,[front,substitute]):[front];
    }
  }
  return team;
}
export function simulate({friendly,enemy,archon,enemyArchon,rule='Standard',modifier=null,seed=1}) {
  const random=rng(seed),events=[],teams=[friendly,enemy].map((team,side)=>team.map((c,i)=>({...structuredClone(c),uid:`${side}-${i}`,side,maxHealth:c.health,maxArmor:c.armor,base:structuredClone(c),dead:false,shieldUsed:false,revived:false,echoed:false,poisoned:false,afflicted:false,lastStand:false})));
  let activeRule=rule, round=0,echoUsed=false;
  const alive=side=>teams[side].filter(c=>!c.dead&&c.health>0);
  const has=(c,a)=>c.abilities.includes(a);
  const snapshot=()=>teams.map(t=>t.map(c=>({uid:c.uid,id:c.id,name:c.name,health:Math.max(0,c.health),maxHealth:c.maxHealth,armor:c.armor,dead:c.dead,attack:c.attack,magic:c.magic,ranged:c.ranged,speed:c.speed})));
  const emit=(text,type='attack',actor=null,target=null)=>events.push({round,text,type,actor:actor?.uid,target:target?.uid,teams:snapshot(),rule:activeRule});
  function archonEffects(sign=1){
    [archon,enemyArchon].forEach((a,side)=>{if(!a)return;
      for(const key of ['attack','ranged','magic','armor','health','speed']){
        const value=a[key]||0; if(!value)continue;
        for(const c of teams[value<0?1-side:side]){
          if(['attack','ranged','magic'].includes(key)&&c.base[key]===0)continue;
          const before=c[key]; c[key]=Math.max(key==='health'||key==='speed'?1:0,c[key]+value*sign);
          if(key==='health'){c.maxHealth=Math.max(1,c.maxHealth+c[key]-before);} if(key==='armor')c.maxArmor=c.armor;
        }
      }
      if(sign===1) for(const c of teams[side]) for(const ability of a.abilities||[]) {
        if(ability==='Affliction'){for(const e of teams[1-side])e.afflicted=true;}
        else if(!has(c,ability))c.abilities.push(ability);
      }
    });
  }
  function unitEffects(){for(let side=0;side<2;side++)for(const source of teams[side])for(const [ability,key,amount,opponent] of [['Strengthen','health',1,false],['Weaken','health',-1,true],['Slow','speed',-1,true],['Swiftness','speed',1,false],['Inspire','attack',1,false],['Demoralize','attack',-1,true],['Headwinds','ranged',-1,true],['Silence','magic',-1,true],['Protect','armor',2,false]])if(has(source,ability))for(const c of teams[opponent?1-side:side]){if(['attack','magic','ranged'].includes(key)&&c[key]===0)continue;c[key]=Math.max(key==='armor'?0:1,c[key]+amount);if(key==='health')c.maxHealth=c.health;}}
  function ruleEffects(){for(const c of teams.flat())if(activeRule==='Unprotected')c.armor=0;}
  if(activeRule!=='Silenced Summoners'&&modifier!=='Rift Anomaly')archonEffects();unitEffects();ruleEffects();
  emit('The rift opens. Both teams enter at full strength.','round');
  function deaths(){for(const c of teams.flat())if(!c.dead&&c.health<=0){
    const resurrector=alive(c.side).find(x=>has(x,'Resurrect')&&!x.resurrectUsed);
    if(!c.revived&&(has(c,'Resurgence')||resurrector)){if(resurrector)resurrector.resurrectUsed=true;c.revived=true;c.health=1;c.armor=c.maxArmor;c.poisoned=false;emit(`${c.name} returns with 1 health.`, 'revive',c);continue;}
    if(c.side===0&&modifier==='Echo'&&!echoUsed){echoUsed=true;c.health=1;c.echoed=true;c.abilities=[];emit(`${c.name} echoes back for one basic attack.`, 'revive',c);continue;}
    c.dead=true;emit(`${c.name} falls.`, 'death',c);
    for(const scavenger of teams.flat().filter(x=>!x.dead&&x.health>0&&has(x,'Scavenger'))){scavenger.maxHealth++;scavenger.health++;}
  }}
  function damage(target,value,type,source,secondary=false){
    if(value<=0||target.dead)return 0;
    if(has(target,'Divine Shield')&&!target.shieldUsed){target.shieldUsed=true;emit(`${target.name}’s Divine Shield absorbs the hit.`,'shield',source,target);return 0;}
    if((type==='magic'&&has(target,'Void'))||(type!=='magic'&&has(target,'Shield')))value=value===1?0:Math.ceil(value/2);
    if(!value){emit(`${target.name} resists the attack.`,'shield',source,target);return 0;}
    const dealt=value;
    if(target.armor>0&&(type!=='magic'||has(target,'Void Armor'))){let armor=target.armor;target.armor=Math.max(0,armor-value);if(source&&has(source,'Piercing'))target.health-=Math.max(0,value-armor);}else target.health-=value;
    emit(`${source?.name||'The rift'} deals ${value} ${type} damage to ${target.name}${secondary?' · splash':''}.`,'attack',source,target);
    return dealt;
  }
  function targetFor(c,type){let targets=alive(1-c.side);if(!targets.length)return null;const index=alive(c.side).indexOf(c);
    const taunt=targets.find(t=>has(t,'Taunt'));if(taunt)return taunt;
    const visible=targets.filter((t,i)=>i===0||!has(t,'Camouflage'));targets=visible.length?visible:targets;
    if(index>0&&has(c,'Sneak'))return targets.at(-1);
    if(has(c,'Opportunity')||activeRule==='Equal Opportunity')return [...targets].sort((a,b)=>a.health-b.health)[0];
    if(index>0&&has(c,'Snipe')&&type!=='melee')return targets.find(t=>alive(1-c.side).indexOf(t)>0&&(t.magic||t.ranged||!t.attack))||targets[0];
    return targets[0];
  }
  for(round=1;round<=40&&alive(0).length&&alive(1).length;round++){
    if(round===2&&modifier==='Unstable Rift'){
      const next=pick(['Standard','Reverse Speed','Equal Opportunity','Explosive Weaponry','Unprotected','Close Range'],random);
      if(activeRule==='Silenced Summoners'&&next!=='Silenced Summoners')archonEffects();activeRule=next;ruleEffects();emit(`Unstable Rift shifts the ruleset to ${activeRule}.`,'rule');
    }
    if(round===2&&modifier==='Rift Anomaly'&&activeRule!=='Silenced Summoners'){archonEffects();ruleEffects();emit('Rift Anomaly fades. Archon effects return.','rule');}
    emit(`Round ${round}`,'round');
    for(const c of teams.flat().filter(c=>!c.dead))if(c.poisoned&&!has(c,'Immunity')){c.health-=2;emit(`${c.name} takes 2 poison damage.`,'status',c);}deaths();
    for(let side=0;side<2;side++){const last=alive(side);if(last.length===1&&has(last[0],'Last Stand')&&!last[0].lastStand){let c=last[0];c.lastStand=true;for(const stat of ['attack','magic','ranged','speed','armor','health','maxHealth'])c[stat]=Math.ceil(c[stat]*1.5);emit(`${c.name} makes a Last Stand.`,'status',c);}}
    const order=teams.flat().filter(c=>!c.dead).map(c=>({c,tie:random()})).sort((a,b)=>(activeRule==='Reverse Speed'?a.c.speed-b.c.speed:b.c.speed-a.c.speed)||(!!b.c.magic-!!a.c.magic)||(b.c.rarity-a.c.rarity)||a.tie-b.tie).map(x=>x.c);
    for(const c of order){if(c.dead||!alive(1-c.side).length)continue;
      if(has(c,'Cleanse')){const front=alive(c.side)[0];if(front){front.poisoned=false;front.afflicted=false;}}
      for(const ability of ['Heal','Tank Heal'])if(has(c,ability)){const t=ability==='Heal'?c:alive(c.side)[0];if(t&&!t.afflicted&&t.health<t.maxHealth){t.health=Math.min(t.maxHealth,t.health+Math.max(2,Math.floor(t.maxHealth/3)));emit(`${c.name} heals ${t.name}.`,'heal',c,t);}}
      for(let strike=0;strike<(has(c,'Double Strike')?2:1)&&!c.dead;strike++)for(const [key,type] of [['magic','magic'],['ranged','ranged'],['attack','melee']]){
        if(!c[key]||c.dead)continue;const pos=alive(c.side).indexOf(c);
        if(type==='ranged'&&pos===0&&!has(c,'Close Range')&&activeRule!=='Close Range')continue;
        if(type==='melee'&&pos>0&&!has(c,'Sneak')&&!has(c,'Opportunity')&&activeRule!=='Equal Opportunity'&&!(pos===1&&has(c,'Reach')))continue;
        const t=targetFor(c,type);if(!t)continue;
        let miss=0;if(type!=='magic'||has(t,'Phase')){const difference=activeRule==='Reverse Speed'?c.speed-t.speed:t.speed-c.speed;miss=Math.max(0,difference*.1)+(has(t,'Flying')&&!has(c,'Flying')?.25:0)+(has(t,'Dodge')?.25:0);}
        if(!has(c,'True Strike')&&random()<Math.min(.9,miss)){emit(`${t.name} evades ${c.name}.`,'miss',c,t);if(has(t,'Backfire'))damage(c,2,'melee',t);deaths();continue;}
        const opponents=alive(1-c.side),targetIndex=opponents.indexOf(t),dealt=damage(t,c[key],type,c);
        if(dealt){
          if(has(c,'Life Leech')){const n=Math.ceil(dealt/2);c.maxHealth+=n;c.health+=n;}
          if(has(c,'Affliction')&&random()<.5&&!has(t,'Immunity'))t.afflicted=true;
          if(has(c,'Poison')&&random()<.5&&!has(t,'Immunity'))t.poisoned=true;
          if(has(c,'Cripple')){t.maxHealth=Math.max(1,t.maxHealth-1);t.health=Math.min(t.health,t.maxHealth);}
          if(has(c,'Blast')||activeRule==='Explosive Weaponry')for(const neighbor of [opponents[targetIndex-1],opponents[targetIndex+1]].filter(Boolean))damage(neighbor,Math.ceil(c[key]/2),type,c,true);
          if(type==='melee'&&has(t,'Thorns'))damage(c,2,'melee',t);
          if(type==='magic'&&has(t,'Magic Reflect'))damage(c,Math.ceil(c[key]/2),'magic',t);
          if(type==='ranged'&&has(t,'Return Fire'))damage(c,Math.ceil(c[key]/2),'ranged',t);
        } deaths();
      }
      if(c.echoed&&!c.dead){c.dead=true;c.health=0;emit(`${c.name}’s echo fades.`,'death',c);}
    }
    if(round>=20){for(const c of teams.flat().filter(c=>!c.dead)){c.health-=round-19;emit(`${c.name} takes ${round-19} fatigue damage.`,'status',c);}deaths();}
  }
  const winner=alive(0).length&&!alive(1).length?'friendly':alive(1).length&&!alive(0).length?'enemy':'draw';
  emit(winner==='friendly'?'Victory. The path through the rift is clear.':winner==='enemy'?'Defeat. Your expedition hangs in the balance.':'Both teams fall. The rift claims the battle.','result');
  return {winner,rounds:Math.min(round-1,40),events,teams:snapshot()};
}
