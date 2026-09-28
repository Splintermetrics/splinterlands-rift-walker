import {writeFile,mkdir} from 'node:fs/promises';
const response=await fetch('https://api.splinterlands.com/cards/get_details');if(!response.ok)throw new Error('Card API failed');
await mkdir('data',{recursive:true});await writeFile('data/cards.json',JSON.stringify(await response.json()));
const settings=await fetch('https://api.splinterlands.com/settings');if(!settings.ok)throw new Error('Settings API failed');await writeFile('data/settings.json',JSON.stringify(await settings.json()));
console.log('Public card snapshot refreshed. Foundation pool is derived at runtime from editions 15/16.');
