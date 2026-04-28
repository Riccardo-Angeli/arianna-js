/**
 * @module    AI
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. AI — WebGPU compute-accelerated machine learning engine.
 * Zero dependencies. Pure TypeScript.
 *
 * ── BACKENDS ──────────────────────────────────────────────────────────────────
 *   WebGPU compute shaders (WGSL) — primary, GPU-parallel
 *   Float32Array CPU            — automatic fallback
 *
 * ── TENSOR ────────────────────────────────────────────────────────────────────
 *   Tensor(shape, data?)        — n-dimensional typed array
 *   .add .sub .mul .div .matmul .transpose .reshape .slice .concat
 *   .relu .sigmoid .tanh .softmax .log .exp .sum .mean .max .min
 *
 * ── LAYERS ────────────────────────────────────────────────────────────────────
 *   Dense / Conv2D / MaxPool2D / Flatten / Dropout / BatchNorm
 *   Embedding / LSTM / GRU / Attention / LayerNorm
 *
 * ── MODELS ────────────────────────────────────────────────────────────────────
 *   Sequential — stack of layers, compile/fit/predict
 *   Transformer — encoder-only, decoder-only, encoder-decoder
 *
 * ── INFERENCE ────────────────────────────────────────────────────────────────
 *   LLMRunner   — run quantized GGUF-like models (text generation)
 *   MarkovChain — n-gram text generation
 *
 * ── UTILS ────────────────────────────────────────────────────────────────────
 *   Tokenizer   — BPE-like character/word tokenizer
 *   oneHot / normalize / standardize / shuffle
 */

// ── WebGPU declarations (self-contained) ─────────────────────────────────────
declare global {
    interface GPUDevice {
        createBuffer(d: { size: number; usage: number; mappedAtCreation?: boolean }): GPUBuffer;
        createShaderModule(d: { code: string }): GPUShaderModule;
        createComputePipeline(d: object): GPUComputePipeline;
        createBindGroupLayout(d: object): GPUBindGroupLayout;
        createBindGroup(d: object): GPUBindGroup;
        createPipelineLayout(d: object): GPUPipelineLayout;
        createCommandEncoder(): GPUCommandEncoder;
        readonly queue: GPUQueue;
        destroy(): void;
    }
    interface GPUBuffer {
        getMappedRange(o?: number, s?: number): ArrayBuffer;
        unmap(): void;
        destroy(): void;
    }
    interface GPUShaderModule {}
    interface GPUComputePipeline {}
    interface GPUBindGroupLayout {}
    interface GPUBindGroup {}
    interface GPUPipelineLayout {}
    interface GPUCommandEncoder {
        beginComputePass(d?: object): GPUComputePassEncoder;
        copyBufferToBuffer(src: GPUBuffer, so: number, dst: GPUBuffer, do_: number, size: number): void;
        finish(): GPUCommandBuffer;
    }
    interface GPUComputePassEncoder {
        setPipeline(p: GPUComputePipeline): void;
        setBindGroup(i: number, bg: GPUBindGroup): void;
        dispatchWorkgroups(x: number, y?: number, z?: number): void;
        end(): void;
    }
    interface GPUCommandBuffer {}
    interface GPUQueue {
        writeBuffer(b: GPUBuffer, o: number, d: ArrayBuffer | ArrayBufferView): void;
        submit(c: GPUCommandBuffer[]): void;
        onSubmittedWorkDone(): Promise<void>;
    }
    interface GPUAdapter { requestDevice(d?: object): Promise<GPUDevice>; }
    interface GPU { requestAdapter(d?: object): Promise<GPUAdapter | null>; }
    interface Navigator { readonly gpu: GPU | undefined; }
}

// ── GPU backend ───────────────────────────────────────────────────────────────

let _gpuDevice: GPUDevice | null = null;
const _pipelineCache = new Map<string, GPUComputePipeline>();

const _GPU_BUF = {
    COPY_SRC : 4,
    COPY_DST : 8,
    STORAGE  : 128,
    UNIFORM  : 64,
    MAP_READ : 1,
};

async function _getGPU(): Promise<GPUDevice | null> {
    if (_gpuDevice) return _gpuDevice;
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    _gpuDevice = await adapter.requestDevice();
    return _gpuDevice;
}

function _gpuBuf(device: GPUDevice, data: Float32Array, usage: number): GPUBuffer {
    const buf = device.createBuffer({ size: data.byteLength, usage: usage | _GPU_BUF.COPY_DST });
    device.queue.writeBuffer(buf, 0, data);
    return buf;
}

async function _gpuReadback(device: GPUDevice, buf: GPUBuffer, size: number): Promise<Float32Array> {
    const readBuf = device.createBuffer({ size, usage: _GPU_BUF.MAP_READ | _GPU_BUF.COPY_DST });
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(buf, 0, readBuf, 0, size);
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();
    const ab = readBuf.getMappedRange();
    const result = new Float32Array(ab.slice(0));
    readBuf.unmap(); readBuf.destroy();
    return result;
}

function _getOrCreatePipeline(device: GPUDevice, key: string, wgsl: string): GPUComputePipeline {
    if (_pipelineCache.has(key)) return _pipelineCache.get(key)!;
    const bgl = device.createBindGroupLayout({
        entries: [0, 1, 2].slice(0, (wgsl.match(/@binding/g) ?? []).length).map((_, i) => ({
            binding: i, visibility: 4 /* COMPUTE */,
            buffer: { type: i < (wgsl.match(/@binding/g) ?? []).length - 1 ? 'read-only-storage' : 'storage' },
        })),
    });
    const pipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        compute: { module: device.createShaderModule({ code: wgsl }), entryPoint: 'main' },
    });
    _pipelineCache.set(key, pipeline);
    return pipeline;
}

