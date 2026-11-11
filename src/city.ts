import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  FogExp2,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  PlaneGeometry,
  PointLight,
  Scene,
  ShaderMaterial,
  DoubleSide,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
  Camera,
  DirectionalLight,
  HemisphereLight,
  PMREMGenerator,
  EquirectangularReflectionMapping,
} from 'three';
import type { AssetLibrary } from './assets';
import type { GeneratedTextures } from './canvases';
import { CollisionWorld, type BoxTag } from './collision';
import { DelayedMirror } from './mirror';
import {
  makeBarricade,
  makeCar,
  makeClock,
  makeDocket,
  makeLocker,
  makePosterStand,
  makeShard,
} from './props';
import { TUNE } from './tune';

export interface Hotspot {
  id: string;
  verb: 'Examine' | 'Read' | 'Collect';
  name: string;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

interface FlickerLamp {
  light: PointLight;
  base: number;
  seed: number;
}

interface Block {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
  tint: number;
  lobby?: boolean;
  shop?: boolean;
}

interface Win {
  x: number;
  y: number;
  z: number;
  rotY: number;
  kind: 'glass' | 'lit' | 'board';
}

const SPAWN = { x: 0, y: 0.05, z: 25.6, yaw: 0 };

export class City {
  readonly hotspots: Hotspot[] = [];
  readonly spawn = SPAWN;
  private readonly windows: Win[] = [];
  private readonly lamps: FlickerLamp[] = [];
  private readonly fragments = new Map<string, { mesh: Mesh; light: PointLight; baseY: number }>();
  private readonly bruise: ShaderMaterial;
  private readonly mirror: DelayedMirror;
  private randState = 7;
  private readonly steel: MeshStandardMaterial;
  private readonly wood: MeshStandardMaterial;

