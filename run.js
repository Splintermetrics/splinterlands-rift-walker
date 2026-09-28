import {rng,pick,MODIFIERS,autoTeam,eligible,draftTeam,validateTeam} from './engine.js';
export const REALMS = {
  Fire:{name:'The Burning Lands',subtitle:'Embers stir beneath a fractured sky.',archon:236,boss:11,color:'#df876c'},
  Water:{name:'The Abyssal Expanse',subtitle:'Ancient things wake beneath the tide.',archon:111,boss:177,color:'#70b9d9'},
  Earth:{name:'The Verdant Wilds',subtitle:'The roots remember every fallen traveler.',archon:278,boss:188,color:'#93bd8e'},
  Life:{name:'The Shattered Citadel',subtitle:'A last light holds against the darkness.',archon:914,boss:44,color:'#e6ce96'},
  Death:{name:'The Silent Reach',subtitle:'Even the shadows have a heartbeat.',archon:235,boss:679,color:'#b596d4'},
  Dragon:{name:'The Dragon Spires',subtitle:'Old wings cast shadows over new worlds.',archon:56,boss:255,color:'#d9ae66'},
  Neutral:{name:'The Heart of the Rift',subtitle:'Every path ends at the same impossible door.',archon:506,boss:352,color:'#b6c1cd'}
};
export const NODE_TYPES={fight:{name:'Battle',icon:'⚔',color:'#b9b3cb'},elite:{name:'Elite',icon:'♜',color:'#e2996c'},shop:{name:'Merchant',icon:'◇',color:'#e0c78d'},mystery:{name:'Unknown',icon:'?',color:'#b394ea'},camp:{name:'Rift Camp',icon:'♨',color:'#85ba9b'},boss:{name:'Guardian',icon:'♛',color:'#df797d'}};
export const TOKENS={Sneak:{price:15,tier:1,scope:'battle',description:'Target the backline from any position.'},Blast:{price:30,tier:2,scope:'battle',description:'Splash adjacent enemies. −1 speed.'},Thorns:{price:25,tier:2,scope:'battle',description:'Return 2 melee damage. −1 health.'},Heal:{price:30,tier:2,scope:'battle',description:'Heal each turn. +1 mana.'},'Void Armor':{price:55,tier:3,scope:'act',description:'Armor absorbs magic. −1 health.'},'Divine Shield':{price:55,tier:3,scope:'act',description:'Absorb the first hit. One battle per act.'},Resurgence:{price:90,tier:4,scope:'run',description:'Return once at 1 health. One active graft.'}};
export function createMap(seed,act){const random=rng(seed+act*999),rows=[];
  const presets=[['fight','fight','fight'],['mystery','fight','elite'],['fight','camp','mystery'],['shop','elite','fight'],['elite','mystery','shop'],['camp','fight','camp'],['fight','elite','fight'],['boss']];
  for(let row=0;row<presets.length;row++)rows.push(presets[row].map((type,lane)=>({id:`${act}-${row}-${lane}`,row,lane,type,mana:row===7?42+act*2:28+Math.floor(random()*13)+act*2,rule:row===7?'Standard':pick(['Standard','Standard','Reverse Speed','Equal Opportunity','Explosive Weaponry','Silenced Summoners','Unprotected','Close Range','Keep Your Distance','Lost Magic','Broken Arrows'],random),modifier:row===7?null:random()<(act===0?.15:.4)?pick(Object.keys(MODIFIERS),random):null,seed:Math.floor(random()*1e8),attempt:0})));
  return rows;
}
export function createRun(mode='guest',seed=Date.now(),username=null){const random=rng(seed),elements=Object.keys(REALMS).filter(x=>x!=='Neutral');const realms=[];while(realms.length<3){const e=pick(elements,random);if(!realms.includes(e))realms.push(e);}
  return {version:1,mode,username,seed,realms,act:0,row:-1,lane:1,map:createMap(seed,0),visited:[],shards:0,tokens:3,rerolls:0,penalty:0,manaBoost:0,nextMana:0,inventory:[],grafts:{},active:null,status:'active',wins:0,battles:0,guardians:0,earned:0,started:Date.now()};
}
export function availableNodes(run){return run.map[run.row+1]?.filter(n=>run.row<0||n.type==='boss'||Math.abs(n.lane-run.lane)<=1)||[];}
export function rewardFor(node,run){const random=rng(node.seed+771);const [min,max]=node.type==='boss'?[40,55]:node.type==='elite'?[18,26]:node.type==='mystery'?[8,20]:[8,14];let base=min+Math.floor(random()*(max-min+1));if(node.modifier==='Bloodprice Shard')base*=2;const penalty=node.modifier==='Rift Surge'?Math.max(node.attempt?run.penalty:0,Math.min(.4,(run.rerolls+1)*.1)):node.attempt?run.penalty:0;const reduction=node.type==='boss'?Math.min(.2,penalty):penalty;return {base,penalty:reduction,shards:Math.floor(base*(1-reduction)),token:node.type==='boss'||(node.type==='elite'&&random()<.3),ability:node.type==='boss'?pick(['Void Armor','Divine Shield'],random):node.type==='elite'?pick(['Blast','Thorns','Sneak'],random):null};}
export function rerollNode(run){if(run.tokens<1)throw new Error('No Rift Tokens remain.');run.tokens--;run.rerolls++;run.penalty=Math.min(.4,run.rerolls*.1);const n=run.active;n.attempt++;n.seed+=10003;const random=rng(n.seed);n.rule=pick(['Standard','Reverse Speed','Equal Opportunity','Close Range','Unprotected','Explosive Weaponry'],random);n.mana=28+Math.floor(random()*13)+run.act*2+(n.type==='boss'?12:0)+(n.modifier==='Corrupted Mana'?n.attempt*2:0);run.map[n.row][n.lane]=n;return n;}
export function completeNode(run){const n=run.active;if(!n)throw new Error('No active node.');run.row=n.row;run.lane=n.lane;run.visited.push(n.id);run.active=null;}
export function nextAct(run){run.act++;run.row=-1;run.lane=1;run.map=createMap(run.seed,run.act);run.grafts=Object.fromEntries(Object.entries(run.grafts).filter(([,t])=>t.scope==='run'));run.inventory=run.inventory.filter(t=>t.scope!=='act'||t.act===run.act);}

