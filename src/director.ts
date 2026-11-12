export type NpcRole = 'survivor' | 'scientist' | 'hacker' | 'cultist';

export interface NpcSpec {
  id: string;
  name: string;
  role: NpcRole;
  personality: string;
  fear: string;
  secret: string;
  lines: string[];
  x: number;
  z: number;
}

export interface GameConceptSpec {
  title: string;
  genre: string;
  coreLoop: string;
  mechanics: string[];
  antagonist: string;
  artDirection: string;
}

// --- Seeded RNG ---

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickUnique<T>(rng: () => number, arr: readonly T[], count: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// --- Data Pools ---

const FIRST_NAMES = [
  'Elias', 'Mara', 'Soren', 'Vesper', 'Kael', 'Lyra', 'Gideon', 'Isolde',
  'Silas', 'Rowan', 'Orin', 'Nadia', 'Corvus', 'Thalia', 'Ezra', 'Mireille',
] as const;

const LAST_NAMES = [
  'Vance', 'Kowalski', 'Mercer', 'Blackwood', 'Holloway', 'Cross', 'Vane',
  'Lorne', 'Garrow', 'Sterling', 'Ashford', 'Dreyer', 'Morrow', 'Falk',
] as const;

const ROLES: readonly NpcRole[] = ['survivor', 'scientist', 'hacker', 'cultist'];

const PERSONALITIES = [
  'paranoid & hyper-vigilant', 'catatonic & whispering', 'coldly analytical',
  'manic & twitchy', 'fatalistic', 'deceptively calm', 'sleep-deprived & erratic',
  'obsessive-compulsive', 'cynical & hardened', 'delusionally optimistic',
] as const;

const FEARS = [
  'static on dead frequencies', 'mirrors in low light', 'sub-audible bass tones',
  'being forgotten by the simulation', 'open ceilings', 'synchronized footsteps',
  'rotting geometric patterns', 'their own shadow detaching', 'long corridors',
] as const;

const SECRETS = [
  'sabotaged the primary comms array three days ago',
  'is slowly replacing their own memories with synthetic logs',
  'carries a live containment breach sample in a lead vial',
  'heard the voice in the ventilation shaft and answered it',
  'locked the previous team inside Sector 4 to buy time',
  'has already died once in an adjacent timeline',
  'feeds coordinates of survivors to the relay tower',
  'cannot see their own reflection anymore',
] as const;

const DIALOGUE_TEMPLATES: readonly ((ctx: { name: string; role: NpcRole; fear: string; secret: string }) => string)[] = [
  () => `Don't look at the corners of the room. If you measure them, they aren't ninety degrees anymore.`,
  (c) => `As a ${c.role}, I used to trust patterns. Now all I hear is "${c.fear}".`,
  (c) => `They keep calling my name — ${c.name} — from inside the walls, but the voice is my own.`,
  () => `You didn't come through the door. Nobody comes through the door anymore.`,
  () => `Count your fingers every ten minutes. If there's an extra one, don't try to bend it.`,
  (c) => `I know what I did. (${c.secret}.) And the fog outside knows too.`,
  () => `The lights flicker at 19 Hertz. Just enough to make the optic nerve hallucinate shapes.`,
  (c) => `We are three iterations deep. The real ${c.name} never made it out of the basement.`,
  () => `Keep your voice down. Sound travels backwards in this sector.`,
  () => `If you find a radio tuned to 00.0, smash it before it finishes the sentence.`,
];

const TITLE_PREFIXES = [
  'SIGNAL', 'ECHO', 'THRESHOLD', 'PALE', 'NULL', 'STATIC', 'SUBLEVEL', 'OBSIDIAN', 'CHORUS', 'PROTOCOL',
] as const;

const TITLE_SUFFIXES = [
  'ZERO', 'ARCHIVE', 'DECAY', 'PARADOX', 'VESSEL', 'FREQUENCY', 'LABYRINTH', 'LITURGY', 'APERTURE', '99',
] as const;

const GENRES = [
  'Diegetic analog-tech survival horror',
  'Liminal architectural psychological thriller',
  'Procedural bio-mechanical stealth horror',
  'Time-loop cosmic investigation',
  'Subterranean acoustic-hunting horror',
  'Found-footage isometric dread sim',
] as const;

const CORE_LOOPS = [
  'Scavenge decaying frequencies -> triangulate anomalies -> purge corrupted nodes -> retreat before hull-breach',
  'Map shifting corridors -> harvest bio-luminescent isotopes -> ration sanity & batteries -> seal the rift',
  'Intercept encrypted transmissions -> interrogate synthetic duplicates -> burn infected sectors -> descend deeper',
  'Maintain failing life-support -> bait acoustic predators away from generators -> extract black-box logs -> survive the blackout',
] as const;

const MECHANICS_POOL = [
  'Echolocation scanner that reveals geometry but attracts blind stalkers',
  'Manual cassette-tape splicing to forge security clearances and voiceprints',
  'Blinking mechanic: holding eyes open causes hallucination overlay; closing them dulls movement speed',
  'Diegetic CRT terminal interface with real-time command-line door routing',
  'Heart-rate monitor tied to microphone input or sprint stamina',
  'Non-Euclidean doors that re-link rooms based on camera look-direction',
  'Parasitic inventory items that whisper misleading audio cues if held too long',
  'Light-spectrum flashlight filters (UV, IR, Cobalt) revealing different dimensional layers',
  'Sanity-linked save system where corrupted saves alter NPC allegiances',
  'Directional Geiger-counter audio feedback replacing all HUD elements',
] as const;

const ANTAGONISTS = [
  'The Architect: a towering amalgam of server racks and calcified nervous systems that edits room layouts',
  'Chorus-04: a gestalt entity that mimics the last words of dead crewmates over local intercoms',
  'The Pale Cartographer: an unblinking figure that only moves when obscured by film grain or static',
  'Mycelial Mainframe: a fungal network puppeteering hazard-suit corpses via fiber-optic tendons',
  'The Echo-Stalker: an acoustic predator that replays your own footsteps three seconds behind you',
] as const;

const ART_DIRECTIONS = [
  'Dithered 1-bit monochrome with bleeding phosphor-teal highlights and heavy CRT curvature',
  'Brutalist wet concrete, sodium-vapor amber fog, and VHS tracking distortion',
  'Low-poly PS1 vertex jitter, affine texture warping, and claustrophobic point-lighting',
  'Clinical white cleanrooms stained with iridescent oil and harsh fluorescent strobing',
  'Submerged industrial rust, volumetric turquoise bioluminescence, and heavy film grain',
] as const;

// --- Generators ---

export function generateNpc(prompt: string): NpcSpec {
  const clean = prompt.trim() || 'default-seed';
  const seed = hashString(`npc::${clean}`);
  const rng = mulberry32(seed);

  const first = pick(rng, FIRST_NAMES);
  const last = pick(rng, LAST_NAMES);
  const name = `${first} ${last}`;
  const role = pick(rng, ROLES);
  const personality = pick(rng, PERSONALITIES);
  const fear = pick(rng, FEARS);
  const secret = pick(rng, SECRETS);

  const templates = pickUnique(rng, DIALOGUE_TEMPLATES, 4);
  const ctx = { name, role, fear, secret };
  const lines = templates.slice(0, 4).map((t) => t(ctx));

  const coord = (): number => {
    const raw = (rng() * 20 + 4) * (rng() < 0.5 ? -1 : 1);
    return Math.round(raw * 10) / 10;
  };

  return {
    id: `npc_${seed.toString(16).padStart(8, '0')}`,
    name,
    role,
    personality,
    fear,
    secret,
    lines,
    x: coord(),
    z: coord(),
  };
}

export function generateGameConcept(prompt: string): GameConceptSpec {
  const clean = prompt.trim() || 'default-seed';
  const seed = hashString(`game::${clean}`);
  const rng = mulberry32(seed);

  const title = `${pick(rng, TITLE_PREFIXES)} // ${pick(rng, TITLE_SUFFIXES)}`;
  const genre = pick(rng, GENRES);
  const coreLoop = pick(rng, CORE_LOOPS);
  const mechs = pickUnique(rng, MECHANICS_POOL, 4);
  const antagonist = pick(rng, ANTAGONISTS);
  const artDirection = pick(rng, ART_DIRECTIONS);

  return { title, genre, coreLoop, mechanics: mechs, antagonist, artDirection };
}

// --- Director UI Panel ---

export class DirectorPanel {
  onSpawnNpc: ((spec: NpcSpec) => void) | null = null;
  onGameConcept: ((spec: GameConceptSpec) => void) | null = null;

  private _isOpen = false;
  private container: HTMLDivElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private outputEl: HTMLPreElement | null = null;

  get isOpen(): boolean {
    return this._isOpen;
  }

  mount(root: HTMLElement): void {
    if (this.container) return;

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(3, 6, 8, 0.85)',
      backdropFilter: 'blur(4px)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999',
      fontFamily: '"Courier New", Courier, monospace',
      color: '#d4f5ef',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: 'min(680px, 92vw)',
      maxHeight: '88vh',
      backgroundColor: '#070b0e',
      border: '1px solid #14b8a6',
      boxShadow: '0 0 28px rgba(20, 184, 166, 0.22), inset 0 0 12px rgba(20, 184, 166, 0.08)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #134e4a',
      paddingBottom: '10px',
    });

    const title = document.createElement('div');
    title.textContent = 'SYS.DIRECTOR // AI BUILDER MODE';
    Object.assign(title.style, {
      color: '#2dd4bf',
      fontWeight: 'bold',
      letterSpacing: '1.5px',
      fontSize: '14px',
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '[X] CLOSE (M)';
    Object.assign(closeBtn.style, {
      background: 'transparent',
      border: '1px solid #134e4a',
      color: '#5eead4',
      fontFamily: 'inherit',
      fontSize: '11px',
      padding: '4px 8px',
      cursor: 'pointer',
    });
    closeBtn.addEventListener('click', () => this.close());

    header.append(title, closeBtn);

    const label = document.createElement('div');
    label.textContent = 'SEED PROMPT / NARRATIVE DIRECTIVE';
    Object.assign(label.style, {
      fontSize: '11px',
      color: '#5eead4',
      letterSpacing: '1px',
    });

    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.placeholder =
      'e.g. "paranoiac radio operator in flooded sector 7" or "abandoned submarine sonar horror"...';
    textarea.value = 'infected cryo-lab technician hearing static';
    Object.assign(textarea.style, {
      width: '100%',
      boxSizing: 'border-box',
      backgroundColor: '#030507',
      border: '1px solid #0f766e',
      color: '#ccfbf1',
      fontFamily: 'inherit',
      fontSize: '13px',
      padding: '10px',
      resize: 'vertical',
      outline: 'none',
    });
    textarea.addEventListener('keydown', (e) => e.stopPropagation());

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
    });

    const makeBtn = (text: string, onClick: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.textContent = text;
      Object.assign(btn.style, {
        flex: '1',
        minWidth: '200px',
        backgroundColor: '#042f2e',
        border: '1px solid #14b8a6',
        color: '#5eead4',
        fontFamily: 'inherit',
        fontSize: '12px',
        fontWeight: 'bold',
        letterSpacing: '1px',
        padding: '10px 14px',
        cursor: 'pointer',
        textTransform: 'uppercase',
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = '#0f766e';
        btn.style.color = '#ffffff';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = '#042f2e';
        btn.style.color = '#5eead4';
      });
      btn.addEventListener('click', onClick);
      return btn;
    };

    const spawnBtn = makeBtn('Spawn Generated NPC', () => this.handleSpawnNpc());
    const designBtn = makeBtn('Design New Game', () => this.handleDesignGame());
    btnRow.append(spawnBtn, designBtn);

    const output = document.createElement('pre');
    output.textContent = '// AWAITING DIRECTIVE SEED...\n\nThis mode grows the game from inside the game. The same generator runs daily in the repo (scripts/daily-generate.mjs) — every day the city changes.';
    Object.assign(output.style, {
      margin: '0',
      padding: '12px',
      backgroundColor: '#020405',
      border: '1px solid #115e59',
      color: '#99f6e4',
      fontSize: '12px',
      lineHeight: '1.45',
      maxHeight: '280px',
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    });

    card.append(header, label, textarea, btnRow, output);
    overlay.appendChild(card);
    root.appendChild(overlay);

    this.container = overlay;
    this.textarea = textarea;
    this.outputEl = output;
  }

  open(): void {
    if (!this.container) return;
    this._isOpen = true;
    this.container.style.display = 'flex';
    this.textarea?.focus();
  }

  close(): void {
    if (!this.container) return;
    this._isOpen = false;
    this.container.style.display = 'none';
  }

  toggle(): void {
    if (this._isOpen) this.close();
    else this.open();
  }

  private getPrompt(): string {
    return this.textarea?.value.trim() || 'unseeded-void';
  }

  private handleSpawnNpc(): void {
    const prompt = this.getPrompt();
    const spec = generateNpc(prompt);
    if (this.outputEl) {
      this.outputEl.textContent = [
        `[NPC SYNTHESIS COMPLETE // ID: ${spec.id}]`,
        `NAME       : ${spec.name} (${spec.role.toUpperCase()})`,
        `TRAIT      : ${spec.personality}`,
        `PHOBIA     : ${spec.fear}`,
        `SECRET     : ${spec.secret}`,
        `DIALOGUE   :`,
        ...spec.lines.map((l, i) => `  [${i + 1}] "${l}"`),
      ].join('\n');
    }
    this.onSpawnNpc?.(spec);
  }

  private handleDesignGame(): void {
    const prompt = this.getPrompt();
    const spec = generateGameConcept(prompt);
    if (this.outputEl) {
      this.outputEl.textContent = [
        `[GAME CONCEPT SYNTHESIZED]`,
        `TITLE      : ${spec.title}`,
        `GENRE      : ${spec.genre}`,
        `ART STYLE  : ${spec.artDirection}`,
        `ANTAGONIST : ${spec.antagonist}`,
        `CORE LOOP  : ${spec.coreLoop}`,
        `MECHANICS  :`,
        ...spec.mechanics.map((m) => `  - ${m}`),
        '',
        `(Saved to your field journal.)`,
      ].join('\n');
    }
    this.onGameConcept?.(spec);
  }
}
