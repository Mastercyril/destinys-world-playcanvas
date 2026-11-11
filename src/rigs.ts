import {
  AnimationClip,
  AnimationMixer,
  Box3,
  CanvasTexture,
  Color,
  Euler,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  SkinnedMesh,
  SRGBColorSpace,
  type AnimationAction,
  type Material,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { WebGLRenderer } from 'three';

export type SkinKind = 'ancient' | 'victim' | 'civilian' | 'detective';

export interface CastGltf {
  inmate: GLTF;
  civilian: GLTF;
  detective: GLTF;
}

export interface Puppet {
  model: Object3D;
  mixer: AnimationMixer;
  play: (name: string, once?: boolean) => void;
  update: (dt: number, distance?: number) => void;
}

/**
 * MakeHuman bodies (CC0) compressed with Meshopt + KTX2.
 * Basis transcoder is served from /basis next to the page.
 */
export async function loadCast(renderer: WebGLRenderer): Promise<CastGltf> {
  const base = import.meta.env.BASE_URL;
  const ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const load = (file: string) => loader.loadAsync(`${base}assets/models/${file}`);
  const [inmate, civilian, detective] = await Promise.all([
    load('inmate.glb'),
    load('civilian.glb'),
    load('detective.glb'),
  ]);
  return { inmate, civilian, detective };
}

export function createPuppet(gltf: GLTF, kind: SkinKind, pose: 'stand' | 'flashlight' = 'stand'): Puppet {
  const model = cloneSkeleton(gltf.scene) as Object3D;
  model.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const source = mesh.material;
    const list = Array.isArray(source) ? source : [source];
    const styled = list.map((mat) => styleMaterial(mat, kind));
    mesh.material = Array.isArray(source) ? styled : styled[0];
  });

  if (kind === 'ancient') gaunt(model);

  const mixer = new AnimationMixer(model);
  const actions: Record<string, AnimationAction> = {};
  for (const clip of gltf.animations) {
    actions[clip.name] = mixer.clipAction(clip, model);
    actions[clip.name].loop = LoopRepeat;
  }
  const idleClip = gltf.animations.find((clip) => clip.name === 'idle');
  const attack = armAttack(idleClip);
  if (attack) {
    actions.attack = mixer.clipAction(attack, model);
    actions.attack.loop = LoopOnce;
    actions.attack.clampWhenFinished = true;
  }
  const held = holdClip(idleClip);
  if (held) {
    actions.hold = mixer.clipAction(held, model);
    actions.hold.loop = LoopRepeat;
  }

  let current = '';
  let currentAction: AnimationAction | null = null;
  let acc = 0;
  const play = (name: string, once = false) => {
    if (current === name && !once) return;
    const next = actions[name];
    if (!next) return;
    if (once) {
      next.reset();
      next.loop = LoopOnce;
      next.clampWhenFinished = true;
    }
    next.reset().fadeIn(0.18).play();
    currentAction?.fadeOut(0.18);
    currentAction = next;
    current = name;
  };
  play(pose === 'flashlight' && actions.hold ? 'hold' : 'idle');
  mixer.update(0);
  plantFeet(model);

  return {
    model,
    mixer,
    play,
    update: (dt: number, distance = 0) => {
      // Far puppets tick every third frame. The Ancient One passes distance 0 and stays smooth.
      if (distance > 16) {
        acc += dt;
        if (acc < 0.05) return;
        dt = acc;
        acc = 0;
      }
      mixer.update(dt);
    },
  };
}

function plantFeet(model: Object3D): void {
  model.updateWorldMatrix(true, true);
  model.traverse((obj) => {
    const skinned = obj as SkinnedMesh;
    if (skinned.isSkinnedMesh) skinned.skeleton.update();
  });
  const box = new Box3().setFromObject(model);
  if (Number.isFinite(box.min.y)) model.position.y -= box.min.y;
}

function gaunt(model: Object3D): void {
  for (const name of ['spine_01', 'spine_02', 'spine_03', 'neck_01']) {
    const bone = model.getObjectByName(name);
    if (!bone) continue;
    bone.scale.x *= 0.72;
    bone.scale.z *= 0.72;
  }
  const neck = model.getObjectByName('neck_01');
  if (neck) neck.scale.y *= 1.18;
  for (const name of ['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r']) {
    const bone = model.getObjectByName(name);
    if (bone) bone.scale.y *= 1.14;
  }
}

