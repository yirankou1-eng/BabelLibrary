const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const files=['index.html','multiplayer.html','style.css','atelier.css','data.js','rules.js','idle.js','explore.js','battle-engine.js','combat.js','collection.js','ui.js','card-enemy.jpg','dice-enemy.jpg'];
for(const f of files.filter(f=>f.endsWith('.js')))cp.execFileSync(process.execPath,['--check',f]);
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist',{recursive:true});for(const f of files)fs.copyFileSync(f,path.join('dist',f));fs.cpSync('assets','dist/assets',{recursive:true});
const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const asset=match[1];if(!asset.includes('://')&&!fs.existsSync(path.join('dist',asset)))throw Error('Missing asset: '+asset);}
console.log('Static production build verified: dist/');
