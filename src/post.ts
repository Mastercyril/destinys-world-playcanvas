import {
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TUNE } from './tune';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uHurt: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uHurt;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float n = fract(sin(dot(gl_FragCoord.xy + uTime * 48.0, vec2(12.9898, 78.233))) * 43758.5453);
      color.rgb += (n - 0.5) * 0.038;
      vec2 p = vUv - 0.5;
      float vig = smoothstep(0.92, 0.32, length(p * vec2(1.18, 1.08)));
      color.rgb *= mix(0.58, 1.0, vig);
      float edge = smoothstep(0.42, 0.98, length(p * vec2(1.25, 1.12)));
      color.rgb += vec3(0.20, 0.02, 0.06) * edge * 0.42;
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb += vec3(0.035, 0.0, 0.02) * (1.0 - smoothstep(0.0, 0.5, luma));
      color.rgb = mix(color.rgb, vec3(0.45, 0.02, 0.05), clamp(uHurt, 0.0, 0.72));
      gl_FragColor = color;
    }
  `,
};

export interface PostStack {
  composer: EffectComposer;
  grade: ShaderPass;
  ssao: SSAOPass;
  bloom: UnrealBloomPass;
  resize: (w: number, h: number) => void;
}

export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
    stencil: false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TUNE.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TUNE.pixelRatioCap));
  return renderer;
}

export function createPost(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
): PostStack {
  const size = new Vector2();
  renderer.getSize(size);
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));

  const ssao = new SSAOPass(scene, camera, size.x, size.y, TUNE.ssaoKernel);
  ssao.kernelRadius = TUNE.ssaoRadius;
  ssao.minDistance = 0.002;
  ssao.maxDistance = 0.08;
  ssao.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssao);

  const bloom = new UnrealBloomPass(
    size,
    TUNE.bloomStrength,
    TUNE.bloomRadius,
    TUNE.bloomThreshold,
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  (grade.material as ShaderMaterial).toneMapped = false;
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  return {
    composer,
    grade,
    ssao,
    bloom,
    resize: (w: number, h: number) => {
      composer.setSize(w, h);
      ssao.setSize(w, h);
      bloom.setSize(w, h);
    },
  };
}
