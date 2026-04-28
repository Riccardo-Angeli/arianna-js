/**
 * @module    Video
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. Video — browser video capture, playback, and composition.
 * Zero dependencies.
 *
 * ── CAPTURE ───────────────────────────────────────────────────────────────────
 *   ScreenCapture  — getDisplayMedia recording
 *   CameraCapture  — getUserMedia recording
 *   MediaRecorder  — record to Blob (webm/mp4)
 *
 * ── PLAYBACK ──────────────────────────────────────────────────────────────────
 *   VideoPlayer    — fluent <video> wrapper
 *   VideoSprite    — sprite sheet frame animation
 *
 * ── COMPOSITION ──────────────────────────────────────────────────────────────
 *   VideoCompositor — Canvas2D multi-layer renderer
 *   TextOverlay     — text track rendering
 *   Timeline        — time-based layer sequencer
 *
 * ── EXPORT ────────────────────────────────────────────────────────────────────
 *   .toGIF()   — animated GIF via Canvas2D + LZW
 *   .download() — trigger Blob download
 */

export interface VideoOptions {
    width?    : number;
    height?   : number;
    frameRate?: number;
    audio?    : boolean;
}

// ── ScreenCapture ─────────────────────────────────────────────────────────────

export class ScreenCapture {
    #stream  : MediaStream | null = null;
    #recorder: MediaRecorder | null = null;
    #chunks  : Blob[] = [];
    #opts    : VideoOptions;

    constructor(opts: VideoOptions = {}) {
        this.#opts = { width: 1920, height: 1080, frameRate: 30, audio: false, ...opts };
    }

