import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  SpotLight,
  Vector3,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CollisionWorld } from './collision';
import { createPuppet, type Puppet } from './rigs';
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
  readonly lamp: SpotLight;
  nightVision = false;
  private mirrorPuppet: Puppet | null = null;
  private hands: Puppet | null = null;
  private armPose = { x: 0.6, y: 0.8, z: -1.2 };

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
    this.body = new Group();
    this.body.name = 'alex-reflection';
    this.viewmodel = new Group();
    this.viewmodel.name = 'alex-hands';
    camera.add(this.viewmodel);
    this.lamp = new SpotLight(0xfff0d2, 42, 20, 0.46, 0.55, 1.6);
    this.lamp.position.set(0.16, -0.14, -0.15);
    this.lamp.target.position.set(0.05, -0.28, -6);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(512, 512);
    this.lamp.shadow.bias = -0.0008;
    this.lamp.shadow.camera.near = 0.2;
    this.lamp.shadow.camera.far = 18;
    this.lamp.layers.enable(1);
    this.lamp.shadow.camera.layers.enable(1);
    camera.add(this.lamp);
    camera.add(this.lamp.target);
  }

  /** Suited MakeHuman body for the mirror, and the same rig as first-person hands. */
  mount(gltf: GLTF): void {
    const mirror = createPuppet(gltf, 'detective');
    mirror.model.traverse((obj) => {
      obj.layers.set(1);
    });
    this.body.add(mirror.model);
    this.mirrorPuppet = mirror;

    const hands = createPuppet(gltf, 'detective', 'flashlight');
    hands.model.traverse((obj) => {
      obj.layers.set(2);
      obj.castShadow = false;
    });
    this.alignToEyes(hands.model);
    this.viewmodel.add(hands.model);
    this.hands = hands;
    const palm = hands.model.getObjectByName('hand_r');
    if (palm) palm.add(camcorderMesh());
  }

  toggleNight(): void {
    this.nightVision = !this.nightVision;
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
    if (this.swing === 'ready') return;
    this.swingT -= dt;
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
    }
  }

  updatePresentation(dt: number): void {
    const moving = Math.hypot(this.vx, this.vz);
    const stride = moving > 2.8 ? 'run' : moving > 0.35 ? 'walk' : 'idle';
    this.mirrorPuppet?.play(stride);
    this.mirrorPuppet?.update(dt);
    const striking = this.swing === 'windup' || this.swing === 'active';
    this.hands?.play(striking ? 'attack' : 'hold');
    this.hands?.update(dt);
    this.poseArms();
    this.viewmodel.position.y = this.crouching ? -0.32 : 0;
    this.lamp.color.setHex(this.nightVision ? 0xc8ffd2 : 0xfff0d2);
    this.lamp.intensity = this.nightVision ? 10 : 46;
  }

  setArms(x: number, y: number, z: number): void {
    this.armPose = { x, y, z };
    this.poseArms();
  }

  handLocal(): { x: number; y: number; z: number } | null {
    const hand = this.hands?.model.getObjectByName('hand_r');
    if (!hand) return null;
    const v = new Vector3();
    hand.getWorldPosition(v);
    this.camera.worldToLocal(v);
    return { x: v.x, y: v.y, z: v.z };
  }

  private poseArms(): void {
    const bend = (name: string, x: number, y: number, z: number) => {
      const bone = this.hands?.model.getObjectByName(name);
      if (!bone) return;
      bone.rotation.set(x, y, z);
    };
    // Applied after the mixer so the camcorder sits in front of the lens.
    const a = this.armPose;
    bend('upperarm_r', a.x, a.y, a.z);
    bend('lowerarm_r', a.x * 0.65, 0.1, 0.1);
    bend('upperarm_l', a.x * 0.85, -a.y, -a.z);
    bend('lowerarm_l', a.x * 0.45, -0.1, -0.1);
  }

  private alignToEyes(model: Object3D): void {
    model.updateWorldMatrix(true, true);
    const head = model.getObjectByName('head');
    if (!head) return;
    const headPos = new Object3D();
    head.getWorldPosition(headPos.position);
    model.position.sub(headPos.position);
    // Drop the skull behind the near plane and bring the forearms into the lower frame.
    model.position.z += 0.34;
    model.position.y -= 0.2;
    model.position.x += 0.04;
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

function camcorderMesh(): Object3D {
  const rig = new Group();
  const body = new Mesh(
    new BoxGeometry(0.07, 0.1, 0.16),
    new MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.45, metalness: 0.4 }),
  );
  const lens = new Mesh(
    new BoxGeometry(0.04, 0.04, 0.02),
    new MeshBasicMaterial({ color: 0xfff4dd }),
  );
  lens.position.set(0, 0.01, -0.09);
  body.position.set(0.02, 0.04, 0.04);
  rig.add(body, lens);
  rig.traverse((obj) => obj.layers.set(2));
  return rig;
}
