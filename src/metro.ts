import * as THREE from 'three';

export interface CollisionBox {
  id: string;
  tag: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface World {
  add(b: CollisionBox): void;
  remove(id: string): void;
}

export interface Hotspot {
  id: string;
  verb: 'Examine' | 'Read' | 'Collect' | 'Talk' | 'Enter';
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export function makeNeonTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#08080c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.font = 'bold 52px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowBlur = 24;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeConcreteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      const v = 30 + Math.floor(Math.random() * 25);
      ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    ctx.fillStyle = 'rgba(10, 12, 15, 0.35)';
    for (let i = 0; i < 12; i++) {
      ctx.fillRect(Math.random() * 256, 0, 2 + Math.random() * 6, 256);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  return tex;
}

function makePortalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
    grad.addColorStop(0.0, '#ffffff');
    grad.addColorStop(0.25, '#ff2d8a');
    grad.addColorStop(0.6, '#2de2ff');
    grad.addColorStop(1.0, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface FlickerLight {
  light: THREE.PointLight;
  baseIntensity: number;
  phase: number;
  speed: number;
}

/**
 * Zone 2 — the Neon Underpass. Replaces the north boulevard barrier once the
 * player holds two fragments. Wet concrete, magenta/cyan practicals, a hacker
 * den, and the Heart portal at the far end.
 */
export class Metro {
  hotspots: Hotspot[] = [];

  private readonly world: World;
  private readonly root: THREE.Group;
  private readonly gateGroup: THREE.Group;
  private isLocked = false;
  private readonly flickerLights: FlickerLight[] = [];
  private portalMesh!: THREE.Mesh;
  private portalInnerMesh!: THREE.Mesh;
  private monitorLight!: THREE.PointLight;

  constructor(scene: THREE.Scene, world: World) {
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = 'Zone2_NeonUnderpass';
    this.gateGroup = new THREE.Group();
    this.gateGroup.name = 'MetroGate';

    this.buildTunnel();
    this.buildNeonSignageAndLights();
    this.buildHackerDen();
    this.buildPortal();
    this.buildGate();
    this.setupInitialHotspots();

    this.root.add(this.gateGroup);
    scene.add(this.root);
  }

  /** Register collision. Call once at startup. */
  lock(): void {
    if (this.isLocked) return;
    this.isLocked = true;

    this.world.add({
      id: 'metro-floor',
      tag: 'ground',
      minX: -4.4,
      maxX: 4.4,
      minY: -0.06,
      maxY: 0.02,
      minZ: -56.5,
      maxZ: -32.4,
    });
    this.world.add({ id: 'metro-wall-west', tag: 'static', minX: -4.4, maxX: -4.0, minY: 0, maxY: 3.2, minZ: -56.5, maxZ: -32.5 });
    this.world.add({ id: 'metro-wall-east', tag: 'static', minX: 4.0, maxX: 4.4, minY: 0, maxY: 3.2, minZ: -56.5, maxZ: -32.5 });
    this.world.add({ id: 'metro-wall-north', tag: 'static', minX: -4.4, maxX: 4.4, minY: 0, maxY: 3.2, minZ: -56.5, maxZ: -56.0 });
    // Wings seal the boulevard end around the 8m tunnel mouth.
    this.world.add({ id: 'metro-wing-west', tag: 'static', minX: -11.0, maxX: -4.0, minY: 0, maxY: 3.2, minZ: -33.0, maxZ: -32.2 });
    this.world.add({ id: 'metro-wing-east', tag: 'static', minX: 4.0, maxX: 11.0, minY: 0, maxY: 3.2, minZ: -33.0, maxZ: -32.2 });
    this.world.add({ id: 'metro-hacker-table', tag: 'static', minX: -3.85, maxX: -2.4, minY: 0, maxY: 1.4, minZ: -45.0, maxZ: -43.0 });
    this.world.add({ id: 'metro-gate', tag: 'static', minX: -4.0, maxX: 4.0, minY: 0, maxY: 3.2, minZ: -32.7, maxZ: -32.3 });
  }

  /** Two fragments collected — the gate loses power and the underpass opens. */
  open(): void {
    this.gateGroup.visible = false;
    this.world.remove('metro-gate');
    if (!this.hotspots.some((h) => h.id === 'metro-entrance')) {
      this.hotspots.push({
        id: 'metro-entrance',
        verb: 'Enter',
        name: 'Neon Underpass',
        minX: -3.5,
        maxX: 3.5,
        minY: 0,
        maxY: 2.8,
        minZ: -34.0,
        maxZ: -32.0,
      });
    }
  }

  update(dt: number, time: number): void {
    void dt;
    for (const fl of this.flickerLights) {
      const wave =
        Math.sin(time * fl.speed + fl.phase) * 0.15 +
        Math.sin(time * fl.speed * 3.7 + fl.phase * 2.1) * 0.1;
      const drop = Math.sin(time * 19.3 + fl.phase * 5.0) > 0.92 ? 0.25 : 1.0;
      fl.light.intensity = Math.max(0.1, (fl.baseIntensity + wave) * drop);
    }
    if (this.monitorLight) {
      this.monitorLight.intensity = 0.7 + Math.sin(time * 11.0) * 0.08;
    }
    if (this.portalMesh && this.portalInnerMesh) {
      const s1 = 1.0 + Math.sin(time * 2.6) * 0.07;
      const s2 = 1.0 + Math.cos(time * 3.8) * 0.11;
      this.portalMesh.scale.set(s1, s1, 1);
      this.portalInnerMesh.scale.set(s2, s2, 1);
      this.portalInnerMesh.rotation.z = time * 0.45;
    }
  }

  private buildTunnel(): void {
    const concreteTex = makeConcreteTexture();
    const wallMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.85, metalness: 0.1 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.35, metalness: 0.25 });
    const puddleMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.06, metalness: 0.85 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 24.0), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, -44.5);
    this.root.add(floor);

