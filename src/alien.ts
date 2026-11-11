import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SphereGeometry,
  BoxGeometry,
  Scene,
} from 'three';
import type { CollisionWorld } from './collision';
import { TUNE } from './tune';

export type AlienMode = 'patrol' | 'chase' | 'windup' | 'recover' | 'dead';

interface Joint {
  node: Object3D;
  restX: number;
  restZ: number;
}

export interface AlienHooks {
  onWindup: () => void;
  onHit: () => void;
  onNotice: () => void;
}

const PATROL = [
  { x: 0.2, z: -1 },
  { x: 1.4, z: -8 },
  { x: -0.6, z: -16 },
  { x: 1.1, z: -11 },
  { x: -1.2, z: -4 },
];

/**
 * Ancient One — a tall temporal silhouette with a second elbow and digitigrade legs.
 * Not a stand-in primitive. Patrols the boulevard, then hunts by sight and proximity.
 */
export class AncientOne {
  mode: AlienMode = 'patrol';
  x = 0;
  y = 0.05;
  z = -8;
  yaw = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  health = TUNE.alienHealth;
  readonly radius = 0.46;
  readonly height = 2.25;
  readonly group: Group;
  private readonly world: CollisionWorld;
  private readonly flesh: MeshStandardMaterial;
  private readonly vein: MeshStandardMaterial;
  private readonly glow: PointLight;
  private readonly joints: Record<string, Joint> = {};
  private waypoint = 0;
  private phase = 0;
  private windupT = 0;
  private recoverT = 0;
  private lostT = 0;
  private noticed = false;
  private fall = 0;
  private readonly ignore = new Set<string>(['alien']);
  private frozen = false;

  constructor(world: CollisionWorld, scene: Scene) {
    this.world = world;
    this.flesh = new MeshStandardMaterial({
      color: 0x8d7384,
      roughness: 0.42,
      metalness: 0.08,
      emissive: 0x2a1020,
      emissiveIntensity: 0.35,
    });
    this.vein = new MeshStandardMaterial({
      color: 0x4a1830,
      emissive: 0xc43a78,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.05,
    });
    this.group = new Group();
    this.group.name = 'ancient-one';
    this.buildBody();
    this.glow = new PointLight(0xaa3366, 1.8, 4.2, 2);
    this.glow.position.set(0, 2.05, -0.1);
    this.glow.layers.enable(1);
    this.group.add(this.glow);
    scene.add(this.group);
    this.syncMesh();
  }

  showcase(x: number, z: number, yaw: number): void {
    this.frozen = true;
    this.x = x;
    this.y = 0;
    this.z = z;
    this.yaw = yaw;
    this.vx = 0;
    this.vz = 0;
    this.phase = 1.1;
    this.mode = 'patrol';
    this.animate(0.016);
    this.syncMesh();
    this.world.setActor('alien', this.x, this.y, this.z, this.radius, this.height);
  }

  reset(x = 0.2, z = -8): void {
    this.frozen = false;
    this.mode = 'patrol';
    this.x = x;
    this.y = 0.05;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.health = TUNE.alienHealth;
    this.waypoint = 0;
    this.windupT = 0;
    this.recoverT = 0;
    this.lostT = 0;
    this.fall = 0;
    this.group.rotation.z = 0;
    this.syncMesh();
  }

  hurt(amount: number): void {
    if (this.mode === 'dead') return;
    this.health = Math.max(0, this.health - amount);
    this.flesh.emissiveIntensity = 1.4;
    if (this.mode === 'patrol') this.mode = 'chase';
    if (this.health <= 0) {
      this.mode = 'dead';
      this.vx = 0;
      this.vz = 0;
      this.world.remove('alien');
    }
  }

