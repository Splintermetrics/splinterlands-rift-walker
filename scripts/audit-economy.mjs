import {writeFileSync} from 'node:fs';
import {playExpedition} from './audit-expeditions.mjs';

const results={};
for(const roster of ['suggested','earth','life','fire']){
  results[roster]={};
  for(const policy of ['skip','recruits','supplies','usual']){
    const runs=Array.from({length:60},(_,i)=>playExpedition({seed:(i+1)*7919,roster,route:'merchant',strategy:'suggest',shopPolicy:policy}));
    results[roster][policy]={victories:runs.filter(r=>r.status==='victory').length,guardians:runs.reduce((n,r)=>n+r.guardians,0),purchases:runs.reduce((n,r)=>n+r.purchases.length,0),shardsLeft:runs.reduce((n,r)=>n+r.shards,0)};
  }
}
writeFileSync(new URL('../docs/testing/economy.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
