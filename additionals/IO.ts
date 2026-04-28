/**
 * @module    IO
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. IO — File I/O, network, storage, clipboard, drag & drop.
 * Zero dependencies.
 *
 * ── FILE ──────────────────────────────────────────────────────────────────────
 *   FileIO     — File API, drag-drop, download helpers
 *   FSAccess   — File System Access API (read/write files & directories)
 *
 * ── NETWORK ──────────────────────────────────────────────────────────────────
 *   Http       — Fetch wrapper with retries, timeout, interceptors
 *   SSE        — Server-Sent Events reactive wrapper
 *   WebSocketIO— WebSocket wrapper with reconnect + message queue
 *
 * ── STORAGE ──────────────────────────────────────────────────────────────────
 *   LocalStore — localStorage reactive wrapper
 *   IndexedDB  — IndexedDB promise-based wrapper
 *
 * ── CLIPBOARD ────────────────────────────────────────────────────────────────
 *   Clipboard  — read/write text, images, rich content
 *
 * ── SHARE ────────────────────────────────────────────────────────────────────
 *   Share      — Web Share API wrapper
 */

// ── FileIO ────────────────────────────────────────────────────────────────────

export type FileFilter = { description: string; accept: Record<string, string[]> };

export class FileIO {

    /** Open a file picker and return the selected File(s). */
    static async open(opts: { multiple?: boolean; accept?: string; filters?: FileFilter[] } = {}): Promise<File[]> {
        // Try File System Access API first
        if ('showOpenFilePicker' in window) {
            const handles = await (window as unknown as {
                showOpenFilePicker(o?: object): Promise<FileSystemFileHandle[]>
            }).showOpenFilePicker({
                multiple: opts.multiple ?? false,
                types   : opts.filters,
            });
            return Promise.all(handles.map((h: FileSystemFileHandle) => h.getFile()));
        }
        // Fallback: hidden input
        return new Promise(res => {
            const input        = document.createElement('input');
            input.type         = 'file';
            input.multiple     = opts.multiple ?? false;
            if (opts.accept) input.accept = opts.accept;
            input.onchange     = () => res(Array.from(input.files ?? []));
            input.click();
        });
    }

    /** Read File/Blob as text. */
    static readText(file: File | Blob): Promise<string> {
        return new Promise((res,rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsText(file); });
    }

    /** Read File/Blob as ArrayBuffer. */
    static readBinary(file: File | Blob): Promise<ArrayBuffer> {
        return new Promise((res,rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = rej; r.readAsArrayBuffer(file); });
    }

