export type BoxTag = 'ground' | 'static' | 'prop' | 'actor';

export interface Box {
  id: string;
  tag: BoxTag;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  h: number;
}

export interface RayHit {
  id: string;
  tag: BoxTag;
  t: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

const EPS = 1e-4;

export class CollisionWorld {
  boxes: Box[] = [];

  add(box: Box): void {
    this.remove(box.id);
    this.boxes.push(box);
  }

  remove(id: string): void {
    this.boxes = this.boxes.filter((b) => b.id !== id);
  }

  get(id: string): Box | undefined {
    return this.boxes.find((b) => b.id === id);
  }

  setActor(id: string, x: number, y: number, z: number, r: number, h: number): void {
    this.add({
      id,
      tag: 'actor',
      minX: x - r,
      maxX: x + r,
      minY: y,
      maxY: y + h,
      minZ: z - r,
      maxZ: z + r,
    });
  }

  blocked(x: number, y: number, z: number, r: number, h: number, ignore?: ReadonlySet<string>): boolean {
    for (const b of this.boxes) {
      if (ignore?.has(b.id)) continue;
      if (this.overlaps(x, y, z, r, h, b)) return true;
    }
    return false;
  }

  /** True when feet rest on a surface (used to cancel gravity). */
  supported(x: number, y: number, z: number, r: number, ignore?: ReadonlySet<string>): boolean {
    for (const b of this.boxes) {
      if (ignore?.has(b.id)) continue;
      if (b.tag === 'actor') continue;
      if (x + r <= b.minX || x - r >= b.maxX) continue;
      if (z + r <= b.minZ || z - r >= b.maxZ) continue;
      const gap = y - b.maxY;
      if (gap >= -0.02 && gap <= 0.025) return true;
    }
    return false;
  }

  move(body: Body, dt: number, stepHeight: number, ignore?: ReadonlySet<string>): { grounded: boolean } {
    const oldY = body.y;
    body.y += body.vy * dt;

    let grounded = false;
    if (body.vy <= 0) {
      let support = -Infinity;
      let hit = false;
      for (const b of this.boxes) {
        if (ignore?.has(b.id)) continue;
        if (b.tag === 'actor' && b.id !== 'player' && b.id !== 'alien') continue;
        if (!this.overlapXZ(body.x, body.z, body.r, b)) continue;
        if (oldY >= b.maxY - 0.02 && body.y <= b.maxY && body.y + body.h > b.minY) {
          if (b.maxY > support) support = b.maxY;
          hit = true;
        }
      }
      if (hit) {
        body.y = support;
        body.vy = 0;
        grounded = true;
      }
    } else {
      for (const b of this.boxes) {
        if (ignore?.has(b.id)) continue;
        if (!this.overlapXZ(body.x, body.z, body.r, b)) continue;
        if (oldY + body.h <= b.minY + 0.02 && body.y + body.h >= b.minY && body.y < b.maxY) {
          body.y = b.minY - body.h - EPS;
          body.vy = 0;
        }
      }
    }

    this.moveAxis(body, 'x', body.vx * dt, stepHeight, ignore);
    this.moveAxis(body, 'z', body.vz * dt, stepHeight, ignore);
    this.depenetrate(body, stepHeight, ignore);

    if (body.vy === 0 && this.supported(body.x, body.y, body.z, body.r, ignore)) grounded = true;
    return { grounded };
  }

  raycast(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxT: number,
    ignore?: ReadonlySet<string>,
    tag?: BoxTag,
  ): RayHit | null {
    let best: RayHit | null = null;
    for (const b of this.boxes) {
      if (ignore?.has(b.id)) continue;
      if (tag && b.tag !== tag) continue;
      const hit = this.rayBox(ox, oy, oz, dx, dy, dz, maxT, b);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    return best;
  }

  private moveAxis(
    body: Body,
    axis: 'x' | 'z',
    delta: number,
    stepHeight: number,
    ignore?: ReadonlySet<string>,
  ): void {
    if (Math.abs(delta) < EPS) return;
    const nx = body.x + (axis === 'x' ? delta : 0);
    const nz = body.z + (axis === 'z' ? delta : 0);
    if (!this.blocked(nx, body.y, nz, body.r, body.h, ignore)) {
      body.x = nx;
      body.z = nz;
      return;
    }

    let top = -Infinity;
    let hard = false;
    for (const b of this.boxes) {
      if (ignore?.has(b.id)) continue;
      if (!this.overlaps(nx, body.y, nz, body.r, body.h, b)) continue;
      if (b.maxY <= body.y + stepHeight + 0.001 && b.maxY > body.y + 0.001) {
        if (b.maxY > top) top = b.maxY;
      } else {
        hard = true;
      }
    }
    if (!hard && top > -Infinity && !this.blocked(nx, top + EPS, nz, body.r, body.h, ignore)) {
      body.x = nx;
      body.z = nz;
      body.y = top;
      return;
    }

    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) * 0.5;
      const tx = body.x + (axis === 'x' ? delta * mid : 0);
      const tz = body.z + (axis === 'z' ? delta * mid : 0);
      if (!this.blocked(tx, body.y, tz, body.r, body.h, ignore)) lo = mid;
      else hi = mid;
    }
    body.x += axis === 'x' ? delta * lo : 0;
    body.z += axis === 'z' ? delta * lo : 0;
  }

