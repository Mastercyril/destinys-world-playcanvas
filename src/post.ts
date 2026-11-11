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
    uNight: { value: 0 },
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
    uniform float uNight;
    varying vec2 vUv;
    void main() {
      vec2 off = (vUv - 0.5) * 0.008;
      float r = texture2D(tDiffuse, vUv + off).r;
      float gch = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - off).b;
      vec3 color = vec3(r, gch, b);
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 teal = color * vec3(0.45, 0.78, 0.82);
      vec3 warm = color * vec3(1.08, 0.86, 0.68);
      color = mix(teal, warm, smoothstep(0.08, 0.62, luma));
      float n = fract(sin(dot(gl_FragCoord.xy + uTime * 60.0, vec2(12.9898, 78.233))) * 43758.5453);
      color.rgb += (n - 0.5) * 0.055;
      vec2 p = vUv - 0.5;
      float vig = smoothstep(0.88, 0.28, length(p * vec2(1.2, 1.12)));
      color.rgb *= mix(0.42, 1.0, vig);
      vec3 nv = vec3(luma * 0.25, luma * 1.25, luma * 0.32);
      nv += sin(gl_FragCoord.y * 1.7 + uTime * 9.0) * 0.035;
      color = mix(color, nv, clamp(uNight, 0.0, 1.0));
      color = mix(color, vec3(0.42, 0.03, 0.03), clamp(uHurt, 0.0, 0.72));
      gl_FragColor = vec4(color, 1.0);
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
