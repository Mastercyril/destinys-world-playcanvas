import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SphereGeometry,
  type Texture,
} from 'three';
import type { SurfaceMaps } from './assets';
import { TUNE } from './tune';

const ghostMat = new MeshBasicMaterial({
  color: 0x7dffb2,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
});

export function setGhostColor(valid: boolean): void {
  ghostMat.color.setHex(valid ? 0x7dffb2 : 0xff4d5a);
}

export function paintGhost(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = ghostMat;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
}

export function enableLights(root: Object3D): void {
  root.traverse((obj) => {
    const light = obj as PointLight;
    if (light.isLight) light.layers.enable(1);
  });
}

function metalMat(maps: SurfaceMaps, color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    color,
    roughness: 0.62,
    metalness: 0.72,
  });
}

function woodMat(wood: Texture): MeshStandardMaterial {
  return new MeshStandardMaterial({ map: wood, color: 0x8a7058, roughness: 0.86, metalness: 0.02 });
}

export function makeBarricade(wood: Texture, maps: SurfaceMaps): Group {
  const g = new Group();
  const plank = woodMat(wood);
  const steel = metalMat(maps, 0x8d8680);
  const board = new Mesh(new BoxGeometry(1.7, 0.18, 0.08), plank);
  board.position.y = 0.92;
  board.castShadow = true;
  const rail = new Mesh(new BoxGeometry(1.7, 0.08, 0.06), steel);
  rail.position.y = 0.62;
  rail.castShadow = true;
  g.add(board, rail);
  for (const x of [-0.62, 0.62]) {
    const legA = new Mesh(new BoxGeometry(0.07, 1.0, 0.07), steel);
    legA.position.set(x, 0.5, 0.12);
    legA.rotation.x = 0.22;
    const legB = legA.clone();
    legB.position.z = -0.12;
    legB.rotation.x = -0.22;
    legA.castShadow = true;
    legB.castShadow = true;
    g.add(legA, legB);
  }
  g.userData.half = { hx: 0.86, hy: 1.05, hz: 0.28 };
  return g;
}

export function makeCrate(wood: Texture): Group {
  const g = new Group();
  const mat = woodMat(wood);
  const box = new Mesh(new BoxGeometry(0.74, 0.74, 0.74), mat);
  box.position.y = 0.37;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);
  for (const y of [0.18, 0.56]) {
    const band = new Mesh(new BoxGeometry(0.78, 0.06, 0.78), mat);
    band.position.y = y;
    band.castShadow = true;
    g.add(band);
  }
  g.userData.half = { hx: 0.39, hy: 0.74, hz: 0.39 };
  return g;
}

export function makeLamp(maps: SurfaceMaps, live: boolean): Group {
  const g = new Group();
  const steel = metalMat(maps, 0xb0a79c);
  for (let i = 0; i < 3; i++) {
    const leg = new Mesh(new CylinderGeometry(0.025, 0.03, 1.15, 6), steel);
    const a = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.22, 0.55, Math.sin(a) * 0.22);
    leg.rotation.z = Math.cos(a) * 0.22;
    leg.rotation.x = -Math.sin(a) * 0.22;
    leg.castShadow = true;
    g.add(leg);
  }
  const mast = new Mesh(new CylinderGeometry(0.035, 0.04, 0.55, 8), steel);
  mast.position.y = 1.2;
  mast.castShadow = true;
  const head = new Mesh(new BoxGeometry(0.22, 0.16, 0.22), steel);
  head.position.y = 1.5;
  head.castShadow = true;
  const bulb = new Mesh(
    new SphereGeometry(0.07, 10, 8),
    new MeshBasicMaterial({ color: 0xffe2c4 }),
  );
  bulb.position.y = 1.42;
  g.add(mast, head, bulb);
  if (live) {
    const light = new PointLight(0xffc29a, TUNE.placedLampIntensity, TUNE.placedLampDistance, 2);
    light.position.y = 1.45;
    light.name = 'placed-lamp';
    light.layers.enable(1);
    g.add(light);
  }
  g.userData.half = { hx: 0.34, hy: 1.58, hz: 0.34 };
  return g;
}

