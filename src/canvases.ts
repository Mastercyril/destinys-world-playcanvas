import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  return { c, g };
}

function texOf(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function evacuationPoster(): CanvasTexture {
  const { c, g } = canvas(512, 680);
  g.fillStyle = '#cfc4ae';
  g.fillRect(0, 0, 512, 680);
  g.strokeStyle = '#2a241c';
  g.lineWidth = 10;
  g.strokeRect(18, 18, 476, 644);
  g.fillStyle = '#1c1814';
  g.font = '600 28px Georgia, serif';
  g.textAlign = 'center';
  g.fillText('CITY OF THORNHAVEN', 256, 78);
  g.font = '700 22px Georgia, serif';
  g.fillText('CIVIL AUTHORITY', 256, 112);
  g.fillStyle = '#6e1c28';
  g.font = '700 64px Georgia, serif';
  g.fillText('EVACUATION', 256, 210);
  g.fillStyle = '#1c1814';
  g.font = '500 26px Georgia, serif';
  g.fillText('ALL DISTRICTS', 256, 258);
  g.font = '600 30px Georgia, serif';
  g.fillText('EFFECTIVE', 256, 340);
  g.save();
  g.translate(256, 430);
  g.rotate(-0.08);
  g.fillStyle = '#9a1d32';
  g.font = '800 78px Georgia, serif';
  g.fillText('YESTERDAY', 0, 0);
  g.restore();
  g.fillStyle = '#1c1814';
  g.font = '500 22px Georgia, serif';
  g.fillText('Leave your homes.', 256, 530);
  g.fillText('Do not wait for a second notice.', 256, 562);
  g.font = 'italic 20px Georgia, serif';
  g.fillText('Shelters will not have your name.', 256, 600);
  g.font = '600 18px Georgia, serif';
  g.fillText('— CIVIL AUTHORITY', 256, 640);
  return texOf(c);
}

export function docketTexture(): CanvasTexture {
  const { c, g } = canvas(512, 680);
  g.fillStyle = '#e6dcc6';
  g.fillRect(0, 0, 512, 680);
  g.fillStyle = '#1a2744';
  g.fillRect(0, 0, 512, 86);
  g.fillStyle = '#f2ead8';
  g.font = '700 28px Georgia, serif';
  g.textAlign = 'center';
  g.fillText('THORNHAVEN P.D.', 256, 38);
  g.font = '600 20px Georgia, serif';
  g.fillText('MISSING PERSONS  ·  14-A', 256, 68);
  g.fillStyle = '#1c1814';
  g.textAlign = 'left';
  g.font = '500 28px Georgia, serif';
  const lines = [
    '1.  ELLIS, MARA',
    '2.  CHO, DENNIS',
    '3.  IBRAHIM, S.',
    '',
    'Filed this morning.',
    'Received: YESTERDAY.',
    '',
    'No two clocks in the',
    'building agree.',
  ];
  lines.forEach((line, i) => g.fillText(line, 48, 160 + i * 46));
  return texOf(c);
}

export function clockTexture(): CanvasTexture {
  const { c, g } = canvas(512, 512);
  g.fillStyle = '#16130f';
  g.fillRect(0, 0, 512, 512);
  g.beginPath();
  g.arc(256, 256, 220, 0, Math.PI * 2);
  g.fillStyle = '#d9d0c2';
  g.fill();
  g.beginPath();
  g.arc(256, 256, 200, 0, Math.PI * 2);
  g.fillStyle = '#f3efe6';
  g.fill();
  g.strokeStyle = '#1c1814';
  g.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = i % 3 === 0 ? 158 : 176;
    g.beginPath();
    g.moveTo(256 + Math.cos(a) * inner, 256 + Math.sin(a) * inner);
    g.lineTo(256 + Math.cos(a) * 196, 256 + Math.sin(a) * 196);
    g.stroke();
  }
  g.fillStyle = '#1c1814';
  g.font = '700 36px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('12', 256, 78);
  g.fillText('3', 420, 256);
  g.fillText('6', 256, 438);
  g.fillText('9', 92, 256);
  // 03:17 — hour hand near 3, minute hand at 17.
  const minute = ((17 / 60) * Math.PI * 2) - Math.PI / 2;
  const hour = (((3 + 17 / 60) / 12) * Math.PI * 2) - Math.PI / 2;
  const hand = (angle: number, len: number, width: number) => {
    g.save();
    g.translate(256, 256);
    g.rotate(angle);
    g.fillStyle = '#1a120e';
    g.fillRect(-width / 2, -len, width, len);
    g.restore();
  };
  hand(hour, 110, 12);
  hand(minute, 150, 7);
  g.beginPath();
  g.arc(256, 256, 8, 0, Math.PI * 2);
  g.fill();
  return texOf(c);
}

export function precinctSign(): CanvasTexture {
  const { c, g } = canvas(1024, 160);
  g.fillStyle = '#140c10';
  g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = '#8a3038';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 1008, 144);
  g.fillStyle = '#e6d2c4';
  g.font = '600 42px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('THORNHAVEN  ·  12TH PRECINCT', 512, 62);
  g.font = '500 22px Georgia, serif';
  g.fillStyle = '#c45b68';
  g.fillText('CLOSED BY ORDER  ·  YESTERDAY', 512, 112);
  return texOf(c);
}

export function roadStencil(): CanvasTexture {
  const { c, g } = canvas(1024, 256);
  g.clearRect(0, 0, 1024, 256);
  g.fillStyle = 'rgba(210, 200, 180, 0.0)';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = 'rgba(190, 176, 150, 0.55)';
  g.font = '700 120px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('YESTERDAY', 512, 128);
  const t = texOf(c);
  t.wrapS = RepeatWrapping;
  return t;
}

export function woodTexture(): CanvasTexture {
  const { c, g } = canvas(128, 128);
  g.fillStyle = '#5a4634';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    g.strokeStyle = `rgba(30, 18, 10, ${0.25 + (y % 16) / 80})`;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y + 2);
    g.stroke();
  }
  const t = texOf(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

export type GeneratedTextures = {
  poster: Texture;
  docket: Texture;
  clock: Texture;
  sign: Texture;
  stencil: Texture;
  wood: Texture;
};
