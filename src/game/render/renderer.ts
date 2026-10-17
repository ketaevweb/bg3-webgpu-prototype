/* ================= RENDER (Фаза 4a рефакторинга) =================
   Рендерер, сцена, камера, пост-эффекты, хало/партиклы/риг-анимация.
   Объекты создаются один раз при импорте модуля — безопасно, потому что
   engine.ts грузится динамическим import() на клиенте (GameClient, ssr:false)
   и к этому моменту HUD уже инжекнут. DOM-подключение canvas — только в
   initRenderer(), которую вызывает bootGame(). */
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ParticleFX } from '../particles';
import { GlowFX } from '../glow';
import { AnimRigs, bindRigs } from '../animation';
import { UI } from '../hud';
import { $ } from '../utils';
import { G } from '../state';

export const renderer=new THREE.WebGPURenderer({antialias:true});
export const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0c1510);
scene.fog=new THREE.FogExp2(0x0c1510,0.014);
/* v0.8: вся декорация карты — в worldGroup, чтобы сменять карту одним clear */
export const worldGroup=new THREE.Group();scene.add(worldGroup);
/* ==== v0.7: эффекты (партиклы / glow-хало / анимационные риги) ==== */
export const fx=new ParticleFX(scene);
export const glows=new GlowFX(scene);
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
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  $(UI.scene).appendChild(renderer.domElement);
}

/* v0.8: атмосфера и свет — параметризованы по карте; v1.5: +болота */
export function applyAtmosphere(m:'forest'|'crypt'|'swamp'|'giants'){
  if(m==='crypt'){scene.background=new THREE.Color(0x0a0a12);scene.fog=new THREE.FogExp2(0x0a0a12,0.018);}
  else if(m==='swamp'){scene.background=new THREE.Color(0x0e1410);scene.fog=new THREE.FogExp2(0x0e1410,0.019);}
  else if(m==='giants'){scene.background=new THREE.Color(0x121822);scene.fog=new THREE.FogExp2(0x121822,0.016);}/* v1.6: холодная синева высоты */
  else{scene.background=new THREE.Color(0x0c1510);scene.fog=new THREE.FogExp2(0x0c1510,0.014);}
}
export function applyLighting(m:'forest'|'crypt'|'swamp'|'giants'){
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
  if(m==='crypt'){
    hemi.color.setHex(0x7c8ca4);hemi.groundColor.setHex(0x1a1826);hemi.intensity=0.68;
    sun.color.setHex(0x9fb4d8);sun.intensity=1.05;
  }else if(m==='swamp'){/* v1.5: мертвенно-зелёные сумерки */
    hemi.color.setHex(0x9ab88a);hemi.groundColor.setHex(0x1a2416);hemi.intensity=0.72;
    sun.color.setHex(0xcfe0a8);sun.intensity=1.5;
  }else if(m==='giants'){/* v1.6: холодный свет высокогорья */
    hemi.color.setHex(0xa8c0d8);hemi.groundColor.setHex(0x242a34);hemi.intensity=0.78;
    sun.color.setHex(0xd8e4f0);sun.intensity=1.8;
  }else{
    hemi.color.setHex(0xbcd8e8);hemi.groundColor.setHex(0x2a3325);hemi.intensity=0.85;
    sun.color.setHex(0xffeecf);sun.intensity=2.4;
  }
}
export function clearGroup(g:THREE.Group){for(let i=g.children.length-1;i>=0;i--)g.remove(g.children[i]);}

/* v0.7.x: bloom-пасс (TSL, работает и на WebGL2-бэкенде); при сбое — обычный рендер */
export async function setupPostFX(){
  try{
    const scenePass=pass(scene,camera);
    const sceneColor=scenePass.getTextureNode();
    const bloomPass=bloom(sceneColor,0.45,0.55,0.82);
    G.postFX=new THREE.PostProcessing(renderer);
    G.postFX.outputNode=sceneColor.add(bloomPass);
    console.log('[bg3] bloom enabled (TSL PostProcessing)');
  }catch(e){
    console.warn('[bg3] bloom disabled:',e);G.postFX=null;
  }
}