  constructor(
    private readonly scene: Scene,
    private readonly world: CollisionWorld,
    private readonly assets: AssetLibrary,
    private readonly art: GeneratedTextures,
  ) {
    const fog = new Color(TUNE.fogColor);
    scene.background = fog;
    scene.fog = new FogExp2(fog, TUNE.fogDensity);
    scene.environmentIntensity = TUNE.envIntensity;

    this.steel = new MeshStandardMaterial({
      map: assets.metal.map,
      normalMap: assets.metal.normalMap,
      roughnessMap: assets.metal.roughnessMap,
      color: 0xa39a92,
      roughness: 0.55,
      metalness: 0.78,
      envMapIntensity: 0.4,
    });
    this.wood = new MeshStandardMaterial({
      map: art.wood,
      color: 0x8d7258,
      roughness: 0.88,
      metalness: 0.02,
    });

    this.bruise = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float pulse = 0.72 + 0.28 * sin(uTime * 2.4);
          float ring = smoothstep(1.0, 0.15, r);
          float core = smoothstep(0.55, 0.0, r);
          vec3 col = mix(vec3(0.55, 0.02, 0.12), vec3(0.62, 0.18, 0.95), core);
          gl_FragColor = vec4(col * (0.85 + core) * pulse, ring * 0.92);
        }
      `,
    });
    this.bruise.toneMapped = false;

    this.lights();
    this.ground();
    this.blocks();
    this.commitWindows();
    this.streetLamps();
    this.cars();
    this.closures();
    this.precinct();
    this.drain();
    this.mirror = new DelayedMirror(3.8, 2.35);
    this.mirror.mesh.position.set(9.12, 1.9, 13.15);
    this.mirror.mesh.rotation.y = -Math.PI / 2;
    scene.add(this.mirror.mesh);
    this.frameWindow();
    this.puddles();
    this.stencil();
    this.defineHotspots();
  }

  bindEnvironment(renderer: WebGLRenderer): void {
    const pmrem = new PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    this.assets.env.mapping = EquirectangularReflectionMapping;
    const target = pmrem.fromEquirectangular(this.assets.env);
    this.scene.environment = target.texture;
    this.scene.userData.envTarget = target;
    pmrem.dispose();
  }

  update(renderer: WebGLRenderer, camera: Camera, dt: number, now: number): void {
    for (const lamp of this.lamps) {
      const n = Math.sin(now * 9.5 + lamp.seed) * Math.sin(now * 2.7 + lamp.seed * 1.7);
      const dip = Math.sin(now * 0.65 + lamp.seed) > 0.985 ? 0.18 : 1;
      lamp.light.intensity = lamp.base * (0.78 + 0.22 * n) * dip;
    }
    this.bruise.uniforms.uTime.value = now;
    for (const frag of this.fragments.values()) {
      if (!frag.mesh.visible) continue;
      frag.mesh.position.y = frag.baseY + Math.sin(now * 1.6 + frag.baseY) * 0.07;
      frag.mesh.rotation.y = now * 0.7;
    }
    this.mirror.update(renderer, this.scene, camera, dt, now);
  }

  collectFragment(id: string): void {
    const frag = this.fragments.get(id);
    if (!frag) return;
    frag.mesh.visible = false;
    frag.light.intensity = 0;
    const idx = this.hotspots.findIndex((h) => h.id === id);
    if (idx >= 0) this.hotspots.splice(idx, 1);
  }

  pick(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): Hotspot | null {
    let best: { h: Hotspot; t: number } | null = null;
    for (const h of this.hotspots) {
      const t = slab(ox, oy, oz, dx, dy, dz, 3.5, h.minX, h.minY, h.minZ, h.maxX, h.maxY, h.maxZ);
      if (t === null) continue;
      if (!best || t < best.t) best = { h, t };
    }
    if (!best) return null;
    const solid = this.world.raycast(ox, oy, oz, dx, dy, dz, best.t);
    if (solid && solid.tag !== 'ground' && solid.tag !== 'actor' && solid.t < best.t - 0.12) return null;
    return best.h;
  }

  private lights(): void {
    const hemi = new HemisphereLight(0x1c1730, 0x12080c, TUNE.hemiIntensity);
    hemi.layers.enable(1);
    const moon = new DirectionalLight(0x8d97b8, TUNE.moonIntensity);
    moon.position.set(-18, 28, 12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 2;
    moon.shadow.camera.far = 70;
    moon.shadow.camera.left = -32;
    moon.shadow.camera.right = 32;
    moon.shadow.camera.top = 32;
    moon.shadow.camera.bottom = -32;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.04;
    moon.layers.enable(1);
    moon.shadow.camera.layers.enable(1);
    this.scene.add(hemi, moon);
  }

  private ground(): void {
    const asphalt = new MeshPhysicalMaterial({
      map: this.assets.asphalt.map,
      normalMap: this.assets.asphalt.normalMap,
      roughnessMap: this.assets.asphalt.roughnessMap,
      color: 0x8e8e8e,
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.82,
      clearcoatRoughness: 0.16,
      envMapIntensity: 0.75,
    });
    const concrete = new MeshPhysicalMaterial({
      map: this.assets.concrete.map,
      normalMap: this.assets.concrete.normalMap,
      roughnessMap: this.assets.concrete.roughnessMap,
      color: 0xa7a29c,
      roughness: 0.55,
      metalness: 0.02,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.35,
    });
    // Safety slab under the block so a clip never opens onto a void.
    this.world.add({
      id: 'catch',
      tag: 'ground',
      minX: -26,
      maxX: 26,
      minY: -8,
      maxY: 0,
      minZ: -38,
      maxZ: 34,
    });
    this.slab('road', asphalt, 10.7, 0.2, 64, 0, -0.1, -2, 'ground', 2.2);
    this.slab('walk-w', concrete, 4.3, 0.38, 63, -7.35, -0.01, -2.2, 'ground', 2.4);
    this.slab('walk-e', concrete, 4.3, 0.38, 63, 7.35, -0.01, -2.2, 'ground', 2.4);
    this.slab('lobby-floor', concrete, 5.6, 0.38, 5.3, -12.0, -0.01, 14.6, 'ground', 2.4);
  }

  private blocks(): void {
    const west: Block[] = [
      { x0: -17.6, x1: -9.2, z0: 21.85, z1: 28.8, h: 11, tint: 0x918980 },
      { x0: -18.4, x1: -9.2, z0: 5.35, z1: 21.95, h: 14.6, tint: 0xa89e94, lobby: true },
      { x0: -19.5, x1: -9.2, z0: -10.3, z1: 5.45, h: 18.4, tint: 0x7a746e },
      { x0: -17.4, x1: -9.2, z0: -32.6, z1: -10.15, h: 12.5, tint: 0x8e857c },
    ];
    const east: Block[] = [
      { x0: 9.2, x1: 17.5, z0: 17.55, z1: 28.8, h: 12.4, tint: 0x847d76 },
      { x0: 9.2, x1: 16.4, z0: 6.15, z1: 17.65, h: 9.4, tint: 0x9a8f86, shop: true },
      { x0: 9.2, x1: 18.8, z0: -8.25, z1: 6.25, h: 16.8, tint: 0x6c6662 },
      { x0: 9.2, x1: 17.0, z0: -21.5, z1: -8.1, h: 13.8, tint: 0x887f76 },
      { x0: 9.2, x1: 15.6, z0: -32.6, z1: -21.35, h: 11, tint: 0x756e68 },
    ];
    west.forEach((b, i) => this.block(b, `w${i}`));
    east.forEach((b, i) => this.block(b, `e${i}`));
  }

  private block(b: Block, id: string): void {
    const mat = this.brick(b.tint);
    const trim = new MeshStandardMaterial({ color: 0x16141a, roughness: 0.72, metalness: 0.08 });
    if (!b.lobby) {
      this.box(`${id}-mass`, b.x1 - b.x0, b.h, b.z1 - b.z0, (b.x0 + b.x1) / 2, b.h / 2, (b.z0 + b.z1) / 2, mat, 'static');
    } else {
      const x0 = b.x0;
      const x1 = b.x1;
      const back = -14.4;
      this.box(`${id}-s`, x1 - x0, b.h, 12.0 - b.z0, (x0 + x1) / 2, b.h / 2, (b.z0 + 12.0) / 2, mat, 'static');
      this.box(`${id}-n`, x1 - x0, b.h, b.z1 - 17.2, (x0 + x1) / 2, b.h / 2, (17.2 + b.z1) / 2, mat, 'static');
      // Back mass keeps a door into the decaying hall (z 15.05–17.05, below the lintel).
      this.box(`${id}-back-s`, back - x0, b.h, 15.05 - 12.0, (x0 + back) / 2, b.h / 2, (12.0 + 15.05) / 2, mat, 'static');
      this.box(`${id}-back-ceil`, back - x0, b.h - 3.05, 2.0, (x0 + back) / 2, 3.05 + (b.h - 3.05) / 2, 16.05, mat, 'static');
      this.box(`${id}-back-n`, back - x0, b.h, 0.2, (x0 + back) / 2, b.h / 2, 17.1, mat, 'static');
      this.box(`${id}-lintel`, x1 - back, b.h - 3.35, 5.2, (back + x1) / 2, 3.35 + (b.h - 3.35) / 2, 14.6, mat, 'static');
    }
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const cornice = new Mesh(sizedBox(b.x1 - b.x0 + 0.22, 0.26, b.z1 - b.z0 + 0.22, 3), trim);
    cornice.position.set(cx, b.h - 0.08, cz);
    cornice.castShadow = true;
    this.scene.add(cornice);

    const streetFace = b.x1 < 0 ? b.x1 : b.x0;
    const facing: 1 | -1 = b.x1 < 0 ? 1 : -1;
    const skip = b.lobby
      ? { z0: 11.8, z1: 17.4, y1: 3.5 }
      : b.shop
        ? { z0: 11.1, z1: 15.4, y1: 3.4 }
        : undefined;
    this.facade(streetFace, b.z0, b.z1, b.h, facing, skip);
    if (!b.lobby) {
      const doorZ = b.shop ? b.z0 + 2.1 : (b.z0 + b.z1) / 2;
      this.door(streetFace, doorZ, facing);
    }
  }

  private facade(
    faceX: number,
    z0: number,
    z1: number,
    height: number,
    facing: 1 | -1,
    skip?: { z0: number; z1: number; y1: number },
  ): void {
    const rotY = facing === 1 ? Math.PI / 2 : -Math.PI / 2;
    const x = faceX + facing * 0.06;
    for (let y = 1.75; y < height - 1.1; y += 3.05) {
      for (let z = z0 + 1.25; z < z1 - 1.05; z += 2.4) {
        if (skip && z > skip.z0 && z < skip.z1 && y < skip.y1) continue;
        const roll = this.rand();
        const kind: Win['kind'] = roll > 0.94 ? 'lit' : roll < 0.48 ? 'board' : 'glass';
        this.windows.push({ x, y, z, rotY, kind });
      }
    }
  }

  private door(faceX: number, z: number, facing: 1 | -1): void {
    const door = new Mesh(
      new PlaneGeometry(1.15, 2.25),
      new MeshStandardMaterial({ color: 0x0c0b10, roughness: 0.9, metalness: 0.1 }),
    );
    door.position.set(faceX + facing * 0.07, 1.15, z);
    door.rotation.y = facing === 1 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(door);
  }

  private commitWindows(): void {
    const glass = new MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.08,
      metalness: 0.62,
      envMapIntensity: 0.28,
    });
    const lit = new MeshStandardMaterial({
      color: 0x2a1a12,
      emissive: 0xffb184,
      emissiveIntensity: 0.9,
      roughness: 0.45,
    });
    const boardMat = this.wood;
    this.scene.add(this.instanced(this.windows.filter((w) => w.kind === 'glass'), glass));
    this.scene.add(this.instanced(this.windows.filter((w) => w.kind === 'lit'), lit));
    const boards = this.windows.filter((w) => w.kind === 'board');
    if (boards.length) this.scene.add(this.instanced(boards, boardMat));
  }

  private instanced(items: Win[], material: MeshStandardMaterial): InstancedMesh {
    const mesh = new InstancedMesh(new PlaneGeometry(0.78, 1.2), material, Math.max(1, items.length));
    mesh.count = items.length;
    mesh.frustumCulled = false;
    const dummy = new Object3D();
    items.forEach((w, i) => {
      dummy.position.set(w.x, w.y, w.z);
      dummy.rotation.set(0, w.rotY, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  private streetLamps(): void {
    const spots: Array<[number, number, boolean]> = [
      [-6.55, 22, false],
      [6.55, 22, false],
      [-6.55, 11, true],
      [6.55, 11, false],
      [-6.55, 0, false],
      [6.55, 0, false],
      [-6.55, -9, false],
      [6.55, -9, true],
      [-6.55, -19, false],
      [6.55, -19, false],
      [-6.55, -28, false],
      [6.55, -28, false],
    ];
    spots.forEach(([x, z, shadow], i) => this.streetLamp(x, z, shadow, i));
  }

  private streetLamp(x: number, z: number, shadow: boolean, index: number): void {
    const g = new Group();
    const pole = new Mesh(new CylinderGeometry(0.07, 0.09, 4.5, 8), this.steel);
    pole.position.y = 2.25;
    pole.castShadow = true;
    const toward = -Math.sign(x);
    const arm = new Mesh(new CylinderGeometry(0.035, 0.04, 0.85, 6), this.steel);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(toward * 0.38, 4.35, 0);
    arm.castShadow = true;
    const head = new Mesh(new BoxGeometry(0.28, 0.12, 0.28), this.steel);
    head.position.set(toward * 0.7, 4.28, 0);
    const bulb = new Mesh(new SphereGeometry(0.07, 10, 8), new MeshBasicMaterial({ color: 0xffe3c2 }));
    bulb.position.set(toward * 0.7, 4.18, 0);
    const light = new PointLight(0xffb27d, TUNE.streetIntensity, TUNE.streetDistance, 2);
    light.position.copy(bulb.position);
    light.layers.enable(1);
    if (shadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(256, 256);
      light.shadow.bias = -0.02;
      light.shadow.normalBias = 0.06;
      light.shadow.camera.near = 0.4;
      light.shadow.camera.far = TUNE.streetDistance;
      light.shadow.camera.layers.enable(1);
    }
    g.add(pole, arm, head, bulb, light);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.lamps.push({ light, base: TUNE.streetIntensity, seed: index * 1.7 + 0.4 });
  }

  private cars(): void {
    const placements: Array<[number, number, number]> = [
      [2.7, 16.2, 0.18],
      [-2.55, 0.6, -0.12],
      [2.35, -14.4, 0.22],
    ];
    for (const [x, z, yaw] of placements) {
      const car = makeCar(this.assets.metal);
      car.position.set(x, 0, z);
      car.rotation.y = yaw;
      this.scene.add(car);
      const c = Math.abs(Math.cos(yaw));
      const s = Math.abs(Math.sin(yaw));
      const hx = 0.9 * c + 2.2 * s;
      const hz = 0.9 * s + 2.2 * c;
      this.world.add({
        id: `car-${x.toFixed(1)}-${z.toFixed(1)}`,
        tag: 'static',
        minX: x - hx,
        maxX: x + hx,
        minY: 0,
        maxY: 1.5,
        minZ: z - hz,
        maxZ: z + hz,
      });
    }
  }

  private closures(): void {
    this.box('closure-s', 22, 1.35, 0.45, 0, 0.67, 29.15, this.steel, 'static');
    this.box('closure-n', 22, 1.35, 0.45, 0, 0.67, -32.15, this.steel, 'static');
    for (const x of [-3.6, -1.2, 1.2, 3.6]) {
      const south = makeBarricade(this.art.wood, this.assets.metal);
      south.position.set(x, 0, 29.05);
      const north = makeBarricade(this.art.wood, this.assets.metal);
      north.position.set(x, 0, -32.05);
      this.scene.add(south, north);
    }
  }

  private precinct(): void {
    const signMat = new MeshStandardMaterial({
      map: this.art.sign,
      emissive: 0x5a1820,
      emissiveIntensity: 0.45,
      roughness: 0.55,
    });
    const sign = new Mesh(new PlaneGeometry(4.6, 0.72), signMat);
    sign.position.set(-9.02, 3.9, 14.6);
    sign.rotation.y = Math.PI / 2;
    this.scene.add(sign);

    const lobby = new PointLight(0xffd2ae, TUNE.lobbyIntensity, 9, 2);
    lobby.position.set(-12.1, 2.75, 14.6);
    lobby.layers.enable(1);
    this.scene.add(lobby);
    this.lamps.push({ light: lobby, base: TUNE.lobbyIntensity, seed: 4.2 });

    const locker = makeLocker(this.assets.metal);
    locker.position.set(-13.62, 0.18, 14.65);
    this.scene.add(locker);
    this.world.add({
      id: 'locker',
      tag: 'static',
      minX: -14.02,
      maxX: -13.22,
      minY: 0.18,
      maxY: 2.05,
      minZ: 14.35,
      maxZ: 14.95,
    });

    const shard = makeShard();
    shard.position.set(-12.75, 1.32, 14.65);
    const light = new PointLight(0xd7a6ff, 8, 4.5, 2);
    light.position.copy(shard.position);
    light.layers.enable(1);
    this.scene.add(shard, light);
    this.fragments.set('fragment-01', { mesh: shard, light, baseY: 1.32 });

    const clock = makeClock(this.art.clock);
    clock.position.set(-14.22, 1.62, 13.05);
    clock.rotation.y = Math.PI / 2;
    this.scene.add(clock);

    const docket = makeDocket(this.art.docket, this.art.wood);
    docket.position.set(-12.15, 0.18, 16.15);
    this.scene.add(docket);
    this.world.add({
      id: 'lectern',
      tag: 'static',
      minX: -12.4,
      maxX: -11.9,
      minY: 0.18,
      maxY: 1.05,
      minZ: 15.9,
      maxZ: 16.4,
    });

    const notice = makePosterStand(this.art.poster, this.assets.metal);
    notice.position.set(-1.15, 0, 20.55);
    notice.rotation.y = 0.18;
    this.scene.add(notice);
    this.asylumHall();
    this.ivyAndSteps();
  }

  /** A short rotting hallway behind the precinct lobby. */
  private asylumHall(): void {
    const plaster = new MeshPhysicalMaterial({
      map: this.assets.plaster.map,
      normalMap: this.assets.plaster.normalMap,
      roughnessMap: this.assets.plaster.roughnessMap,
      color: 0x8a8178,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0.15,
    });
    const trim = new MeshStandardMaterial({ color: 0x2a241c, roughness: 0.7, metalness: 0.05 });
    // Walkable floor continuing the lobby into the block.
    this.slab('hall-floor', plaster, 9.2, 0.36, 2.15, -18.7, 0.0, 16.05, 'ground', 1.6);
    this.box('hall-south', 9.4, 3.05, 0.28, -18.6, 1.52, 15.12, trim, 'static');
    this.box('hall-north', 5.2, 3.05, 0.28, -20.7, 1.52, 17.0, trim, 'static');
    this.box('hall-end', 0.32, 3.05, 2.15, -23.3, 1.52, 16.05, trim, 'static');
    this.box('hall-ceiling', 9.2, 0.28, 2.15, -18.7, 3.15, 16.05, trim, 'static');

    const wall = new Mesh(
      new PlaneGeometry(8.6, 2.5),
      new MeshStandardMaterial({
        map: this.assets.plaster.map,
        normalMap: this.assets.plaster.normalMap,
        roughnessMap: this.assets.plaster.roughnessMap,
        color: 0xc4b4a4,
        roughness: 0.86,
      }),
    );
    wall.position.set(-18.8, 1.55, 15.28);
    this.scene.add(wall);
    const wainscot = new Mesh(new PlaneGeometry(8.6, 0.85), trim);
    wainscot.position.set(-18.8, 0.6, 15.3);
    this.scene.add(wainscot);

    const tube = new Mesh(
      new BoxGeometry(1.4, 0.08, 0.12),
      new MeshBasicMaterial({ color: 0xd7ffe8 }),
    );
    tube.position.set(-20.2, 2.85, 16.05);
    this.scene.add(tube);
    const fluor = new PointLight(0xd5ffe6, 16, 8, 2);
    fluor.position.set(-20.2, 2.7, 16.05);
    fluor.layers.enable(1);
    this.scene.add(fluor);
    this.lamps.push({ light: fluor, base: 16, seed: 9.1 });

    const shaftMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {},
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; void main(){
        float shaft = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.2, vUv.y);
        float across = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        gl_FragColor = vec4(0.75, 0.95, 0.85, shaft * across * 0.22);
      }`,
    });
    const shaft = new Mesh(new PlaneGeometry(0.7, 2.6), shaftMat);
    shaft.position.set(-20.2, 1.5, 16.2);
    shaft.renderOrder = 2;
    this.scene.add(shaft);

    const rubble = new Mesh(new BoxGeometry(0.7, 0.28, 0.55), plaster);
    rubble.position.set(-21.4, 0.32, 15.7);
    rubble.rotation.y = 0.4;
    rubble.castShadow = true;
    this.scene.add(rubble);
  }

  private ivyAndSteps(): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#14301c';
    for (let i = 0; i < 48; i++) {
      g.globalAlpha = 0.75;
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 256, 16 + Math.random() * 14, 7, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    const ivyMat = new MeshStandardMaterial({
      map,
      color: 0x1d3a24,
      transparent: true,
      alphaTest: 0.35,
      roughness: 0.8,
      side: DoubleSide,
    });
    const spots: Array<[number, number, number, number]> = [
      [-9.05, 4.2, 10.2, 2.4],
      [-9.05, 6.4, 8.4, 3.1],
      [-9.05, 3.2, 19.4, 1.8],
      [9.05, 5.1, 12.2, 2.6],
    ];
    for (const [x, y, z, s] of spots) {
      const leaf = new Mesh(new PlaneGeometry(s, s * 1.4), ivyMat);
      leaf.position.set(x, y, z);
      leaf.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(leaf);
    }
    const step = new MeshStandardMaterial({ color: 0x6e6a66, roughness: 0.9 });
    for (const [x, w] of [[-8.55, 3.2], [-8.15, 3.6]] as Array<[number, number]>) {
      const stone = new Mesh(new BoxGeometry(0.35, 0.12, w), step);
      stone.position.set(x, 0.22, 14.6);
      stone.castShadow = true;
      stone.receiveShadow = true;
      this.scene.add(stone);
    }
  }

  private drain(): void {
    const grate = new Mesh(
      new CylinderGeometry(0.72, 0.72, 0.06, 18),
      new MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4, metalness: 0.8 }),
    );
    grate.position.set(0.55, 0.04, -4.25);
    this.scene.add(grate);
    for (let i = -2; i <= 2; i++) {
      const bar = new Mesh(new BoxGeometry(1.2, 0.025, 0.045), this.steel);
      bar.position.set(0.55, 0.08, -4.25 + i * 0.18);
      this.scene.add(bar);
    }
    const pool = new Mesh(new CircleGeometry(1.25, 24), this.bruise);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0.55, 0.05, -4.25);
    pool.renderOrder = 1;
    this.scene.add(pool);
    const glow = new PointLight(0xb02658, TUNE.bruiseIntensity, 7, 2);
    glow.position.set(0.55, 0.6, -4.25);
    glow.layers.enable(1);
    const shard = makeShard();
    shard.position.set(0.55, 0.92, -4.25);
    const shardLight = new PointLight(0xe7b6ff, 7, 3.5, 2);
    shardLight.position.copy(shard.position);
    shardLight.layers.enable(1);
    this.scene.add(glow, shard, shardLight);
    this.fragments.set('fragment-02', { mesh: shard, light: shardLight, baseY: 0.92 });
  }

  private frameWindow(): void {
    const frame = new MeshStandardMaterial({ color: 0x120e12, roughness: 0.6, metalness: 0.3 });
    const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new Mesh(new BoxGeometry(w, h, d), frame);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.scene.add(m);
    };
    add(0.08, 2.55, 3.95, 9.16, 1.9, 13.15);
    add(0.12, 0.1, 4.05, 9.08, 3.15, 13.15);
    add(0.12, 0.1, 4.05, 9.08, 0.68, 13.15);
  }

  private puddles(): void {
    const mat = new MeshPhysicalMaterial({
      color: 0x1a1c22,
      roughness: 0.06,
      metalness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1,
      transparent: true,
      opacity: 0.72,
    });
    const spots: Array<[number, number, number]> = [
      [1.4, 18.4, 1.6],
      [-1.8, 8.2, 2.1],
      [0.8, -1.2, 1.4],
      [-2.2, -12.5, 1.8],
    ];
    for (const [x, z, s] of spots) {
      const puddle = new Mesh(new CircleGeometry(s, 18), mat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(x, 0.025, z);
      this.scene.add(puddle);
    }
  }

  private stencil(): void {
    const decal = new Mesh(
      new PlaneGeometry(7.2, 1.5),
      new MeshBasicMaterial({ map: this.art.stencil, transparent: true, depthWrite: false, opacity: 0.7 }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(0.2, 0.03, 17.4);
    this.scene.add(decal);
  }

  private defineHotspots(): void {
    this.hotspots.push(
      {
        id: 'evacuation-notice',
        verb: 'Examine',
        name: 'Evacuation Notice',
        minX: -1.95,
        maxX: -0.3,
        minY: 0.7,
        maxY: 2.15,
        minZ: 20.15,
        maxZ: 21.05,
      },
      {
        id: 'precinct-clock',
        verb: 'Examine',
        name: 'Precinct Clock',
        minX: -14.35,
        maxX: -13.35,
        minY: 1.15,
        maxY: 2.15,
        minZ: 12.6,
        maxZ: 13.5,
      },
      {
        id: 'missing-docket',
        verb: 'Read',
        name: 'Missing Persons Docket',
        minX: -12.6,
        maxX: -11.6,
        minY: 0.95,
        maxY: 1.55,
        minZ: 15.75,
        maxZ: 16.55,
      },
      {
        id: 'shop-window',
        verb: 'Examine',
        name: 'Shop Window',
        minX: 7.4,
        maxX: 8.95,
        minY: 0.7,
        maxY: 2.8,
        minZ: 11.3,
        maxZ: 15.0,
      },
      {
        id: 'fragment-01',
        verb: 'Collect',
        name: 'Evidence Locker Residue',
        minX: -13.15,
        maxX: -12.25,
        minY: 0.85,
        maxY: 1.85,
        minZ: 14.15,
        maxZ: 15.15,
      },
      {
        id: 'fragment-02',
        verb: 'Collect',
        name: 'Time Bruise',
        minX: -0.3,
        maxX: 1.45,
        minY: 0.25,
        maxY: 1.5,
        minZ: -5.05,
        maxZ: -3.45,
      },
    );
  }

  private brick(tint: number): MeshStandardMaterial {
    return new MeshStandardMaterial({
      map: this.assets.brick.map,
      normalMap: this.assets.brick.normalMap,
      roughnessMap: this.assets.brick.roughnessMap,
      color: tint,
      roughness: 0.9,
      metalness: 0.02,
      envMapIntensity: 0.22,
      normalScale: new Vector2(0.7, 0.7),
    });
  }

  private slab(
    id: string,
    material: MeshPhysicalMaterial,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    tag: BoxTag,
    tile: number,
  ): void {
    const geo = sizedBox(w, h, d, tile);
    const mesh = new Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.scene.add(mesh);
    this.world.add({
      id,
      tag,
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  }

  private box(
    id: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: MeshStandardMaterial,
    tag: BoxTag,
  ): void {
    const mesh = new Mesh(sizedBox(w, h, d, 1.7), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.world.add({
      id,
      tag,
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  }

  private rand(): number {
    this.randState = (this.randState * 16807 + 11) % 2147483647;
    return (this.randState & 0x7fffffff) / 2147483647;
  }
}

function sizedBox(w: number, h: number, d: number, tile: number): BufferGeometry {
  const geo = new BoxGeometry(w, h, d);
  const uv = geo.getAttribute('uv') as BufferAttribute;
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const su = dims[f][0] / tile;
    const sv = dims[f][1] / tile;
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv);
    }
  }
  uv.needsUpdate = true;
  try {
    geo.computeTangents();
  } catch {
    /* normal maps still apply on generated tangents in the shader */
  }
  return geo;
}

function slab(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): number | null {
  let t1 = 0;
  let t2 = maxT;
  const origin = [ox, oy, oz];
  const dir = [dx, dy, dz];
  const min = [minX, minY, minZ];
  const max = [maxX, maxY, maxZ];
  for (let a = 0; a < 3; a++) {
    const o = origin[a];
    const d = dir[a];
    if (Math.abs(d) < 1e-8) {
      if (o < min[a] || o > max[a]) return null;
      continue;
    }
    let ta = (min[a] - o) / d;
    let tb = (max[a] - o) / d;
    if (ta > tb) {
      const s = ta;
      ta = tb;
      tb = s;
    }
    if (ta > t1) t1 = ta;
    t2 = Math.min(t2, tb);
    if (t1 > t2) return null;
  }
  if (t1 < 0 || t1 > maxT) return null;
  return t1;
}
