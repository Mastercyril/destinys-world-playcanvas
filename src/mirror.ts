import {
  Color,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  HalfFloatType,
  Scene,
  WebGLRenderer,
  Camera,
} from 'three';

/**
 * Shop-window reflection delayed by half a second.
 * Oblique near-plane clip follows Lengyel, as in three.js Reflector (MIT).
 * The displayed frame is the capture from ~0.5s earlier, so the coat lags.
 */
const SLOT_COUNT = 6;
const CAPTURE_EVERY = 0.1;
const DELAY = 0.5;

interface Slot {
  ready: boolean;
  time: number;
  target: WebGLRenderTarget;
  matrix: Matrix4;
}

export class DelayedMirror {
  readonly mesh: Mesh;
  private readonly slots: Slot[];
  private readonly virtualCamera = new PerspectiveCamera();
  private readonly material: ShaderMaterial;
  private cursor = 0;
  private acc = CAPTURE_EVERY;
  private primed = false;

  constructor(width: number, height: number) {
    this.slots = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      this.slots.push({
        ready: false,
        time: 0,
        target: new WebGLRenderTarget(384, 384, { type: HalfFloatType, samples: 0 }),
        matrix: new Matrix4(),
      });
    }
    this.material = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.slots[0].target.texture },
        textureMatrix: { value: new Matrix4() },
        color: { value: new Color(0.78, 0.84, 0.95) },
      },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vMirrorUv;
        void main() {
          vMirrorUv = textureMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec3 color;
        varying vec4 vMirrorUv;
        void main() {
          vec4 base = texture2DProj(tDiffuse, vMirrorUv);
          gl_FragColor = vec4(base.rgb * color, 1.0);
        }
      `,
    });
    this.material.toneMapped = false;
    this.material.fog = false;
    this.mesh = new Mesh(new PlaneGeometry(width, height), this.material);
    this.mesh.name = 'shop-window';
  }

  update(renderer: WebGLRenderer, scene: Scene, camera: Camera, dt: number, now: number): void {
    this.acc += dt;
    if (!this.primed || this.acc >= CAPTURE_EVERY) {
      this.acc = 0;
      this.capture(renderer, scene, camera, now);
      this.primed = true;
    }
    this.present(now);
  }

  private present(now: number): void {
    let latest: Slot | null = null;
    let delayed: Slot | null = null;
    for (const slot of this.slots) {
      if (!slot.ready) continue;
      if (!latest || slot.time > latest.time) latest = slot;
      if (slot.time <= now - DELAY && (!delayed || slot.time > delayed.time)) delayed = slot;
    }
    const use = delayed ?? latest;
    if (!use) return;
    this.material.uniforms.tDiffuse.value = use.target.texture;
    (this.material.uniforms.textureMatrix.value as Matrix4).copy(use.matrix);
  }

  private capture(renderer: WebGLRenderer, scene: Scene, camera: Camera, now: number): void {
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % this.slots.length;
    const scope = this.mesh;
    const virtualCamera = this.virtualCamera;
    const clipBias = 0.003;

    const reflectorWorldPosition = _reflectorWorldPosition;
    const cameraWorldPosition = _cameraWorldPosition;
    const rotationMatrix = _rotationMatrix;
    const normal = _normal;
    const view = _view;
    const lookAtPosition = _lookAtPosition;
    const target = _target;
    const textureMatrix = slot.matrix;
    const reflectorPlane = _reflectorPlane;
    const clipPlane = _clipPlane;
    const q = _q;

    reflectorWorldPosition.setFromMatrixPosition(scope.matrixWorld);
    cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    rotationMatrix.extractRotation(scope.matrixWorld);
    normal.set(0, 0, 1).applyMatrix4(rotationMatrix);
    view.subVectors(reflectorWorldPosition, cameraWorldPosition);
    if (view.dot(normal) > 0) return;

    view.reflect(normal).negate();
    view.add(reflectorWorldPosition);

    rotationMatrix.extractRotation(camera.matrixWorld);
    lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);
    target.subVectors(reflectorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(reflectorWorldPosition);

    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.far = (camera as PerspectiveCamera).far || 120;
    virtualCamera.updateMatrixWorld();
    virtualCamera.projectionMatrix.copy((camera as PerspectiveCamera).projectionMatrix);
    virtualCamera.layers.set(0);
    virtualCamera.layers.enable(1);

    textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
    textureMatrix.multiply(virtualCamera.projectionMatrix);
    textureMatrix.multiply(virtualCamera.matrixWorldInverse);
    textureMatrix.multiply(scope.matrixWorld);

    reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
    clipPlane.set(reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant);
    const projectionMatrix = virtualCamera.projectionMatrix;
    q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    q.z = -1;
    q.w = (1 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
    clipPlane.multiplyScalar(2 / clipPlane.dot(q));
    projectionMatrix.elements[2] = clipPlane.x;
    projectionMatrix.elements[6] = clipPlane.y;
    projectionMatrix.elements[10] = clipPlane.z + 1 - clipBias;
    projectionMatrix.elements[14] = clipPlane.w;

    const currentRenderTarget = renderer.getRenderTarget();
    const currentXr = renderer.xr.enabled;
    const currentShadow = renderer.shadowMap.autoUpdate;
    scope.visible = false;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(slot.target);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear();
    renderer.render(scene, virtualCamera);
    renderer.xr.enabled = currentXr;
    renderer.shadowMap.autoUpdate = currentShadow;
    renderer.setRenderTarget(currentRenderTarget);
    scope.visible = true;
    slot.time = now;
    slot.ready = true;
  }
}

const _reflectorWorldPosition = new Vector3();
const _cameraWorldPosition = new Vector3();
const _rotationMatrix = new Matrix4();
const _normal = new Vector3();
const _view = new Vector3();
const _lookAtPosition = new Vector3();
const _target = new Vector3();
const _reflectorPlane = new Plane();
const _clipPlane = new Vector4();
const _q = new Vector4();
