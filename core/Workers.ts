/**
 * @module    AriannAWorkers
 * @author    Riccardo Angeli
 * @version   0.2.0
 * @copyright Riccardo Angeli 2026 All Rights Reserved
 *
 * WebWorker abstraction, parallel computation.
 * Includes: WorkerPool, SharedState, OffscreenCanvas, ComputeShader bridge.
 *
 * ── SIGNAL BRIDGE ─────────────────────────────────────────────────────────────
 * Workers.sharedSignal(key, initial) → Signal<T> sincronizzato cross-thread
 * via SharedArrayBuffer + Atomics (ove disponibile) o postMessage fallback.
 *
 * Il Signal creato è identico a State.signal() — stessa API .get()/.set()/.peek().
 * Gli Effect nel thread main reagiscono normalmente.
 * Quando il worker chiama postMessage({ type: 'signal', key, value }),
 * il thread main aggiorna il Signal corrispondente → tutti gli Effect reagiscono.
 *
 * @example
 *   const Workers = Core.use(WorkersPlugin);
 *
 *   // Thread main
 *   const progress = Workers.sharedSignal('progress', 0);
 *   State.effect(() => { progressBar.style('width', `${progress.get()}%`); });
 *
 *   // Worker (via postMessage protocol)
 *   for (let i = 0; i <= 100; i++) {
 *     self.postMessage({ type: 'arianna:signal', key: 'progress', value: i });
 *     await sleep(10);
 *   }
 */

import Core from './Core.ts';
import { Observable } from './Observable.ts';
import State from './State.ts';
import { signal as _signal } from './Observable.ts';
import type { Signal } from './Observable.ts';

// ── WorkerPool ────────────────────────────────────────────────────────────────

export interface WorkerTask<T = unknown>
{
    fn     : (...args: unknown[]) => T;
    args   : unknown[];
    resolve: (v: T) => void;
    reject : (e: unknown) => void;
}

/**
 * Pool di Worker riusabili — evita il costo di spawn per ogni task.
 *
 * @example
 *   const pool = new WorkerPool(4, './worker.js');
 *   const result = await pool.run((a, b) => a + b, [1, 2]);
 */
export class WorkerPool
{
    #workers : Worker[]     = [];
    #queue   : WorkerTask[] = [];
    #idle    : Worker[]     = [];

    constructor(size: number, url: string | URL)
    {
        for (let i = 0; i < size; i++) {
            const w = new Worker(url, { type: 'module' });
            w.onmessage = (e) => this.#onResult(w, e.data);
            w.onerror   = (e) => this.#onError(w, e);
            this.#workers.push(w);
            this.#idle.push(w);
        }
    }

    /**
     * Esegue fn in un worker del pool.
     * Il worker deve esporre un handler che risponde a { fn, args }.
     */
    run<T>(fn: (...args: unknown[]) => T, args: unknown[] = []): Promise<T>
    {
        return new Promise((resolve, reject) => {
            const task: WorkerTask<T> = { fn, args, resolve, reject };
            const worker = this.#idle.pop();
            if (worker) this.#dispatch(worker, task as WorkerTask);
            else this.#queue.push(task as WorkerTask);
        });
    }

    /** Termina tutti i worker del pool. */
    terminate(): void
    {
        this.#workers.forEach(w => w.terminate());
        this.#workers = []; this.#idle = []; this.#queue = [];
    }

    #dispatch(worker: Worker, task: WorkerTask): void
    {
        (worker as unknown as Record<string, unknown>)['__task__'] = task;
        worker.postMessage({ fn: task.fn.toString(), args: task.args });
    }

    #onResult(worker: Worker, data: unknown): void
    {
        const task = (worker as unknown as Record<string, unknown>)['__task__'] as WorkerTask | undefined;
        task?.resolve(data);
        const next = this.#queue.shift();
        if (next) this.#dispatch(worker, next);
        else this.#idle.push(worker);
    }

    #onError(worker: Worker, e: ErrorEvent): void
    {
        const task = (worker as unknown as Record<string, unknown>)['__task__'] as WorkerTask | undefined;
        task?.reject(e.error ?? e.message);
        this.#idle.push(worker);
    }
}

// ── SharedState — Signal bridge cross-thread ──────────────────────────────────

const _sharedSignals = new Map<string, Signal<unknown>>();

/**
 * Crea (o recupera) un Signal sincronizzato con i Worker via postMessage.
 * Il worker può aggiornarlo inviando:
 *   { type: 'arianna:signal', key: string, value: T }
 *
 * @example
 *   const progress = Workers.sharedSignal('progress', 0);
 *   State.effect(() => progressBar.style('width', `${progress.get()}%`));
 */
function sharedSignal<T>(key: string, initial: T): Signal<T>
{
    if (_sharedSignals.has(key)) return _sharedSignals.get(key) as Signal<T>;
    const s = _signal<T>(initial);
    _sharedSignals.set(key, s as Signal<unknown>);
    return s;
}

/** Handler globale per i messaggi dai Worker. Registrato automaticamente. */
function _installWorkerListener(): void
{
    if (typeof window === 'undefined') return;
    window.addEventListener('message', (e: MessageEvent) => {
        const { type, key, value } = e.data ?? {};
        if (type === 'arianna:signal' && _sharedSignals.has(key)) {
            (_sharedSignals.get(key) as Signal<unknown>).set(value);
        }
    });
}

// ── OffscreenCanvas bridge ─────────────────────────────────────────────────────

/**
 * Trasferisce un Canvas a un Worker per rendering off-thread.
 * Il Worker riceve il canvas e può usare WebGL/2D context senza bloccare il main thread.
 *
 * @example
 *   const canvas = document.getElementById('gl') as HTMLCanvasElement;
 *   const worker = new Worker('./renderer.js', { type: 'module' });
 *   Workers.offscreen(canvas, worker);
 */
function offscreen(canvas: HTMLCanvasElement, worker: Worker): void
{
    if (!('transferControlToOffscreen' in canvas)) {
        console.warn('[AriannA Workers] OffscreenCanvas not supported in this browser');
        return;
    }
    const offscreenCanvas = (canvas as unknown as { transferControlToOffscreen(): OffscreenCanvas }).transferControlToOffscreen();
    worker.postMessage({ type: 'arianna:offscreen', canvas: offscreenCanvas }, [offscreenCanvas as unknown as Transferable]);
}

// ── Workers Plugin ─────────────────────────────────────────────────────────────

export const Workers = {
    name   : 'AriannAWorkers',
    version: '0.2.0',

    install(core: typeof Core, _opts?: unknown): void
    {
        _installWorkerListener();

        const API = {
            WorkerPool,
            sharedSignal,
            offscreen,
            /** Tutti i Signal condivisi attivi — utile per debug. */
            get signals() { return _sharedSignals; },
        };

        Object.defineProperty(window, 'AriannAWorkers', {
            value: API, writable: false, enumerable: false, configurable: false,
        });
    },
};

export default Workers;
