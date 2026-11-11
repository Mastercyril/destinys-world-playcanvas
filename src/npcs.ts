import { Group, Object3D, Scene } from 'three';
import type { CollisionWorld } from './collision';
import { createPuppet, layDown, type CastGltf, type Puppet } from './rigs';

interface Wanderer {
  puppet: Puppet;
  anchor: Object3D;
}

/**
 * A stranded civilian on the sidewalk and a body in the precinct hall.
 * Both are the CC0 MakeHuman cast, dressed by material rather than a second fiction.
 */
export class Bystanders {
  private readonly people: Wanderer[] = [];

  constructor(cast: CastGltf, scene: Scene, world: CollisionWorld) {
    const civilian = createPuppet(cast.civilian, 'civilian');
    const civilianAnchor = new Group();
    civilianAnchor.name = 'stranded-civilian';
    civilianAnchor.add(civilian.model);
    civilianAnchor.position.set(-4.35, 0.18, 18.55);
    civilianAnchor.rotation.y = 0.9;
    scene.add(civilianAnchor);
    world.add({
      id: 'civilian',
      tag: 'static',
      minX: -4.7,
      maxX: -4.0,
      minY: 0.18,
      maxY: 1.7,
      minZ: 18.2,
      maxZ: 18.9,
    });
    this.people.push({ puppet: civilian, anchor: civilianAnchor });

    const victim = createPuppet(cast.inmate, 'victim');
    layDown(victim.model);
    const victimAnchor = new Group();
    victimAnchor.name = 'folded-victim';
    victimAnchor.add(victim.model);
    // North side of the precinct hall, clear of the evidence locker.
    victimAnchor.position.set(-19.4, 0.18, 16.15);
    victimAnchor.rotation.y = 0.4;
    scene.add(victimAnchor);
    world.add({
      id: 'victim',
      tag: 'static',
      minX: -20.2,
      maxX: -18.5,
      minY: 0.18,
      maxY: 0.7,
      minZ: 15.6,
      maxZ: 16.8,
    });
    this.people.push({ puppet: victim, anchor: victimAnchor });
  }

  update(dt: number, px: number, pz: number): void {
    for (const person of this.people) {
      const dx = person.anchor.position.x - px;
      const dz = person.anchor.position.z - pz;
      person.puppet.play('idle');
      person.puppet.update(dt, Math.hypot(dx, dz));
    }
  }
}
