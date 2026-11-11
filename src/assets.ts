import {
  ColorSpace,
  EquirectangularReflectionMapping,
  LinearSRGBColorSpace,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

/**
 * CC0 textures and HDRI from Poly Haven, committed under public/assets.
 * See public/assets/CREDITS.txt.
 */
const FILES = {
  asphalt: ['asphalt_diff.jpg', 'asphalt_nor.jpg', 'asphalt_rough.jpg'],
  brick: ['brick_diff.jpg', 'brick_nor.jpg', 'brick_rough.jpg'],
  concrete: ['concrete_diff.jpg', 'concrete_nor.jpg', 'concrete_rough.jpg'],
  metal: ['metal_diff.jpg', 'metal_nor.jpg', 'metal_rough.jpg'],
  plaster: ['plaster_diff.jpg', 'plaster_nor.jpg', 'plaster_rough.jpg'],
} as const;

export interface SurfaceMaps {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
}

export interface AssetLibrary {
  env: Texture;
  asphalt: SurfaceMaps;
  brick: SurfaceMaps;
  concrete: SurfaceMaps;
  metal: SurfaceMaps;
  plaster: SurfaceMaps;
}

function baseUrl(): string {
  return import.meta.env.BASE_URL;
}

function prep(texture: Texture, colorSpace: ColorSpace, anisotropy: number): Texture {
  texture.colorSpace = colorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}

export async function loadAssets(renderer: WebGLRenderer, onProgress: (ratio: number) => void): Promise<AssetLibrary> {
  const loader = new TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const jobs: Promise<void>[] = [];
  let done = 0;
  const total = Object.keys(FILES).length * 3 + 1;
  const bump = () => {
    done += 1;
    onProgress(done / total);
  };

  const loadTex = (file: string, colorSpace: ColorSpace) =>
    new Promise<Texture>((resolve, reject) => {
      loader.load(
        `${baseUrl()}assets/textures/${file}`,
        (texture) => {
          prep(texture, colorSpace, anisotropy);
          bump();
          resolve(texture);
        },
        undefined,
        () => reject(new Error(`Missing texture ${file}`)),
      );
    });

  const surfaces = {} as Record<keyof typeof FILES, SurfaceMaps>;
  for (const key of Object.keys(FILES) as (keyof typeof FILES)[]) {
    const [diff, nor, rough] = FILES[key];
    jobs.push(
      Promise.all([
        loadTex(diff, SRGBColorSpace),
        loadTex(nor, NoColorSpace),
        loadTex(rough, LinearSRGBColorSpace),
      ]).then(([map, normalMap, roughnessMap]) => {
        surfaces[key] = { map, normalMap, roughnessMap };
      }),
    );
  }

  const envPromise = new Promise<Texture>((resolve, reject) => {
    new RGBELoader().load(
      `${baseUrl()}assets/hdri/cobblestone_street_night_1k.hdr`,
      (hdr) => {
        hdr.mapping = EquirectangularReflectionMapping;
        bump();
        resolve(hdr);
      },
      undefined,
      () => reject(new Error('Missing HDRI')),
    );
  });

  const [env] = await Promise.all([envPromise, ...jobs]);
  onProgress(1);
  return {
    env,
    asphalt: surfaces.asphalt,
    brick: surfaces.brick,
    concrete: surfaces.concrete,
    metal: surfaces.metal,
    plaster: surfaces.plaster,
  };
}
