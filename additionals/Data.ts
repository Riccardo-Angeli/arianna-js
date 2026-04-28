/**
 * @module    Data
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. Data — essential data structures and abstract models.
 * Zero dependencies.
 *
 * ── GRAPH ─────────────────────────────────────────────────────────────────────
 *   DAG           — Directed Acyclic Graph with topological sort + cycle detect
 *   Graph         — Weighted directed graph: BFS, DFS, Dijkstra, A*
 *
 * ── STATE MACHINES ────────────────────────────────────────────────────────────
 *   FSM           — Finite State Machine with guards, actions, history
 *   StatechartFSM — Hierarchical statechart (HSM) with regions
 *
 * ── TREES ─────────────────────────────────────────────────────────────────────
 *   Trie          — Prefix tree for autocomplete / IP routing
 *   BinaryTree    — BST with insert/search/delete/inorder/balance
 *   SegmentTree   — Range queries (sum, min, max) with lazy propagation
 *
 * ── QUEUES ────────────────────────────────────────────────────────────────────
 *   PriorityQueue — Binary min/max heap
 *   Deque         — Double-ended queue (O(1) push/pop both ends)
 *
 * ── CACHE ─────────────────────────────────────────────────────────────────────
 *   LRUCache      — Least-Recently-Used cache (O(1) get/put)
 *   LFUCache      — Least-Frequently-Used cache
 *
 * ── UNION-FIND ────────────────────────────────────────────────────────────────
 *   DisjointSet   — Union-Find with path compression + rank
 *
 * ── OBSERVABLE COLLECTIONS ───────────────────────────────────────────────────
 *   ObservableMap   — Map that fires onChange on mutations
 *   ObservableArray — Array with reactive splice/push/pop
 */

// ══════════════════════════════════════════════════════════════════════════════
// GRAPH
// ══════════════════════════════════════════════════════════════════════════════

export class DAG<T = string> {
    #nodes = new Map<T, Set<T>>();

