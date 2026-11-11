import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  SphereGeometry,
} from 'three';
import type { CollisionWorld } from './collision';
import { TUNE } from './tune';

const STAND_H = 1.72;
const CROUCH_H = 1.15;
const STAND_EYE = 1.58;
const CROUCH_EYE = 1.02;
const RADIUS = 0.32;

export class Player {
  x = 0;
  y = 0.2;
  z = 0;
  yaw = 0;
  pitch = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  health = TUNE.playerHealth;
  crouching = false;
  crouchLatch = false;
  grounded = false;
  eye = STAND_EYE;
  invuln = 0;
  swing: 'ready' | 'windup' | 'active' | 'cooldown' = 'ready';
  private swingT = 0;
  private swingHit = false;
  readonly radius = RADIUS;
  readonly camera: PerspectiveCamera;
  readonly body: Group;
  readonly viewmodel: Group;
  private readonly baton: Mesh;

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
    this.body = buildCoat();
    this.viewmodel = new Group();
    this.viewmodel.layers.set(2);
    const mat = new MeshStandardMaterial({ color: 0x2a241c, roughness: 0.45, metalness: 0.35 });
    this.baton = new Mesh(new BoxGeometry(0.04, 0.04, 0.52), mat);
    this.baton.position.set(0.26, -0.24, -0.48);
    this.baton.layers.set(2);
    this.baton.visible = false;
    this.viewmodel.add(this.baton);
    camera.add(this.viewmodel);
  }

  get height(): number {
    return this.crouching ? CROUCH_H : STAND_H;
  }

  teleport(x: number, y: number, z: number, yaw?: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    if (yaw !== undefined) this.yaw = yaw;
    this.writeCamera();
    this.syncBody();
  }

  lookAt(x: number, y: number, z: number): void {
    const eyeY = this.y + this.eye;
    const dx = x - this.x;
    const dy = y - eyeY;
    const dz = z - this.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    this.writeCamera();
  }

  addLook(dx: number, dy: number): void {
    const sens = 0.00215;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
  }

  /** Integrate wish direction. Returns horizontal speed for footstep timing. */
  integrate(
    dt: number,
    world: CollisionWorld,
    wishX: number,
    wishZ: number,
    sprint: boolean,
    wantCrouch: boolean,
    ignore: ReadonlySet<string>,
    tryHit: () => void,
  ): number {
    if (this.invuln > 0) this.invuln -= dt;
    const standBlocked = world.blocked(this.x, this.y, this.z, this.radius, STAND_H, ignore);
    this.crouching = wantCrouch || (this.crouching && standBlocked && !wantCrouch ? false : wantCrouch);
    if (!wantCrouch && standBlocked) this.crouching = true;
    else this.crouching = wantCrouch;

    const targetEye = this.crouching ? CROUCH_EYE : STAND_EYE;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 12);

    const speed = this.crouching ? 1.55 : sprint ? 5.7 : 3.15;
    const len = Math.hypot(wishX, wishZ);
    const tx = len > 0 ? (wishX / len) * speed : 0;
    const tz = len > 0 ? (wishZ / len) * speed : 0;
    const accel = this.grounded ? 18 : 4;
    this.vx += (tx - this.vx) * Math.min(1, accel * dt);
    this.vz += (tz - this.vz) * Math.min(1, accel * dt);
    if (len === 0 && this.grounded) {
      const damp = Math.max(0, 1 - 10 * dt);
      this.vx *= damp;
      this.vz *= damp;
    }

    if (!world.supported(this.x, this.y, this.z, this.radius, ignore)) this.vy -= 22 * dt;
    else if (this.vy < 0) this.vy = 0;
    this.vy = Math.max(-30, this.vy);

    const body = this.asBody();
    const result = world.move(body, dt, 0.42, ignore);
    this.x = body.x;
    this.y = body.y;
    this.z = body.z;
    this.vx = body.vx;
    this.vy = body.vy;
    this.vz = body.vz;
    this.grounded = result.grounded;
    this.advanceSwing(dt, tryHit);
    this.writeCamera();
    this.syncBody();
    return Math.hypot(this.vx, this.vz);
  }

  startSwing(): boolean {
    if (this.swing !== 'ready') return false;
    this.swing = 'windup';
    this.swingT = 0.2;
    this.swingHit = false;
    return true;
  }

  damage(amount: number): boolean {
    if (this.invuln > 0 || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invuln = 0.55;
    return true;
  }

  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  right(): { x: number; z: number } {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  eyePosition(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y + this.eye, z: this.z };
  }

  private asBody() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      vx: this.vx,
      vy: this.vy,
      vz: this.vz,
      r: this.radius,
      h: this.height,
    };
  }

  private advanceSwing(dt: number, tryHit: () => void): void {
    if (this.swing === 'ready') {
      this.baton.visible = false;
      return;
    }
    this.swingT -= dt;
    this.baton.visible = this.swing === 'windup' || this.swing === 'active';
    const raised = this.swing === 'windup' ? 0.8 : this.swing === 'active' ? -1.15 : 0.2;
    this.baton.rotation.x = raised;
    if (this.swing === 'windup' && this.swingT <= 0) {
      this.swing = 'active';
      this.swingT = 0.09;
    } else if (this.swing === 'active') {
      if (!this.swingHit) {
        this.swingHit = true;
        tryHit();
      }
      if (this.swingT <= 0) {
        this.swing = 'cooldown';
        this.swingT = 0.42;
      }
    } else if (this.swing === 'cooldown' && this.swingT <= 0) {
      this.swing = 'ready';
      this.baton.visible = false;
    }
  }

  writeCamera(): void {
    this.camera.position.set(this.x, this.y + this.eye, this.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.updateMatrixWorld(true);
  }

  syncBody(): void {
    this.body.position.set(this.x, this.y, this.z);
    this.body.rotation.y = this.yaw;
  }
}