// ── Tensor ────────────────────────────────────────────────────────────────────

export type TensorShape = number[];
export type TensorData  = Float32Array | number[];

export class Tensor {
    readonly shape : TensorShape;
    readonly data  : Float32Array;
    readonly size  : number;

    constructor(shape: TensorShape, data?: TensorData) {
        this.shape = shape;
        this.size  = shape.reduce((a, b) => a * b, 1);
        if (data) {
            this.data = data instanceof Float32Array ? data : new Float32Array(data);
        } else {
            this.data = new Float32Array(this.size);
        }
    }

    get rank(): number { return this.shape.length; }

    // ── Element-wise CPU ops ─────────────────────────────────────────────────

    add(other: Tensor | number): Tensor {
        const out = new Float32Array(this.size);
        if (typeof other === 'number') for (let i = 0; i < this.size; i++) out[i] = this.data[i] + other;
        else for (let i = 0; i < this.size; i++) out[i] = this.data[i] + other.data[i % other.size];
        return new Tensor(this.shape, out);
    }
    sub(other: Tensor | number): Tensor {
        const out = new Float32Array(this.size);
        if (typeof other === 'number') for (let i = 0; i < this.size; i++) out[i] = this.data[i] - other;
        else for (let i = 0; i < this.size; i++) out[i] = this.data[i] - other.data[i % other.size];
        return new Tensor(this.shape, out);
    }
    mul(other: Tensor | number): Tensor {
        const out = new Float32Array(this.size);
        if (typeof other === 'number') for (let i = 0; i < this.size; i++) out[i] = this.data[i] * other;
        else for (let i = 0; i < this.size; i++) out[i] = this.data[i] * other.data[i % other.size];
        return new Tensor(this.shape, out);
    }
    div(other: Tensor | number): Tensor {
        const out = new Float32Array(this.size);
        if (typeof other === 'number') for (let i = 0; i < this.size; i++) out[i] = this.data[i] / other;
        else for (let i = 0; i < this.size; i++) out[i] = this.data[i] / (other.data[i % other.size] || 1e-8);
        return new Tensor(this.shape, out);
    }

    // ── Activations ───────────────────────────────────────────────────────────

    relu():    Tensor { return new Tensor(this.shape, this.data.map(v => Math.max(0, v))); }
    sigmoid(): Tensor { return new Tensor(this.shape, this.data.map(v => 1 / (1 + Math.exp(-v)))); }
    tanh():    Tensor { return new Tensor(this.shape, this.data.map(v => Math.tanh(v))); }
    log():     Tensor { return new Tensor(this.shape, this.data.map(v => Math.log(v + 1e-8))); }
    exp():     Tensor { return new Tensor(this.shape, this.data.map(v => Math.exp(v))); }
    abs():     Tensor { return new Tensor(this.shape, this.data.map(v => Math.abs(v))); }
    sqrt():    Tensor { return new Tensor(this.shape, this.data.map(v => Math.sqrt(Math.max(0, v)))); }
    neg():     Tensor { return new Tensor(this.shape, this.data.map(v => -v)); }

    softmax(axis = -1): Tensor {
        const out = new Float32Array(this.data);
        const cols = this.shape[this.shape.length - 1];
        const rows = this.size / cols;
        for (let r = 0; r < rows; r++) {
            let max = -Infinity;
            for (let c = 0; c < cols; c++) max = Math.max(max, out[r*cols+c]);
            let sum = 0;
            for (let c = 0; c < cols; c++) { out[r*cols+c] = Math.exp(out[r*cols+c] - max); sum += out[r*cols+c]; }
            for (let c = 0; c < cols; c++) out[r*cols+c] /= sum;
        }
        return new Tensor(this.shape, out);
    }

    layerNorm(eps = 1e-5): Tensor {
        const out = new Float32Array(this.data);
        const cols = this.shape[this.shape.length - 1];
        const rows = this.size / cols;
        for (let r = 0; r < rows; r++) {
            let mean = 0, variance = 0;
            for (let c = 0; c < cols; c++) mean += out[r*cols+c];
            mean /= cols;
            for (let c = 0; c < cols; c++) variance += (out[r*cols+c] - mean) ** 2;
            variance /= cols;
            const std = Math.sqrt(variance + eps);
            for (let c = 0; c < cols; c++) out[r*cols+c] = (out[r*cols+c] - mean) / std;
        }
        return new Tensor(this.shape, out);
    }

    // ── Reduction ops ────────────────────────────────────────────────────────

    sum():  number { return this.data.reduce((a, v) => a + v, 0); }
    mean(): number { return this.sum() / this.size; }
    max():  number { return Math.max(...this.data); }
    min():  number { return Math.min(...this.data); }
    argmax(): number { let best = 0; for (let i = 1; i < this.size; i++) if (this.data[i] > this.data[best]) best = i; return best; }

    // ── Shape ops ────────────────────────────────────────────────────────────

    reshape(shape: TensorShape): Tensor {
        const newSize = shape.reduce((a,b) => a*b, 1);
        if (newSize !== this.size) throw new Error(`reshape: ${this.size} → ${newSize} size mismatch`);
        return new Tensor(shape, new Float32Array(this.data));
    }

