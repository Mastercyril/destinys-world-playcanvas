import './style.css';
import { Game } from './game';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app');

const params = new URLSearchParams(window.location.search);
const capture = params.get('capture');
const debug = params.has('debug') || capture !== null;

const game = new Game(root as HTMLElement, capture, debug);

void game.load().catch((err: unknown) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'The boulevard failed to load.';
  root.innerHTML = `<main style="color:#e6dccb;font-family:Georgia,serif;padding:8vh 10vw;background:#07040c;min-height:100vh">
    <p style="letter-spacing:.2em;text-transform:uppercase;color:#a3988c">Destiny's World</p>
    <h1>Lost Society in Time</h1>
    <p>${message}</p>
  </main>`;
});
