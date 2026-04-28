/**
 * @module    Modal
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Accessible dialog/modal overlay.
 *
 * @example
 *   const modal = new Modal({ size: 'md' });
 *   modal.title   = 'Confirm action';
 *   modal.content = '<p>Are you sure?</p>';
 *   modal.footer  = '<button id="ok">OK</button>';
 *   modal.open();
 *   modal.on('close', () => console.log('closed'));
 */
import { Control } from '../core/Control.ts';

export interface ModalOptions {
  size?            : 'sm'|'md'|'lg'|'xl'|'full';
  closeOnBackdrop? : boolean;
  class?           : string;
}

export class Modal extends Control<ModalOptions> {
  private _title   = '';
  private _content : string|HTMLElement = '';
  private _footer  : string|HTMLElement = '';
  private _backdrop!: HTMLElement;
  private _dialog!  : HTMLElement;

  constructor(opts: ModalOptions = {}) {
    super(null, 'div', { size: 'md', closeOnBackdrop: true, ...opts });
    document.body.appendChild(this.el);
    this.el.className = `ar-modal${opts.class ? ' '+opts.class : ''}`;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.style.display = 'none';

    this._backdrop = this._el('div', 'ar-modal__backdrop', this.el);
    this._dialog   = this._el('div', `ar-modal__dialog ar-modal__dialog--${opts.size??'md'}`, this.el);

    this._backdrop.addEventListener('click', () => {
      if (this._get('closeOnBackdrop', true)) this.close();
    });
    this._on(document as unknown as HTMLElement, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.el.style.display !== 'none') this.close();
    });
  }

  set title(v: string)               { this._title   = v; this._build(); }
  set content(v: string|HTMLElement) { this._content = v; this._build(); }
  set footer(v: string|HTMLElement)  { this._footer  = v; this._build(); }

  open()  {
    this.el.style.display = '';
    document.body.style.overflow = 'hidden';
    this._emit('open', {});
  }
  close() {
    this.el.style.display = 'none';
    document.body.style.overflow = '';
    this._emit('close', {});
  }

  protected _build() {
    this._dialog.innerHTML = '';
    const h = this._el('div', 'ar-modal__header', this._dialog);
    const t = this._el('div', 'ar-modal__title',  h); t.textContent = this._title;
    const x = this._el('button', 'ar-modal__close', h) as HTMLButtonElement;
    x.textContent = '✕'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => this.close());

    const b = this._el('div', 'ar-modal__body', this._dialog);
    if (typeof this._content === 'string') b.innerHTML = this._content;
    else if (this._content) b.appendChild(this._content);

    if (this._footer) {
      const f = this._el('div', 'ar-modal__footer', this._dialog);
      if (typeof this._footer === 'string') f.innerHTML = this._footer;
      else f.appendChild(this._footer);
    }
  }
}

export const ModalCSS = `
.ar-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center}
.ar-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(2px)}
.ar-modal__dialog{position:relative;background:var(--ar-bg2);border:1px solid var(--ar-border);border-radius:var(--ar-radius-lg);box-shadow:var(--ar-shadow-lg);display:flex;flex-direction:column;max-height:90vh;width:90vw;z-index:1;overflow:hidden}
.ar-modal__dialog--sm{max-width:360px}
.ar-modal__dialog--md{max-width:520px}
.ar-modal__dialog--lg{max-width:760px}
.ar-modal__dialog--xl{max-width:1020px}
.ar-modal__dialog--full{max-width:none;width:96vw;height:96vh}
.ar-modal__header{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--ar-border);flex-shrink:0}
.ar-modal__title{flex:1;font-weight:600}
.ar-modal__close{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:1rem;line-height:1;padding:2px 6px;border-radius:var(--ar-radius-sm)}
.ar-modal__close:hover{background:var(--ar-bg4)}
.ar-modal__body{flex:1;overflow-y:auto;padding:16px}
.ar-modal__footer{padding:12px 16px;border-top:1px solid var(--ar-border);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0}
`;
