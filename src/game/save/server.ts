/* ================= SERVER TABLETS (v1.5 «Болота культистов») =================
   Серверные скрижали — клиентская сторона зеркала сейвов на сервере
   (/api/tablets → Prisma/SQLite, модель Tablet). IndexedDB-облако (v1.4)
   страхует от очистки браузера, серверная скрижаль — от смены машины:
   кампания переживает переезд на другой компьютер. Формат данных — тот же
   SaveData v2, БЕЗ изменений. Все операции асинхронные и без исключений
   наружу: недоступность сервера (оффлайн, 500) — не ошибка, false/null. */
import type { SaveData } from '../types';

const API='/api/tablets';

export async function serverPut(i:number,sv:SaveData):Promise<boolean>{
  try{
    const r=await fetch(API,{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({slot:i,when:sv.when,data:JSON.stringify(sv)})});
    return r.ok;
  }catch{return false;}
}
export async function serverGet(i:number):Promise<SaveData|null>{
  try{
    const r=await fetch(API+'?slot='+i);
    if(!r.ok)return null;
    const j=(await r.json()) as {slot:number;when:number;data:string}|null;
    if(!j||typeof j.data!=='string')return null;
    const sv=JSON.parse(j.data) as SaveData;
    if(!sv||sv.v!==2||!Array.isArray(sv.heroes))return null;
    return sv;
  }catch{return null;}
}
export async function serverList():Promise<{slot:number;when:number}[]>{
  try{
    const r=await fetch(API);
    if(!r.ok)return [];
    const j=(await r.json()) as {slot:number;when:number}[];
    return Array.isArray(j)?j:[];
  }catch{return [];}
}
export async function serverDel(i:number):Promise<boolean>{
  try{
    const r=await fetch(API+'?slot='+i,{method:'DELETE'});
    return r.ok;
  }catch{return false;}
}
