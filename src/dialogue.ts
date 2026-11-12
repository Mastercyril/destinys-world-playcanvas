export interface Talker {
  id: string;
  name: string;
  lines: string[];
  x: number;
  y: number;
  z: number;
}

export const TALKERS: Talker[] = [
  {
    id: 'stranded_civilian',
    name: 'Mirella — Stranded Civilian',
    x: -4.35,
    y: 0.18,
    z: 18.55,
    lines: [
      'The evac buses left yesterday. Or three hours ago. My watch says both.',
      'Look at the puddles on the boulevard — my reflection didn\u2019t turn its head when I did.',
      'I\u2019ve been waiting for the 04:15 convoy since 04:15. It\u2019s still 04:15.',
      'Don\u2019t look at the streetlamp timers. They\u2019re counting into negative numbers.',
      'You came from the precinct? The lights in there were on all night. All of them.',
    ],
  },
  {
    id: 'ghost_hacker',
    name: 'Ghost',
    x: 1.6,
    y: 0,
    z: -44,
    lines: [
      'Down here the neon hums at 40Hz, then 0Hz. The grid is desynced from causality.',
      'I pinged the municipal time servers. Every packet came back timestamped from next Tuesday.',
      'Evacuation alert went out yesterday, right? Then why is the broadcast still buffering in the air?',
      'My shadow on the tile wall is lagging by a full two seconds. Check yours.',
      'If you hear a train arriving, don\u2019t board it. That train derailed forty-eight hours ago.',
    ],
  },
  {
    id: 'transit_warden',
    name: 'Warden Kael',
    x: 4.2,
    y: 0,
    z: -28.5,
    lines: [
      'Sector 4 was cleared twenty-six hours ago. Logbook says I already locked this gate from the outside.',
      'The station clock and my comms implant are six hours apart, and neither is moving.',
      'I saw my own unit march past the barricade ten minutes ago. They didn\u2019t see me.',
      'Radio static keeps repeating the final evac siren, stretched out like a dying tape.',
    ],
  },
  {
    id: 'signal_scavenger',
    name: 'Sable — Signal Scavenger',
    x: -8.4,
    y: 0,
    z: -6.2,
    lines: [
      'Good loot left behind in the rush, if you can pry it out of yesterday\u2019s air.',
      'Dropped a flare off the overpass. Took four minutes to hit the wet asphalt.',
      'Mirrors in the storefront windows are still showing the crowd panicking from the evac.',
      'Whatever broke the clocks here didn\u2019t stop time — it knotted it.',
    ],
  },
];

const STYLE_ID = 'npc-dialogue-panel-styles';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .dp-container {
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      width: min(680px, calc(100vw - 48px));
      background: rgba(10, 14, 20, 0.92);
      border: 1px solid rgba(90, 180, 255, 0.35);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.75), 0 0 15px rgba(90, 180, 255, 0.12);
      border-radius: 6px;
      padding: 18px 22px;
      color: #e6eef8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      z-index: 1000;
      backdrop-filter: blur(6px);
      pointer-events: auto;
      user-select: none;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .dp-container.dp-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateX(-50%) translateY(10px);
    }
    .dp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(90, 180, 255, 0.2);
      padding-bottom: 6px;
    }
    .dp-speaker {
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #66d9ef;
    }
    .dp-step {
      font-size: 0.75rem;
      color: #7a8c9e;
    }
    .dp-line {
      font-size: 1.02rem;
      line-height: 1.55;
      min-height: 3.1em;
      color: #dce6f2;
      margin-bottom: 14px;
    }
    .dp-footer {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      font-size: 0.78rem;
      color: #8fa3b8;
    }
    .dp-key {
      display: inline-block;
      padding: 1px 6px;
      border: 1px solid rgba(143, 163, 184, 0.45);
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
      font-weight: 600;
      margin-right: 4px;
    }
  `;
  document.head.appendChild(style);
}

export class DialoguePanel {
  private readonly panelEl: HTMLDivElement;
  private readonly speakerEl: HTMLSpanElement;
  private readonly stepEl: HTMLSpanElement;
  private readonly lineEl: HTMLDivElement;
  private readonly nextHintEl: HTMLSpanElement;

  private activeTalker: Talker | null = null;
  private lineIndex = 0;

  constructor(root: HTMLElement) {
    injectStyles();

    this.panelEl = document.createElement('div');
    this.panelEl.className = 'dp-container dp-hidden';
    this.panelEl.setAttribute('role', 'dialog');
    this.panelEl.setAttribute('aria-live', 'polite');

    const header = document.createElement('div');
    header.className = 'dp-header';

    this.speakerEl = document.createElement('span');
    this.speakerEl.className = 'dp-speaker';

    this.stepEl = document.createElement('span');
    this.stepEl.className = 'dp-step';

    header.append(this.speakerEl, this.stepEl);

    this.lineEl = document.createElement('div');
    this.lineEl.className = 'dp-line';

    const footer = document.createElement('div');
    footer.className = 'dp-footer';

    this.nextHintEl = document.createElement('span');
    const closeHintEl = document.createElement('span');
    closeHintEl.innerHTML = `<span class="dp-key">Esc</span> Close`;

    footer.append(this.nextHintEl, closeHintEl);
    this.panelEl.append(header, this.lineEl, footer);
    root.appendChild(this.panelEl);
  }

  get isOpen(): boolean {
    return this.activeTalker !== null;
  }

  open(talker: Talker): void {
    if (talker.lines.length === 0) {
      this.close();
      return;
    }
    this.activeTalker = talker;
    this.lineIndex = 0;
    this.render();
    this.panelEl.classList.remove('dp-hidden');
  }

  advance(): void {
    if (!this.activeTalker) return;
    if (this.lineIndex + 1 < this.activeTalker.lines.length) {
      this.lineIndex += 1;
      this.render();
    } else {
      this.close();
    }
  }

  close(): void {
    this.activeTalker = null;
    this.lineIndex = 0;
    this.panelEl.classList.add('dp-hidden');
  }

  private render(): void {
    if (!this.activeTalker) return;
    const total = this.activeTalker.lines.length;
    const current = this.lineIndex + 1;

    this.speakerEl.textContent = this.activeTalker.name;
    this.stepEl.textContent = `${current} / ${total}`;
    this.lineEl.textContent = this.activeTalker.lines[this.lineIndex] ?? '';

    const isLast = current >= total;
    this.nextHintEl.innerHTML = `<span class="dp-key">E</span> ${isLast ? 'Finish' : 'Next'}`;
  }
}