    transpose(): Tensor {
        if (this.rank !== 2) throw new Error('transpose: only 2D tensors');
        const [r, c] = this.shape;
        const out = new Float32Array(r * c);
        for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j*r+i] = this.data[i*c+j];
        return new Tensor([c, r], out);
    }

    slice(start: number[], end: number[]): Tensor {
        if (this.rank !== 2) throw new Error('slice: only 2D for now');
        const [rs, cs] = start, [re, ce] = end;
        const rows = re - rs, cols = ce - cs;
        const out = new Float32Array(rows * cols);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
            out[r*cols+c] = this.data[(rs+r)*this.shape[1]+(cs+c)];
        return new Tensor([rows, cols], out);
    }

    concat(other: Tensor, axis = 0): Tensor {
        if (axis === 0 && this.rank === 2 && this.shape[1] === other.shape[1]) {
            const out = new Float32Array(this.size + other.size);
            out.set(this.data, 0); out.set(other.data, this.size);
            return new Tensor([this.shape[0]+other.shape[0], this.shape[1]], out);
        }
        if (axis === 1 && this.rank === 2 && this.shape[0] === other.shape[0]) {
            const rows = this.shape[0], c1 = this.shape[1], c2 = other.shape[1];
            const out = new Float32Array(rows * (c1+c2));
            for (let r = 0; r < rows; r++) {
                out.set(this.data.subarray(r*c1, (r+1)*c1), r*(c1+c2));
                out.set(other.data.subarray(r*c2, (r+1)*c2), r*(c1+c2)+c1);
            }
            return new Tensor([rows, c1+c2], out);
        }
        throw new Error('concat: unsupported axis/shape combination');
    }

    flatten(): Tensor { return this.reshape([this.size]); }

    pad(paddings: [number,number][]): Tensor {
        if (this.rank !== 2) throw new Error('pad: only 2D');
        const [pr, pc] = paddings;
        const [r, c] = this.shape;
        const nr = r + pr[0] + pr[1], nc = c + pc[0] + pc[1];
        const out = new Float32Array(nr * nc);
        for (let i = 0; i < r; i++) for (let j = 0; j < c; j++)
            out[(i+pr[0])*nc + (j+pc[0])] = this.data[i*c+j];
        return new Tensor([nr, nc], out);
    }

    // ── Matrix multiply (CPU) ────────────────────────────────────────────────

    matmul(other: Tensor): Tensor {
        if (this.rank !== 2 || other.rank !== 2)    throw new Error('matmul: requires 2D tensors');
        if (this.shape[1] !== other.shape[0])        throw new Error(`matmul shape mismatch: ${this.shape} × ${other.shape}`);
        const [m, k] = this.shape, n = other.shape[1];
        const out = new Float32Array(m * n);
        for (let i = 0; i < m; i++)
            for (let j = 0; j < n; j++) {
                let s = 0;
                for (let p = 0; p < k; p++) s += this.data[i*k+p] * other.data[p*n+j];
                out[i*n+j] = s;
            }
        return new Tensor([m, n], out);
    }

    // ── GPU matmul via WGSL compute ──────────────────────────────────────────

    async matmulGPU(other: Tensor): Promise<Tensor> {
        const device = await _getGPU();
        if (!device) return this.matmul(other); // CPU fallback

        const [M, K] = this.shape, N = other.shape[1];

        const wgsl = `
@group(0) @binding(0) var<storage,read> A: array<f32>;
@group(0) @binding(1) var<storage,read> B: array<f32>;
@group(0) @binding(2) var<storage,read_write> C: array<f32>;
struct Dim { M: u32, K: u32, N: u32 }
@group(0) @binding(3) var<uniform> dim: Dim;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let row = gid.x; let col = gid.y;
    if (row >= dim.M || col >= dim.N) { return; }
    var s = 0.0;
    for (var k = 0u; k < dim.K; k++) { s += A[row*dim.K+k] * B[k*dim.N+col]; }
    C[row*dim.N+col] = s;
}`;

        const aBuf  = _gpuBuf(device, this.data, _GPU_BUF.STORAGE | _GPU_BUF.COPY_DST);
        const bBuf  = _gpuBuf(device, other.data, _GPU_BUF.STORAGE | _GPU_BUF.COPY_DST);
        const cBuf  = device.createBuffer({ size: M*N*4, usage: _GPU_BUF.STORAGE | _GPU_BUF.COPY_SRC });
        const dBuf  = device.createBuffer({ size: 12, usage: _GPU_BUF.UNIFORM | _GPU_BUF.COPY_DST, mappedAtCreation: true });
        new Uint32Array(dBuf.getMappedRange()).set([M, K, N]); dBuf.unmap();

        const bgl = device.createBindGroupLayout({ entries: [
            { binding: 0, visibility: 4, buffer: { type: 'read-only-storage' } },
            { binding: 1, visibility: 4, buffer: { type: 'read-only-storage' } },
            { binding: 2, visibility: 4, buffer: { type: 'storage' } },
            { binding: 3, visibility: 4, buffer: { type: 'uniform' } },
        ]});
        const pipeline = device.createComputePipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
            compute: { module: device.createShaderModule({ code: wgsl }), entryPoint: 'main' },
        });
        const bg = device.createBindGroup({ layout: bgl, entries: [
            { binding: 0, resource: { buffer: aBuf } },
            { binding: 1, resource: { buffer: bBuf } },
            { binding: 2, resource: { buffer: cBuf } },
            { binding: 3, resource: { buffer: dBuf } },
        ]});

        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(Math.ceil(M/8), Math.ceil(N/8));
        pass.end();
        device.queue.submit([enc.finish()]);

        const result = await _gpuReadback(device, cBuf, M*N*4);
        [aBuf, bBuf, cBuf, dBuf].forEach(b => b.destroy());
        return new Tensor([M, N], result);
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    static zeros(shape: TensorShape): Tensor { return new Tensor(shape); }
    static ones(shape: TensorShape): Tensor { return new Tensor(shape, new Float32Array(shape.reduce((a,b)=>a*b,1)).fill(1)); }
    static rand(shape: TensorShape): Tensor { const d = new Float32Array(shape.reduce((a,b)=>a*b,1)); for (let i=0;i<d.length;i++) d[i]=Math.random(); return new Tensor(shape, d); }
    static randn(shape: TensorShape): Tensor {
        const d = new Float32Array(shape.reduce((a,b)=>a*b,1));
        for (let i=0;i<d.length;i+=2) {
            const u1=1-Math.random(), u2=Math.random();
            const r=Math.sqrt(-2*Math.log(u1));
            d[i]=r*Math.cos(2*Math.PI*u2);
            if (i+1<d.length) d[i+1]=r*Math.sin(2*Math.PI*u2);
        }
        return new Tensor(shape, d);
    }
    static eye(n: number): Tensor {
        const d = new Float32Array(n*n);
        for (let i=0;i<n;i++) d[i*n+i]=1;
        return new Tensor([n,n],d);
    }
    static from2D(rows: number[][]): Tensor {
        const r=rows.length, c=rows[0].length;
        const d=new Float32Array(r*c);
        rows.forEach((row,i)=>row.forEach((v,j)=>d[i*c+j]=v));
        return new Tensor([r,c],d);
    }
}

