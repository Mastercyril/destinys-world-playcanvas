import { Clock, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { loadAssets } from './assets';
import { GameAudio } from './audio';
import { AncientOne } from './alien';
import { Bystanders } from './npcs';
import { loadCast } from './rigs';
import { BuildSystem, type Placement } from './build';
import { clockTexture, docketTexture, evacuationPoster, precinctSign, roadStencil, woodTexture } from './canvases';
import { City, type Hotspot } from './city';
import { CollisionWorld } from './collision';
import { Hud, type JournalEntry } from './hud';
import { Player } from './player';
import { createPost, createRenderer, type PostStack } from './post';
import { Rain } from './rain';
import { TUNE } from './tune';

export interface DebugApi {
  probe: () => {
    y: number;
    x: number;
    z: number;
    health: number;
    alienHealth: number;
    alienMode: string;
    alien: [number, number, number];
    fragments: number;
    journal: string;
    prompt: string | null;
    lamps: number;
    barricades: number;
    chimes: number;
  };
  teleport: (x: number, y: number, z: number) => void;
  lookAt: (x: number, y: number, z: number) => void;
  interact: () => string | null;
  getPrompt: () => string | null;
  hotspots: () => Array<{ id: string; verb: string; name: string; cx: number; cy: number; cz: number }>;
  melee: () => void;
  cycleBuild: () => void;
  place: () => boolean;
  placeAt: (kind: 'barricade' | 'lamp' | 'crate', x: number, z: number) => boolean;
  openJournal: () => void;
  closeJournal: () => void;
  step: (dt: number) => void;
  slide: (vx: number, vz: number) => { x: number; y: number; z: number };
  handPoint: () => { x: number; y: number; z: number } | null;
  setArms: (x: number, y: number, z: number) => void;
  blocked: (x: number, y: number, z: number) => boolean;
}

const BRIEFING: JournalEntry = {
  id: 'act1_briefing',
  title: 'Case opened',
  body: 'Three disappearances in forty-eight hours. The streets are too quiet. I was not told the city had been emptied.',
};

const EVACUATION = 'Evacuation was yesterday. My badge still works. That might be the trap.';

export class Game {
  private readonly hud: Hud;
  private readonly canvas: HTMLCanvasElement;
  private readonly audio = new GameAudio();
  private readonly keys = new Set<string>();
  private renderer!: WebGLRenderer;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private world!: CollisionWorld;
  private city!: City;
  private player!: Player;
  private alien!: AncientOne;
  private people!: Bystanders;
  private build!: BuildSystem;
  private rain!: Rain;
  private post!: PostStack;
  private readonly clock = new Clock();
  private started = false;
  private paused = false;
  private journalOpen = false;
  private dying = false;
  private deathT = 0;
  private fragments = 0;
  private hurt = 0;
  private simTime = 0;
  private stepFoot = 0;
  private ctrl = false;
  private frames = 0;
  private renderCost = 0;
  private readonly entries: JournalEntry[] = [BRIEFING];
  private checkpoint = { x: 0, y: 0.05, z: 25.6, yaw: 0 };
  private readonly selfIgnore = new Set<string>(['player']);
  private readonly watchStart = performance.now();
  private inputLockUntil = 0;
  private noticedAlien = false;

  constructor(
    root: HTMLElement,
    private readonly capture: string | null,
    private readonly debug: boolean,
  ) {
    this.hud = new Hud(root);
    this.canvas = this.hud.canvas;
    this.bindInput();
  }

  async load(): Promise<void> {
    this.renderer = createRenderer(this.canvas);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(68, 1, 0.08, 140);
    this.camera.layers.enable(2);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const assets = await loadAssets(this.renderer, (ratio) => this.hud.setProgress(ratio));
    const art = {
      poster: evacuationPoster(),
      docket: docketTexture(),
      clock: clockTexture(),
      sign: precinctSign(),
      stencil: roadStencil(),
      wood: woodTexture(),
    };
    this.world = new CollisionWorld();
    this.city = new City(this.scene, this.world, assets, art);
    this.city.bindEnvironment(this.renderer);
    const cast = await loadCast(this.renderer);
    this.player = new Player(this.camera);
    this.player.mount(cast.detective);
    this.player.teleport(this.city.spawn.x, this.city.spawn.y, this.city.spawn.z, this.city.spawn.yaw);
    this.checkpoint = { ...this.city.spawn };
    this.scene.add(this.player.body);
    this.alien = new AncientOne(this.world, this.scene);
    this.alien.mount(cast.inmate);
    this.people = new Bystanders(cast, this.scene, this.world);
    this.build = new BuildSystem(this.scene, this.world, assets.metal, art.wood);
    this.rain = new Rain();
    this.scene.add(this.rain.mesh);
    this.post = createPost(this.renderer, this.scene, this.camera);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.hud.setHealth(1);
    this.hud.setFragments(0);
    this.hud.setReady();
    if (this.debug) this.attachDebug();
    if (this.capture) this.beginCapture();
    this.clock.start();
    this.frame();
  }

  private beginCapture(): void {
    this.start();
    if (this.capture === 'street') {
      this.player.teleport(1.35, 0.02, 24.6, 0);
      this.player.pitch = -0.1;
      this.player.writeCamera();
    } else if (this.capture === 'alien') {
      this.alien.showcase(-1.35, 11.2, Math.PI * 0.78);
      this.player.teleport(0.15, 0.02, 13.55, 0);
      this.player.lookAt(-1.35, 1.05, 11.2);
    } else if (this.capture === 'hands') {
      this.player.teleport(0.4, 0.02, 16.8, 0);
      this.player.pitch = -0.22;
      this.player.writeCamera();
    } else if (this.capture === 'npc') {
      this.player.teleport(-2.1, 0.18, 20.3, 0);
      this.player.lookAt(-4.35, 1.2, 18.55);
    } else if (this.capture === 'nv') {
      this.player.nightVision = true;
      this.player.teleport(0.2, 0.02, 18.5, 0);
      this.player.pitch = -0.18;
      this.player.writeCamera();
    } else if (this.capture === 'lamp') {
      this.player.teleport(2.35, 0.05, 21.15, 0);
      this.build.tool = 'lamp';
      this.build.place({ x: 0.15, y: 0, z: 18.1, yaw: 0.4, valid: true });
      this.player.lookAt(0.15, 0.45, 18.1);
      this.build.tool = 'hands';
    } else if (this.capture === 'journal') {
      this.player.teleport(0.2, 0.05, 22.4, 0);
      this.player.pitch = -0.04;
      this.player.writeCamera();
      this.addEntry({
        id: 'act1_evacuation_yesterday',
        title: 'Evacuation notice',
        body: EVACUATION,
      });
      this.journalOpen = true;
      this.hud.setJournal(this.entries, true);
    }
  }

  private start(): void {
    if (this.started) return;
    this.started = true;
    this.audio.start();
    this.hud.showPlay();
    this.inputLockUntil = performance.now() + 350;
    if (!this.capture) void this.canvas.requestPointerLock();
  }

  private frame = (): void => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
  };

  private update(dt: number): void {
    this.simTime += dt;
    if (this.dying) {
      this.deathT -= dt;
      if (this.deathT <= 0) this.respawn();
    } else if (this.started && !this.paused && !this.journalOpen) {
      this.simulate(dt);
    }
    this.city.update(this.renderer, this.camera, dt, this.simTime);
    this.rain.update(dt, this.player.x, this.player.z, this.player.yaw);
    this.player.updatePresentation(dt);
    this.people?.update(dt, this.player.x, this.player.z);
    this.post.grade.uniforms.uNight.value = this.player.nightVision ? 1 : 0;
    this.hud.tickSubtitle(dt);
    this.hud.setWatch(this.watchString());
    this.hud.setHealth(this.player.health / TUNE.playerHealth);
    const chasing = this.alien.mode === 'chase' || this.alien.mode === 'windup' || this.alien.mode === 'recover';
    this.audio.setThreat(chasing ? 1 : 0);
    this.hurt = Math.max(0, this.hurt - dt * 0.8);
    this.post.grade.uniforms.uTime.value = this.simTime;
    this.post.grade.uniforms.uHurt.value = this.hurt * 0.65 + (1 - this.player.health / TUNE.playerHealth) * 0.18;
    if (!this.paused && !this.journalOpen) {
      this.hud.setPrompt(this.started ? this.promptText() : null);
      this.hud.setTool(this.started ? this.build.label() : '');
      const ghost = this.started && !this.dying ? this.placement() : null;
      this.build.updateGhost(ghost);
    }
    const t0 = performance.now();
    try {
      this.post.composer.render();
    } catch (err) {
      console.error(err);
      this.post.ssao.enabled = false;
      this.renderer.render(this.scene, this.camera);
    }
    this.renderCost = this.renderCost * 0.9 + (performance.now() - t0) * 0.1;
    this.frames += 1;
    if (!this.capture && this.frames === 90 && this.renderCost > 18) this.post.ssao.enabled = false;
    if (this.frames === 2) window.__DW_READY = true;
  }

  private simulate(dt: number): void {
    const wish = this.wish();
    this.world.setActor('player', this.player.x, this.player.y, this.player.z, this.player.radius, this.player.height);
    if (this.alien.mode !== 'dead') {
      this.world.setActor('alien', this.alien.x, this.alien.y, this.alien.z, this.alien.radius, this.alien.height);
    }
    const speed = this.player.integrate(dt, this.world, wish.x, wish.z, wish.sprint, wish.crouch, this.selfIgnore, () =>
      this.meleeHit(),
    );
    if (this.player.grounded && speed > 0.65) {
      this.stepFoot -= dt;
      if (this.stepFoot <= 0) {
        this.audio.footstep();
        this.stepFoot = this.player.crouching ? 0.62 : wish.sprint ? 0.32 : 0.46;
      }
    }
    this.alien.update(
      dt,
      {
        x: this.player.x,
        y: this.player.y,
        z: this.player.z,
        eyeY: this.player.y + this.player.eye,
        crouching: this.player.crouching,
      },
      {
        onWindup: () => this.audio.attack(),
        onHit: () => this.alienHits(),
        onNotice: () => {
          if (this.noticedAlien) return;
          this.noticedAlien = true;
          this.hud.say('Something on the boulevard is walking wrong. The joints arrive late.');
        },
      },
    );
  }

  private alienHits(): void {
    if (!this.player.damage(TUNE.alienDamage)) return;
    this.audio.hurt();
    this.hurt = 1;
    if (this.player.health <= 0) this.die();
  }

  private die(): void {
    this.dying = true;
    this.deathT = 1.7;
    this.hud.setDeath(true);
    this.hud.setPrompt(null);
  }

  private respawn(): void {
    this.player.health = TUNE.playerHealth;
    this.player.invuln = 1.5;
    this.player.teleport(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z, this.checkpoint.yaw);
    this.alien.reset();
    this.dying = false;
    this.hurt = 0;
    this.hud.setDeath(false);
  }

  private meleeHit(): void {
    if (this.alien.mode === 'dead') return;
    const fwd = this.player.forward();
    const dx = this.alien.x - this.player.x;
    const dz = this.alien.z - this.player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 2.25 || dist < 0.001) return;
    const dot = (fwd.x * dx + fwd.z * dz) / dist;
    if (dot < 0.2) return;
    this.alien.hurt(TUNE.meleeDamage);
    this.audio.hit();
    if (this.alien.health <= 0) this.hud.say('It folded. The street did not thank me.');
  }

  private wish(): { x: number; z: number; sprint: boolean; crouch: boolean } {
    const f = this.player.forward();
    const r = this.player.right();
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW')) {
      x += f.x;
      z += f.z;
    }
    if (this.keys.has('KeyS')) {
      x -= f.x;
      z -= f.z;
    }
    if (this.keys.has('KeyD')) {
      x += r.x;
      z += r.z;
    }
    if (this.keys.has('KeyA')) {
      x -= r.x;
      z -= r.z;
    }
    const crouch = this.player.crouchLatch || this.ctrl;
    const sprint = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !crouch;
    return { x, z, sprint, crouch };
  }

  private promptText(): string | null {
    const spot = this.lookedAt();
    if (!spot) return null;
    return `[E] ${spot.verb} — ${spot.name}`;
  }

  private lookedAt(): Hotspot | null {
    const eye = this.player.eyePosition();
    const dir = new Vector3();
    this.camera.getWorldDirection(dir);
    return this.city.pick(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z);
  }

  private interact(): string | null {
    const spot = this.lookedAt();
    if (!spot) return null;
    this.resolve(spot);
    return spot.id;
  }

  private resolve(spot: Hotspot): void {
    switch (spot.id) {
      case 'evacuation-notice':
        this.audio.paper();
        this.addEntry({ id: 'act1_evacuation_yesterday', title: 'Evacuation notice', body: EVACUATION });
        this.hud.say(EVACUATION);
        break;
      case 'precinct-clock':
        this.audio.paper();
        this.hud.say('The precinct clock reads 03:17. My watch is hours ahead of it. The hands are not broken. They are late.');
        break;
      case 'missing-docket':
        this.audio.paper();
        this.hud.say('Three names in forty-eight hours. The docket was received yesterday and filed this morning. No one agrees what hour it is.');
        break;
      case 'shop-window':
        this.hud.say('I raised my hand. The coat in the glass is half a second behind me.');
        break;
      case 'fragment-01':
        this.takeFragment(
          'fragment-01',
          'act1_fragment_01',
          'Fragment 01',
          'The evidence locker was open. The residue on the shelf is warm. Nobody signed it out.',
        );
        break;
      case 'fragment-02':
        this.takeFragment(
          'fragment-02',
          'act1_fragment_02',
          'Fragment 02',
          'The storm drain is a time bruise. Light pools where the water should be, and it does not belong to this hour.',
        );
        break;
      default:
        break;
    }
  }

  private takeFragment(id: string, entryId: string, title: string, body: string): void {
    this.city.collectFragment(id);
    this.fragments += 1;
    this.hud.setFragments(this.fragments);
    this.audio.chime();
    this.addEntry({ id: entryId, title, body });
    this.checkpoint = { x: this.player.x, y: this.player.y, z: this.player.z, yaw: this.player.yaw };
    this.hud.say(
      this.fragments >= 2 ? 'Two fragments. The street still will not say where they went.' : body,
    );
  }

  private addEntry(entry: JournalEntry): void {
    if (this.entries.some((e) => e.id === entry.id)) return;
    this.entries.push(entry);
    if (this.journalOpen) this.hud.setJournal(this.entries, true);
  }

  private placement(): Placement | null {
    const tool = this.build.tool;
    if (tool === 'hands') return null;
    const eye = this.player.eyePosition();
    const dir = new Vector3();
    this.camera.getWorldDirection(dir);
    const hit = this.world.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, 5.5, this.selfIgnore);
    const yaw = this.player.yaw;
    if (!hit || hit.tag !== 'ground' || hit.ny < 0.65) {
      const x = eye.x + dir.x * 2;
      const z = eye.z + dir.z * 2;
      return { x, y: 0, z, yaw, valid: false };
    }
    const surface = this.world.get(hit.id);
    const y = surface ? surface.maxY : hit.y;
    const dist = Math.hypot(hit.x - this.player.x, hit.z - this.player.z);
    const half = tool === 'crate' ? 0.4 : tool === 'lamp' ? 0.36 : 0.7;
    const height = tool === 'crate' ? 0.7 : tool === 'lamp' ? 1.5 : 1.0;
    const crowded = this.world.blocked(hit.x, y + 0.08, hit.z, half, height, this.selfIgnore);
    const stock = this.build.stock[tool];
    const valid = dist > 1.15 && dist < 5.3 && y < 0.45 && y > -0.05 && !crowded && stock > 0;
    return { x: hit.x, y, z: hit.z, yaw, valid };
  }

  private tryMelee(): void {
    if (performance.now() < this.inputLockUntil) return;
    if (this.player.startSwing()) this.audio.whoosh();
  }

  private tryPlace(): void {
    if (performance.now() < this.inputLockUntil) return;
    const place = this.placement();
    if (!place) return;
    if (!place.valid) {
      const tool = this.build.tool;
      if (tool !== 'hands' && this.build.stock[tool] <= 0) {
        this.hud.say("I don't have another.");
      }
      return;
    }
    this.build.place(place);
  }

  private toggleJournal(): void {
    this.journalOpen = !this.journalOpen;
    this.hud.setJournal(this.entries, this.journalOpen);
    if (this.journalOpen) this.build.updateGhost(null);
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.hud.setPaused(paused);
    if (paused) {
      this.journalOpen = false;
      this.hud.setJournal(this.entries, false);
      this.build.updateGhost(null);
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }
  }

  private watchString(): string {
    const elapsed = Math.floor((performance.now() - this.watchStart) / 1000);
    const total = 21 * 3600 + 42 * 60 + elapsed;
    const h = Math.floor(total / 3600) % 24;
    const m = Math.floor(total / 60) % 60;
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.post?.resize(w, h);
  }

  private bindInput(): void {
    this.hud.start.addEventListener('click', () => this.start());
    this.hud.resume.addEventListener('click', () => {
      this.setPaused(false);
      if (!this.capture) void this.canvas.requestPointerLock();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.started) {
        if (e.code === 'Enter' || e.code === 'Space') this.start();
        return;
      }
      if (e.code === 'Escape') {
        if (this.journalOpen) this.toggleJournal();
        else this.setPaused(!this.paused);
        return;
      }
      if (this.paused || this.dying) return;
      if (e.code === 'Tab') {
        this.toggleJournal();
        return;
      }
      if (this.journalOpen) return;
      this.keys.add(e.code);
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.ctrl = true;
      if (e.code === 'KeyC' && !e.repeat) this.player.crouchLatch = !this.player.crouchLatch;
      if (e.code === 'KeyE' && !e.repeat) this.interact();
      if (e.code === 'KeyB' && !e.repeat) this.build.cycle();
      if (e.code === 'KeyF' && !e.repeat) this.tryMelee();
      if (e.code === 'KeyN' && !e.repeat) this.player.toggleNight();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        this.ctrl = this.keys.has('ControlLeft') || this.keys.has('ControlRight');
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      if (this.paused || this.journalOpen || this.dying) return;
      this.player.addLook(e.movementX, e.movementY);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.started || this.paused || this.journalOpen || this.dying) return;
      if (e.button !== 0) return;
      if (document.pointerLockElement !== this.canvas && !this.capture) {
        void this.canvas.requestPointerLock();
        return;
      }
      if (this.build.tool === 'hands') this.tryMelee();
      else this.tryPlace();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && this.started && !this.paused && !this.dying && !this.capture && !this.journalOpen) {
        this.setPaused(true);
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private attachDebug(): void {
    const api: DebugApi = {
      probe: () => ({
        y: this.player.y,
        x: this.player.x,
        z: this.player.z,
        health: this.player.health,
        alienHealth: this.alien.health,
        alienMode: this.alien.mode,
        alien: [this.alien.x, this.alien.y, this.alien.z],
        fragments: this.fragments,
        journal: this.entries.map((e) => e.body).join('\n'),
        prompt: this.promptText(),
        lamps: this.build.placedCount('lamp'),
        barricades: this.build.placedCount('barricade'),
        chimes: this.audio.chimes,
      }),
      teleport: (x, y, z) => this.player.teleport(x, y, z),
      lookAt: (x, y, z) => this.player.lookAt(x, y, z),
      interact: () => this.interact(),
      getPrompt: () => this.promptText(),
      hotspots: () =>
        this.city.hotspots.map((h) => ({
          id: h.id,
          verb: h.verb,
          name: h.name,
          cx: (h.minX + h.maxX) / 2,
          cy: (h.minY + h.maxY) / 2,
          cz: (h.minZ + h.maxZ) / 2,
        })),
      melee: () => this.tryMelee(),
      cycleBuild: () => this.build.cycle(),
      place: () => {
        const p = this.placement();
        return p ? this.build.place(p) : false;
      },
      placeAt: (kind, x, z) => {
        this.build.tool = kind;
        return this.build.place({ x, y: 0, z, yaw: this.player.yaw, valid: true });
      },
      openJournal: () => {
        this.journalOpen = true;
        this.hud.setJournal(this.entries, true);
      },
      closeJournal: () => {
        this.journalOpen = false;
        this.hud.setJournal(this.entries, false);
      },
      step: (dt) => this.update(dt),
      handPoint: () => this.player.handLocal(),
      setArms: (x, y, z) => this.player.setArms(x, y, z),
      slide: (vx, vz) => {
        const body = {
          x: this.player.x,
          y: this.player.y,
          z: this.player.z,
          vx,
          vy: 0,
          vz,
          r: this.player.radius,
          h: this.player.height,
        };
        this.world.move(body, 1, 0.42, this.selfIgnore);
        this.player.x = body.x;
        this.player.y = body.y;
        this.player.z = body.z;
        this.player.vx = 0;
        this.player.vz = 0;
        this.player.writeCamera();
        return { x: body.x, y: body.y, z: body.z };
      },
      blocked: (x, y, z) => this.world.blocked(x, y, z, this.alien.radius, this.alien.height, new Set(['alien'])),
    };
    window.__DW = api;
  }
}