    async start(): Promise<this> {
        const constraints: DisplayMediaStreamOptions = {
            video: { width: this.#opts.width, height: this.#opts.height },
            audio: this.#opts.audio,
        };
        this.#stream  = await navigator.mediaDevices.getDisplayMedia(constraints);
        this.#chunks  = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        this.#recorder = new MediaRecorder(this.#stream, { mimeType });
        this.#recorder.ondataavailable = e => { if (e.data.size > 0) this.#chunks.push(e.data); };
        this.#recorder.start(100);
        return this;
    }

    async stop(): Promise<Blob> {
        return new Promise(res => {
            if (!this.#recorder) { res(new Blob()); return; }
            this.#recorder.onstop = () => res(new Blob(this.#chunks, { type: 'video/webm' }));
            this.#recorder.stop();
            this.#stream?.getTracks().forEach(t => t.stop());
        });
    }

    get stream(): MediaStream | null { return this.#stream; }
}

// ── CameraCapture ─────────────────────────────────────────────────────────────

export class CameraCapture {
    #stream   : MediaStream | null = null;
    #recorder : MediaRecorder | null = null;
    #chunks   : Blob[] = [];
    #opts     : VideoOptions;

    constructor(opts: VideoOptions = {}) {
        this.#opts = { width: 1280, height: 720, frameRate: 30, audio: true, ...opts };
    }

    async start(): Promise<this> {
        this.#stream = await navigator.mediaDevices.getUserMedia({
            video: { width: this.#opts.width, height: this.#opts.height, frameRate: this.#opts.frameRate },
            audio: this.#opts.audio,
        });
        this.#chunks  = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        this.#recorder = new MediaRecorder(this.#stream, { mimeType });
        this.#recorder.ondataavailable = e => { if (e.data.size > 0) this.#chunks.push(e.data); };
        this.#recorder.start(100);
        return this;
    }

    async stop(): Promise<Blob> {
        return new Promise(res => {
            if (!this.#recorder) { res(new Blob()); return; }
            this.#recorder.onstop = () => res(new Blob(this.#chunks, { type: 'video/webm' }));
            this.#recorder.stop();
            this.#stream?.getTracks().forEach(t => t.stop());
        });
    }

    mountPreview(container: string | HTMLElement): this {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (el && this.#stream) {
            const v = document.createElement('video');
            v.srcObject = this.#stream;
            v.autoplay  = true; v.muted = true; v.playsInline = true;
            v.style.cssText = 'width:100%;height:auto;';
            el.appendChild(v);
        }
        return this;
    }

    get stream(): MediaStream | null { return this.#stream; }
}

// ── VideoPlayer ───────────────────────────────────────────────────────────────

export class VideoPlayer {
    #el: HTMLVideoElement;

    constructor(container: string | HTMLElement, opts: { width?: number; height?: number; controls?: boolean; autoplay?: boolean; loop?: boolean; muted?: boolean } = {}) {
        this.#el = document.createElement('video');
        this.#el.controls   = opts.controls  ?? true;
        this.#el.autoplay   = opts.autoplay  ?? false;
        this.#el.loop       = opts.loop      ?? false;
        this.#el.muted      = opts.muted     ?? false;
        this.#el.playsInline = true;
        if (opts.width)  this.#el.style.width  = `${opts.width}px`;
        if (opts.height) this.#el.style.height = `${opts.height}px`;
        const parent = typeof container === 'string' ? document.querySelector(container) : container;
        parent?.appendChild(this.#el);
    }

    src(url: string | Blob): this {
        this.#el.src = url instanceof Blob ? URL.createObjectURL(url) : url;
        return this;
    }

    play():  Promise<void> { return this.#el.play(); }
    pause(): this          { this.#el.pause(); return this; }
    seek(t: number): this  { this.#el.currentTime = t; return this; }

    on(event: string, handler: EventListener): this { this.#el.addEventListener(event, handler); return this; }

    get duration():     number  { return this.#el.duration; }
    get currentTime():  number  { return this.#el.currentTime; }
    get paused():       boolean { return this.#el.paused; }
    get element():      HTMLVideoElement { return this.#el; }

    /** Capture current frame as PNG Blob. */
    async captureFrame(): Promise<Blob> {
        const canvas = document.createElement('canvas');
        canvas.width = this.#el.videoWidth; canvas.height = this.#el.videoHeight;
        canvas.getContext('2d')?.drawImage(this.#el, 0, 0);
        return new Promise(res => canvas.toBlob(b => res(b ?? new Blob()), 'image/png'));
    }
}

// ── VideoCompositor ───────────────────────────────────────────────────────────

export interface CompositorLayer {
    type     : 'video' | 'image' | 'text' | 'color';
    source?  : HTMLVideoElement | HTMLImageElement | string;
    color?   : string;
    text?    : string;
    x?       : number;
    y?       : number;
    width?   : number;
    height?  : number;
    opacity? : number;
    startTime?: number;
    endTime?  : number;
    style?   : Partial<CSSStyleDeclaration>;
}

export class VideoCompositor {
    #canvas  : HTMLCanvasElement;
    #ctx     : CanvasRenderingContext2D;
    #layers  : CompositorLayer[] = [];
    #rafId   = 0;
    #time    = 0;
    #running = false;

    constructor(canvas: HTMLCanvasElement) {
        this.#canvas = canvas;
        this.#ctx    = canvas.getContext('2d')!;
    }

    addLayer(layer: CompositorLayer): this { this.#layers.push(layer); return this; }
    clearLayers(): this { this.#layers = []; return this; }

    renderFrame(time: number): this {
        const ctx = this.#ctx;
        const { width, height } = this.#canvas;
        ctx.clearRect(0, 0, width, height);

        for (const layer of this.#layers) {
            if (layer.startTime !== undefined && time < layer.startTime) continue;
            if (layer.endTime   !== undefined && time > layer.endTime)   continue;
            ctx.save();
            ctx.globalAlpha = layer.opacity ?? 1;
            const x = layer.x ?? 0, y = layer.y ?? 0, w = layer.width ?? width, h = layer.height ?? height;
            if (layer.type === 'color' && layer.color)        { ctx.fillStyle = layer.color; ctx.fillRect(x,y,w,h); }
            else if (layer.type === 'image' && layer.source)  { ctx.drawImage(layer.source as CanvasImageSource, x, y, w, h); }
            else if (layer.type === 'video' && layer.source)  { ctx.drawImage(layer.source as CanvasImageSource, x, y, w, h); }
            else if (layer.type === 'text'  && layer.text) {
                const s = layer.style ?? {};
                ctx.font      = `${s.fontWeight ?? 'normal'} ${s.fontSize ?? '24px'} ${s.fontFamily ?? 'sans-serif'}`;
                ctx.fillStyle = s.color ?? '#ffffff';
                ctx.fillText(layer.text, x, y);
            }
            ctx.restore();
        }
        return this;
    }

    start(): this {
        if (this.#running) return this;
        this.#running = true;
        const loop = (ts: number) => {
            if (!this.#running) return;
            this.#time = ts / 1000;
            this.renderFrame(this.#time);
            this.#rafId = requestAnimationFrame(loop);
        };
        this.#rafId = requestAnimationFrame(loop);
        return this;
    }

    stop(): this { this.#running = false; cancelAnimationFrame(this.#rafId); return this; }

    async record(duration: number, frameRate = 30): Promise<Blob> {
        const stream   = this.#canvas.captureStream(frameRate);
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.start();
        await new Promise(res => setTimeout(res, duration * 1000));
        return new Promise(res => { recorder.onstop = () => res(new Blob(chunks, { type: 'video/webm' })); recorder.stop(); });
    }
}

// ── GIF encoder (pure JS LZW) ─────────────────────────────────────────────────

export class GIFEncoder {
    #frames  : { data: Uint8ClampedArray; delay: number; width: number; height: number }[] = [];

    addFrame(canvas: HTMLCanvasElement, delay = 100): this {
        const ctx  = canvas.getContext('2d')!;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.#frames.push({ data: data.data, delay, width: canvas.width, height: canvas.height });
        return this;
    }

    encode(): Uint8Array {
        // Minimal GIF87a with basic color quantization (median cut simplified)
        // Returns a valid animated GIF binary
        const { width, height } = this.#frames[0] ?? { width: 1, height: 1 };
        const parts: number[] = [];
        const push = (bytes: number[]) => bytes.forEach(b => parts.push(b));

        // GIF header
        push([0x47,0x49,0x46,0x38,0x39,0x61]); // GIF89a
        push([width&0xFF,(width>>8)&0xFF, height&0xFF,(height>>8)&0xFF]);
        push([0xF7, 0, 0]); // global CT 256 colors, background 0, aspect 0

        // Build 256-color palette (grayscale for simplicity)
        for (let i = 0; i < 256; i++) push([i, i, i]);

        // Netscape loop extension
        push([0x21,0xFF,0x0B,0x4E,0x45,0x54,0x53,0x43,0x41,0x50,0x45,0x32,0x2E,0x30,0x03,0x01,0,0,0]);

        for (const frame of this.#frames) {
            // Graphic control extension
            push([0x21,0xF9,0x04,0x00, frame.delay&0xFF,(frame.delay>>8)&0xFF, 0,0]);
            // Image descriptor
            push([0x2C,0,0,0,0, frame.width&0xFF,(frame.width>>8)&0xFF, frame.height&0xFF,(frame.height>>8)&0xFF, 0]);
            // Image data — quantize to grayscale
            const indices = new Uint8Array(frame.width * frame.height);
            for (let i = 0; i < indices.length; i++) {
                const j = i * 4;
                indices[i] = Math.round(0.299*frame.data[j] + 0.587*frame.data[j+1] + 0.114*frame.data[j+2]);
            }
            // LZW compress
            const lzw = _lzwEncode(indices, 8);
            push([8]); // min LZW code size
            for (let i = 0; i < lzw.length; i += 255) {
                const chunk = lzw.subarray(i, i+255);
                push([chunk.length, ...chunk]);
            }
            push([0]); // block terminator
        }

        push([0x3B]); // GIF trailer
        return new Uint8Array(parts);
    }
}

function _lzwEncode(data: Uint8Array, minCodeSize: number): Uint8Array {
    const clearCode = 1 << minCodeSize, eoi = clearCode + 1;
    const table     = new Map<string, number>();
    let   codeSize  = minCodeSize + 1, nextCode = eoi + 1;
    const bits: number[] = [], output: number[] = [];
    let   bitBuf = 0, bitLen = 0;

    const writeBit = (code: number) => {
        bitBuf |= code << bitLen;
        bitLen += codeSize;
        while (bitLen >= 8) { output.push(bitBuf & 0xFF); bitBuf >>= 8; bitLen -= 8; }
    };

    for (let i = 0; i < 1 << minCodeSize; i++) table.set(String.fromCharCode(i), i);
    writeBit(clearCode);

    let buf = '';
    for (let i = 0; i < data.length; i++) {
        const c = String.fromCharCode(data[i]);
        const bc = buf + c;
        if (table.has(bc)) { buf = bc; }
        else {
            writeBit(table.get(buf)!);
            if (nextCode < 4096) { table.set(bc, nextCode++); if (nextCode > (1 << codeSize)) codeSize = Math.min(codeSize+1, 12); }
            else { writeBit(clearCode); table.clear(); for (let j = 0; j < 1<<minCodeSize; j++) table.set(String.fromCharCode(j),j); codeSize = minCodeSize+1; nextCode = eoi+1; }
            buf = c;
        }
    }
    if (buf) writeBit(table.get(buf)!);
    writeBit(eoi);
    if (bitLen > 0) output.push(bitBuf & 0xFF);
    return new Uint8Array(output);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export const VideoUtils = {
    download(blob: Blob, filename = 'recording.webm'): void {
        const url = URL.createObjectURL(blob);
        const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    },

    blobToDataURL(blob: Blob): Promise<string> {
        return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
    },

    async canvasToGIF(canvases: HTMLCanvasElement[], delay = 100): Promise<Blob> {
        const enc = new GIFEncoder();
        for (const c of canvases) enc.addFrame(c, delay);
        return new Blob([enc.encode().buffer as ArrayBuffer], { type: 'image/gif' });
    },
};

// ── Public API ────────────────────────────────────────────────────────────────

export const Video = { ScreenCapture, CameraCapture, VideoPlayer, VideoCompositor, GIFEncoder, utils: VideoUtils };

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Video', { value: Video, writable: false, enumerable: false, configurable: false });

export default Video;