  private depenetrate(body: Body, stepHeight: number, ignore?: ReadonlySet<string>): void {
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.boxes) {
        if (ignore?.has(b.id)) continue;
        if (!this.overlaps(body.x, body.y, body.z, body.r, body.h, b)) continue;
        if (b.maxY - body.y <= stepHeight && b.maxY > body.y) {
          const raised = b.maxY + EPS;
          if (!this.blocked(body.x, raised, body.z, body.r, body.h, ignore)) {
            body.y = raised;
            body.vy = Math.max(0, body.vy);
            continue;
          }
        }
        const penLeft = body.x + body.r - b.minX;
        const penRight = b.maxX - (body.x - body.r);
        const penBack = body.z + body.r - b.minZ;
        const penFront = b.maxZ - (body.z - body.r);
        const minPen = Math.min(penLeft, penRight, penBack, penFront);
        if (minPen === penLeft) body.x = b.minX - body.r - EPS;
        else if (minPen === penRight) body.x = b.maxX + body.r + EPS;
        else if (minPen === penBack) body.z = b.minZ - body.r - EPS;
        else body.z = b.maxZ + body.r + EPS;
      }
    }
  }

  private overlapXZ(x: number, z: number, r: number, b: Box): boolean {
    return x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ;
  }

  private overlaps(x: number, y: number, z: number, r: number, h: number, b: Box): boolean {
    return (
      x + r > b.minX + EPS &&
      x - r < b.maxX - EPS &&
      z + r > b.minZ + EPS &&
      z - r < b.maxZ - EPS &&
      y + h > b.minY + EPS &&
      y < b.maxY - EPS
    );
  }

  private rayBox(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxT: number,
    b: Box,
  ): RayHit | null {
    let t1 = 0;
    let t2 = maxT;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    const origin = [ox, oy, oz];
    const dir = [dx, dy, dz];
    const min = [b.minX, b.minY, b.minZ];
    const max = [b.maxX, b.maxY, b.maxZ];
    for (let a = 0; a < 3; a++) {
      const o = origin[a];
      const d = dir[a];
      if (Math.abs(d) < 1e-8) {
        if (o < min[a] || o > max[a]) return null;
        continue;
      }
      let ta = (min[a] - o) / d;
      let tb = (max[a] - o) / d;
      let sign = d > 0 ? -1 : 1;
      if (ta > tb) {
        const s = ta;
        ta = tb;
        tb = s;
        sign = -sign;
      }
      if (ta > t1) {
        t1 = ta;
        nx = a === 0 ? sign : 0;
        ny = a === 1 ? sign : 0;
        nz = a === 2 ? sign : 0;
      }
      t2 = Math.min(t2, tb);
      if (t1 > t2) return null;
    }
    if (t1 < 0 || t1 > maxT) return null;
    return {
      id: b.id,
      tag: b.tag,
      t: t1,
      x: ox + dx * t1,
      y: oy + dy * t1,
      z: oz + dz * t1,
      nx,
      ny,
      nz,
    };
  }
}

export function yawAabb(
  id: string,
  tag: BoxTag,
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
  yaw: number,
): Box {
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  const wx = hx * c + hz * s;
  const wz = hx * s + hz * c;
  return {
    id,
    tag,
    minX: x - wx,
    maxX: x + wx,
    minY: y,
    maxY: y + hy,
    minZ: z - wz,
    maxZ: z + wz,
  };
}