export function makeCar(maps: SurfaceMaps): Group {
  const g = new Group();
  const paint = metalMat(maps, 0x6a717c);
  const glass = new MeshStandardMaterial({
    color: 0x0c1218,
    roughness: 0.08,
    metalness: 0.7,
    envMapIntensity: 0.35,
  });
  const body = new Mesh(new BoxGeometry(1.75, 0.7, 4.3), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  body.receiveShadow = true;
  const cab = new Mesh(new BoxGeometry(1.55, 0.55, 2.0), glass);
  cab.position.set(0, 1.15, -0.15);
  cab.castShadow = true;
  g.add(body, cab);
  const wheel = new Mesh(new CylinderGeometry(0.28, 0.28, 0.18, 10), metalMat(maps, 0x222222));
  wheel.rotation.z = Math.PI / 2;
  for (const [x, z] of [
    [-0.85, 1.35],
    [0.85, 1.35],
    [-0.85, -1.35],
    [0.85, -1.35],
  ] as const) {
    const w = wheel.clone();
    w.position.set(x, 0.28, z);
    w.castShadow = true;
    g.add(w);
  }
  return g;
}

export function makeLocker(maps: SurfaceMaps): Group {
  const g = new Group();
  const steel = metalMat(maps, 0x9aa2a8);
  const shell = new Mesh(new BoxGeometry(0.78, 1.85, 0.55), steel);
  shell.position.y = 0.95;
  shell.castShadow = true;
  shell.receiveShadow = true;
  const cavity = new Mesh(
    new BoxGeometry(0.5, 1.2, 0.08),
    new MeshStandardMaterial({ color: 0x1a0a12, emissive: 0x6a2050, emissiveIntensity: 0.7, roughness: 0.4 }),
  );
  cavity.position.set(0, 1.05, 0.24);
  const door = new Mesh(new BoxGeometry(0.7, 1.7, 0.05), steel);
  door.position.set(0.42, 0.95, 0.34);
  door.rotation.y = -0.7;
  door.castShadow = true;
  g.add(shell, cavity, door);
  return g;
}

export function makePosterStand(poster: Texture, maps: SurfaceMaps): Group {
  const g = new Group();
  const steel = metalMat(maps, 0x888078);
  for (const x of [-0.55, 0.55]) {
    const post = new Mesh(new CylinderGeometry(0.04, 0.05, 1.7, 6), steel);
    post.position.set(x, 0.85, 0);
    post.castShadow = true;
    g.add(post);
  }
  const board = new Mesh(new BoxGeometry(1.35, 1.7, 0.06), new MeshStandardMaterial({ map: poster, roughness: 0.85 }));
  board.position.y = 1.25;
  board.castShadow = true;
  g.add(board);
  return g;
}

export function makeClock(clock: Texture): Group {
  const g = new Group();
  const face = new Mesh(
    new BoxGeometry(0.72, 0.72, 0.06),
    new MeshStandardMaterial({ map: clock, roughness: 0.45, metalness: 0.15 }),
  );
  const rim = new Mesh(
    new BoxGeometry(0.82, 0.82, 0.05),
    new MeshStandardMaterial({ color: 0x1a120e, roughness: 0.5, metalness: 0.4 }),
  );
  rim.position.z = 0.02;
  face.position.z = -0.02;
  g.add(rim, face);
  return g;
}

export function makeDocket(page: Texture, wood: Texture): Group {
  const g = new Group();
  const stand = new Mesh(new BoxGeometry(0.46, 1.05, 0.46), woodMat(wood));
  stand.position.y = 0.52;
  stand.castShadow = true;
  const paper = new Mesh(
    new BoxGeometry(0.42, 0.56, 0.02),
    new MeshStandardMaterial({ map: page, roughness: 0.7 }),
  );
  paper.position.set(0, 1.12, -0.16);
  paper.rotation.x = -0.5;
  g.add(stand, paper);
  return g;
}

export function makeShard(): Mesh {
  const mesh = new Mesh(
    new SphereGeometry(0.16, 6, 5),
    new MeshBasicMaterial({ color: 0xf0c6ff }),
  );
  mesh.scale.set(0.55, 1.4, 0.4);
  mesh.name = 'fragment-shard';
  return mesh;
}

export function halfOf(group: Group): { hx: number; hy: number; hz: number } {
  const half = group.userData.half as { hx: number; hy: number; hz: number } | undefined;
  return half ?? { hx: 0.4, hy: 1, hz: 0.4 };
}
