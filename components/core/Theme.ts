/**
 * @module    AriannATheme
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Design tokens for the AriannA controls system.
 * Injects CSS custom properties on :root or a given element.
 *
 * @example
 *   import { Theme } from 'arianna-wip/controls/core/Theme';
 *
 *   // Apply dark theme globally
 *   Theme.apply('dark');
 *
 *   // Apply light theme to a container
 *   Theme.apply('light', document.querySelector('#app'));
 *
 *   // Extend / override tokens
 *   Theme.extend({ '--ar-primary': '#ff6b6b' });
 */

export type ThemeMode = 'dark' | 'light' | 'auto';

export interface ThemeTokens {
  '--ar-bg'          : string;
  '--ar-bg2'         : string;
  '--ar-bg3'         : string;
  '--ar-bg4'         : string;
  '--ar-border'      : string;
  '--ar-border2'     : string;
  '--ar-text'        : string;
  '--ar-muted'       : string;
  '--ar-dim'         : string;
  '--ar-primary'     : string;
  '--ar-primary-text': string;
  '--ar-success'     : string;
  '--ar-warning'     : string;
  '--ar-danger'      : string;
  '--ar-info'        : string;
  '--ar-radius'      : string;
  '--ar-radius-sm'   : string;
  '--ar-radius-lg'   : string;
  '--ar-shadow'      : string;
  '--ar-shadow-lg'   : string;
  '--ar-font'        : string;
  '--ar-font-mono'   : string;
  '--ar-font-size'   : string;
  '--ar-transition'  : string;
  [key: string]      : string;
}

const DARK: ThemeTokens = {
  '--ar-bg'          : '#0d0d0d',
  '--ar-bg2'         : '#161616',
  '--ar-bg3'         : '#1e1e1e',
  '--ar-bg4'         : '#252525',
  '--ar-border'      : '#2a2a2a',
  '--ar-border2'     : '#333',
  '--ar-text'        : '#e0e0e0',
  '--ar-muted'       : '#888',
  '--ar-dim'         : '#444',
  '--ar-primary'     : '#7eb8f7',
  '--ar-primary-text': '#000',
  '--ar-success'     : '#4caf50',
  '--ar-warning'     : '#ff9800',
  '--ar-danger'      : '#f44336',
  '--ar-info'        : '#4dd0e1',
  '--ar-radius'      : '5px',
  '--ar-radius-sm'   : '3px',
  '--ar-radius-lg'   : '10px',
  '--ar-shadow'      : '0 2px 8px rgba(0,0,0,.4)',
  '--ar-shadow-lg'   : '0 8px 32px rgba(0,0,0,.6)',
  '--ar-font'        : 'ui-monospace,"Cascadia Code",monospace',
  '--ar-font-mono'   : 'ui-monospace,"Cascadia Code",monospace',
  '--ar-font-size'   : '13px',
  '--ar-transition'  : '.14s ease',
};

const LIGHT: ThemeTokens = {
  '--ar-bg'          : '#ffffff',
  '--ar-bg2'         : '#f5f5f5',
  '--ar-bg3'         : '#eeeeee',
  '--ar-bg4'         : '#e0e0e0',
  '--ar-border'      : '#d0d0d0',
  '--ar-border2'     : '#bdbdbd',
  '--ar-text'        : '#1a1a1a',
  '--ar-muted'       : '#666',
  '--ar-dim'         : '#999',
  '--ar-primary'     : '#1565c0',
  '--ar-primary-text': '#ffffff',
  '--ar-success'     : '#2e7d32',
  '--ar-warning'     : '#e65100',
  '--ar-danger'      : '#c62828',
  '--ar-info'        : '#00838f',
  '--ar-radius'      : '5px',
  '--ar-radius-sm'   : '3px',
  '--ar-radius-lg'   : '10px',
  '--ar-shadow'      : '0 2px 8px rgba(0,0,0,.12)',
  '--ar-shadow-lg'   : '0 8px 32px rgba(0,0,0,.18)',
  '--ar-font'        : 'system-ui,sans-serif',
  '--ar-font-mono'   : 'ui-monospace,monospace',
  '--ar-font-size'   : '13px',
  '--ar-transition'  : '.14s ease',
};

export const Theme = {
  dark : DARK,
  light: LIGHT,

  /**
   * Apply theme tokens to an element (default: document.documentElement).
   *
   * @example
   *   Theme.apply('dark');
   *   Theme.apply('light', document.querySelector('#panel'));
   */
  apply(mode: ThemeMode, target: HTMLElement = document.documentElement): void {
    const tokens = mode === 'light' ? LIGHT
      : mode === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? LIGHT : DARK)
        : DARK;
    Object.entries(tokens).forEach(([k, v]) => target.style.setProperty(k, v ?? null));
    target.dataset.arTheme = mode;
  },

  /**
   * Extend / override specific tokens on a target element.
   *
   * @example
   *   Theme.extend({ '--ar-primary': '#ff6b6b', '--ar-radius': '8px' });
   */
  extend(tokens: Partial<ThemeTokens>, target: HTMLElement = document.documentElement): void {
    Object.entries(tokens).forEach(([k, v]) => target.style.setProperty(k, v ?? null));
  },

  /**
   * Inject the shared base CSS required by all controls.
   * Call once at app startup.
   */
  inject(): void {
    if (document.getElementById('arianna-wip-base-css')) return;
    const s = document.createElement('style');
    s.id = 'arianna-wip-base-css';
    s.textContent = `
*, *::before, *::after { box-sizing: border-box; }
.ar-ctrl { font-family: var(--ar-font); font-size: var(--ar-font-size); color: var(--ar-text); }
.ar-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--ar-bg3); border: 1px solid var(--ar-border); border-radius: var(--ar-radius);
  color: var(--ar-text); cursor: pointer; font: inherit; font-size: .82rem;
  padding: 5px 14px; transition: background var(--ar-transition), border-color var(--ar-transition);
  user-select: none; white-space: nowrap;
}
.ar-btn:hover:not(:disabled) { background: var(--ar-bg4); border-color: var(--ar-border2); }
.ar-btn--primary { background: var(--ar-primary); border-color: var(--ar-primary); color: var(--ar-primary-text); }
.ar-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.ar-btn:disabled { opacity: .4; cursor: not-allowed; }
.ar-input {
  background: var(--ar-bg3); border: 1px solid var(--ar-border); border-radius: var(--ar-radius);
  color: var(--ar-text); font: inherit; font-size: .82rem; outline: none;
  padding: 5px 10px; transition: border-color var(--ar-transition); width: 100%;
}
.ar-input:focus { border-color: var(--ar-primary); }
.ar-input:disabled { opacity: .5; cursor: not-allowed; }
`;
    document.head.appendChild(s);
  },
};
