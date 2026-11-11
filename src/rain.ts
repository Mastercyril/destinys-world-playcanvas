import { InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';

const COUNT = 680;

/** Vertical streaks parented around the camera. Frustum culling is off so the cloud can travel. */
export class Rain {
  readonly mesh: InstancedMesh;
  private readonly px = new Float32Array(COUNT);
  private readonly py = new Float32Array(COUNT);
  private readonly pz = new Float32Array(COUNT);
  private readonly dummy = new Object3D();

  constructor() {
    const geo = new PlaneGeometry(0.012, 0.72);
    const mat = new MeshBasicMaterial({
      color: 0xd5deea,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.mesh = new InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    for (let i = 0; i < COUNT; i++) this.reset(i, true);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private reset(i: number, anywhere: boolean): void {
    this.px[i] = (Math.random() - 0.5) * 28;
    this.py[i] = anywhere ? Math.random() * 16 : 14 + Math.random() * 4;
    this.pz[i] = (Math.random() - 0.5) * 28;
  }

  update(dt: number, camX: number, camZ: number, yaw: number): void {
    for (let i = 0; i < COUNT; i++) {
      this.py[i] -= dt * (14 + (i % 7));
      this.px[i] += dt * 1.4;
      if (this.py[i] < 0) this.reset(i, false);
      this.dummy.position.set(camX + this.px[i], this.py[i], camZ + this.pz[i]);
      this.dummy.rotation.set(0, yaw, 0.08);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
