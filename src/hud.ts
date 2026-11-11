export interface JournalEntry {
  id: string;
  title: string;
  body: string;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly startBtn: HTMLButtonElement;
  private readonly loadLabel: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly tool: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly fragments: HTMLElement;
  private readonly watch: HTMLElement;
  private readonly journal: HTMLElement;
  private readonly entries: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly death: HTMLElement;
  private readonly crosshair: HTMLElement;
  private subTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <canvas id="view"></canvas>
      <div id="crosshair" aria-hidden="true"></div>
      <div id="hud">
        <div id="watch"><span>WATCH</span><strong>21:42:00</strong></div>
        <div id="prompt"></div>
        <div id="subtitle"></div>
        <div id="tool"></div>
        <div id="vitals">
          <div class="stat">
            <span>HEALTH</span>
            <div class="bar"><div id="health-fill"></div></div>
          </div>
          <div class="stat right">
            <span>FRAGMENTS</span>
            <strong id="fragments">0/2</strong>
          </div>
        </div>
      </div>
      <aside id="journal" hidden>
        <p class="kicker">Field journal</p>
        <h2>Alex Morgan</h2>
        <p class="meta">Thornhaven · Act I · Empty Boulevard</p>
        <div id="entries"></div>
        <p class="hint">Tab to close</p>
      </aside>
      <div id="pause" hidden>
        <p class="kicker">Paused</p>
        <h1>Destiny's World: Lost Society in Time</h1>
        <p class="lede">Detective Alex Morgan · Empty Boulevard</p>
        <ul>
          <li>WASD move · mouse look · Shift sprint</li>
          <li>C toggle crouch · Ctrl hold crouch</li>
          <li>E examine, read, collect · Tab journal</li>
          <li>Left click or F strike · B place · N night vision</li>
        </ul>
        <button id="resume" type="button">Resume</button>
      </div>
      <div id="death" hidden>
        <p>Continuity claims another detective.</p>
      </div>
      <div id="overlay">
        <p class="kicker">Act I · Modern District</p>
        <h1>Destiny's World: Lost Society in Time</h1>
        <p class="lede">Detective Alex Morgan</p>
        <p class="story">A missing-persons case. The streets are too quiet. Evacuation notices are stamped yesterday. You were not told.</p>
        <p id="load-label">Loading the boulevard…</p>
        <button id="start" type="button" hidden>Click to begin</button>
        <ul class="controls">
          <li>WASD move</li><li>Mouse look</li><li>Shift sprint</li><li>C / Ctrl crouch</li>
          <li>E interact</li><li>Tab journal</li><li>Click / F strike</li><li>B place</li><li>N night vision</li><li>Esc pause</li>
        </ul>
      </div>
    `;
    this.overlay = this.must('overlay');
    this.startBtn = this.must('start') as HTMLButtonElement;
    this.loadLabel = this.must('load-label');
    this.prompt = this.must('prompt');
    this.tool = this.must('tool');
    this.subtitle = this.must('subtitle');
    this.healthFill = this.must('health-fill');
    this.fragments = this.must('fragments');
    this.watch = this.must('watch').querySelector('strong') as HTMLElement;
    this.journal = this.must('journal');
    this.entries = this.must('entries');
    this.pause = this.must('pause');
    this.death = this.must('death');
    this.crosshair = this.must('crosshair');
  }

  get canvas(): HTMLCanvasElement {
    return this.must('view') as HTMLCanvasElement;
  }

  get start(): HTMLButtonElement {
    return this.startBtn;
  }

  get resume(): HTMLButtonElement {
    return this.must('resume') as HTMLButtonElement;
  }

  setProgress(ratio: number): void {
    const pct = Math.round(ratio * 100);
    this.loadLabel.textContent = `Loading the boulevard… ${pct}%`;
  }

  setReady(): void {
    this.loadLabel.hidden = true;
    this.startBtn.hidden = false;
  }

  showPlay(): void {
    this.overlay.hidden = true;
    this.root.classList.add('playing');
  }

  setPrompt(text: string | null): void {
    this.prompt.textContent = text ?? '';
    this.prompt.classList.toggle('show', Boolean(text));
  }

  setTool(text: string): void {
    this.tool.textContent = text;
    this.tool.classList.toggle('show', text.length > 0);
  }

  say(text: string): void {
    this.subtitle.textContent = text;
    this.subtitle.classList.add('show');
    this.subTimer = 4.6;
  }

  tickSubtitle(dt: number): void {
    if (this.subTimer <= 0) return;
    this.subTimer -= dt;
    if (this.subTimer <= 0) this.subtitle.classList.remove('show');
  }

  setHealth(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    this.healthFill.style.transform = `scaleX(${clamped})`;
    this.healthFill.classList.toggle('low', clamped < 0.35);
  }

  setFragments(count: number): void {
    this.fragments.textContent = `${count}/2`;
  }

  setWatch(text: string): void {
    this.watch.textContent = text;
  }

  setJournal(entries: JournalEntry[], open: boolean): void {
    this.entries.innerHTML = entries
      .map(
        (e) =>
          `<article><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.body)}</p></article>`,
      )
      .join('');
    this.journal.hidden = !open;
    this.crosshair.classList.toggle('dim', open);
  }

  setPaused(open: boolean): void {
    this.pause.hidden = !open;
    this.crosshair.classList.toggle('dim', open || !this.journal.hidden);
  }

  setDeath(open: boolean): void {
    this.death.hidden = !open;
  }

  private must(id: string): HTMLElement {
    const el = this.root.querySelector(`#${id}`);
    if (!el) throw new Error(`Missing #${id}`);
    return el as HTMLElement;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
