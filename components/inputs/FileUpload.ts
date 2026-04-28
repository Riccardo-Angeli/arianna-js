/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module FileUpload
 * Drag-and-drop file upload area.
 * @example
 *   const fu = new FileUpload('#root', { accept: 'image/*', multiple: true });
 *   fu.on('change', ({ files }) => upload(files));
 */
import { Control } from '../core/Control.ts';
export interface FileUploadOptions { accept?: string; multiple?: boolean; maxSize?: number; label?: string; hint?: string; disabled?: boolean; class?: string; }
export class FileUpload extends Control<FileUploadOptions> {
  private _files: File[] = [];
  private _dragging = false;
  constructor(container: string | HTMLElement | null = null, opts: FileUploadOptions = {}) {
    super(container, 'div', opts);
    this.el.className = `ar-fileupload${opts.class?' '+opts.class:''}`;
  }
  get files() { return this._files; }
  clear() { this._files = []; this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    const zone = this._el('div', `ar-fileupload__zone${this._dragging?' ar-fileupload__zone--over':''}`, this.el);
    this._el('div', 'ar-fileupload__icon', zone).textContent = '📁';
    const lbl = this._get('label', 'Drop files here or click to browse') as string;
    this._el('div', 'ar-fileupload__label', zone).textContent = lbl;
    const hint = this._get('hint', '') as string; if (hint) this._el('div', 'ar-fileupload__hint', zone).textContent = hint;
    const input = document.createElement('input'); input.type = 'file'; input.className = 'ar-fileupload__input';
    const accept = this._get('accept', '') as string; if (accept) input.accept = accept;
    input.multiple = this._get('multiple', false) as boolean;
    input.disabled = this._get('disabled', false) as boolean;
    input.addEventListener('change', () => { if (input.files) { this._files = Array.from(input.files); this._emit('change', { files: this._files }); this._build(); } });
    zone.appendChild(input);
    zone.addEventListener('dragover',  e => { e.preventDefault(); this._dragging = true;  zone.classList.add('ar-fileupload__zone--over'); });
    zone.addEventListener('dragleave', () => { this._dragging = false; zone.classList.remove('ar-fileupload__zone--over'); });
    zone.addEventListener('drop', e => { e.preventDefault(); this._dragging = false; zone.classList.remove('ar-fileupload__zone--over'); if (e.dataTransfer?.files) { this._files = Array.from(e.dataTransfer.files); this._emit('change', { files: this._files }); this._build(); } });
    if (this._files.length) {
      const list = this._el('ul', 'ar-fileupload__list', this.el);
      this._files.forEach(f => { const li = this._el('li', 'ar-fileupload__file', list); li.textContent = `${f.name} (${(f.size/1024).toFixed(1)} KB)`; });
    }
  }
}
export const FileUploadCSS = `.ar-fileupload{display:flex;flex-direction:column;gap:8px}.ar-fileupload__zone{align-items:center;border:2px dashed var(--ar-border);border-radius:var(--ar-radius-lg);cursor:pointer;display:flex;flex-direction:column;gap:6px;padding:28px 16px;position:relative;text-align:center;transition:border-color var(--ar-transition),background var(--ar-transition)}.ar-fileupload__zone:hover,.ar-fileupload__zone--over{border-color:var(--ar-primary);background:rgba(126,184,247,.04)}.ar-fileupload__icon{font-size:2rem}.ar-fileupload__label{font-size:.83rem}.ar-fileupload__hint{color:var(--ar-muted);font-size:.74rem}.ar-fileupload__input{cursor:pointer;height:100%;left:0;opacity:0;position:absolute;top:0;width:100%}.ar-fileupload__list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}.ar-fileupload__file{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius-sm);font-size:.78rem;padding:4px 10px}`;