    const puddleDefs: Array<[number, number, number, number]> = [
      [-1.4, -36.2, 2.2, 3.1],
      [1.6, -40.8, 1.9, 2.6],
      [-0.5, -45.5, 2.8, 3.4],
      [1.2, -50.2, 2.1, 2.9],
      [-1.1, -53.8, 2.5, 2.2],
    ];
    for (const [px, pz, pw, pd] of puddleDefs) {
      const puddle = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(px, 0.018, pz);
      this.root.add(puddle);
    }

    const ceil = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.3, 24.0), wallMat);
    ceil.position.set(0, 3.35, -44.5);
    this.root.add(ceil);

    const wallGeo = new THREE.BoxGeometry(0.4, 3.2, 24.0);
    const westWall = new THREE.Mesh(wallGeo, wallMat);
    westWall.position.set(-4.2, 1.6, -44.5);
    this.root.add(westWall);
    const eastWall = new THREE.Mesh(wallGeo, wallMat);
    eastWall.position.set(4.2, 1.6, -44.5);
    this.root.add(eastWall);

    const endWall = new THREE.Mesh(new THREE.BoxGeometry(8.8, 3.2, 0.4), wallMat);
    endWall.position.set(0, 1.6, -56.2);
    this.root.add(endWall);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222327, roughness: 0.8, metalness: 0.2 });
    const pillarGeo = new THREE.BoxGeometry(0.25, 3.2, 0.35);
    for (let z = -35; z >= -55; z -= 5) {
      const pL = new THREE.Mesh(pillarGeo, pillarMat);
      pL.position.set(-3.9, 1.6, z);
      this.root.add(pL);
      const pR = new THREE.Mesh(pillarGeo, pillarMat);
      pR.position.set(3.9, 1.6, z);
      this.root.add(pR);
    }

    const wingGeo = new THREE.BoxGeometry(7.0, 3.2, 0.4);
    const westWing = new THREE.Mesh(wingGeo, wallMat);
    westWing.position.set(-7.5, 1.6, -32.5);
    this.root.add(westWing);
    const eastWing = new THREE.Mesh(wingGeo, wallMat);
    eastWing.position.set(7.5, 1.6, -32.5);
    this.root.add(eastWing);
  }

  private buildNeonSignageAndLights(): void {
    const signConfigs: Array<{
      text: string;
      color: string;
      hex: number;
      x: number;
      y: number;
      z: number;
      rotY: number;
      lightX: number;
    }> = [
      { text: '夜想曲 BAR', color: '#ff2d8a', hex: 0xff2d8a, x: -3.96, y: 2.15, z: -36.5, rotY: Math.PI / 2, lightX: -3.2 },
      { text: 'サイバー酒場', color: '#2de2ff', hex: 0x2de2ff, x: 3.96, y: 2.15, z: -41.5, rotY: -Math.PI / 2, lightX: 3.2 },
      { text: '電脳スナック', color: '#ff2d8a', hex: 0xff2d8a, x: -3.96, y: 2.15, z: -47.5, rotY: Math.PI / 2, lightX: -3.2 },
      { text: '深淵クラブ', color: '#2de2ff', hex: 0x2de2ff, x: 3.96, y: 2.15, z: -52.5, rotY: -Math.PI / 2, lightX: 3.2 },
    ];

    const signGeo = new THREE.PlaneGeometry(2.4, 0.6);
    const backingGeo = new THREE.BoxGeometry(2.46, 0.66, 0.05);
    const backingMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.6, metalness: 0.7 });

    signConfigs.forEach((cfg, idx) => {
      const tex = makeNeonTexture(cfg.text, cfg.color);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color(cfg.hex),
        emissiveMap: tex,
        emissiveIntensity: 1.8,
        roughness: 0.25,
        metalness: 0.1,
      });

      const signGroup = new THREE.Group();
      signGroup.position.set(cfg.x, cfg.y, cfg.z);
      signGroup.rotation.y = cfg.rotY;

      const backing = new THREE.Mesh(backingGeo, backingMat);
      backing.position.z = -0.03;
      signGroup.add(backing);
      signGroup.add(new THREE.Mesh(signGeo, mat));
      this.root.add(signGroup);

      const light = new THREE.PointLight(cfg.hex, 2.2, 11.0, 1.6);
      light.castShadow = false;
      light.position.set(cfg.lightX, 2.3, cfg.z);
      this.root.add(light);

      this.flickerLights.push({ light, baseIntensity: 2.2, phase: idx * 1.7 + 0.5, speed: 6.0 + idx * 1.9 });
    });
  }

  private buildHackerDen(): void {
    const denGroup = new THREE.Group();
    denGroup.position.set(-3.1, 0, -44.0);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.5, metalness: 0.75 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x261d18, roughness: 0.75, metalness: 0.1 });
    const boxMatA = new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.65, metalness: 0.35 });
    const boxMatB = new THREE.MeshStandardMaterial({ color: 0x382b35, roughness: 0.7, metalness: 0.25 });

    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.8), darkWoodMat);
    topMesh.position.set(0, 0.75, 0);
    denGroup.add(topMesh);

    const legGeo = new THREE.BoxGeometry(0.06, 0.75, 0.06);
    for (const [lx, lz] of [
      [-0.48, -0.82],
      [0.48, -0.82],
      [-0.48, 0.82],
      [0.48, 0.82],
    ] as Array<[number, number]>) {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(lx, 0.375, lz);
      denGroup.add(leg);
    }

    const chairGroup = new THREE.Group();
    chairGroup.position.set(0.85, 0, 0.15);
    chairGroup.rotation.y = -0.35;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.46), metalMat);
    seat.position.set(0, 0.45, 0);
    chairGroup.add(seat);
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.48, 0.46), metalMat);
    backrest.position.set(0.21, 0.69, 0);
    chairGroup.add(backrest);
    const cLegGeo = new THREE.BoxGeometry(0.04, 0.45, 0.04);
    for (const [cx, cz] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ] as Array<[number, number]>) {
      const cLeg = new THREE.Mesh(cLegGeo, metalMat);
      cLeg.position.set(cx, 0.225, cz);
      chairGroup.add(cLeg);
    }
    denGroup.add(chairGroup);

    const monStand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), metalMat);
    monStand.position.set(-0.15, 0.84, -0.1);
    denGroup.add(monStand);
    const monBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.72), boxMatA);
    monBody.position.set(-0.12, 1.08, -0.1);
    monBody.rotation.y = 0.12;
    denGroup.add(monBody);

    const screenTex = makeNeonTexture('SIGNAL_03 //', '#2de2ff');
    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      emissive: new THREE.Color(0x2de2ff),
      emissiveMap: screenTex,
      emissiveIntensity: 1.6,
      roughness: 0.15,
      metalness: 0.1,
    });
    const screenPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.38), screenMat);
    screenPlane.position.set(-0.068, 1.08, -0.1);
    screenPlane.rotation.y = Math.PI / 2 + 0.12;
    denGroup.add(screenPlane);

    this.monitorLight = new THREE.PointLight(0x2de2ff, 0.7, 3.5, 1.8);
    this.monitorLight.castShadow = false;
    this.monitorLight.position.set(0.25, 1.15, -0.1);
    denGroup.add(this.monitorLight);

    const boxSpecs: Array<[number, number, number, number, number, number, THREE.Material]> = [
      [-0.2, 0.9, 0.55, 0.35, 0.24, 0.42, boxMatA],
      [0.15, 0.81, 0.35, 0.28, 0.05, 0.22, boxMatB],
      [-0.35, 0.18, 1.15, 0.48, 0.36, 0.48, boxMatA],
      [0.2, 0.14, -1.1, 0.4, 0.28, 0.36, boxMatB],
      [-0.25, 0.44, 1.12, 0.32, 0.18, 0.32, boxMatB],
    ];
    for (const [bx, by, bz, bw, bh, bd, bmat] of boxSpecs) {
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bmat);
      bMesh.position.set(bx, by, bz);
      denGroup.add(bMesh);
    }

    this.root.add(denGroup);
  }

  private buildPortal(): void {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 1.6, -55.85);

    const portalTex = makePortalTexture();
    const outerMat = new THREE.MeshStandardMaterial({
      map: portalTex,
      emissive: new THREE.Color(0xff2d8a),
      emissiveMap: portalTex,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      depthWrite: false,
    });
    const innerMat = new THREE.MeshStandardMaterial({
      map: portalTex,
      emissive: new THREE.Color(0x2de2ff),
      emissiveMap: portalTex,
      emissiveIntensity: 2.6,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      depthWrite: false,
    });

    this.portalMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), outerMat);
    portalGroup.add(this.portalMesh);
    this.portalInnerMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.85), innerMat);
    this.portalInnerMesh.position.z = 0.03;
    portalGroup.add(this.portalInnerMesh);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.4, metalness: 0.8 });
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, 0.24), frameMat);
    frameL.position.set(-1.55, 0, 0);
    portalGroup.add(frameL);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, 0.24), frameMat);
    frameR.position.set(1.55, 0, 0);
    portalGroup.add(frameR);

    this.root.add(portalGroup);
  }

  private buildGate(): void {
    this.gateGroup.position.set(0, 0, -32.5);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.45, metalness: 0.85 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0x3a2028, roughness: 0.6, metalness: 0.5 });

    const railGeo = new THREE.BoxGeometry(8.0, 0.18, 0.18);
    const bottomRail = new THREE.Mesh(railGeo, hazardMat);
    bottomRail.position.set(0, 0.15, 0);
    this.gateGroup.add(bottomRail);
    const midRail = new THREE.Mesh(railGeo, steelMat);
    midRail.position.set(0, 1.55, 0);
    this.gateGroup.add(midRail);
    const topRail = new THREE.Mesh(railGeo, hazardMat);
    topRail.position.set(0, 3.05, 0);
    this.gateGroup.add(topRail);

    const barGeo = new THREE.BoxGeometry(0.08, 3.0, 0.08);
    for (let x = -3.8; x <= 3.85; x += 0.4) {
      const bar = new THREE.Mesh(barGeo, steelMat);
      bar.position.set(x, 1.6, 0);
      this.gateGroup.add(bar);
    }

    const closedTex = makeNeonTexture('CLOSED // 封鎖', '#ff2d8a');
    const closedMat = new THREE.MeshStandardMaterial({
      map: closedTex,
      emissive: new THREE.Color(0xff2d8a),
      emissiveMap: closedTex,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.2,
    });
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 0.08), steelMat);
    signBoard.position.set(0, 1.85, 0.08);
    this.gateGroup.add(signBoard);
    const closedPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.54), closedMat);
    closedPlane.position.set(0, 1.85, 0.13);
    this.gateGroup.add(closedPlane);
  }

  private setupInitialHotspots(): void {
    this.hotspots.push(
      {
        id: 'fragment-03',
        verb: 'Collect',
        name: 'Signal Fragment',
        minX: -3.6,
        maxX: -2.0,
        minY: 0.0,
        maxY: 2.0,
        minZ: -44.8,
        maxZ: -43.2,
      },
      {
        id: 'fragment-04',
        verb: 'Collect',
        name: 'Deep Fragment',
        minX: 1.5,
        maxX: 3.5,
        minY: 0.0,
        maxY: 2.0,
        minZ: -54.2,
        maxZ: -52.2,
      },
      {
        id: 'heart-portal',
        verb: 'Enter',
        name: 'The Heart',
        minX: -1.8,
        maxX: 1.8,
        minY: 0.0,
        maxY: 3.0,
        minZ: -56.0,
        maxZ: -54.2,
      },
    );
  }
}