function buildCoat(): Group {
  const root = new Group();
  root.name = 'detective-reflection';
  const cloth = new MeshStandardMaterial({ color: 0x3c4452, roughness: 0.82, metalness: 0.04 });
  const dark = new MeshStandardMaterial({ color: 0x23262c, roughness: 0.7, metalness: 0.08 });
  const skin = new MeshStandardMaterial({ color: 0xc2b2a2, roughness: 0.6, metalness: 0 });
  const shirt = new MeshStandardMaterial({ color: 0xd5cbb8, roughness: 0.55, metalness: 0 });

  const coat = new Mesh(new BoxGeometry(0.52, 0.82, 0.28), cloth);
  coat.position.y = 1.18;
  root.add(coat);
  const collar = new Mesh(new BoxGeometry(0.16, 0.16, 0.05), shirt);
  collar.position.set(0, 1.48, -0.13);
  root.add(collar);
  const legGeo = new CapsuleGeometry(0.07, 0.55, 3, 6);
  const legL = new Mesh(legGeo, dark);
  legL.position.set(-0.12, 0.48, 0);
  const legR = legL.clone();
  legR.position.x = 0.12;
  root.add(legL, legR);
  const armGeo = new CapsuleGeometry(0.055, 0.48, 3, 6);
  const armL = new Mesh(armGeo, cloth);
  armL.position.set(-0.34, 1.2, 0);
  armL.rotation.z = 0.18;
  const armR = armL.clone();
  armR.position.x = 0.34;
  armR.rotation.z = -0.18;
  root.add(armL, armR);
  const head = new Mesh(new SphereGeometry(0.13, 12, 10), skin);
  head.position.y = 1.72;
  root.add(head);
  const brim = new Mesh(new CylinderGeometry(0.2, 0.2, 0.025, 16), dark);
  brim.position.y = 1.84;
  const crown = new Mesh(new CylinderGeometry(0.11, 0.12, 0.14, 12), dark);
  crown.position.y = 1.92;
  root.add(brim, crown);

  root.traverse((obj: Object3D) => {
    obj.layers.set(1);
    obj.castShadow = false;
    obj.receiveShadow = true;
  });
  return root;
}
