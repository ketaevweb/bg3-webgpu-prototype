/* ================= RENDER (Фаза 4a рефакторинга) =================
   Рендерер, сцена, камера, пост-эффекты, хало/партиклы/риг-анимация.
   Объекты создаются один раз при импорте модуля — безопасно, потому что
   engine.ts грузится динамическим import() на клиенте (GameClient, ssr:false)
   и к этому моменту HUD уже инжекнут. DOM-подключение canvas — только в
   initRenderer(), которую вызывает bootGame(). */
import * as THREE from 'three/webgpu';
import { pass, uv, vec3, vec4, mix, dot, length, smoothstep } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ParticleFX } from '../particles';
import { GlowFX } from '../glow';
import { SkyFX } from './sky';/* v2.9: небо/облака/амбиент */
import { AnimRigs, bindRigs } from '../animation';
import { UI } from '../hud';
import { $ } from '../utils';
import { G } from '../state';
import { isTouchDevice } from '../ui/mobile';/* v2.7: pixelRatio ниже на таче — батарея/производительность */

export const renderer=new THREE.WebGPURenderer({antialias:true});
export const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0c1510);
scene.fog=new THREE.FogExp2(0x0c1510,0.014);
/* v0.8: вся декорация карты — в worldGroup, чтобы сменять карту одним clear */
export const worldGroup=new THREE.Group();scene.add(worldGroup);
/* ==== v0.7: эффекты (партиклы / glow-хало / анимационные риги) ==== */
export const fx=new ParticleFX(scene);
export const glows=new GlowFX(scene);
export const sky=new SkyFX(scene);/* v2.9: купол/светило/облака/амбиент-частицы */
export const rigs=new AnimRigs();
bindRigs(rigs);/* v1.6: playAttack-фоллбек анимирует тот же экземпляр */
export const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,0.1,220);
camera.position.set(2,27,41);
export const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=0.08;
controls.maxPolarAngle=1.32; controls.minPolarAngle=0.15;
controls.minDistance=8; controls.maxDistance=62;
controls.target.set(1,0,12);

let inited=false;
/* инициализация рендерера — один раз на время жизни приложения (ремоут переиспользует синглтон) */
export async function ensureRendererInit(){
  if(inited)return;
  await renderer.init();
  inited=true;
}

/* DOM-подключение canvas — вызывается из bootGame() (HUD уже в DOM) */
export function initRenderer(){
  renderer.setSize(innerWidth,innerHeight);
  /* v2.7: на тач-устройствах пиксель-рейт capped на 1.5 — телефон не греется,
     Playwright-эмуляция мобилы тоже с тачем → тот же путь */
  renderer.setPixelRatio(Math.min(devicePixelRatio,isTouchDevice()?1.5:2));
  renderer.shadowMap.enabled=true;
  $(UI.scene).appendChild(renderer.domElement);
}

