console.log('main.ts loaded');

import { Core, Real, State, Directive } from 'ariannajs';

// ── App state ─────────────────────────────────────────────────────────────────
const state = new State({
  count  : 0,
  message: 'Welcome to AriannA!',
  theme  : 'light',
});

// ── Build UI with Real ────────────────────────────────────────────────────────
const app = new Real('#app');

// Header
const header = new Real('header')
  .set('style', 'display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid #e0e0e0;background:#fff');

const logo = new Real('div')
  .set('innerHTML', 'Ariann<span style="color:#e40c88">A</span>')
  .set('style', 'font-size:1.4rem;font-weight:700;letter-spacing:.04em;font-family:Avenir Next,Century Gothic,sans-serif');

const ver = new Real('span')
  .set('textContent', `v${Core.version.string}`)
  .set('style', 'background:#f0f0f0;border:1px solid #e0e0e0;border-radius:8px;color:#555;font-size:.7rem;padding:2px 8px');

header.add(logo.render(), ver.render());

// Counter card
const card = new Real('div')
  .set('style', 'background:#fff;border:1px solid #e0e0e0;border-radius:8px;margin:24px;padding:24px;max-width:400px');

const title = new Real('h1')
  .set('textContent', state.State.message)
  .set('style', 'font-size:1.4rem;font-weight:700;margin-bottom:8px;color:#111');

const counter = new Real('div')
  .set('style', 'font-size:3rem;font-weight:700;color:#e40c88;text-align:center;margin:16px 0');

const updateCounter = () => {
  counter.set('textContent', String(state.State.count));
};
updateCounter();

// Buttons
const btnRow = new Real('div')
  .set('style', 'display:flex;gap:8px;justify-content:center;margin-top:16px');

const btnStyle = 'border:none;border-radius:5px;cursor:pointer;font:inherit;font-size:.85rem;font-weight:600;padding:8px 20px;transition:opacity .15s';

const btnPlus = new Real('button')
  .set('textContent', '+ Increment')
  .set('style', `background:#e40c88;color:#fff;${btnStyle}`)
  .on('click', () => { state.State.count++; });

const btnMinus = new Real('button')
  .set('textContent', '− Decrement')
  .set('style', `background:#f0f0f0;color:#111;${btnStyle}`)
  .on('click', () => { state.State.count--; });

const btnReset = new Real('button')
  .set('textContent', 'Reset')
  .set('style', `background:#fff;color:#555;border:1px solid #e0e0e0;border-radius:5px;cursor:pointer;font:inherit;font-size:.85rem;padding:8px 20px`)
  .on('click', () => { state.State.count = 0; });

btnRow.add(btnMinus.render(), btnPlus.render(), btnReset.render());

// State log
const log = new Real('div')
  .set('style', 'background:#f5f5f5;border:1px solid #e0e0e0;border-radius:5px;color:#555;font-family:monospace;font-size:.75rem;margin-top:16px;padding:10px');

state.on('State-Changed', (e) => {
  updateCounter();
  log.set('textContent', `State-Changed: ${JSON.stringify(e.Property)}`);
});

// Assemble
card.add(title.render(), counter.render(), btnRow.render(), log.render());
app.add(header.render(), card.render());

const button = new Real('button')
  .set('textContent', 'Click me!')
  .on('click', () => {
    button.set('textContent', 'You clicked me!');
  }).append(btnRow);