export const battleMana=run=>run.active.mana+run.manaBoost+(run.nextMana||0)+(run.active.modifier==='Rift Surge'?5:0);
export function graftCard(run,card){const copy=structuredClone(card),graft=run?.grafts[card.id];if(graft){copy.abilities=[...new Set([...copy.abilities,graft.name])];if(graft.name==='Blast')copy.speed=Math.max(1,copy.speed-1);if(['Thorns','Void Armor'].includes(graft.name))copy.health=Math.max(1,copy.health-1);if(graft.name==='Heal')copy.mana++;}return copy;}
export function enemyFor(run,foundation,cards){
  const n=run.active,random=rng(n.seed+193),realm=REALMS[run.realms[run.act]],guardian=n.type==='boss';
  const byId=id=>cards.find(c=>c.id===id);
  const archon=guardian?byId(realm.archon):pick(foundation.filter(c=>c.type==='Summoner'),random);
  const pool=foundation.filter(c=>c.type==='Monster'&&(c.element===archon.element||c.element==='Neutral'||archon.element==='Dragon'&&c.element===run.realms[run.act]||archon.element==='Neutral'&&c.element==='Death'));
  const boss=guardian?byId(realm.boss):null,initial=boss&&eligible(boss,n.rule)?[boss]:[];
  const team=autoTeam(pool,archon,battleMana(run),n.rule,random,guardian?3+run.act:n.type==='elite'?4+Math.min(1,run.act):3+run.act,initial);
  if(guardian&&team.length>1&&initial[0]&&(boss.ranged&&!boss.attack&&!boss.magic&&!boss.abilities.includes('Close Range')||!boss.attack&&!boss.ranged&&!boss.magic))[team[0],team[1]]=[team[1],team[0]];
  return {archon,team};
}
export const mysteryOutcome=node=>pick(['shards','token','fight','shop','recruit'],rng(node.seed+555));
export function claimVictory(run){
  if(!run.active||!run.pending||run.pending.winner!=='friendly'||run.recruitment)return null;
  const boss=run.active.type==='boss',reward=rewardFor(run.active,run);
  run.shards+=reward.shards;run.earned+=reward.shards;run.wins++;
  if(reward.token)run.tokens++;
  if(reward.ability)run.inventory.push({name:reward.ability,scope:TOKENS[reward.ability].scope,act:boss?run.act+1:run.act});
  run.pending=null;run.draft=[];run.recruitment={kind:'reward',nodeId:run.active.id};run.screen='recruit';
  return reward;
}
export function finalizeRecruitment(run){
  if(!run.recruitment||run.recruitment.nodeId!==run.active?.id)return null;
  const boss=run.active.type==='boss',reward=run.recruitment.kind==='reward';
  completeNode(run);run.recruitment=null;run.pending=null;run.draft=[];
  let screen='map';if(boss&&reward){run.guardians++;screen=run.act===2?'victory':'intermission';}
  run.screen=screen;return screen;
}
export function campBoon(run,choice,intermission=false){
  if(!['token','mana','ability'].includes(choice))return false;
  if(intermission?run.screen!=='intermission':run.screen!=='camp'||run.active?.type!=='camp')return false;
  if(choice==='token')run.tokens++;
  if(choice==='mana')run.manaBoost+=2;
  if(choice==='ability')run.inventory.push({name:intermission?'Blast':'Sneak',scope:'battle'});
  if(intermission)nextAct(run);else completeNode(run);
  run.screen='map';return true;
}
export function suggestLineup(run,roster,enemy){
  const node=run.active,cap=battleMana(run),options=[];
  const enemyMagic=enemy.team.reduce((n,c)=>n+c.magic,0),enemyArmor=enemy.team.reduce((n,c)=>n+c.armor,0);
  for(const archon of roster.filter(c=>c.type==='Summoner'))for(const paired of ['Dragon','Neutral'].includes(archon.element)?['Fire','Water','Earth','Life','Death']:['Fire']){
    const units=roster.filter(c=>c.type==='Monster'&&(c.element==='Neutral'||c.element===archon.element||c.element===archon.secondary||['Dragon','Neutral'].includes(archon.element)&&c.element===paired)).map(c=>graftCard(run,c));
    const tanks=units.filter(c=>eligible(c,node.rule)&&c.mana+archon.mana<=cap).sort((a,b)=>(b.health+b.armor*.7+(b.attack?2:0))-(a.health+a.armor*.7+(a.attack?2:0))).slice(0,3);
    for(let variant=0;variant<=tanks.length;variant++){
      const team=draftTeam(units,archon,cap,node.rule,node.modifier,rng(node.seed+22+variant*71),variant?[tanks[variant-1]]:[]);
      if(validateTeam(team,archon,cap,node.rule,node.modifier,paired))continue;
      let score=0;
      team.forEach((c,i)=>{
        const melee=c.attack&&(i===0||c.abilities.some(a=>['Sneak','Opportunity'].includes(a))||node.rule==='Equal Opportunity'||i===1&&c.abilities.includes('Reach'))?c.attack:0;
        const ranged=i>0||node.rule==='Close Range'||c.abilities.includes('Close Range')?c.ranged:0;
        score+=(melee+ranged+c.magic)*2.5+c.health*.65+c.armor*(enemyMagic?0.15:.5)+c.speed*.1;
        if(c.magic&&enemyArmor)score+=c.magic*.5;
        if(c.abilities.includes('Heal'))score+=c.health*.4;
        if(c.abilities.includes('Tank Heal'))score+=(team[0]?.health||0)*.4;
        if(c.abilities.includes('Void')&&enemyMagic)score+=1.5;
        if(c.abilities.includes('Blast')||c.abilities.includes('Double Strike'))score+=(melee+ranged+c.magic)*1.5;
      });
      if(node.rule!=='Silenced Summoners'&&node.modifier!=='Rift Anomaly')score+=(archon.health||0)*team.length*.65+(archon.magic||0)*team.filter(c=>c.magic).length*2.5+(archon.attack||0)*team.filter(c=>c.attack).length*2.5+(archon.speed||0)*team.length*.2;
      options.push({archon,team,paired,score});
    }
  }
  // Uses visible stats and rules only; it does not simulate or inspect the battle outcome.
  return options.sort((a,b)=>b.score-a.score)[0]||null;
}
export function hasLegalLineup(run,roster,node){
  return !!suggestLineup({...run,active:node},roster,{team:[]});
}
