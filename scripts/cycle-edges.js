#!/usr/bin/env node
/* Печать рёбер графа импортов внутри SCC + список «замыкающих» рёбер. */
const fs=require('fs'),path=require('path');
const ROOT='/home/z/my-project/src/game';
function walk(d,acc=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory())walk(p,acc);else if(/\.tsx?$/.test(e.name))acc.push(p);}return acc;}
const files=walk(ROOT);
const graph=new Map(),lines=new Map();
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  const deps=[];const re=/from\s+['"](\.[^'"]+)['"]/g;let m;
  while((m=re.exec(src))){
    let r=path.resolve(path.dirname(f),m[1]);
    if(fs.existsSync(r+'.ts'))r+='.ts';else if(fs.existsSync(r+'.tsx'))r+='.tsx';
    if(fs.existsSync(r)&&r!==f){deps.push(r);lines.set(f+'>'+r,m[1]);}
  }
  graph.set(f,deps);
}
const rel=p=>p.replace(ROOT+'/','');
/* все пути-циклы из каждого узла в самого себя (BFS, лимит) */
const cycleEdges=new Set();
for(const start of files){
  const prev=new Map([[start,null]]);
  const q=[start];
  while(q.length){
    const v=q.shift();
    for(const w of graph.get(v)||[]){
      if(w===start){/* найден цикл: восстановить путь, пометить все рёбра */
        let cur=v;const pathE=[];
        while(cur!==null){const nxt=prev.get(cur);if(nxt)pathE.push([nxt,cur]);cur=nxt;}
        for(const [a,b] of pathE)cycleEdges.add(a+'>'+b);
        continue;
      }
      if(!prev.has(w)){prev.set(w,v);q.push(w);}
    }
  }
}
console.log('=== РЁБРА, УЧАСТВУЮЩИЕ ХОТЯ БЫ В ОДНОМ ЦИКЛЕ ===');
for(const f of files){
  for(const d of graph.get(f)||[]){
    if(cycleEdges.has(f+'>'+d))console.log(rel(f)+'  ->  '+rel(d)+'   ("'+lines.get(f+'>'+d)+'")');
  }
}