function styleMaterial(source: Material, kind: SkinKind): MeshPhysicalMaterial {
  const std = source as MeshStandardMaterial;
  const name = std.name || '';
  const cloth = /suit|shoe/i.test(name);
  const blood = bloodMap(kind);
  const ancient = kind === 'ancient';
  const victim = kind === 'victim';
  const mat = new MeshPhysicalMaterial({
    name,
    map: std.map ?? null,
    normalMap: std.normalMap ?? null,
    roughnessMap: std.roughnessMap ?? null,
    color: cloth ? 0x6e7278 : ancient ? 0x5c463f : victim ? 0x6a4e48 : 0x8d756c,
    roughness: cloth ? 0.62 : ancient ? 0.28 : 0.46,
    metalness: cloth ? 0.08 : 0.02,
    sheen: cloth ? 0.15 : 0.62,
    sheenColor: new Color(ancient || victim ? 0x6a140f : 0x3a2018),
    sheenRoughness: 0.35,
    clearcoat: cloth ? 0.08 : ancient ? 0.55 : victim ? 0.28 : 0.12,
    clearcoatRoughness: ancient ? 0.12 : 0.28,
    thickness: cloth ? 0 : 0.55,
    attenuationColor: new Color(0x7a1a14),
    attenuationDistance: ancient ? 0.22 : 0.4,
    emissive: new Color(ancient ? 0x1a0808 : 0x000000),
    emissiveIntensity: ancient ? 0.22 : 0,
    envMapIntensity: 0.35,
  });
  if (!cloth && (ancient || victim)) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uBlood = { value: blood };
      shader.fragmentShader =
        'uniform sampler2D uBlood;\n' +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           vec4 stain = texture2D(uBlood, vMapUv);
           diffuseColor.rgb = mix(diffuseColor.rgb, stain.rgb, stain.a);`,
        );
    };
  }
  return mat;
}

const bloodTextures = new Map<string, CanvasTexture>();

function bloodMap(kind: SkinKind): CanvasTexture {
  const key = kind === 'ancient' || kind === 'victim' ? kind : 'light';
  const cached = bloodTextures.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('blood canvas');
  g.clearRect(0, 0, 512, 512);
  const blot = (x: number, y: number, rx: number, ry: number, color: string, alpha: number) => {
    g.fillStyle = color;
    g.globalAlpha = alpha;
    g.beginPath();
    g.ellipse(x, y, rx, ry, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  };
  const heavy = key !== 'light';
  for (let i = 0; i < (heavy ? 36 : 12); i++) {
    blot(
      Math.random() * 512,
      Math.random() * 512,
      6 + Math.random() * (heavy ? 22 : 12),
      3 + Math.random() * 10,
      i % 4 === 0 ? '#1a0908' : i % 3 === 0 ? '#5a1410' : '#8a2018',
      heavy ? 0.28 + Math.random() * 0.3 : 0.12,
    );
  }
  g.globalAlpha = 1;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  bloodTextures.set(key, texture);
  return texture;
}

function holdClip(idle: AnimationClip | undefined): AnimationClip | null {
  if (!idle) return null;
  const tracks = armTracks(idle, (name, rest) => {
    const side = name.includes('_l') ? -1 : 1;
    const aim = new Quaternion().setFromEuler(new Euler(-1.45, side * 0.05, side * 0.35));
    return rest.clone().multiply(aim).normalize();
  });
  if (!tracks.length) return null;
  return new AnimationClip('hold', 1, tracks);
}

function armAttack(idle: AnimationClip | undefined): AnimationClip | null {
  if (!idle) return null;
  const tracks = armTracks(idle, (name, rest) => {
    const side = name.includes('_l') ? -1 : 1;
    const swing = new Quaternion().setFromEuler(new Euler(0.45, side * 0.2, side * 0.35));
    return rest.clone().multiply(swing).normalize();
  });
  if (!tracks.length) return null;
  // Two poses: the held light, then a short strike, then the light again.
  const keyed = tracks.map((track) => {
    const rest = idle.tracks.find((item) => item.name === track.name);
    const r = rest ? rest.values : track.values;
    const q = new Quaternion(r[0], r[1], r[2], r[3]);
    const q2 = new Quaternion(track.values[0], track.values[1], track.values[2], track.values[3]);
    return new QuaternionKeyframeTrack(track.name, [0, 0.18, 0.36, 0.62], [
      q.x, q.y, q.z, q.w,
      q2.x, q2.y, q2.z, q2.w,
      q.x, q.y, q.z, q.w,
      q.x, q.y, q.z, q.w,
    ]);
  });
  return new AnimationClip('attack', 0.62, keyed);
}

function armTracks(
  idle: AnimationClip,
  pose: (name: string, rest: Quaternion) => Quaternion,
): QuaternionKeyframeTrack[] {
  const tracks: QuaternionKeyframeTrack[] = [];
  for (const track of idle.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    if (!/upperarm_|lowerarm_|clavicle_/.test(track.name)) continue;
    const rest = new Quaternion(track.values[0], track.values[1], track.values[2], track.values[3]);
    const q = pose(track.name, rest);
    tracks.push(new QuaternionKeyframeTrack(track.name, [0, 1], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
  }
  return tracks;
}

export function layDown(model: Object3D): void {
  model.rotation.z = Math.PI / 2;
  model.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(model);
  if (Number.isFinite(box.min.y)) model.position.y -= box.min.y;
}