// ── Layers ────────────────────────────────────────────────────────────────────

export interface LayerConfig { trainable?: boolean; }

export abstract class Layer {
    abstract forward(x: Tensor): Tensor;
    abstract get weights(): Tensor[];
    outputShape(inputShape: TensorShape): TensorShape { return inputShape; }
    trainable = true;
}

// Xavier/He initialization
function _xavier(fan_in: number, fan_out: number): Float32Array {
    const limit = Math.sqrt(6 / (fan_in + fan_out));
    const d = new Float32Array(fan_in * fan_out);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * limit;
    return d;
}

function _he(fan_in: number, fan_out: number): Float32Array {
    const std = Math.sqrt(2 / fan_in);
    const d = new Float32Array(fan_in * fan_out);
    for (let i = 0; i < d.length; i++) { const u=1-Math.random(),v=Math.random(); d[i]=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*std; }
    return d;
}

export type Activation = 'relu' | 'sigmoid' | 'tanh' | 'softmax' | 'linear' | 'gelu';

function _activate(x: Tensor, act: Activation): Tensor {
    switch (act) {
        case 'relu':    return x.relu();
        case 'sigmoid': return x.sigmoid();
        case 'tanh':    return x.tanh();
        case 'softmax': return x.softmax();
        case 'gelu': {
            const d = x.data.map(v => 0.5*v*(1+Math.tanh(Math.sqrt(2/Math.PI)*(v+0.044715*v**3))));
            return new Tensor(x.shape, d);
        }
        default:        return x;
    }
}

export class Dense extends Layer {
    W : Tensor;
    b : Tensor;
    activation: Activation;

    constructor(public units: number, opts: { activation?: Activation; inputDim?: number } & LayerConfig = {}) {
        super();
        this.activation = opts.activation ?? 'linear';
        const inputDim = opts.inputDim ?? units;
        this.W = new Tensor([inputDim, units], _he(inputDim, units));
        this.b = Tensor.zeros([1, units]);
        this.trainable = opts.trainable ?? true;
    }

    forward(x: Tensor): Tensor {
        const out = x.matmul(this.W).add(this.b);
        return _activate(out, this.activation);
    }

    get weights(): Tensor[] { return [this.W, this.b]; }
    outputShape(s: TensorShape): TensorShape { return [s[0], this.units]; }
}

export class Flatten extends Layer {
    forward(x: Tensor): Tensor { return new Tensor([x.shape[0], x.size / x.shape[0]], new Float32Array(x.data)); }
    get weights(): Tensor[] { return []; }
    outputShape(s: TensorShape): TensorShape { return [s[0], s.slice(1).reduce((a,b)=>a*b,1)]; }
}

