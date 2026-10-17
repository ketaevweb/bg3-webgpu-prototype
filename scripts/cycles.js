#!/usr/bin/env node
/* Детектор циклов импортов в src/game (аналог dpdm --exit-warn-count).
   Строит граф по relative-imports, ищет SCC (Тарьян) и выводит циклы. */
const fs=require('fs'),path=require('path');
const ROOT='/home/z/my-project/src/game';
function walk(d,acc=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory())walk(p,acc);else if(/\.tsx?$/.test(e.name))acc.push(p);}return acc;}
const files=walk(ROOT);
const graph=new Map();
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  const deps=[];
  const re=/from\s+['"](\.[^'"]+)['"]/g;let m;
  while((m=re.exec(src))){
    let r=path.resolve(path.dirname(f),m[1]);
    if(fs.existsSync(r+'.ts'))r+='.ts';else if(fs.existsSync(r+'.tsx'))r+='.tsx';
    else if(fs.existsSync(r)&&fs.statSync(r).isDirectory()){
      if(fs.existsSync(r+'/index.ts'))r+='/index.ts';
    }
    if(fs.existsSync(r)&&r!==f)deps.push(r);
  }
  graph.set(f,deps);
}
/* Тарьян SCC */
const idx=new Map(),low=new Map(),on=new Set(),st=[],sccs=[];let cnt=0;
function strong(v){
  idx.set(v,cnt);low.set(v,cnt);cnt++;st.push(v);on.add(v);
  for(const w of graph.get(v)||[]){
    if(!idx.has(w)){strong(w);low.set(v,Math.min(low.get(v),low.get(w)));}
    else if(on.has(w))low.set(v,Math.min(low.get(v),idx.get(w)));
  }
  if(low.get(v)===idx.get(v)){const c=[];for(;;){const w=st.pop();on.delete(w);c.push(w);if(w===v)break;}if(c.length>1)sccs.push(c);}
}
for(const f of files)if(!idx.has(f))strong(f);
const rel=p=>p.replace(ROOT+'/','');
if(sccs.length===0){console.log('NO CYCLES');process.exit(0);}
console.log('CYCLES: '+sccs.length);
for(const c of sccs)console.log('  ['+c.map(rel).sort().join(' <-> ')+']');
process.exit(1);
