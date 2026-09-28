import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize,ownedLevel,imageURL,isBattleCard,sanitizeCollection,sanitizeCollectionRun} from '../data.js';
test('normalization takes the exact level stats and cumulative ability unlocks',()=>{const card={id:1,name:'Test',color:'Green',type:'Monster',rarity:2,editions:'15,16',stats:{mana:[4,4,4],attack:[1,2,3],health:[3,4,5],speed:[1,2,3],abilities:[['Reach'],[],['Thorns']]}};const c=normalize(card,3);assert.equal(c.attack,3);assert.equal(c.health,5);assert.deepEqual(c.abilities,['Reach','Thorns']);assert.equal(c.element,'Earth');assert.deepEqual(card.stats.attack,[1,2,3]);});
test('Archon stats are scalars and flat ability lists',()=>{const c=normalize({id:1,name:'Test',color:'Red',type:'Summoner',rarity:4,editions:'4',stats:{mana:7,health:1,ranged:1,abilities:['Blast']}},2);assert.equal(c.mana,7);assert.equal(c.ranged,1);assert.deepEqual(c.abilities,['Blast']);});
test('reported collection level is preferred to BCX calculations',()=>{assert.equal(ownedLevel({level:4,xp:1,edition:15},{rarity:1}),4);});
test('Foundation and legacy reward cards select their proper combine tables',()=>{const settings={foundations_combine_rates:[[1,5,14,30,60]],combine_rates:[[1,5,14,30,60]],sk_combine_rates:[[1,3,9]]};assert.equal(ownedLevel({xp:14,edition:15},{rarity:1,tier:15},settings),3);assert.equal(ownedLevel({xp:30,edition:3},{rarity:1,tier:4},settings),4);assert.equal(ownedLevel({xp:9,edition:3},{rarity:1,tier:9},settings),3);});
test('old card artwork resolves to edition-specific official folders',()=>{assert.match(imageURL({name:'Yodin Zaku',editions:'4'}),/cards_untamed\/Yodin%20Zaku.jpg$/);assert.match(imageURL({name:'Death Ranger',editions:'13'}),/cards_soulboundrb\/Death%20Ranger.jpg$/);});

test('land-only cards are excluded while zero-attack and zero-mana battle units remain',()=>{
  assert.equal(isBattleCard({type:'Monster',stats:{land_abilities:[['Farmhand']]}}),false);
  assert.equal(isBattleCard({type:'Monster',stats:{mana:[0],health:[1],attack:[0],ranged:[0],magic:[0]}}),true);
  assert.equal(isBattleCard({type:'Monster',editions:'19',stats:{land_abilities:['Farmhand'],mana:[2],health:[4]}}),true);
  assert.equal(isBattleCard({type:'Summoner',stats:{mana:3,health:0,attack:0,abilities:[]}}),true);
});

test('missing and malformed battle stats are not treated as zero-mana units',()=>{
  for(const card of [null,{type:'Monster'},{type:'Monster',stats:{mana:null,health:2}},{type:'Monster',stats:{mana:[],health:[2]}},{type:'Monster',stats:{mana:['bad'],health:[2]}},{type:'Monster',stats:{mana:[0],health:[0]}},{type:'Summoner',stats:{land_abilities:['Farmhand']}}])assert.equal(isBattleCard(card),false);
});

test('official snapshot excludes land-only definitions and retains every Foundation card',()=>{
  const details=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url),'utf8'));
  const landOnly=details.filter(d=>d.stats?.land_abilities&&!Object.hasOwn(d.stats,'mana'));
  assert.ok(landOnly.length>0);
  assert.ok(landOnly.some(d=>d.editions.split(',').includes('19')));
  assert.ok(landOnly.some(d=>d.editions.split(',').includes('21')));
  assert.ok(landOnly.every(d=>!isBattleCard(d)));
  const foundation=details.filter(d=>d.editions.split(',').some(e=>['15','16'].includes(e)));
  assert.equal(foundation.length,55);
  assert.ok(foundation.every(isBattleCard));
});

test('saved collections are cleaned by current definitions without changing metadata or levels',()=>{
  const collection={username:'player',loaded:123,cards:[{id:1,level:4},{id:866,level:1},{id:2,level:2}]};
  const result=sanitizeCollection(collection,new Set([1,2]));
  assert.deepEqual(result,{username:'player',loaded:123,cards:[{id:1,level:4},{id:2,level:2}]});
  assert.equal(collection.cards.length,3);
  assert.equal(sanitizeCollection(result,new Set([1,2])),result);
  assert.equal(sanitizeCollection(null,new Set()),null);
});

test('saved collection runs drop land units and refund their grafts without changing progress',()=>{
  const landToken={name:'Heal',scope:'run'},unitToken={name:'Sneak',scope:'battle'};
  const run={mode:'collection',act:1,tokens:3,shards:90,draft:[866,1],collectionSnapshot:{username:'player',cards:[{id:866},{id:1}]},grafts:{866:landToken,1:unitToken},inventory:[],pending:{winner:'friendly'}};
  const result=sanitizeCollectionRun(run,new Set([1]));
  assert.deepEqual(result.draft,[1]);
  assert.deepEqual(result.collectionSnapshot.cards,[{id:1}]);
  assert.deepEqual(result.grafts,{1:unitToken});
  assert.deepEqual(result.inventory,[landToken]);
  assert.equal(result.act,1);assert.equal(result.shards,90);assert.equal(result.tokens,3);assert.equal(result.pending,run.pending);
  assert.equal(run.collectionSnapshot.cards.length,2);assert.deepEqual(run.inventory,[]);
  assert.equal(sanitizeCollectionRun(result,new Set([1])),result);
  assert.equal(sanitizeCollectionRun({mode:'guest'},new Set()).mode,'guest');
  assert.equal(sanitizeCollectionRun(null,new Set()),null);
});
