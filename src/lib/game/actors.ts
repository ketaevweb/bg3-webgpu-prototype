import * as THREE from 'three/webgpu';
import type { ActorStats, StatusState } from './types';

export interface Actor {
  id: string;
  def: ActorStats;
  hp: number;
  mesh: THREE.Group;
  hitbox: THREE.Mesh;
  barGroup: THREE.Group | null;
  barFill: THREE.Mesh | null;
  nameSprite: THREE.Sprite | null;
  alive: boolean;
  moveTarget: THREE.Vector3 | null;
  /** Путь по сетке A* (v0.4): промежуточные точки, последняя совпадает с moveTarget. */
  path: THREE.Vector3[] | null;
  lastTileKey: number;
  bashCd: number;
  disengaged: boolean;
  pendingAttackId: string | null;
  movementLeft: number;
  actionAvailable: boolean;
  bonusAvailable: boolean;
  reactionAvailable: boolean;
  statuses: StatusState[];
  statusSprite: THREE.Sprite | null;
  threatZones: Set<string> | null;
  initiative: number;
  attackT: number;
  walk: number;
  fall: number;
  fallDir: number;
}

/** Спрайт с текстом (имена, всплывающий урон). */
export function makeTextSprite(text: string, color: string, width = 1.7): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 56px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, 256, 68);
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(width, width / 4, 1);
  return spr;
}

export function updateBar(a: Actor): void {
  if (!a.barFill) return;
  const ratio = Math.max(0.001, a.hp / a.def.maxHp);
  a.barFill.scale.x = ratio;
}

/** Собирает меш персонажа: тело, голова, оружие/шляпа, хитбокс, полоска HP, имя. */
export function createActor(def: ActorStats, pos: THREE.Vector3): Actor {
  const g = new THREE.Group();
  const isGob = def.mode === 'foe';
  const scale = isGob ? 0.92 : 1;

  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.82 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, isGob ? 0.42 : 0.55, 4, 12), bodyMat);
  body.position.y = isGob ? 0.64 : 0.78;
  body.castShadow = true;
  const skinMat = new THREE.MeshStandardMaterial({
    color: isGob ? 0x7da05a : 0xd9b38c,
    roughness: 0.9,
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(isGob ? 0.24 : 0.21, 14, 12), skinMat);
  head.position.y = isGob ? 1.26 : 1.42;
  head.castShadow = true;
  g.add(body, head);

  if (def.id === 'liara') {
    // Волшебница: остроконечная шляпа и посох со светящимся навершием
    const hatMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.72), roughness: 0.85 });
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.55, 10), hatMat);
    hat.position.y = 1.76;
    hat.castShadow = true;
    g.add(hat);
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 1.55, 7),
      new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 })
    );
    staff.position.set(-0.42, 0.78, 0);
    staff.castShadow = true;
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffb84d, emissive: 0xff9a3d, emissiveIntensity: 2.6 })
    );
    tip.position.set(-0.42, 1.6, 0);
    g.add(staff, tip);
  }

  if (def.id === 'cardan') {
    // Воин: меч и деревянные ножны
    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.95, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.85, roughness: 0.3 })
    );
    sword.position.set(0.44, 0.82, 0.05);
    sword.rotation.z = -0.18;
    sword.castShadow = true;
    const hilt = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.06, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8 })
    );
    hilt.position.set(0.4, 0.34, 0.05);
    g.add(sword, hilt);
  }

  if (isGob) {
    // Гоблин: уши, красные глаза, ржавый клинок
    const earGeo = new THREE.ConeGeometry(0.07, 0.3, 6);
    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.34, 1.28, 0);
    const earR = new THREE.Mesh(earGeo, skinMat);
    earR.rotation.z = -Math.PI / 2;
    earR.position.set(0.34, 1.28, 0);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3820, emissiveIntensity: 2.8 });
    const eyeGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.09, 1.3, 0.19);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.09, 1.3, 0.19);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5a, metalness: 0.5, roughness: 0.6 })
    );
    blade.position.set(0.4, 0.72, 0.05);
    blade.rotation.z = -0.3;
    g.add(earL, earR, eyeL, eyeR, blade);
  }

  if (def.mode === 'neutral') {
    // Странник: капюшон и посох-фонарь
    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.42, 9),
      new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 0.95 })
    );
    hood.position.y = 1.6;
    hood.castShadow = true;
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3c28, roughness: 1 })
    );
    stick.position.set(-0.4, 0.75, 0.1);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd88a, emissive: 0xffb04d, emissiveIntensity: 2.2 })
    );
    lamp.position.set(-0.4, 1.52, 0.1);
    g.add(hood, stick, lamp);
  }

  // Хитбокс для рейкаста (прозрачный, но ловит клики)
  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 2.3, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitbox.position.y = 1.1;
  hitbox.userData.actorId = def.id;
  g.add(hitbox);

  // Полоска HP (не для нейтралов)
  let barGroup: THREE.Group | null = null;
  let barFill: THREE.Mesh | null = null;
  if (def.mode !== 'neutral') {
    barGroup = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.94, 0.13),
      new THREE.MeshBasicMaterial({ color: 0x140808, transparent: true, opacity: 0.85, depthWrite: false })
    );
    barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 0.08).translate(0.44, 0, 0.002),
      new THREE.MeshBasicMaterial({
        color: def.mode === 'ally' ? 0x46b05e : 0xc0392b,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    barFill.position.x = -0.44;
    barGroup.add(bg, barFill);
    barGroup.position.y = 2.02;
    g.add(barGroup);
  }

  const nameColor = def.mode === 'ally' ? '#ffe3a0' : def.mode === 'foe' ? '#ffb3a3' : '#d8cfa8';
  const nameSprite = makeTextSprite(def.name, nameColor, def.mode === 'foe' ? 1.35 : 1.6);
  nameSprite.position.y = barGroup ? 2.42 : 2.3;
  g.add(nameSprite);

  g.scale.setScalar(scale);
  g.position.copy(pos);

  return {
    id: def.id,
    def,
    hp: def.hp,
    mesh: g,
    hitbox,
    barGroup,
    barFill,
    nameSprite,
    alive: true,
    moveTarget: null,
    path: null,
    lastTileKey: -1,
    bashCd: 0,
    disengaged: false,
    pendingAttackId: null,
    movementLeft: def.speed,
    actionAvailable: true,
    bonusAvailable: true,
    reactionAvailable: true,
    statuses: [],
    statusSprite: null,
    threatZones: null,
    initiative: 0,
    attackT: 0,
    walk: 0,
    fall: 0,
    fallDir: 1,
  };
}
