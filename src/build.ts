import { Group, Scene } from 'three';
import { CollisionWorld, yawAabb } from './collision';
import type { SurfaceMaps } from './assets';
import type { Texture } from 'three';
import { halfOf, makeBarricade, makeCrate, makeLamp, paintGhost, setGhostColor } from './props';

export type Tool = 'hands' | 'barricade' | 'lamp' | 'crate';

const ORDER: Tool[] = ['hands', 'barricade', 'lamp', 'crate'];

export interface Placement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  valid: boolean;
}

/**
 * Session inventory. Barricades are solid to the alien, lamps are real point lights.
 */
export class BuildSystem {
  tool: Tool = 'hands';
  readonly stock: Record<Exclude<Tool, 'hands'>, number> = {
    barricade: 5,
    lamp: 5,
    crate: 5,
  };
  private readonly ghost = new Group();
  private ghostKind: Tool | null = null;
  private seq = 0;

  constructor(
    private readonly scene: Scene,
    private readonly world: CollisionWorld,
    private readonly metal: SurfaceMaps,
    private readonly wood: Texture,
  ) {
    this.ghost.visible = false;
    scene.add(this.ghost);
  }

  cycle(): void {
    const i = ORDER.indexOf(this.tool);
    this.tool = ORDER[(i + 1) % ORDER.length];
  }

  label(): string {
    if (this.tool === 'hands') return '';
    const name = this.tool === 'barricade' ? 'Barricade' : this.tool === 'lamp' ? 'Portable Lamp' : 'Crate';
    return `${name}  ·  ${this.stock[this.tool]} left  ·  click to place`;
  }

  updateGhost(place: Placement | null): void {
    if (this.tool === 'hands' || !place) {
      this.ghost.visible = false;
      return;
    }
    if (this.ghostKind !== this.tool) {
      this.ghost.clear();
      const built =
        this.tool === 'barricade'
          ? makeBarricade(this.wood, this.metal)
          : this.tool === 'lamp'
            ? makeLamp(this.metal, false)
            : makeCrate(this.wood);
      paintGhost(built);
      this.ghost.add(built);
      this.ghostKind = this.tool;
    }
    setGhostColor(place.valid);
    this.ghost.visible = true;
    this.ghost.position.set(place.x, place.y, place.z);
    this.ghost.rotation.y = place.yaw;
  }

  place(place: Placement): boolean {
    if (this.tool === 'hands' || !place.valid) return false;
    const kind = this.tool;
    if (this.stock[kind] <= 0) return false;
    const group =
      kind === 'barricade'
        ? makeBarricade(this.wood, this.metal)
        : kind === 'lamp'
          ? makeLamp(this.metal, true)
          : makeCrate(this.wood);
    group.position.set(place.x, place.y, place.z);
    group.rotation.y = place.yaw;
    this.scene.add(group);
    const half = halfOf(group);
    const id = `${kind}-${this.seq++}`;
    this.world.add(yawAabb(id, 'prop', place.x, place.y, place.z, half.hx, half.hy, half.hz, place.yaw));
    this.stock[kind] -= 1;
    return true;
  }

  placedCount(kind: Exclude<Tool, 'hands'>): number {
    return this.world.boxes.filter((b) => b.id.startsWith(`${kind}-`)).length;
  }
}