  /** Slows when a placed barricade is crowding the body, and solids block the sweep. */
  update(
    dt: number,
    player: { x: number; y: number; z: number; eyeY: number; crouching: boolean },
    hooks: AlienHooks,
  ): void {
    this.flesh.emissiveIntensity += (0.4 - this.flesh.emissiveIntensity) * Math.min(1, dt * 3);
    this.vein.emissiveIntensity = 0.85 + Math.sin(performance.now() * 0.006) * 0.35;
    if (this.frozen) {
      this.phase += dt;
      this.animate(dt);
      this.syncMesh();
      return;
    }
    if (this.mode === 'dead') {
      this.fall = Math.min(1, this.fall + dt * 1.4);
      this.group.rotation.z = this.fall * 1.25;
      this.group.position.y = this.y + this.fall * 0.15;
      this.glow.intensity = 0.4;
      return;
    }

    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);
    const sight = player.crouching ? 10 : 17.5;
    const prox = player.crouching ? 3.1 : 5.4;
    const los = this.hasLos(player.x, player.eyeY, player.z);
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const inv = dist > 0.001 ? 1 / dist : 0;
    const dot = fwdX * dx * inv + fwdZ * dz * inv;
    const halfFov = Math.cos(player.crouching ? 0.62 : 0.95);
    const sees = dist < sight && dot > halfFov && los;
    const hears = dist < prox;
    if (sees || hears) {
      if (this.mode === 'patrol') this.mode = 'chase';
      if (!this.noticed) {
        this.noticed = true;
        hooks.onNotice();
      }
      this.lostT = 0;
    } else if (this.mode === 'chase') {
      this.lostT += dt;
      if (this.lostT > 3.2 && dist > prox) this.mode = 'patrol';
    }

    let speed = this.mode === 'patrol' ? 1.35 : 3.95;
    if (this.nearBarricade()) speed *= 0.42;

    if (this.mode === 'windup' || this.mode === 'recover') {
      this.face(dx, dz, dt, 6);
      this.vx = 0;
      this.vz = 0;
    } else if (this.mode === 'chase') {
      if (dist < 1.62) {
        this.mode = 'windup';
        this.windupT = 0.58;
        this.vx = 0;
        this.vz = 0;
        hooks.onWindup();
      } else {
        this.steer(dx * inv, dz * inv, speed, dt);
      }
      this.face(this.vx, this.vz, dt, 5);
    } else {
      const wp = PATROL[this.waypoint];
      const wx = wp.x - this.x;
      const wz = wp.z - this.z;
      const wlen = Math.hypot(wx, wz);
      if (wlen < 0.55) this.waypoint = (this.waypoint + 1) % PATROL.length;
      else this.steer(wx / wlen, wz / wlen, speed, dt);
      this.face(this.vx, this.vz, dt, 3);
    }

    if (this.mode === 'windup') {
      this.windupT -= dt;
      if (this.windupT <= 0) {
        const still = Math.hypot(player.x - this.x, player.z - this.z);
        if (still < 1.9) hooks.onHit();
        this.mode = 'recover';
        this.recoverT = 0.78;
      }
    } else if (this.mode === 'recover') {
      this.recoverT -= dt;
      if (this.recoverT <= 0) this.mode = 'chase';
    }

