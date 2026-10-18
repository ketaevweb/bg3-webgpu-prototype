/* ================= SERVER LEADERBOARD (v2.3 «Тень отряда») =================
   Клиентская сторона лидерборда глубины (/api/scores → Prisma/SQLite,
   модель Score). При каждом улучшении рекорда арены (S.arenaBest) игра
   постит запись «имя капитана + глубина»; у стелы рекордов читается
   топ-10 «летописи Глубин». Все операции асинхронные и без исключений
   наружу: недоступность сервера — не ошибка (false/[]). */
const API='/api/scores';

export interface ScoreRow{name:string;best:number;when:number;}

export async function postScore(name:string,best:number):Promise<boolean>{
  try{
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,best})});
    return r.ok;
  }catch{return false;}
}
export async function topScores():Promise<ScoreRow[]>{
  try{
    const r=await fetch(API);
    if(!r.ok)return [];
    const j=(await r.json()) as ScoreRow[];
    return Array.isArray(j)?j.filter(s=>s&&typeof s.name==='string'&&typeof s.best==='number'):[];
  }catch{return [];}
}
