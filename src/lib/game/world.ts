import * as THREE from 'three/webgpu';

export interface World {
  group: THREE.Group;
  ground: THREE.Mesh;
  fireLight: THREE.PointLight;
  update(t: number): void;
}

/** Строит ночную лесную поляну: земля, деревья, камни, руины, костёр, светлячки, звёзды. */
export function buildWorld(scene: THREE.Scene): World {
  const group = new THREE.Group();
  scene.add(group);

  // --- Свет ---
  const hemi = new THREE.HemisphereLight(0x39442f, 0x1a130c, 0.9);
  const moon = new THREE.DirectionalLight(0xcfd8b8, 1.7);
  moon.position.set(-12, 18, -8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -22;
  moon.shadow.camera.right = 22;
  moon.shadow.camera.top = 22;
  moon.shadow.camera.bottom = -22;
  moon.shadow.camera.far = 60;
  moon.shadow.bias = -0.0004;
  scene.add(hemi, moon, moon.target);

  const fireLight = new THREE.PointLight(0xff8a3a, 24, 18, 1.7);
  fireLight.position.set(3.2, 1.4, -2.5);
  scene.add(fireLight);

  // --- Земля ---
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(34, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x31491f, roughness: 1 })
  );
  ground.receiveShadow = true;
  group.add(ground);

  // Пятна травы потемнее — лёгкая вариация
  const patchMat = new THREE.MeshBasicMaterial({
    color: 0x223314,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(1.5 + Math.random() * 3, 24).rotateX(-Math.PI / 2), patchMat);
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 12;
    p.position.set(Math.cos(a) * r, 0.015 + i * 0.002, Math.sin(a) * r);
    group.add(p);
  }

  // Тропа к гоблинскому лагерю
  const pathMat = new THREE.MeshBasicMaterial({ color: 0x6a5638, transparent: true, opacity: 0.4, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(1.1 + Math.random() * 0.5, 3.4).rotateX(-Math.PI / 2), pathMat);
    seg.position.set(Math.sin(i * 1.3) * 0.8, 0.02 + i * 0.002, 1.5 - i * 3.2);
    seg.rotation.y = Math.sin(i * 2.1) * 0.25;
    group.add(seg);
  }

  // --- Деревья ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3623, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e4020, roughness: 1 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x274d24, roughness: 1 });
  let planted = 0;
  let guard = 0;
  while (planted < 34 && guard++ < 400) {
    const a = Math.random() * Math.PI * 2;
    const r = 12.5 + Math.random() * 17;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x, z + 15) < 8) continue;       // гоблинский лагерь
    if (Math.hypot(x - 9, z + 13) < 5.5) continue; // руины
    if (Math.hypot(x - 3.2, z + 2.5) < 4) continue; // костёр
    const tree = new THREE.Group();
    const h = 2.2 + Math.random() * 1.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, h, 6), trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    const s = 1.2 + Math.random() * 0.9;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.25 * s, 2.6 * s, 7), Math.random() < 0.5 ? leafMat : leafMat2);
    c1.position.y = h + 1.1 * s;
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.85 * s, 1.9 * s, 7), leafMat);
    c2.position.y = h + 2.3 * s;
    c2.castShadow = true;
    tree.add(trunk, c1, c2);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    group.add(tree);
    planted++;
  }

  // --- Камни ---
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6d62, roughness: 0.95 });
  for (let i = 0; i < 12; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.75, 0), rockMat);
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 20;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x, z - 2) < 4 && Math.random() < 0.6) continue;
    rock.position.set(x, 0.18 + Math.random() * 0.15, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // --- Руины на севере (лагерь гоблинов) ---
  const ruinMat = new THREE.MeshStandardMaterial({ color: 0x77796c, roughness: 0.9 });
  const ruins = new THREE.Group();
  const pillarSpots: Array<[number, number, number, number]> = [
    [-2.6, 0, -1.4, 2.6], [-1.6, 0, 1.8, 1.3], [2.2, 0, -0.6, 2.9], [3.0, 0, 1.6, 1.1], [0.2, 0, 2.6, 0.8],
  ];
  for (const [px, , pz, ph] of pillarSpots) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.75, ph, 0.75), ruinMat);
    pillar.position.set(px, ph / 2, pz);
    pillar.rotation.y = Math.random() * 0.6 - 0.3;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    ruins.add(pillar);
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 1.2), ruinMat);
  slab.position.set(0.6, 0.2, 0.4);
  slab.rotation.set(0.06, 0.5, 0.03);
  slab.castShadow = true;
  slab.receiveShadow = true;
  ruins.add(slab);
  ruins.position.set(9, 0, -13);
  group.add(ruins);

  // --- Костёр ---
  const fireGroup = new THREE.Group();
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.15, 6), logMat);
    lg.rotation.z = Math.PI / 2.4;
    lg.rotation.y = (i * Math.PI * 2) / 3;
    lg.position.y = 0.12;
    fireGroup.add(lg);
  }
  const stoneRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.11, 6, 14).rotateX(Math.PI / 2), rockMat);
  stoneRing.position.y = 0.08;
  fireGroup.add(stoneRing);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.85, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.96 })
  );
  flame.position.y = 0.6;
  const glow = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.5, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0.9 })
  );
  glow.position.y = 0.55;
  fireGroup.add(flame, glow);
  fireGroup.position.set(3.2, 0, -2.5);
  group.add(fireGroup);

  // --- Светлячки ---
  const FIRE_N = 22;
  const positions = new Float32Array(FIRE_N * 3);
  const base = new Float32Array(FIRE_N * 3);
  for (let i = 0; i < FIRE_N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 11;
    base[i * 3] = Math.cos(a) * r;
    base[i * 3 + 1] = 0.6 + Math.random() * 1.8;
    base[i * 3 + 2] = Math.sin(a) * r;
  }
  positions.set(base);
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const flies = new THREE.Points(
    flyGeo,
    new THREE.PointsMaterial({
      color: 0xd6e878,
      size: 0.14,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    })
  );
  group.add(flies);

  // --- Звёзды и луна ---
  const STAR_N = 260;
  const starPos = new Float32Array(STAR_N * 3);
  for (let i = 0; i < STAR_N; i++) {
    const a = Math.random() * Math.PI * 2;
    const el = 0.15 + Math.random() * 1.35;
    const rr = 85;
    starPos[i * 3] = Math.cos(a) * Math.cos(el) * rr;
    starPos[i * 3 + 1] = Math.sin(el) * rr;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(el) * rr;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xc8d0c0, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false })
  );
  group.add(stars);

  const moonBall = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xe8e4c4, fog: false })
  );
  moonBall.position.set(-48, 42, -66);
  group.add(moonBall);

  // --- Анимация ---
  const update = (t: number) => {
    const s1 = Math.sin(t * 11);
    const s2 = Math.sin(t * 23 + 1);
    flame.scale.set(1 + s1 * 0.14, 1 + s2 * 0.24, 1 + s1 * 0.14);
    flame.rotation.y = t * 2.2;
    glow.scale.set(1 + s2 * 0.18, 1 + s1 * 0.3, 1 + s2 * 0.18);
    fireLight.intensity = 21 + s1 * 4 + s2 * 3 + Math.random() * 2;

    const attr = flies.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < FIRE_N; i++) {
      attr.setXYZ(
        i,
        base[i * 3] + Math.sin(t * 0.7 + i * 1.3) * 0.5,
        base[i * 3 + 1] + Math.sin(t * 1.2 + i * 1.7) * 0.3,
        base[i * 3 + 2] + Math.cos(t * 0.6 + i) * 0.5
      );
    }
    attr.needsUpdate = true;
  };

  return { group, ground, fireLight, update };
}