    if (!this.world.supported(this.x, this.y, this.z, this.radius, this.ignore)) this.vy -= 22 * dt;
    else if (this.vy < 0) this.vy = 0;
    const body = {
      x: this.x,
      y: this.y,
      z: this.z,
      vx: this.vx,
      vy: this.vy,
      vz: this.vz,
      r: this.radius,
      h: this.height,
    };
    this.world.move(body, dt, 0.45, this.ignore);
    this.x = body.x;
    this.y = body.y;
    this.z = body.z;
    this.vx = body.vx;
    this.vy = body.vy;
    this.vz = body.vz;
    this.world.setActor('alien', this.x, this.y, this.z, this.radius, this.height);
    const moving = Math.hypot(this.vx, this.vz);
    this.phase += dt * (this.mode === 'chase' ? 7.5 : 3.2) * Math.min(1, moving / 1.2);
    this.animate(dt);
    this.syncMesh();
  }

  private steer(dx: number, dz: number, speed: number, dt: number): void {
    const options = [0, 0.6, -0.6, 1.15, -1.15, 1.8, -1.8];
    for (const off of options) {
      const c = Math.cos(off);
      const s = Math.sin(off);
      const sx = dx * c - dz * s;
      const sz = dx * s + dz * c;
      if (this.clear(sx, sz, Math.max(0.8, speed * dt * 2.2))) {
        this.vx = sx * speed;
        this.vz = sz * speed;
        return;
      }
    }
    this.vx = 0;
    this.vz = 0;
  }

  private clear(dx: number, dz: number, dist: number): boolean {
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      const t = (dist * i) / steps;
      if (this.world.blocked(this.x + dx * t, this.y, this.z + dz * t, this.radius, this.height, this.ignore)) {
        return false;
      }
    }
    return true;
  }

  private nearBarricade(): boolean {
    for (const b of this.world.boxes) {
      if (!b.id.startsWith('barricade')) continue;
      const cx = (b.minX + b.maxX) * 0.5;
      const cz = (b.minZ + b.maxZ) * 0.5;
      if (Math.hypot(cx - this.x, cz - this.z) < 1.35) return true;
    }
    return false;
  }

  private hasLos(px: number, py: number, pz: number): boolean {
    const ox = this.x;
    const oy = this.y + 1.95;
    const oz = this.z;
    const dx = px - ox;
    const dy = py - oy;
    const dz = pz - oz;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001) return true;
    const hit = this.world.raycast(ox, oy, oz, dx / len, dy / len, dz / len, len, this.ignore);
    if (!hit) return true;
    if (hit.tag === 'ground' || hit.tag === 'actor') return true;
    return hit.t > len - 0.4;
  }

  private face(dx: number, dz: number, dt: number, rate: number): void {
    if (Math.hypot(dx, dz) < 0.05) return;
    const target = Math.atan2(-dx, -dz);
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, rate * dt);
  }

  private syncMesh(): void {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.y = this.yaw;
  }

  private animate(_dt: number): void {
    const s = Math.sin(this.phase);
    const walk = this.mode === 'dead' ? 0 : Math.min(1, Math.hypot(this.vx, this.vz) / 1.4);
    const attack =
      this.mode === 'windup' ? 1 - Math.max(0, this.windupT) / 0.58 : this.mode === 'recover' ? 0.35 : 0;
    // Limb meshes hang on local -Y, so a rest angle near 0 points at the ground.
    this.setJoint('thighL', 0.2 + s * 0.5 * walk, 0.08);
    this.setJoint('thighR', 0.2 - s * 0.5 * walk, -0.08);
    this.setJoint('shinL', -0.4 - Math.max(0, s) * 0.15 * walk, 0);
    this.setJoint('shinR', -0.4 - Math.max(0, -s) * 0.15 * walk, 0);
    this.setJoint('armL', 0.2 - s * 0.45 * walk - attack * 1.35, 0.22);
    this.setJoint('armR', 0.2 + s * 0.45 * walk - attack * 1.35, -0.22);
    this.setJoint('midL', 0.45, 0.1);
    this.setJoint('midR', 0.45, -0.1);
    this.setJoint('foreL', 0.35, 0);
    this.setJoint('foreR', 0.35, 0);
    this.setJoint('smallL', 0.5 + Math.sin(this.phase * 0.7) * 0.3, 0.45);
    this.setJoint('smallR', 0.5 - Math.sin(this.phase * 0.7) * 0.3, -0.45);
    const hips = this.joints.hips?.node;
    if (hips) hips.position.y = 1.02 + Math.abs(s) * 0.04 * walk;
  }

  private setJoint(name: string, x: number, z: number): void {
    const j = this.joints[name];
    if (!j) return;
    j.node.rotation.x = x;
    j.node.rotation.z = z;
    j.restX = x;
    j.restZ = z;
  }

  private buildBody(): void {
    const hips = this.joint(this.group, 'hips', 0, 1.2, 0);
    this.capsule(hips, 0.22, 0.16, this.flesh);
    const spine = this.joint(hips, 'spine', 0, 0.16, 0);
    this.capsule(spine, 0.48, 0.16, this.flesh);
    const chest = this.joint(spine, 'chest', 0, 0.48, 0);
    const vein = new Mesh(new BoxGeometry(0.05, 0.42, 0.05), this.vein);
    vein.position.set(0.1, 0.2, -0.12);
    chest.add(vein);
    const neck = this.joint(chest, 'neck', 0, 0.16, 0);
    this.capsule(neck, 0.16, 0.06, this.flesh);
    const headPivot = this.joint(neck, 'head', 0, 0.18, 0);
    const head = new Mesh(new SphereGeometry(0.16, 14, 12), this.flesh);
    head.scale.set(0.75, 1.35, 0.82);
    head.position.y = 0.12;
    head.castShadow = true;
    headPivot.add(head);
    const slit = new Mesh(new BoxGeometry(0.035, 0.28, 0.03), this.vein);
    slit.position.set(0, 0.12, -0.12);
    headPivot.add(slit);

    this.arm(chest, 'L', 1);
    this.arm(chest, 'R', -1);
    this.smallArm(chest, 'L', 1);
    this.smallArm(chest, 'R', -1);
    this.leg(hips, 'L', 1);
    this.leg(hips, 'R', -1);
  }

  private arm(parent: Object3D, side: 'L' | 'R', sign: number): void {
    const upper = this.joint(parent, `arm${side}`, sign * 0.26, 0.1, 0);
    this.hang(upper, 0.5, 0.065, this.flesh);
    const mid = this.joint(upper, `mid${side}`, sign * 0.04, -0.5, 0);
    this.hang(mid, 0.42, 0.05, this.flesh);
    const fore = this.joint(mid, `fore${side}`, 0, -0.42, 0);
    this.hang(fore, 0.4, 0.042, this.flesh);
    const hand = this.joint(fore, `hand${side}`, 0, -0.4, 0);
    for (let f = 0; f < 3; f++) {
      const finger = new Mesh(new CapsuleGeometry(0.014, 0.24, 2, 5), this.flesh);
      finger.position.set((f - 1) * 0.05, -0.16, 0);
      finger.castShadow = true;
      hand.add(finger);
    }
  }

  private smallArm(parent: Object3D, side: 'L' | 'R', sign: number): void {
    const root = this.joint(parent, `small${side}`, sign * 0.14, 0.02, 0.1);
    this.hang(root, 0.36, 0.035, this.vein);
    const tip = this.joint(root, `smallTip${side}`, 0, -0.36, 0);
    this.hang(tip, 0.3, 0.028, this.flesh);
  }

  private leg(parent: Object3D, side: 'L' | 'R', sign: number): void {
    const thigh = this.joint(parent, `thigh${side}`, sign * 0.14, -0.02, 0);
    this.hang(thigh, 0.58, 0.085, this.flesh);
    const shin = this.joint(thigh, `shin${side}`, 0, -0.58, 0);
    this.hang(shin, 0.52, 0.065, this.flesh);
    const foot = this.joint(shin, `foot${side}`, 0, -0.5, 0);
    const paw = new Mesh(new CapsuleGeometry(0.055, 0.2, 2, 5), this.flesh);
    paw.rotation.x = Math.PI / 2;
    paw.position.set(0, -0.04, -0.12);
    paw.castShadow = true;
    foot.add(paw);
  }

  private hang(parent: Object3D, length: number, radius: number, material: MeshStandardMaterial): Mesh {
    const cyl = Math.max(0.02, length - radius * 2);
    const mesh = new Mesh(new CapsuleGeometry(radius, cyl, 3, 7), material);
    mesh.position.y = -length * 0.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private joint(parent: Object3D, name: string, x: number, y: number, z: number): Object3D {
    const node = new Object3D();
    node.name = name;
    node.position.set(x, y, z);
    parent.add(node);
    this.joints[name] = { node, restX: 0, restZ: 0 };
    return node;
  }

  private capsule(parent: Object3D, length: number, radius: number, material: MeshStandardMaterial): Mesh {
    const cyl = Math.max(0.02, length - radius * 2);
    const mesh = new Mesh(new CapsuleGeometry(radius, cyl, 3, 7), material);
    mesh.position.y = length * 0.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}