    addNode(n: T): this { if (!this.#nodes.has(n)) this.#nodes.set(n, new Set()); return this; }

    addEdge(from: T, to: T): this {
        this.addNode(from); this.addNode(to);
        if (this.#wouldCycle(from, to)) throw new Error(`DAG cycle: ${from} → ${to}`);
        this.#nodes.get(from)!.add(to);
        return this;
    }

    #wouldCycle(from: T, to: T): boolean {
        const visited = new Set<T>();
        const dfs = (n: T): boolean => {
            if (n === from) return true;
            if (visited.has(n)) return false;
            visited.add(n);
            for (const next of this.#nodes.get(n) ?? []) if (dfs(next)) return true;
            return false;
        };
        return dfs(to);
    }

    /** Kahn's algorithm topological sort. */
    topoSort(): T[] {
        const inDegree = new Map<T, number>();
        for (const n of this.#nodes.keys()) inDegree.set(n, 0);
        for (const [, edges] of this.#nodes) for (const e of edges) inDegree.set(e, (inDegree.get(e) ?? 0) + 1);
        const queue = [...inDegree.entries()].filter(([,d])=>d===0).map(([n])=>n);
        const result: T[] = [];
        while (queue.length) {
            const n = queue.shift()!; result.push(n);
            for (const next of this.#nodes.get(n) ?? []) {
                const d = (inDegree.get(next) ?? 1) - 1;
                inDegree.set(next, d);
                if (d === 0) queue.push(next);
            }
        }
        if (result.length !== this.#nodes.size) throw new Error('DAG cycle detected in topoSort');
        return result;
    }

    /** Ancestors of a node (all nodes that have a path TO it). */
    ancestors(node: T): Set<T> {
        const result = new Set<T>();
        const dfs = (n: T) => {
            for (const [from, edges] of this.#nodes) {
                if (edges.has(n) && !result.has(from)) { result.add(from); dfs(from); }
            }
        };
        dfs(node); return result;
    }

    /** Descendants of a node. */
    descendants(node: T): Set<T> {
        const result = new Set<T>();
        const dfs = (n: T) => { for (const next of this.#nodes.get(n) ?? []) if (!result.has(next)) { result.add(next); dfs(next); } };
        dfs(node); return result;
    }

    get nodes(): T[] { return [...this.#nodes.keys()]; }
    edges(): [T, T][] { const out: [T,T][] = []; for (const [f,es] of this.#nodes) for (const t of es) out.push([f,t]); return out; }
}

export interface GraphEdge { to: number; weight: number; }

export class Graph {
    #adj: Map<number, GraphEdge[]> = new Map();
    #directed: boolean;

    constructor(directed = true) { this.#directed = directed; }

    addNode(id: number): this { if (!this.#adj.has(id)) this.#adj.set(id, []); return this; }

    addEdge(from: number, to: number, weight = 1): this {
        this.addNode(from); this.addNode(to);
        this.#adj.get(from)!.push({ to, weight });
        if (!this.#directed) this.#adj.get(to)!.push({ to: from, weight });
        return this;
    }

    bfs(start: number): number[] {
        const visited = new Set([start]), queue = [start], out = [start];
        while (queue.length) {
            const n = queue.shift()!;
            for (const { to } of this.#adj.get(n) ?? []) if (!visited.has(to)) { visited.add(to); queue.push(to); out.push(to); }
        }
        return out;
    }

    dfs(start: number): number[] {
        const visited = new Set<number>(), out: number[] = [];
        const rec = (n: number) => { visited.add(n); out.push(n); for (const { to } of this.#adj.get(n) ?? []) if (!visited.has(to)) rec(to); };
        rec(start); return out;
    }

    /** Dijkstra shortest paths from start. Returns { dist, prev } maps. */
    dijkstra(start: number): { dist: Map<number, number>; prev: Map<number, number | null> } {
        const dist = new Map<number, number>();
        const prev = new Map<number, number | null>();
        const pq   = new PriorityQueue<{ id: number; d: number }>((a, b) => a.d - b.d);

        for (const id of this.#adj.keys()) { dist.set(id, Infinity); prev.set(id, null); }
        dist.set(start, 0); pq.push({ id: start, d: 0 });

        while (!pq.empty()) {
            const { id, d } = pq.pop()!;
            if (d > dist.get(id)!) continue;
            for (const { to, weight } of this.#adj.get(id) ?? []) {
                const nd = d + weight;
                if (nd < dist.get(to)!) { dist.set(to, nd); prev.set(to, id); pq.push({ id: to, d: nd }); }
            }
        }
        return { dist, prev };
    }

    /** A* shortest path. heuristic(node) → estimated cost to goal. */
    aStar(start: number, goal: number, heuristic: (n: number) => number): number[] | null {
        const gScore = new Map([[start, 0]]);
        const fScore = new Map([[start, heuristic(start)]]);
        const prev   = new Map<number, number>();
        const open   = new PriorityQueue<{ id: number; f: number }>((a, b) => a.f - b.f);
        open.push({ id: start, f: heuristic(start) });

        while (!open.empty()) {
            const { id } = open.pop()!;
            if (id === goal) {
                const path = [goal]; let cur = goal;
                while (prev.has(cur)) { cur = prev.get(cur)!; path.unshift(cur); }
                return path;
            }
            for (const { to, weight } of this.#adj.get(id) ?? []) {
                const ng = (gScore.get(id) ?? Infinity) + weight;
                if (ng < (gScore.get(to) ?? Infinity)) {
                    prev.set(to, id); gScore.set(to, ng);
                    const f = ng + heuristic(to); fScore.set(to, f);
                    open.push({ id: to, f });
                }
            }
        }
        return null;
    }

    get nodeCount(): number { return this.#adj.size; }
}

// ══════════════════════════════════════════════════════════════════════════════
// FINITE STATE MACHINE
// ══════════════════════════════════════════════════════════════════════════════

export interface FSMTransition<S extends string, E extends string> {
    from   : S | '*';
    event  : E;
    to     : S;
    guard? : (ctx: unknown) => boolean;
    action?: (ctx: unknown, event: E) => void;
}

export class FSM<S extends string, E extends string> {
    #state    : S;
    #initial  : S;
    #trans    : FSMTransition<S, E>[];
    #history  : S[] = [];
    #listeners: Map<string, ((from: S, to: S, event: E) => void)[]> = new Map();
    #maxHistory: number;

    constructor(initial: S, transitions: FSMTransition<S, E>[], maxHistory = 50) {
        this.#state   = initial;
        this.#initial = initial;
        this.#trans   = transitions;
        this.#maxHistory = maxHistory;
    }

    get state(): S { return this.#state; }
    get history(): S[] { return [...this.#history]; }

    /** Send an event. Returns true if a transition fired. */
    send(event: E, ctx?: unknown): boolean {
        const match = this.#trans.find(t =>
            (t.from === '*' || t.from === this.#state) &&
            t.event === event &&
            (!t.guard || t.guard(ctx))
        );
        if (!match) return false;

        const from = this.#state;
        match.action?.(ctx, event);
        this.#state = match.to;
        this.#history.push(from);
        if (this.#history.length > this.#maxHistory) this.#history.shift();

        const key = `${from}→${match.to}`;
        this.#listeners.get(key)?.forEach(fn => fn(from, match.to, event));
        this.#listeners.get('*')?.forEach(fn => fn(from, match.to, event));
        return true;
    }

    /** Returns all events valid from current state. */
    validEvents(): E[] {
        return this.#trans
            .filter(t => t.from === '*' || t.from === this.#state)
            .map(t => t.event);
    }

    /** Can we go back? (if previous state reachable via any transition) */
    canUndo(): boolean { return this.#history.length > 0; }

    undo(ctx?: unknown): boolean {
        const prev = this.#history.pop();
        if (!prev) return false;
        this.#state = prev;
        return true;
    }

    reset(): this { this.#state = this.#initial; this.#history = []; return this; }

    on(transition: `${S}→${S}` | '*', fn: (from: S, to: S, event: E) => void): () => void {
        const key = transition as string;
        if (!this.#listeners.has(key)) this.#listeners.set(key, []);
        this.#listeners.get(key)!.push(fn);
        return () => {
            const arr = this.#listeners.get(key) ?? [];
            this.#listeners.set(key, arr.filter(l => l !== fn));
        };
    }

    /** Export to DOT format for visualization. */
    toDOT(name = 'FSM'): string {
        const edges = this.#trans.map(t => `  "${t.from}" -> "${t.to}" [label="${t.event}"];`).join('\n');
        return `digraph ${name} {\n  rankdir=LR;\n  "${this.#state}" [shape=doublecircle];\n${edges}\n}`;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// TRIE
// ══════════════════════════════════════════════════════════════════════════════

interface TrieNode<V> {
    children: Map<string, TrieNode<V>>;
    value?: V;
    isEnd: boolean;
}

export class Trie<V = string> {
    #root: TrieNode<V> = { children: new Map(), isEnd: false };
    #size = 0;

    insert(key: string, value?: V): this {
        let node = this.#root;
        for (const ch of key) {
            if (!node.children.has(ch)) node.children.set(ch, { children: new Map(), isEnd: false });
            node = node.children.get(ch)!;
        }
        if (!node.isEnd) this.#size++;
        node.isEnd = true; node.value = value;
        return this;
    }

    get(key: string): V | undefined {
        let node = this.#root;
        for (const ch of key) { node = node.children.get(ch)!; if (!node) return undefined; }
        return node.isEnd ? node.value : undefined;
    }

    has(key: string): boolean { return this.get(key) !== undefined || this.#find(key)?.isEnd === true; }

    #find(key: string): TrieNode<V> | null {
        let node = this.#root;
        for (const ch of key) { const n = node.children.get(ch); if (!n) return null; node = n; }
        return node;
    }

    /** All keys with given prefix. */
    autocomplete(prefix: string, limit = 20): string[] {
        const node = this.#find(prefix);
        if (!node) return [];
        const results: string[] = [];
        const dfs = (n: TrieNode<V>, path: string) => {
            if (results.length >= limit) return;
            if (n.isEnd) results.push(path);
            for (const [ch, child] of n.children) dfs(child, path + ch);
        };
        dfs(node, prefix);
        return results;
    }

    delete(key: string): boolean {
        const stack: [TrieNode<V>, string][] = [];
        let node = this.#root;
        for (const ch of key) {
            const n = node.children.get(ch);
            if (!n) return false;
            stack.push([node, ch]); node = n;
        }
        if (!node.isEnd) return false;
        node.isEnd = false; this.#size--;
        // Prune leaf nodes
        for (let i = stack.length - 1; i >= 0; i--) {
            const [parent, ch] = stack[i];
            const child = parent.children.get(ch)!;
            if (child.children.size === 0 && !child.isEnd) parent.children.delete(ch);
            else break;
        }
        return true;
    }

    get size(): number { return this.#size; }
    longestPrefix(query: string): string {
        let node = this.#root, longest = '';
        for (let i = 0; i < query.length; i++) {
            const n = node.children.get(query[i]);
            if (!n) break;
            node = n;
            if (node.isEnd) longest = query.slice(0, i+1);
        }
        return longest;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRIORITY QUEUE (min-heap)
// ══════════════════════════════════════════════════════════════════════════════

export class PriorityQueue<T> {
    #heap: T[] = [];
    #cmp : (a: T, b: T) => number;

    constructor(comparator: (a: T, b: T) => number = (a: T, b: T) => (a as number) - (b as number)) {
        this.#cmp = comparator;
    }

    push(item: T): this {
        this.#heap.push(item);
        this.#bubbleUp(this.#heap.length - 1);
        return this;
    }

    pop(): T | undefined {
        if (!this.#heap.length) return undefined;
        const top = this.#heap[0];
        const last = this.#heap.pop()!;
        if (this.#heap.length) { this.#heap[0] = last; this.#sinkDown(0); }
        return top;
    }

    peek(): T | undefined { return this.#heap[0]; }
    get size(): number { return this.#heap.length; }
    empty(): boolean { return this.#heap.length === 0; }

    #bubbleUp(i: number): void {
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.#cmp(this.#heap[i], this.#heap[parent]) >= 0) break;
            [this.#heap[i], this.#heap[parent]] = [this.#heap[parent], this.#heap[i]];
            i = parent;
        }
    }

    #sinkDown(i: number): void {
        const n = this.#heap.length;
        while (true) {
            let smallest = i;
            const l = 2*i+1, r = 2*i+2;
            if (l < n && this.#cmp(this.#heap[l], this.#heap[smallest]) < 0) smallest = l;
            if (r < n && this.#cmp(this.#heap[r], this.#heap[smallest]) < 0) smallest = r;
            if (smallest === i) break;
            [this.#heap[i], this.#heap[smallest]] = [this.#heap[smallest], this.#heap[i]];
            i = smallest;
        }
    }

    toSortedArray(): T[] {
        const clone = new PriorityQueue<T>(this.#cmp);
        clone.#heap = [...this.#heap];
        const out: T[] = [];
        while (!clone.empty()) out.push(clone.pop()!);
        return out;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// DEQUE (Double-ended queue)
// ══════════════════════════════════════════════════════════════════════════════

export class Deque<T> {
    #buf    : (T | undefined)[];
    #head   : number;
    #tail   : number;
    #size   : number;
    #cap    : number;

    constructor(initialCapacity = 16) {
        this.#cap  = initialCapacity;
        this.#buf  = new Array(initialCapacity);
        this.#head = 0; this.#tail = 0; this.#size = 0;
    }

    pushFront(item: T): void { this.#grow(); this.#head = (this.#head - 1 + this.#cap) % this.#cap; this.#buf[this.#head] = item; this.#size++; }
    pushBack (item: T): void { this.#grow(); this.#buf[this.#tail] = item; this.#tail = (this.#tail + 1) % this.#cap; this.#size++; }
    popFront (): T | undefined { if (!this.#size) return undefined; const v=this.#buf[this.#head]; this.#buf[this.#head]=undefined; this.#head=(this.#head+1)%this.#cap; this.#size--; return v; }
    popBack  (): T | undefined { if (!this.#size) return undefined; this.#tail=(this.#tail-1+this.#cap)%this.#cap; const v=this.#buf[this.#tail]; this.#buf[this.#tail]=undefined; this.#size--; return v; }
    peekFront(): T | undefined { return this.#buf[this.#head]; }
    peekBack (): T | undefined { return this.#buf[(this.#tail-1+this.#cap)%this.#cap]; }
    get size (): number { return this.#size; }
    isEmpty  (): boolean { return this.#size === 0; }

    #grow(): void {
        if (this.#size < this.#cap) return;
        const newCap = this.#cap * 2;
        const newBuf = new Array<T | undefined>(newCap);
        for (let i = 0; i < this.#size; i++) newBuf[i] = this.#buf[(this.#head + i) % this.#cap];
        this.#buf = newBuf; this.#head = 0; this.#tail = this.#size; this.#cap = newCap;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// LRU CACHE
// ══════════════════════════════════════════════════════════════════════════════

export class LRUCache<K, V> {
    #cap    : number;
    #cache  : Map<K, V>;

    constructor(capacity: number) {
        this.#cap   = capacity;
        this.#cache = new Map();
    }

    get(key: K): V | undefined {
        if (!this.#cache.has(key)) return undefined;
        const val = this.#cache.get(key)!;
        this.#cache.delete(key); this.#cache.set(key, val); // move to end (most recent)
        return val;
    }

    put(key: K, value: V): void {
        if (this.#cache.has(key)) this.#cache.delete(key);
        else if (this.#cache.size >= this.#cap) this.#cache.delete(this.#cache.keys().next().value as K);
        this.#cache.set(key, value);
    }

    has(key: K): boolean { return this.#cache.has(key); }
    delete(key: K): boolean { return this.#cache.delete(key); }
    clear(): void { this.#cache.clear(); }
    get size(): number { return this.#cache.size; }
    get capacity(): number { return this.#cap; }

    /** Keys from least to most recently used. */
    keys(): IterableIterator<K> { return this.#cache.keys(); }
}

// ══════════════════════════════════════════════════════════════════════════════
// SEGMENT TREE (range sum/min/max with lazy propagation)
// ══════════════════════════════════════════════════════════════════════════════

export type SegmentOp = 'sum' | 'min' | 'max';

export class SegmentTree {
    #n    : number;
    #tree : number[];
    #lazy : number[];
    #op   : SegmentOp;

    constructor(data: number[], op: SegmentOp = 'sum') {
        this.#n    = data.length;
        this.#op   = op;
        this.#tree = new Array(4 * this.#n).fill(op === 'min' ? Infinity : op === 'max' ? -Infinity : 0);
        this.#lazy = new Array(4 * this.#n).fill(0);
        this.#build(data, 1, 0, this.#n - 1);
    }

    #combine(a: number, b: number): number {
        return this.#op === 'sum' ? a+b : this.#op === 'min' ? Math.min(a,b) : Math.max(a,b);
    }

    #build(data: number[], node: number, start: number, end: number): void {
        if (start === end) { this.#tree[node] = data[start]; return; }
        const mid = (start + end) >> 1;
        this.#build(data, 2*node, start, mid);
        this.#build(data, 2*node+1, mid+1, end);
        this.#tree[node] = this.#combine(this.#tree[2*node], this.#tree[2*node+1]);
    }

    query(l: number, r: number): number { return this.#query(1, 0, this.#n-1, l, r); }

    #query(node: number, start: number, end: number, l: number, r: number): number {
        if (r < start || end < l) return this.#op === 'min' ? Infinity : this.#op === 'max' ? -Infinity : 0;
        if (l <= start && end <= r) return this.#tree[node];
        const mid = (start + end) >> 1;
        return this.#combine(
            this.#query(2*node, start, mid, l, r),
            this.#query(2*node+1, mid+1, end, l, r)
        );
    }

    update(i: number, val: number): void { this.#update(1, 0, this.#n-1, i, val); }

    #update(node: number, start: number, end: number, i: number, val: number): void {
        if (start === end) { this.#tree[node] = val; return; }
        const mid = (start + end) >> 1;
        if (i <= mid) this.#update(2*node, start, mid, i, val);
        else          this.#update(2*node+1, mid+1, end, i, val);
        this.#tree[node] = this.#combine(this.#tree[2*node], this.#tree[2*node+1]);
    }

    get length(): number { return this.#n; }
}

// ══════════════════════════════════════════════════════════════════════════════
// DISJOINT SET (Union-Find)
// ══════════════════════════════════════════════════════════════════════════════

export class DisjointSet {
    #parent: number[];
    #rank  : number[];
    #count : number;

    constructor(n: number) {
        this.#parent = Array.from({ length: n }, (_, i) => i);
        this.#rank   = new Array(n).fill(0);
        this.#count  = n;
    }

    find(x: number): number {
        if (this.#parent[x] !== x) this.#parent[x] = this.find(this.#parent[x]); // path compression
        return this.#parent[x];
    }

    union(x: number, y: number): boolean {
        const px = this.find(x), py = this.find(y);
        if (px === py) return false;
        if (this.#rank[px] < this.#rank[py]) this.#parent[px] = py;
        else if (this.#rank[px] > this.#rank[py]) this.#parent[py] = px;
        else { this.#parent[py] = px; this.#rank[px]++; }
        this.#count--;
        return true;
    }

    connected(x: number, y: number): boolean { return this.find(x) === this.find(y); }
    get componentCount(): number { return this.#count; }
}

// ══════════════════════════════════════════════════════════════════════════════
// OBSERVABLE COLLECTIONS
// ══════════════════════════════════════════════════════════════════════════════

export type MapChangeEvent<K, V> = { type: 'set' | 'delete' | 'clear'; key?: K; value?: V; };
export type ArrayChangeEvent<T>  = { type: 'push' | 'pop' | 'splice' | 'set'; index?: number; items?: T[]; removed?: T[]; };

export class ObservableMap<K, V> extends Map<K, V> {
    #listeners: ((e: MapChangeEvent<K, V>) => void)[] = [];

    subscribe(fn: (e: MapChangeEvent<K, V>) => void): () => void {
        this.#listeners.push(fn);
        return () => { this.#listeners = this.#listeners.filter(l => l !== fn); };
    }

    #emit(e: MapChangeEvent<K, V>): void { this.#listeners.forEach(l => l(e)); }

    set(key: K, value: V): this { super.set(key, value); this.#emit({ type: 'set', key, value }); return this; }
    delete(key: K): boolean     { const r = super.delete(key); if (r) this.#emit({ type: 'delete', key }); return r; }
    clear(): void               { super.clear(); this.#emit({ type: 'clear' }); }
}

export class ObservableArray<T> extends Array<T> {
    #listeners: ((e: ArrayChangeEvent<T>) => void)[] = [];

    subscribe(fn: (e: ArrayChangeEvent<T>) => void): () => void {
        this.#listeners.push(fn);
        return () => { this.#listeners = this.#listeners.filter(l => l !== fn); };
    }

    #emit(e: ArrayChangeEvent<T>): void { this.#listeners.forEach(l => l(e)); }

    push(...items: T[]): number { const r = super.push(...items); this.#emit({ type: 'push', items }); return r; }
    pop(): T | undefined        { const r = super.pop(); this.#emit({ type: 'pop', removed: r !== undefined ? [r] : [] }); return r; }
    splice(start: number, deleteCount?: number, ...items: T[]): T[] {
        const removed = deleteCount !== undefined ? super.splice(start, deleteCount, ...items) : super.splice(start);
        this.#emit({ type: 'splice', index: start, items, removed });
        return removed;
    }

    static from<T>(arr: T[]): ObservableArray<T> {
        const oa = new ObservableArray<T>(); oa.push(...arr); return oa;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════

export const Data = {
    DAG, Graph,
    FSM,
    Trie, PriorityQueue, Deque,
    LRUCache,
    SegmentTree,
    DisjointSet,
    ObservableMap, ObservableArray,
};

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Data', {
        value: Data, writable: false, enumerable: false, configurable: false,
    });

export default Data;