/* v0.8: атмосфера и свет — параметризованы по карте; v1.5: +болота; v2.9: +небо/цветокор */
export function applyAtmosphere(m:'forest'|'crypt'|'swamp'|'giants'|'citadel'){
  sky.setMap(m);/* v2.9: палитра неба + амбиент-частицы карты */
  if(m==='crypt'){scene.background=new THREE.Color(0x0a0a12);scene.fog=new THREE.FogExp2(0x0a0a12,0.018);}
  else if(m==='swamp'){scene.background=new THREE.Color(0x0e1410);scene.fog=new THREE.FogExp2(0x0e1410,0.019);}
  else if(m==='giants'){scene.background=new THREE.Color(0x121822);scene.fog=new THREE.FogExp2(0x121822,0.016);}/* v1.6: холодная синева высоты */
  else if(m==='citadel'){scene.background=new THREE.Color(0x0a1012);scene.fog=new THREE.FogExp2(0x0a1012,0.02);}/* v1.8: мертвенная изумрудная мгла */
  else{scene.background=new THREE.Color(0x0c1510);scene.fog=new THREE.FogExp2(0x0c1510,0.014);}
}
export function applyLighting(m:'forest'|'crypt'|'swamp'|'giants'|'citadel'){
  if(!G.hemiLight||!G.sunLight){
    const hemi=new THREE.HemisphereLight(0xbcd8e8,0x2a3325,0.85);
    const sun=new THREE.DirectionalLight(0xffeecf,2.4);
    sun.position.set(14,22,8);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left=-24;sun.shadow.camera.right=24;
    sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;
    sun.shadow.camera.near=1;sun.shadow.camera.far=60;
    scene.add(hemi,sun);
    G.hemiLight=hemi;G.sunLight=sun;
  }
  const hemi=G.hemiLight,sun=G.sunLight;/* синглтоны — установлены выше */
  if(m==='crypt'){/* v0.8: ночная крипта; v2.9: чуть светлее — читается */
    hemi.color.setHex(0x7c8ca4);hemi.groundColor.setHex(0x1a1826);hemi.intensity=0.8;
    sun.color.setHex(0x9fb4d8);sun.intensity=1.15;
  }else if(m==='swamp'){/* v1.5: мертвенно-зелёные сумерки; v3.0: Mud-тайл темнит — свет поднят */
    hemi.color.setHex(0x9ab88a);hemi.groundColor.setHex(0x1a2416);hemi.intensity=1.2;
    sun.color.setHex(0xcfe0a8);sun.intensity=2.5;
  }else if(m==='giants'){/* v1.6: холодный свет высокогорья; v2.9: читаемее */
    hemi.color.setHex(0xa8c0d8);hemi.groundColor.setHex(0x242a34);hemi.intensity=0.92;
    sun.color.setHex(0xd8e4f0);sun.intensity=2.0;
  }else if(m==='citadel'){/* v1.8: изумрудные сумерки Глубинного; v2.9: читаемее */
    hemi.color.setHex(0x8ab0a4);hemi.groundColor.setHex(0x141e1a);hemi.intensity=0.88;
    sun.color.setHex(0xb4d8c8);sun.intensity=1.55;
  }else{
    /* v2.9: солнечнее и светлее — «тёплый полдень тракта» вместо сумерек */
    hemi.color.setHex(0xbcd8e8);hemi.groundColor.setHex(0x2a3325);hemi.intensity=1.04;
    sun.color.setHex(0xffeecf);sun.intensity=2.9;
  }
}
export function clearGroup(g:THREE.Group){for(let i=g.children.length-1;i>=0;i--)g.remove(g.children[i]);}

/* v0.7.x: bloom-пасс (TSL, работает и на WebGL2-бэкенде); v2.9: +цветокор и
   виньетка по картам (сдвиг насыщенности/контраста/тона + затемнение краёв).
   Пересобирается при applyGfx/applyAtmosphere — композиция узлов зависит от
   рубильников G.bloomOn/G.gradeOn. При сбое — обычный рендер. */
export async function setupPostFX(){
  try{
    const scenePass=pass(scene,camera);
    const sceneColor=scenePass.getTextureNode();
    const bloomOn=!!G.bloomOn,gradeOn=!!G.gradeOn;
    if(!bloomOn&&!gradeOn){if(G.postFX){try{G.postFX.dispose();}catch{}}G.postFX=null;return;}
    const GRADE:Record<string,{sat:number;con:number;tint:[number,number,number];vig:number}>={
      forest:{sat:1.24,con:1.07,tint:[1.06,1.02,0.9],vig:0.26},
      crypt:{sat:0.85,con:1.1,tint:[0.92,0.96,1.14],vig:0.46},
      swamp:{sat:1.05,con:1.05,tint:[0.93,1.07,0.95],vig:0.4},
      giants:{sat:1.12,con:1.05,tint:[0.95,1.0,1.1],vig:0.3},
      citadel:{sat:1.1,con:1.08,tint:[0.9,1.08,1.0],vig:0.46},
    };
    let graded=sceneColor.rgb;
    if(gradeOn){
      const gm=GRADE[G.mapId]??{sat:1.12,con:1.05,tint:[1,1,1] as [number,number,number],vig:0.34};
      const lum=dot(graded,vec3(0.299,0.587,0.114));
      graded=mix(vec3(lum),graded,gm.sat);
      graded=graded.sub(0.5).mul(gm.con).add(0.5);
      graded=graded.mul(vec3(gm.tint[0],gm.tint[1],gm.tint[2]));
      const dist=length(uv().sub(0.5)).mul(1.42);
      const vig=smoothstep(0.42,1.05,dist).mul(gm.vig).oneMinus();
      graded=graded.mul(vig);
    }
    const gradedVec=vec4(graded,1);
    const bloomPass=bloom(sceneColor,0.45,0.55,0.82);
    if(G.postFX){try{G.postFX.dispose();}catch{}}
    G.postFX=new THREE.PostProcessing(renderer);
    G.postFX.outputNode=(bloomOn&&gradeOn)?gradedVec.add(bloomPass):(gradeOn?gradedVec:sceneColor.add(bloomPass));
    console.log('[bg3] postFX enabled (bloom:'+(bloomOn?'on':'off')+', grade:'+(gradeOn?'on':'off')+', map:'+G.mapId+')');
  }catch(e){
    console.warn('[bg3] postFX disabled:',e);G.postFX=null;
  }
}