    /** Read File/Blob as data URL. */
    static readDataURL(file: File | Blob): Promise<string> {
        return new Promise((res,rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
    }

    /** Download content as a file. */
    static download(content: string | Blob | ArrayBuffer, filename: string, type = 'application/octet-stream'): void {
        let blob: Blob;
        if (typeof content === 'string')        blob = new Blob([content], { type: 'text/plain' });
        else if (content instanceof ArrayBuffer) blob = new Blob([content], { type });
        else                                     blob = content;
        const url = URL.createObjectURL(blob);
        const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    /** Setup drag-and-drop on an element. */
    static dropZone(el: HTMLElement, onDrop: (files: File[]) => void, opts: { highlight?: string } = {}): () => void {
        const hl = opts.highlight ?? 'rgba(228,12,136,0.08)';
        const orig  = el.style.background;
        const over  = (e: DragEvent) => { e.preventDefault(); el.style.background = hl; };
        const leave = ()              => { el.style.background = orig; };
        const drop  = (e: DragEvent) => {
            e.preventDefault();
            el.style.background = orig;
            const files = Array.from(e.dataTransfer?.files ?? []);
            if (files.length) onDrop(files);
        };
        el.addEventListener('dragover',  over);
        el.addEventListener('dragleave', leave);
        el.addEventListener('drop',      drop);
        return () => { el.removeEventListener('dragover', over); el.removeEventListener('dragleave', leave); el.removeEventListener('drop', drop); };
    }
}

// ── FSAccess ──────────────────────────────────────────────────────────────────

export class FSAccess {
    static isSupported(): boolean { return 'showOpenFilePicker' in window; }

    static async readFile(filter?: FileFilter[]): Promise<{ name: string; text(): Promise<string>; binary(): Promise<ArrayBuffer> }> {
        const [handle] = await (window as unknown as { showOpenFilePicker(o?: object): Promise<FileSystemFileHandle[]> }).showOpenFilePicker({ types: filter });
        const file = await handle.getFile();
        return { name: file.name, text: () => file.text(), binary: () => file.arrayBuffer() };
    }

    static async writeFile(content: string | ArrayBuffer, suggestedName = 'file.txt', filter?: FileFilter[]): Promise<void> {
        const handle = await (window as unknown as { showSaveFilePicker(o?: object): Promise<FileSystemFileHandle> }).showSaveFilePicker({ suggestedName, types: filter });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    static async openDirectory(): Promise<FileSystemDirectoryHandle> {
        return (window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    }
}

// ── Http ──────────────────────────────────────────────────────────────────────

export interface HttpOptions {
    baseURL?    : string;
    timeout?    : number;
    retries?    : number;
    retryDelay? : number;
    headers?    : Record<string, string>;
    onRequest?  : (req: RequestInit & { url: string }) => void;
    onResponse? : (res: Response) => void;
    onError?    : (err: Error) => void;
}

export class Http {
    #opts: Required<HttpOptions>;

    constructor(opts: HttpOptions = {}) {
        this.#opts = { baseURL: '', timeout: 30000, retries: 0, retryDelay: 1000, headers: {}, onRequest: () => {}, onResponse: () => {}, onError: () => {}, ...opts };
    }

    async #fetch(url: string, init: RequestInit = {}, retries = this.#opts.retries): Promise<Response> {
        const fullURL = this.#opts.baseURL + url;
        const headers = { ...this.#opts.headers, ...(init.headers as Record<string,string> ?? {}) };
        const ctrl    = new AbortController();
        const timer   = setTimeout(() => ctrl.abort(), this.#opts.timeout);
        const req     = { ...init, headers, signal: ctrl.signal, url: fullURL };
        this.#opts.onRequest(req);
        try {
            const res = await fetch(fullURL, req);
            clearTimeout(timer);
            this.#opts.onResponse(res);
            return res;
        } catch (err) {
            clearTimeout(timer);
            if (retries > 0) { await new Promise(r => setTimeout(r, this.#opts.retryDelay)); return this.#fetch(url, init, retries - 1); }
            this.#opts.onError(err as Error);
            throw err;
        }
    }

    async get<T>(url: string, opts?: RequestInit):  Promise<T> { return (await this.#fetch(url, { ...opts, method: 'GET' })).json(); }
    async post<T>(url: string, body: unknown, opts?: RequestInit): Promise<T> { return (await this.#fetch(url, { ...opts, method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })).json(); }
    async put<T>(url: string, body: unknown, opts?: RequestInit): Promise<T>  { return (await this.#fetch(url, { ...opts, method: 'PUT',  body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })).json(); }
    async del<T>(url: string, opts?: RequestInit):  Promise<T> { return (await this.#fetch(url, { ...opts, method: 'DELETE' })).json(); }

    async blob(url: string): Promise<Blob>          { return (await this.#fetch(url)).blob(); }
    async buffer(url: string): Promise<ArrayBuffer> { return (await this.#fetch(url)).arrayBuffer(); }
    async text(url: string):   Promise<string>      { return (await this.#fetch(url)).text(); }
}

export const http = new Http();

// ── SSE ───────────────────────────────────────────────────────────────────────

export class SSE {
    #source   : EventSource | null = null;
    #handlers : Map<string, ((data: unknown) => void)[]> = new Map();

    connect(url: string, withCredentials = false): this {
        this.disconnect();
        this.#source = new EventSource(url, { withCredentials });
        this.#source.onmessage = (e) => this.#emit('message', e.data);
        this.#source.onerror   = (e) => this.#emit('error', e);
        this.#source.onopen    = (e) => this.#emit('open', e);
        return this;
    }

    on(event: string, handler: (data: unknown) => void): this {
        if (!this.#handlers.has(event)) this.#handlers.set(event, []);
        this.#handlers.get(event)!.push(handler);
        this.#source?.addEventListener(event, (e) => handler((e as MessageEvent).data));
        return this;
    }

    #emit(event: string, data: unknown): void {
        this.#handlers.get(event)?.forEach(h => h(data));
    }

    disconnect(): void { this.#source?.close(); this.#source = null; }
    get readyState(): number { return this.#source?.readyState ?? -1; }
}

// ── WebSocketIO ───────────────────────────────────────────────────────────────

export class WebSocketIO {
    #ws          : WebSocket | null = null;
    #url         : string;
    #queue       : unknown[] = [];
    #handlers    : Map<string, ((data: unknown) => void)[]> = new Map();
    #reconnect   : boolean;
    #reconnectMs : number;

    constructor(url: string, opts: { reconnect?: boolean; reconnectMs?: number } = {}) {
        this.#url         = url;
        this.#reconnect   = opts.reconnect   ?? true;
        this.#reconnectMs = opts.reconnectMs ?? 3000;
    }

    connect(): this {
        this.#ws = new WebSocket(this.#url);
        this.#ws.onopen    = () => { this.#emit('open', null); this.#flush(); };
        this.#ws.onmessage = (e) => { try { this.#emit('message', JSON.parse(e.data)); } catch { this.#emit('message', e.data); } };
        this.#ws.onerror   = (e) => this.#emit('error', e);
        this.#ws.onclose   = (e) => { this.#emit('close', e); if (this.#reconnect) setTimeout(() => this.connect(), this.#reconnectMs); };
        return this;
    }

    send(data: unknown): this {
        if (this.#ws?.readyState === 1) this.#ws.send(JSON.stringify(data));
        else this.#queue.push(data);
        return this;
    }

    #flush(): void { while (this.#queue.length) this.send(this.#queue.shift()); }

    on(event: string, handler: (data: unknown) => void): this {
        if (!this.#handlers.has(event)) this.#handlers.set(event, []);
        this.#handlers.get(event)!.push(handler);
        return this;
    }

    #emit(event: string, data: unknown): void { this.#handlers.get(event)?.forEach(h => h(data)); }

    close(): void { this.#reconnect = false; this.#ws?.close(); }
    get readyState(): number { return this.#ws?.readyState ?? -1; }
}

// ── LocalStore ────────────────────────────────────────────────────────────────

export class LocalStore<T extends Record<string, unknown>> {
    #key     : string;
    #default : T;
    #data    : T;
    #listeners: ((data: T) => void)[] = [];

    constructor(key: string, defaults: T) {
        this.#key     = key;
        this.#default = defaults;
        const raw     = localStorage.getItem(key);
        this.#data    = raw ? { ...defaults, ...JSON.parse(raw) } as T : { ...defaults };
    }

    get<K extends keyof T>(key: K): T[K] { return this.#data[key]; }

    set<K extends keyof T>(key: K, value: T[K]): this {
        this.#data = { ...this.#data, [key]: value };
        localStorage.setItem(this.#key, JSON.stringify(this.#data));
        this.#listeners.forEach(l => l(this.#data));
        return this;
    }

    reset(): this {
        this.#data = { ...this.#default };
        localStorage.setItem(this.#key, JSON.stringify(this.#data));
        this.#listeners.forEach(l => l(this.#data));
        return this;
    }

    subscribe(fn: (data: T) => void): () => void {
        this.#listeners.push(fn);
        return () => { this.#listeners = this.#listeners.filter(l => l !== fn); };
    }

    get all(): T { return { ...this.#data }; }
    clear(): void { localStorage.removeItem(this.#key); }
}

// ── IndexedDB wrapper ─────────────────────────────────────────────────────────

export class IDBIO {
    #name    : string;
    #version : number;
    #stores  : string[];
    #db      : IDBDatabase | null = null;

    constructor(name: string, stores: string[], version = 1) {
        this.#name    = name;
        this.#stores  = stores;
        this.#version = version;
    }

    async open(): Promise<this> {
        return new Promise((res, rej) => {
            const req = indexedDB.open(this.#name, this.#version);
            req.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                for (const store of this.#stores) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
            };
            req.onsuccess = (e) => { this.#db = (e.target as IDBOpenDBRequest).result; res(this); };
            req.onerror   = rej;
        });
    }

    async put<T extends { id: string | number }>(store: string, value: T): Promise<void> {
        return new Promise((res,rej) => { const tx = this.#db!.transaction(store, 'readwrite'); tx.objectStore(store).put(value).onsuccess = () => res(); tx.onerror = rej; });
    }

    async get<T>(store: string, id: string | number): Promise<T | undefined> {
        return new Promise((res,rej) => { const req = this.#db!.transaction(store,'readonly').objectStore(store).get(id); req.onsuccess = () => res(req.result as T); req.onerror = rej; });
    }

    async delete(store: string, id: string | number): Promise<void> {
        return new Promise((res,rej) => { const tx = this.#db!.transaction(store,'readwrite'); tx.objectStore(store).delete(id).onsuccess = () => res(); tx.onerror = rej; });
    }

    async getAll<T>(store: string): Promise<T[]> {
        return new Promise((res,rej) => { const req = this.#db!.transaction(store,'readonly').objectStore(store).getAll(); req.onsuccess = () => res(req.result as T[]); req.onerror = rej; });
    }

    close(): void { this.#db?.close(); }
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

export const Clipboard = {
    async readText(): Promise<string>        { return navigator.clipboard.readText(); },
    async writeText(text: string): Promise<void> { return navigator.clipboard.writeText(text); },
    async readImage(): Promise<Blob | null> {
        const items = await navigator.clipboard.read();
        for (const item of items) for (const type of item.types) if (type.startsWith('image/')) return item.getType(type);
        return null;
    },
    async writeImage(blob: Blob): Promise<void> {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    },
};

// ── Share ─────────────────────────────────────────────────────────────────────

export const Share = {
    isSupported(): boolean { return 'share' in navigator; },
    async share(data: { title?: string; text?: string; url?: string; files?: File[] }): Promise<void> {
        if (!Share.isSupported()) throw new Error('Web Share API not supported');
        return navigator.share(data);
    },
    canShareFiles(): boolean { return 'canShare' in navigator; },
};

// ── Public API ────────────────────────────────────────────────────────────────

export const IO = { FileIO, FSAccess, Http, http, SSE, WebSocketIO, LocalStore, IDBIO, Clipboard, Share };

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'IO', { value: IO, writable: false, enumerable: false, configurable: false });

export default IO;
