const IMAGE_DIRECTORIES=['cards_v2.2','cards_beta','cards_v2.2','cards_beta','cards_untamed','cards_untamed','cards_gladiator','cards_chaos','cards_riftwatchers','cards_v2.2','cards_soulbound','cards_nightmare','cards_rebellion','cards_soulboundrb','cards_v2.2','cards_v2.2','cards_v2.2','cards_v2.2','cards_v2.2','cards_land','cards_v2.2','cards_land'];
export function imageURL(c){const edition=Number(c.editions.split(',')[0]);return `https://d36mxiodymuqjm.cloudfront.net/${IMAGE_DIRECTORIES[edition]||'cards_v2.2'}/${encodeURIComponent(c.name).replace(/'/g,'%27')}.jpg`;}

const ELEMENTS={Red:"Fire",Blue:"Water",Green:"Earth",White:"Life",Black:"Death",Gold:"Dragon",Gray:"Neutral"};
export function isBattleCard(card){
  if(!card||!['Monster','Summoner'].includes(card.type))return false;
  const values=key=>{const stat=card.stats?.[key];return (Array.isArray(stat)?stat:[stat]).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number).filter(Number.isFinite);};
  // Check the source stats before normalization can turn missing land-card stats into zeroes.
  return values('mana').some(v=>v>=0)&&(card.type==='Summoner'||values('health').some(v=>v>0));
}
export function sanitizeCollection(collection,battleIds){
  if(!collection)return collection;
  const cards=collection.cards.filter(c=>battleIds.has(Number(c.id)));
  return cards.length===collection.cards.length?collection:{...collection,cards};
}
export function sanitizeCollectionRun(run,battleIds){
  if(!run?.collectionSnapshot)return run;
  const collectionSnapshot=sanitizeCollection(run.collectionSnapshot,battleIds);
  if(collectionSnapshot===run.collectionSnapshot)return run;
  const ids=new Set(collectionSnapshot.cards.map(c=>Number(c.id)));
  const grafts={},inventory=[...(run.inventory||[])];
  for(const [id,token] of Object.entries(run.grafts||{})){
    if(ids.has(Number(id)))grafts[id]=token;
    else inventory.push(token);
  }
  return {...run,collectionSnapshot,draft:(run.draft||[]).filter(id=>ids.has(Number(id))),grafts,inventory};
}
export function normalize(d,level=1){const get=k=>Array.isArray(d.stats[k])?Number(d.stats[k][Math.min(level-1,d.stats[k].length-1)])||0:Number(d.stats[k])||0;const a=d.stats.abilities||[];const abilities=Array.isArray(a[0])?a.slice(0,level).flat():a.filter(x=>typeof x==='string');return {id:d.id,name:d.name,element:ELEMENTS[d.color]||'Neutral',secondary:ELEMENTS[d.secondary_color],type:d.type,rarity:d.rarity,level,mana:get('mana'),attack:get('attack'),ranged:get('ranged'),magic:get('magic'),health:get('health'),armor:get('armor'),speed:get('speed'),abilities:[...new Set(abilities)],editions:d.editions,subtype:d.sub_type};}
export function ownedLevel(owned,d,settings={}){if(owned.level)return Math.max(1,Number(owned.level));const edition=Number(owned.edition),gold=!!owned.gold||Number(owned.foil)>0;const modern=edition===4||d.tier>=4;const rates=[15,16].includes(edition)?settings[gold?'foundations_combine_rates_gold':'foundations_combine_rates']?.[d.rarity-1]:settings[d.tier===9?(gold?'sk_combine_rates_gold':'sk_combine_rates'):(gold?'combine_rates_gold':'combine_rates')]?.[d.rarity-1];if(modern&&Array.isArray(rates)){const bcx=Number(owned.xp||0);return Math.max(1,rates.filter(n=>n<=bcx).length);}const xp=settings.xp_levels?.[d.rarity-1];if(Array.isArray(xp))return 1+xp.filter(n=>n<=Number(owned.xp||0)).length;return 1;}
