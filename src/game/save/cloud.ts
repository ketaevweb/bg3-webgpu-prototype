/* ================= CLOUD (v1.4 «Наставник дозора») =================
   Облачные скрижали — IndexedDB-зеркало трёх слотов сохранений.
   localStorage остаётся первичным хранилищем (синхронным, как в v1.1);
   облако — страховка от очистки браузера/приватного режима и способ
   подстраховки длинной кампании. Формат данных — тот же SaveData v2,
   БЕЗ изменений (REFACTORING.md §8: SAVE_VER не меняется).
   Все операции асинхронные, без исключений наружу: недоступность
   IndexedDB (приватный режим, квота) — не ошибка, просто false/null. */
import type { SaveData } from '../types';

const DB_NAME='bg3w_cloud',STORE='slots';
let dbp:Promise<IDBDatabase|null>|null=null;

function openDb():Promise<IDBDatabase|null>{
  if(dbp)return dbp;/* синглтон соединения (идемпотентно при ремоуте) */
  dbp=new Promise(res=>{
    try{
      const rq=indexedDB.open(DB_NAME,1);
      rq.onupgradeneeded=()=>{
        const db=rq.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
      };
      rq.onsuccess=()=>res(rq.result);
      rq.onerror=()=>res(null);
      rq.onblocked=()=>res(null);
    }catch{res(null);}
  });
  return dbp;
}

/* одна операция над стором; любой сбой → null (не бросает исключений) */
function tx<T>(mode:IDBTransactionMode,fn:(st:IDBObjectStore)=>IDBRequest):Promise<T|null>{
  return openDb().then(db=>{
    if(!db)return null;
    return new Promise<T|null>(res=>{
      try{
        const t=db.transaction(STORE,mode);
        const rq=fn(t.objectStore(STORE));
        rq.onsuccess=()=>res(rq.result as T);
        rq.onerror=()=>res(null);
        t.onabort=()=>res(null);
      }catch{res(null);}
    });
  });
}

export function cloudPut(i:number,sv:SaveData):Promise<boolean>{
  return tx<IDBValidKey>('readwrite',st=>st.put(sv,i)).then(v=>v!==null&&v!==undefined);
}
export function cloudGet(i:number):Promise<SaveData|null>{
  return tx<SaveData>('readonly',st=>st.get(i)).then(v=>v??null);
}
export function cloudDel(i:number):Promise<boolean>{
  return tx<undefined>('readwrite',st=>st.delete(i)).then(v=>v!==null);
}