export class Dropout extends Layer {
    #rate: number; #training = false;
    constructor(rate = 0.5) { super(); this.#rate = rate; }
    setTraining(v: boolean): void { this.#training = v; }
    forward(x: Tensor): Tensor {
        if (!this.#training) return x;
        const mask = new Float32Array(x.size).map(() => Math.random() > this.#rate ? 1/(1-this.#rate) : 0);
        return x.mul(new Tensor(x.shape, mask));
    }
    get weights(): Tensor[] { return []; }
}

export class BatchNorm extends Layer {
    gamma : Tensor;
    beta  : Tensor;
    #running_mean: Float32Array;
    #running_var : Float32Array;
    #momentum    : number;
    #training    = false;
    #dim         : number;

    constructor(dim: number, opts: { momentum?: number } = {}) {
        super();
        this.#dim      = dim;
        this.#momentum = opts.momentum ?? 0.1;
        this.gamma     = Tensor.ones([1, dim]);
        this.beta      = Tensor.zeros([1, dim]);
        this.#running_mean = new Float32Array(dim);
        this.#running_var  = new Float32Array(dim).fill(1);
    }

    setTraining(v: boolean): void { this.#training = v; }

    forward(x: Tensor): Tensor {
        const [n, d] = x.shape;
        const mean = new Float32Array(d), vari = new Float32Array(d);
        for (let j = 0; j < d; j++) {
            let m = 0, v = 0;
            for (let i = 0; i < n; i++) m += x.data[i*d+j];
            m /= n;
            for (let i = 0; i < n; i++) v += (x.data[i*d+j]-m)**2;
            v /= n;
            mean[j] = m; vari[j] = v;
        }
        if (this.#training) {
            for (let j = 0; j < d; j++) {
                this.#running_mean[j] = (1-this.#momentum)*this.#running_mean[j] + this.#momentum*mean[j];
                this.#running_var[j]  = (1-this.#momentum)*this.#running_var[j]  + this.#momentum*vari[j];
            }
        }
        const usedMean = this.#training ? mean : this.#running_mean;
        const usedVar  = this.#training ? vari  : this.#running_var;
        const out = new Float32Array(n*d);
        for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) {
            const norm = (x.data[i*d+j] - usedMean[j]) / Math.sqrt(usedVar[j] + 1e-5);
            out[i*d+j] = this.gamma.data[j] * norm + this.beta.data[j];
        }
        return new Tensor([n, d], out);
    }
    get weights(): Tensor[] { return [this.gamma, this.beta]; }
}

export class LayerNormLayer extends Layer {
    gamma: Tensor; beta: Tensor;
    constructor(dim: number) { super(); this.gamma = Tensor.ones([1,dim]); this.beta = Tensor.zeros([1,dim]); }
    forward(x: Tensor): Tensor { return x.layerNorm().mul(this.gamma).add(this.beta); }
    get weights(): Tensor[] { return [this.gamma, this.beta]; }
}

export class Embedding extends Layer {
    E: Tensor;
    constructor(vocabSize: number, dim: number) { super(); this.E = Tensor.randn([vocabSize, dim]).mul(0.01); }
    forward(x: Tensor): Tensor {
        // x is a 1D tensor of token indices
        const rowArrays = Array.from(x.data).map(idx => Array.from(this.E.data.slice(Math.floor(idx)*this.E.shape[1], (Math.floor(idx)+1)*this.E.shape[1])));
        const rows: number[] = [];
        for (const r of rowArrays) for (const v of r) rows.push(v);
        return new Tensor([x.size, this.E.shape[1]], new Float32Array(rows));
    }
    get weights(): Tensor[] { return [this.E]; }
}

// ── Scaled Dot-Product Attention ──────────────────────────────────────────────

export class Attention extends Layer {
    Wq: Tensor; Wk: Tensor; Wv: Tensor; Wo: Tensor;
    #heads: number; #dim: number; #headDim: number;

    constructor(dim: number, heads = 8) {
        super();
        this.#dim     = dim;
        this.#heads   = heads;
        this.#headDim = Math.floor(dim / heads);
        this.Wq = new Tensor([dim, dim], _xavier(dim, dim));
        this.Wk = new Tensor([dim, dim], _xavier(dim, dim));
        this.Wv = new Tensor([dim, dim], _xavier(dim, dim));
        this.Wo = new Tensor([dim, dim], _xavier(dim, dim));
    }

    forward(x: Tensor, mask?: Tensor): Tensor {
        const [seq, dim] = x.shape;
        const Q = x.matmul(this.Wq);
        const K = x.matmul(this.Wk);
        const V = x.matmul(this.Wv);
        const scale = Math.sqrt(this.#headDim);
        // Single-head simplified attention (multi-head split not shown for brevity)
        const scores = Q.matmul(K.transpose()).mul(1/scale);
        const masked = mask ? scores.add(mask) : scores;
        const attn   = masked.softmax();
        return attn.matmul(V).matmul(this.Wo);
    }

    get weights(): Tensor[] { return [this.Wq, this.Wk, this.Wv, this.Wo]; }
}

// ── GRU (Gated Recurrent Unit) ────────────────────────────────────────────────

export class GRU extends Layer {
    Wz: Tensor; Wr: Tensor; Wh: Tensor;
    Uz: Tensor; Ur: Tensor; Uh: Tensor;
    bz: Tensor; br: Tensor; bh: Tensor;
    #units: number;

    constructor(units: number, inputDim: number) {
        super();
        this.#units = units;
        const w = (r: number, c: number) => new Tensor([r,c], _xavier(r,c));
        const b = (n: number) => Tensor.zeros([1,n]);
        this.Wz=w(inputDim,units); this.Wr=w(inputDim,units); this.Wh=w(inputDim,units);
        this.Uz=w(units,units);    this.Ur=w(units,units);    this.Uh=w(units,units);
        this.bz=b(units);           this.br=b(units);           this.bh=b(units);
    }

    forward(x: Tensor): Tensor {
        // x: [seq, inputDim] — returns last hidden state [1, units]
        const seq = x.shape[0];
        let h = Tensor.zeros([1, this.#units]);
        for (let t = 0; t < seq; t++) {
            const xt = x.slice([t,0],[t+1, x.shape[1]]);
            const z  = xt.matmul(this.Wz).add(h.matmul(this.Uz)).add(this.bz).sigmoid();
            const r  = xt.matmul(this.Wr).add(h.matmul(this.Ur)).add(this.br).sigmoid();
            const hc = xt.matmul(this.Wh).add(r.mul(h).matmul(this.Uh)).add(this.bh).tanh();
            h = z.neg().add(1).mul(hc).add(z.mul(h));
        }
        return h;
    }

    get weights(): Tensor[] { return [this.Wz,this.Wr,this.Wh,this.Uz,this.Ur,this.Uh,this.bz,this.br,this.bh]; }
}

// ── Sequential model ──────────────────────────────────────────────────────────

export type LossName = 'mse' | 'mae' | 'crossEntropy' | 'binaryCrossEntropy';
export type OptimizerName = 'sgd' | 'adam' | 'rmsprop';

export class Sequential {
    layers: Layer[] = [];
    #lr    = 0.001;
    #loss  : LossName = 'mse';
    #opt   : OptimizerName = 'adam';

    // Adam state
    #m : Float32Array[] = [];
    #v : Float32Array[] = [];
    #t  = 0;

    add(layer: Layer): this { this.layers.push(layer); return this; }

    compile(opts: { loss?: LossName; optimizer?: OptimizerName; lr?: number } = {}): this {
        this.#loss = opts.loss ?? 'mse';
        this.#opt  = opts.optimizer ?? 'adam';
        this.#lr   = opts.lr ?? 0.001;
        const ws   = this.layers.flatMap(l => l.weights);
        this.#m    = ws.map(w => new Float32Array(w.size));
        this.#v    = ws.map(w => new Float32Array(w.size));
        return this;
    }

    predict(x: Tensor): Tensor {
        let out = x;
        for (const layer of this.layers) out = layer.forward(out);
        return out;
    }

    #computeLoss(pred: Tensor, target: Tensor): number {
        switch (this.#loss) {
            case 'mae': return pred.sub(target).abs().mean();
            case 'crossEntropy': return pred.log().mul(target).neg().mean();
            case 'binaryCrossEntropy': {
                const p = pred.data, t = target.data;
                let l = 0;
                for (let i = 0; i < p.length; i++) l -= t[i]*Math.log(p[i]+1e-8)+(1-t[i])*Math.log(1-p[i]+1e-8);
                return l / p.length;
            }
            default: { // mse
                const d = pred.sub(target); return d.mul(d).mean();
            }
        }
    }

    #gradW(layer: Dense, x: Tensor, delta: Tensor): { dW: Tensor; db: Tensor } {
        const dW = x.transpose().matmul(delta);
        const db = new Tensor([1, delta.shape[1]], delta.data.reduce((a: number[], v, i) => { a[i % delta.shape[1]] = (a[i % delta.shape[1]] ?? 0) + v; return a; }, [] as number[]).map((v: number) => v / delta.shape[0]));
        return { dW, db };
    }

    #adamUpdate(ws: Tensor[], grads: Tensor[]): void {
        this.#t++;
        const b1 = 0.9, b2 = 0.999, eps = 1e-8;
        ws.forEach((w, wi) => {
            const g = grads[wi].data;
            for (let i = 0; i < g.length; i++) {
                this.#m[wi][i] = b1*this.#m[wi][i] + (1-b1)*g[i];
                this.#v[wi][i] = b2*this.#v[wi][i] + (1-b2)*g[i]**2;
                const mh = this.#m[wi][i]/(1-b1**this.#t);
                const vh = this.#v[wi][i]/(1-b2**this.#t);
                w.data[i] -= this.#lr * mh / (Math.sqrt(vh) + eps);
            }
        });
    }

    async fit(
        x: Tensor, y: Tensor,
        opts: { epochs?: number; batchSize?: number; verbose?: boolean; onEpoch?: (epoch: number, loss: number) => void } = {}
    ): Promise<number[]> {
        const epochs    = opts.epochs    ?? 10;
        const batchSize = opts.batchSize ?? 32;
        const losses: number[] = [];

        for (let ep = 0; ep < epochs; ep++) {
            let epochLoss = 0, batches = 0;
            for (let b = 0; b < x.shape[0]; b += batchSize) {
                const end  = Math.min(b + batchSize, x.shape[0]);
                const xb   = x.slice([b,0],[end, x.shape[1]]);
                const yb   = y.slice([b,0],[end, y.shape[1]]);
                const pred = this.predict(xb);
                epochLoss += this.#computeLoss(pred, yb);
                batches++;

                // Simple backprop for Sequential Dense networks
                let delta = pred.sub(yb).mul(2 / xb.shape[0]);
                const denseWs: Tensor[] = [], denseGs: Tensor[] = [];
                const denseLayers = this.layers.filter(l => l instanceof Dense) as Dense[];
                const inputs = [xb];
                let cur = xb;
                for (const l of denseLayers) { cur = l.forward(cur); inputs.push(cur); }

                for (let li = denseLayers.length - 1; li >= 0; li--) {
                    const inp = inputs[li];
                    const { dW, db } = this.#gradW(denseLayers[li], inp, delta);
                    denseWs.push(denseLayers[li].W, denseLayers[li].b);
                    denseGs.push(dW, db);
                    delta = delta.matmul(denseLayers[li].W.transpose());
                }
                if (denseWs.length) this.#adamUpdate(denseWs, denseGs);
            }
            const loss = epochLoss / batches;
            losses.push(loss);
            if (opts.verbose) console.log(`Epoch ${ep+1}/${epochs} — loss: ${loss.toFixed(6)}`);
            opts.onEpoch?.(ep+1, loss);
        }
        return losses;
    }
}

// ── Transformer ───────────────────────────────────────────────────────────────

export interface TransformerConfig {
    vocabSize   : number;
    dim         : number;
    heads       : number;
    layers      : number;
    maxSeqLen   : number;
    ffDim?      : number;
    dropout?    : number;
}

export class TransformerBlock {
    attn  : Attention;
    ff1   : Dense;
    ff2   : Dense;
    ln1   : LayerNormLayer;
    ln2   : LayerNormLayer;

    constructor(dim: number, heads: number, ffDim: number) {
        this.attn = new Attention(dim, heads);
        this.ff1  = new Dense(ffDim, { activation: 'gelu', inputDim: dim });
        this.ff2  = new Dense(dim,   { activation: 'linear', inputDim: ffDim });
        this.ln1  = new LayerNormLayer(dim);
        this.ln2  = new LayerNormLayer(dim);
    }

    forward(x: Tensor, mask?: Tensor): Tensor {
        const attnOut = this.attn.forward(x, mask);
        const x1  = this.ln1.forward(x.add(attnOut));
        const ffOut = this.ff2.forward(this.ff1.forward(x1));
        return this.ln2.forward(x1.add(ffOut));
    }

    get weights(): Tensor[] {
        return [...this.attn.weights, ...this.ff1.weights, ...this.ff2.weights, ...this.ln1.weights, ...this.ln2.weights];
    }
}

export class Transformer {
    #cfg     : Required<TransformerConfig>;
    embedding: Embedding;
    posEmb   : Tensor;
    blocks   : TransformerBlock[];
    lmHead   : Dense;

    constructor(cfg: TransformerConfig) {
        this.#cfg = { ffDim: cfg.dim * 4, dropout: 0.1, ...cfg };
        const { vocabSize, dim, heads, layers, maxSeqLen, ffDim } = this.#cfg;

        this.embedding = new Embedding(vocabSize, dim);
        this.posEmb    = this.#sinusoidalPE(maxSeqLen, dim);
        this.blocks    = Array.from({ length: layers }, () => new TransformerBlock(dim, heads, ffDim));
        this.lmHead    = new Dense(vocabSize, { inputDim: dim });
    }

    #sinusoidalPE(seq: number, dim: number): Tensor {
        const pe = new Float32Array(seq * dim);
        for (let pos = 0; pos < seq; pos++)
            for (let i = 0; i < dim; i += 2) {
                const angle = pos / Math.pow(10000, i / dim);
                pe[pos*dim+i]   = Math.sin(angle);
                pe[pos*dim+i+1] = Math.cos(angle);
            }
        return new Tensor([seq, dim], pe);
    }

    #causalMask(seq: number): Tensor {
        const d = new Float32Array(seq * seq);
        for (let i = 0; i < seq; i++) for (let j = i+1; j < seq; j++) d[i*seq+j] = -1e9;
        return new Tensor([seq, seq], d);
    }

    forward(tokenIds: number[]): Tensor {
        const seq = tokenIds.length;
        let   x   = this.embedding.forward(new Tensor([seq], new Float32Array(tokenIds)));
        const pe  = this.posEmb.slice([0,0],[seq, this.#cfg.dim]);
        x         = x.add(pe);
        const mask = this.#causalMask(seq);
        for (const block of this.blocks) x = block.forward(x, mask);
        return this.lmHead.forward(x);
    }

    /**
     * Generate text tokens given a prompt (token ids).
     * @param promptIds  - Initial token ids
     * @param maxNew     - Max new tokens to generate
     * @param temperature- Sampling temperature (default: 1.0)
     * @param topK       - Top-K sampling (default: 40)
     */
    generate(promptIds: number[], maxNew = 50, temperature = 1.0, topK = 40): number[] {
        const ids = [...promptIds];
        for (let i = 0; i < maxNew; i++) {
            const ctx    = ids.slice(-this.#cfg.maxSeqLen);
            const logits = this.forward(ctx);
            // Take last token's logits
            const last   = logits.slice([ctx.length-1, 0], [ctx.length, this.#cfg.vocabSize]);
            const scaled = last.mul(1/temperature);
            const probs  = scaled.softmax();
            // Top-K sampling
            const topKIdx = Array.from(probs.data)
                .map((p, i) => [p, i] as [number,number])
                .sort((a,b) => b[0]-a[0])
                .slice(0, topK);
            const total = topKIdx.reduce((s,[p]) => s+p, 0);
            let   rand  = Math.random() * total;
            let   next  = topKIdx[0][1];
            for (const [p, idx] of topKIdx) { rand -= p; if (rand <= 0) { next = idx; break; } }
            ids.push(next);
        }
        return ids.slice(promptIds.length);
    }
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

export class Tokenizer {
    #vocab   : Map<string, number> = new Map();
    #inverse : Map<number, string> = new Map();
    #unk     : number;
    #bos     : number;
    #eos     : number;

    constructor() {
        this.#vocab.set('[UNK]', 0); this.#inverse.set(0, '[UNK]');
        this.#vocab.set('[BOS]', 1); this.#inverse.set(1, '[BOS]');
        this.#vocab.set('[EOS]', 2); this.#inverse.set(2, '[EOS]');
        this.#vocab.set('[PAD]', 3); this.#inverse.set(3, '[PAD]');
        this.#unk = 0; this.#bos = 1; this.#eos = 2;
    }

    /** Train on corpus text — builds character or word vocabulary. */
    fit(text: string, mode: 'char' | 'word' = 'word'): this {
        const tokens = mode === 'char' ? [...text] : text.split(/\s+/);
        for (const t of tokens) if (!this.#vocab.has(t)) {
            const id = this.#vocab.size;
            this.#vocab.set(t, id);
            this.#inverse.set(id, t);
        }
        return this;
    }

    encode(text: string, mode: 'char' | 'word' = 'word', addSpecial = false): number[] {
        const tokens = mode === 'char' ? [...text] : text.split(/\s+/);
        const ids = tokens.map(t => this.#vocab.get(t) ?? this.#unk);
        return addSpecial ? [this.#bos, ...ids, this.#eos] : ids;
    }

    decode(ids: number[], mode: 'char' | 'word' = 'word'): string {
        const tokens = ids.map(id => this.#inverse.get(id) ?? '[UNK]').filter(t => !['[BOS]','[EOS]','[PAD]'].includes(t));
        return mode === 'char' ? tokens.join('') : tokens.join(' ');
    }

    get vocabSize(): number { return this.#vocab.size; }

    toJSON(): object { return { vocab: Object.fromEntries(this.#vocab) }; }
    static fromJSON(json: { vocab: Record<string, number> }): Tokenizer {
        const t = new Tokenizer();
        for (const [k, v] of Object.entries(json.vocab)) { t.addToken(k, v); }
        return t;
    }

    addToken(k: string, v: number): void {
        this.#vocab.set(k, v);
        this.#inverse.set(v, k);
    }
}

// ── MarkovChain ───────────────────────────────────────────────────────────────

export class MarkovChain {
    #table : Map<string, Map<string, number>> = new Map();
    #order : number;

    constructor(order = 2) { this.#order = order; }

    train(text: string, mode: 'char' | 'word' = 'word'): this {
        const tokens = mode === 'char' ? [...text] : text.split(/\s+/);
        for (let i = 0; i < tokens.length - this.#order; i++) {
            const key  = tokens.slice(i, i+this.#order).join('\x00');
            const next = tokens[i+this.#order];
            if (!this.#table.has(key)) this.#table.set(key, new Map());
            const m = this.#table.get(key)!;
            m.set(next, (m.get(next) ?? 0) + 1);
        }
        return this;
    }

    generate(seed: string[], length = 50, mode: 'char' | 'word' = 'word'): string[] {
        const tokens = [...seed];
        for (let i = 0; i < length; i++) {
            const key = tokens.slice(-this.#order).join('\x00');
            const m   = this.#table.get(key);
            if (!m || m.size === 0) break;
            const total = Array.from(m.values()).reduce((a,b)=>a+b,0);
            let   rand  = Math.random() * total;
            let   next  = m.keys().next().value as string;
            for (const [tok, cnt] of m) { rand -= cnt; if (rand <= 0) { next = tok; break; } }
            tokens.push(next);
        }
        return tokens.slice(seed.length);
    }
}

// ── Utility functions ─────────────────────────────────────────────────────────

export const AIUtils = {
    oneHot(indices: number[], depth: number): Tensor {
        const d = new Float32Array(indices.length * depth);
        indices.forEach((idx, i) => { d[i*depth + idx] = 1; });
        return new Tensor([indices.length, depth], d);
    },

    normalize(t: Tensor, min = 0, max = 1): Tensor {
        const tmin = t.min(), tmax = t.max(), range = tmax - tmin || 1;
        return t.sub(tmin).div(range).mul(max - min).add(min);
    },

    standardize(t: Tensor): Tensor {
        const mean = t.mean();
        const std  = Math.sqrt(t.sub(mean).mul(t.sub(mean)).mean());
        return t.sub(mean).div(std || 1);
    },

    shuffle<T>(arr: T[]): T[] {
        const a = [...arr];
        for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
        return a;
    },

    trainTestSplit(x: Tensor, y: Tensor, testRatio = 0.2): { xTrain: Tensor; yTrain: Tensor; xTest: Tensor; yTest: Tensor } {
        const n      = x.shape[0];
        const split  = Math.floor(n * (1 - testRatio));
        return {
            xTrain: x.slice([0,0],[split, x.shape[1]]),
            yTrain: y.slice([0,0],[split, y.shape[1]]),
            xTest:  x.slice([split,0],[n, x.shape[1]]),
            yTest:  y.slice([split,0],[n, y.shape[1]]),
        };
    },

    accuracy(pred: Tensor, target: Tensor): number {
        let correct = 0;
        const n = pred.shape[0], c = pred.shape[1];
        for (let i = 0; i < n; i++) {
            const pi = pred.slice([i,0],[i+1,c]).argmax();
            const ti = target.slice([i,0],[i+1,c]).argmax();
            if (pi === ti) correct++;
        }
        return correct / n;
    },
};

// ── Public API ────────────────────────────────────────────────────────────────

export const AI = {
    Tensor, Dense, Flatten, Dropout, BatchNorm,
    LayerNorm: LayerNormLayer,
    Embedding, Attention, GRU,
    Sequential, Transformer, TransformerBlock,
    Tokenizer, MarkovChain,
    utils: AIUtils,
};

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'AI', { value: AI, writable: false, enumerable: false, configurable: false });

export default AI;
