/**
 * @module    LaTeX
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 * @version   1.0.0
 *
 * LaTeX / MathML rendering for AriannA. Zero dependencies, browser-native
 * MathML output, with bidirectional support: parse LaTeX → MathML, AND parse
 * a simple infix syntax → LaTeX + MathML simultaneously.
 *
 * ── Why not MathJax / KaTeX / temml? ─────────────────────────────────────────
 *
 * AriannA's policy is zero runtime deps. MathJax (300KB), KaTeX (250KB), temml
 * (200KB) are all valid choices but each pulls a large parser, font set, and
 * CSS. MathML Core is now natively rendered in Chrome 109+, Safari 14+, Firefox
 * (≥ 90% of browsers in 2026). With native rendering, we only need a parser —
 * not a renderer — so we can ship something minimal: ~20KB covering the 80%
 * of LaTeX patterns used in real notation.
 *
 * What we cover (the realistic subset):
 *
 *   • Fractions:              \frac{a}{b}
 *   • Roots:                  \sqrt{x}, \sqrt[n]{x}
 *   • Super/subscript:        x^2, x^{n+1}, x_i, x_{n+1}, x^a_b
 *   • Greek letters:          \alpha, \beta, \pi, \Sigma, ...
 *   • Big operators:          \sum, \prod, \int, \oint, \lim
 *   • Operators & relations:  \cdot, \pm, \times, \le, \ge, \ne, \approx, \infty, ...
 *   • Functions:              \sin, \cos, \tan, \log, \ln, \exp
 *   • Brackets & delimiters:  ( ), [ ], \{ \}, \left( \right), |x|
 *   • Matrices:               \begin{matrix} a & b \\ c & d \end{matrix}
 *                             \begin{pmatrix}, \bmatrix, \vmatrix variants
 *   • Vectors / hats:         \vec{x}, \hat{n}, \bar{y}
 *   • Text: \text{...}, \mathbf, \mathit, \mathrm
 *
 * What we don't cover (out of scope, falls through as <mtext>):
 *   array environment with column specs, \newcommand, custom macros,
 *   complex spacing primitives. For those, install temml as optional peer dep.
 *
 * ── Bidirectional: also support a simple infix syntax ────────────────────────
 *
 * For interactive demos and quick formula entry, AriannA ships a pragmatic
 * infix parser that reads `1/2 + sqrt(x^2 + y^2)` and returns BOTH the LaTeX
 * source AND the MathML simultaneously. This is the "simple syntax" the
 * AriannA site demo uses for the LaTeX/MathML field.
 *
 * @example
 *   import { Latex } from "./Latex.ts";
 *
 *   // LaTeX → MathML
 *   const ml = Latex.toMathML("x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}");
 *
 *   // Simple infix → LaTeX + MathML
 *   const { latex, mathml } = Latex.fromInfix("(1+sqrt(5))/2");
 *
 *   // Render LaTeX into a DOM element
 *   Latex.render(el, "E = mc^2");
 *
 *   // Numeric evaluation of an infix expression (Solve button)
 *   Latex.evalInfix("1/2 + sqrt(2*3)");   // → 2.949…
 */

// ── Constant tables ──────────────────────────────────────────────────────────

/** Greek letter LaTeX commands → Unicode characters. */
const GREEK: Record<string, string> = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
    zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', varpi: 'ϖ',
    rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ',
    phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
    Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

/** Operator/relation LaTeX commands → Unicode. */
const OPERATORS: Record<string, string> = {
    pm: '±', mp: '∓', times: '×', div: '÷', ast: '∗', star: '⋆',
    cdot: '·', cdots: '⋯', ldots: '…', vdots: '⋮', ddots: '⋱',
    leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
    approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅',
    propto: '∝', infty: '∞', partial: '∂', nabla: '∇',
    forall: '∀', exists: '∃', emptyset: '∅', in: '∈', notin: '∉',
    subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
    cup: '∪', cap: '∩', setminus: '∖', wedge: '∧', vee: '∨', neg: '¬',
    rightarrow: '→', leftarrow: '←', leftrightarrow: '↔',
    Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔',
    to: '→', mapsto: '↦', implies: '⟹', iff: '⟺',
    perp: '⊥', parallel: '∥', angle: '∠', triangle: '△',
    aleph: 'ℵ', hbar: 'ℏ', ell: 'ℓ', wp: '℘', Re: 'ℜ', Im: 'ℑ',
};

/** Big operators (renderable as <mo> with stretchy attribute). */
const BIG_OPS: Record<string, string> = {
    sum: '∑', prod: '∏', coprod: '∐',
    int: '∫', iint: '∬', iiint: '∭', oint: '∮',
    bigcup: '⋃', bigcap: '⋂', bigvee: '⋁', bigwedge: '⋀',
    bigoplus: '⨁', bigotimes: '⨂',
    lim: 'lim', liminf: 'lim inf', limsup: 'lim sup',
    max: 'max', min: 'min', sup: 'sup', inf: 'inf', det: 'det',
    arg: 'arg', deg: 'deg', dim: 'dim', exp: 'exp', gcd: 'gcd', lcm: 'lcm',
};

/** Function names rendered upright. */
const FUNCTIONS = new Set([
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'sinh', 'cosh', 'tanh', 'coth',
    'arcsin', 'arccos', 'arctan',
    'log', 'ln', 'lg',
]);

// ── Tokenizer ────────────────────────────────────────────────────────────────

type Token =
    | { kind: 'cmd';    name: string }
    | { kind: 'lbrace' }
    | { kind: 'rbrace' }
    | { kind: 'lparen' }
    | { kind: 'rparen' }
    | { kind: 'lbrack' }
    | { kind: 'rbrack' }
    | { kind: 'caret' }
    | { kind: 'under' }
    | { kind: 'amp' }
    | { kind: 'dbl_back' }
    | { kind: 'num';    value: string }
    | { kind: 'ident';  value: string }
    | { kind: 'op';     value: string }
    | { kind: 'space' };

function tokenize(src: string): Token[]
{
    const tokens: Token[] = [];
    let i = 0;
    while (i < src.length)
    {
        const ch = src[i] ?? '';
        if (/\s/.test(ch)) { tokens.push({ kind: 'space' }); i++; continue; }

        if (ch === '\\')
        {
            i++;
            if (src[i] === '\\') { tokens.push({ kind: 'dbl_back' }); i++; continue; }
            if (src[i] && !/[a-zA-Z]/.test(src[i] ?? ''))
            { tokens.push({ kind: 'cmd', name: src[i] ?? '' }); i++; continue; }
            let name = '';
            while (i < src.length && /[a-zA-Z]/.test(src[i] ?? '')) { name += src[i]; i++; }
            tokens.push({ kind: 'cmd', name });
            continue;
        }

        if (/[0-9.]/.test(ch))
        {
            let num = '';
            while (i < src.length && /[0-9.]/.test(src[i] ?? '')) { num += src[i]; i++; }
            tokens.push({ kind: 'num', value: num });
            continue;
        }

        if (/[a-zA-Z]/.test(ch))
        {
            tokens.push({ kind: 'ident', value: ch });
            i++; continue;
        }

        switch (ch)
        {
            case '{': tokens.push({ kind: 'lbrace' }); i++; continue;
            case '}': tokens.push({ kind: 'rbrace' }); i++; continue;
            case '(': tokens.push({ kind: 'lparen' }); i++; continue;
            case ')': tokens.push({ kind: 'rparen' }); i++; continue;
            case '[': tokens.push({ kind: 'lbrack' }); i++; continue;
            case ']': tokens.push({ kind: 'rbrack' }); i++; continue;
            case '^': tokens.push({ kind: 'caret' });  i++; continue;
            case '_': tokens.push({ kind: 'under' });  i++; continue;
            case '&': tokens.push({ kind: 'amp' });    i++; continue;
        }

        tokens.push({ kind: 'op', value: ch });
        i++;
    }
    return tokens;
}

// ── Parser: LaTeX → MathML ───────────────────────────────────────────────────

class LatexParser
{
    private tokens: Token[];
    private pos = 0;

    constructor(tokens: Token[]) { this.tokens = tokens; }

    parse(): string { return this.parseGroup(false); }

    private peek(offset = 0): Token | undefined { return this.tokens[this.pos + offset]; }
    private next(): Token | undefined { return this.tokens[this.pos++]; }
    private skipSpace(): void { while (this.peek()?.kind === 'space') this.pos++; }

    private parseGroup(inBrace: boolean): string
    {
        const out: string[] = [];
        while (this.pos < this.tokens.length)
        {
            const t = this.peek();
            if (!t) break;
            if (inBrace && t.kind === 'rbrace') break;
            const atom = this.parseAtom();
            if (atom) out.push(atom);
        }
        return out.join('');
    }

    private parseAtom(): string
    {
        this.skipSpace();
        const t = this.next();
        if (!t) return '';

        let base = '';
        switch (t.kind)
        {
            case 'space':  return '';
            case 'num':    base = `<mn>${t.value}</mn>`; break;
            case 'ident':  base = `<mi>${t.value}</mi>`; break;
            case 'op':     base = `<mo>${escapeXml(t.value)}</mo>`; break;
            case 'lbrace': base = this.parseBraceGroup(); break;
            case 'rbrace': return '';
            case 'lparen': base = `<mo>(</mo>${this.parseUntil('rparen')}<mo>)</mo>`; break;
            case 'rparen': base = '<mo>)</mo>'; break;
            case 'lbrack': base = `<mo>[</mo>${this.parseUntil('rbrack')}<mo>]</mo>`; break;
            case 'rbrack': base = '<mo>]</mo>'; break;
            case 'caret':  return this.handleScript('msup');
            case 'under':  return this.handleScript('msub');
            case 'amp':    return '';
            case 'dbl_back': return '';
            case 'cmd':    base = this.handleCommand(t.name); break;
        }

        return this.attachScripts(base);
    }

    private parseBraceGroup(): string
    {
        const inner = this.parseGroup(true);
        const t = this.next();
        void t;
        return `<mrow>${inner}</mrow>`;
    }

    private parseUntil(closer: Token['kind']): string
    {
        const out: string[] = [];
        while (this.pos < this.tokens.length)
        {
            const t = this.peek();
            if (!t || t.kind === closer) { if (t) this.pos++; break; }
            const atom = this.parseAtom();
            if (atom) out.push(atom);
        }
        return out.join('');
    }

    private handleScript(kind: 'msup' | 'msub'): string
    {
        const base = '<mrow></mrow>';
        const arg = this.parseScriptArg();
        return `<${kind}>${base}${arg}</${kind}>`;
    }

    private parseScriptArg(): string
    {
        this.skipSpace();
        const t = this.peek();
        if (!t) return '<mrow></mrow>';
        if (t.kind === 'lbrace') { this.pos++; return this.parseBraceGroup(); }
        // Important: read a SINGLE atom WITHOUT chained super/sub, so that
        // `x_a^b` correctly produces <msubsup> instead of <msub><x, msup<a,b>>.
        const atom = this.parseAtomBare();
        return atom || '<mrow></mrow>';
    }

    /** Same as parseAtom but does not consume trailing ^ or _. */
    private parseAtomBare(): string
    {
        this.skipSpace();
        const t = this.next();
        if (!t) return '';
        switch (t.kind)
        {
            case 'space':  return '';
            case 'num':    return `<mn>${t.value}</mn>`;
            case 'ident':  return `<mi>${t.value}</mi>`;
            case 'op':     return `<mo>${escapeXml(t.value)}</mo>`;
            case 'lbrace': return this.parseBraceGroup();
            case 'rbrace': return '';
            case 'lparen': return `<mo>(</mo>${this.parseUntil('rparen')}<mo>)</mo>`;
            case 'rparen': return '<mo>)</mo>';
            case 'lbrack': return `<mo>[</mo>${this.parseUntil('rbrack')}<mo>]</mo>`;
            case 'rbrack': return '<mo>]</mo>';
            case 'caret':  return this.handleScript('msup');
            case 'under':  return this.handleScript('msub');
            case 'amp':    return '';
            case 'dbl_back': return '';
            case 'cmd':    return this.handleCommand(t.name);
        }
    }

    private attachScripts(base: string): string
    {
        this.skipSpace();
        const next1 = this.peek();
        if (next1?.kind !== 'caret' && next1?.kind !== 'under') return base;

        this.pos++;
        const arg1 = this.parseScriptArg();
        this.skipSpace();
        const next2 = this.peek();
        const isOther = next2 && (
            (next1.kind === 'caret' && next2.kind === 'under') ||
            (next1.kind === 'under' && next2.kind === 'caret')
        );
        if (isOther)
        {
            this.pos++;
            const arg2 = this.parseScriptArg();
            if (next1.kind === 'caret') return `<msubsup>${base}${arg2}${arg1}</msubsup>`;
            return `<msubsup>${base}${arg1}${arg2}</msubsup>`;
        }
        return next1.kind === 'caret'
            ? `<msup>${base}${arg1}</msup>`
            : `<msub>${base}${arg1}</msub>`;
    }

    private handleCommand(name: string): string
    {
        if (name in GREEK) return `<mi>${GREEK[name]}</mi>`;
        if (name in OPERATORS) return `<mo>${OPERATORS[name]}</mo>`;
        if (name in BIG_OPS) return `<mo>${BIG_OPS[name]}</mo>`;
        if (FUNCTIONS.has(name)) return `<mi>${name}</mi>`;

        switch (name)
        {
            case 'frac':       return this.handleFrac();
            case 'sqrt':       return this.handleSqrt();
            case 'vec':        return this.handleAccent('→');
            case 'hat':        return this.handleAccent('^');
            case 'bar':        return this.handleAccent('‾');
            case 'tilde':      return this.handleAccent('~');
            case 'dot':        return this.handleAccent('˙');
            case 'ddot':       return this.handleAccent('¨');
            case 'mathbf':     return this.handleStyle('mathvariant', 'bold');
            case 'mathit':     return this.handleStyle('mathvariant', 'italic');
            case 'mathrm':     return this.handleStyle('mathvariant', 'normal');
            case 'mathcal':    return this.handleStyle('mathvariant', 'script');
            case 'mathbb':     return this.handleStyle('mathvariant', 'double-struck');
            case 'text':       return this.handleText();
            case 'left':       return this.handleLeftRight();
            case 'right':      return '';
            case 'begin':      return this.handleEnvironment();
            case ',':          return '<mspace width="0.166em"/>';
            case ';':          return '<mspace width="0.222em"/>';
            case ':':          return '<mspace width="0.222em"/>';
            case '!':          return '<mspace width="-0.166em"/>';
            case '{':          return '<mo>{</mo>';
            case '}':          return '<mo>}</mo>';
            case '|':          return '<mo>|</mo>';
        }
        return `<mi>\\${name}</mi>`;
    }

    private handleFrac(): string
    {
        const num = this.parseScriptArg();
        const den = this.parseScriptArg();
        return `<mfrac>${num}${den}</mfrac>`;
    }

    private handleSqrt(): string
    {
        this.skipSpace();
        if (this.peek()?.kind === 'lbrack')
        {
            this.pos++;
            const idx = this.parseUntil('rbrack');
            const radicand = this.parseScriptArg();
            return `<mroot>${radicand}<mrow>${idx}</mrow></mroot>`;
        }
        const radicand = this.parseScriptArg();
        return `<msqrt>${radicand}</msqrt>`;
    }

    private handleAccent(accent: string): string
    {
        const arg = this.parseScriptArg();
        return `<mover accent="true">${arg}<mo>${accent}</mo></mover>`;
    }

    private handleStyle(attr: string, value: string): string
    {
        const arg = this.parseScriptArg();
        return `<mstyle ${attr}="${value}">${arg}</mstyle>`;
    }

    private handleText(): string
    {
        this.skipSpace();
        if (this.peek()?.kind !== 'lbrace') return '';
        this.pos++;
        let body = '';
        while (this.pos < this.tokens.length)
        {
            const t = this.next();
            if (!t || t.kind === 'rbrace') break;
            switch (t.kind)
            {
                case 'space':  body += ' '; break;
                case 'num':    body += t.value; break;
                case 'ident':  body += t.value; break;
                case 'op':     body += t.value; break;
                case 'lbrace': body += '{'; break;
                case 'cmd':    body += '\\' + t.name; break;
                default:       break;
            }
        }
        return `<mtext>${escapeXml(body)}</mtext>`;
    }

    private handleLeftRight(): string
    {
        this.skipSpace();
        const t = this.next();
        let lDelim = '(';
        if (t)
        {
            if (t.kind === 'op' || t.kind === 'lparen' || t.kind === 'lbrack')
                lDelim = (t as { value?: string }).value ?? '(';
            else if (t.kind === 'cmd') lDelim = t.name === '{' ? '{' : (OPERATORS[t.name] ?? '(');
        }

        const inner: string[] = [];
        while (this.pos < this.tokens.length)
        {
            const tk = this.peek();
            if (tk?.kind === 'cmd' && tk.name === 'right') { this.pos++; break; }
            const atom = this.parseAtom();
            if (atom) inner.push(atom);
        }

        this.skipSpace();
        let rDelim = ')';
        const r = this.next();
        if (r)
        {
            if (r.kind === 'op' || r.kind === 'rparen' || r.kind === 'rbrack')
                rDelim = (r as { value?: string }).value ?? ')';
            else if (r.kind === 'cmd') rDelim = r.name === '}' ? '}' : (OPERATORS[r.name] ?? ')');
        }
        return `<mo stretchy="true">${escapeXml(lDelim)}</mo>${inner.join('')}<mo stretchy="true">${escapeXml(rDelim)}</mo>`;
    }

    private handleEnvironment(): string
    {
        this.skipSpace();
        if (this.peek()?.kind !== 'lbrace') return '';
        this.pos++;
        let envName = '';
        while (this.pos < this.tokens.length)
        {
            const t = this.next();
            if (!t || t.kind === 'rbrace') break;
            if (t.kind === 'ident') envName += t.value;
        }

        const delims: Record<string, [string, string]> = {
            matrix:  ['', ''],
            pmatrix: ['(', ')'],
            bmatrix: ['[', ']'],
            Bmatrix: ['{', '}'],
            vmatrix: ['|', '|'],
            Vmatrix: ['‖', '‖'],
        };
        const [lD, rD] = delims[envName] ?? ['', ''];

        const rows: string[][] = [[]];
        let cell: string[] = [];
        const flushCell = () => { rows[rows.length - 1]!.push(cell.join('')); cell = []; };

        while (this.pos < this.tokens.length)
        {
            const t = this.peek();
            if (!t) break;
            if (t.kind === 'cmd' && t.name === 'end')
            {
                this.pos++;
                if (this.peek()?.kind === 'lbrace')
                {
                    this.pos++;
                    while (this.pos < this.tokens.length)
                    {
                        const n = this.next();
                        if (!n || n.kind === 'rbrace') break;
                    }
                }
                break;
            }
            if (t.kind === 'amp')      { this.pos++; flushCell(); continue; }
            if (t.kind === 'dbl_back') { this.pos++; flushCell(); rows.push([]); continue; }
            const atom = this.parseAtom();
            if (atom) cell.push(atom);
        }
        flushCell();
        if (rows.length > 0 && rows[rows.length - 1]!.length === 1 && rows[rows.length - 1]![0] === '')
            rows.pop();

        const tableBody = rows.map(r =>
            `<mtr>${r.map(c => `<mtd>${c}</mtd>`).join('')}</mtr>`
        ).join('');

        const table = `<mtable>${tableBody}</mtable>`;
        if (lD)
            return `<mo>${escapeXml(lD)}</mo>${table}<mo>${escapeXml(rD)}</mo>`;
        return table;
    }
}

function escapeXml(s: string): string
{
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Public LaTeX API ─────────────────────────────────────────────────────────

export const Latex = {

    /**
     * Convert a LaTeX string to a complete MathML document string.
     */
    toMathML(latex: string): string
    {
        const tokens = tokenize(latex);
        const parser = new LatexParser(tokens);
        const body = parser.parse();
        return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>${body}</mrow></math>`;
    },

    /**
     * Render a LaTeX string as MathML inside the given DOM element.
     */
    render(el: Element, latex: string): void
    {
        el.innerHTML = Latex.toMathML(latex);
    },

    /**
     * Parse a simple infix expression and produce BOTH the equivalent
     * LaTeX source and the rendered MathML.
     */
    fromInfix(expr: string): { latex: string; mathml: string }
    {
        const ast = parseInfix(expr);
        const latex = astToLatex(ast);
        const mathml = Latex.toMathML(latex);
        return { latex, mathml };
    },

    /**
     * Numerically evaluate a simple infix expression.
     */
    evalInfix(expr: string, vars: Record<string, number> = {}): number
    {
        return evalAst(parseInfix(expr), vars);
    },
};

// ── Infix parser (recursive descent) ─────────────────────────────────────────

type InfixAst =
    | { type: 'num';   value: number }
    | { type: 'var';   name: string }
    | { type: 'bin';   op: '+' | '-' | '*' | '/' | '^'; left: InfixAst; right: InfixAst }
    | { type: 'unary'; op: '-'; operand: InfixAst }
    | { type: 'call';  fn: string; arg: InfixAst };

class InfixParser
{
    private src: string;
    private pos = 0;

    constructor(src: string) { this.src = src.replace(/\s+/g, ''); }

    parse(): InfixAst
    {
        const ast = this.parseAddSub();
        if (this.pos < this.src.length)
            throw new Error(`Infix parse error at ${this.pos}: unexpected '${this.src[this.pos]}'`);
        return ast;
    }

    private peek(): string { return this.src[this.pos] ?? ''; }
    private consume(): string { return this.src[this.pos++] ?? ''; }

    private parseAddSub(): InfixAst
    {
        let left = this.parseMulDiv();
        while (this.peek() === '+' || this.peek() === '-')
        {
            const op = this.consume() as '+' | '-';
            const right = this.parseMulDiv();
            left = { type: 'bin', op, left, right };
        }
        return left;
    }

    private parseMulDiv(): InfixAst
    {
        let left = this.parsePower();
        while (true)
        {
            const ch = this.peek();
            if (ch === '*' || ch === '/')
            {
                const op = this.consume() as '*' | '/';
                const right = this.parsePower();
                left = { type: 'bin', op, left, right };
            }
            else if (ch && /[a-zA-Z(]/.test(ch) &&
                (left.type === 'num' || left.type === 'var' || left.type === 'call' ||
                 (left.type === 'bin' && left.op === '^')))
            {
                const right = this.parsePower();
                left = { type: 'bin', op: '*', left, right };
            }
            else break;
        }
        return left;
    }

    private parsePower(): InfixAst
    {
        const left = this.parseUnary();
        if (this.peek() === '^')
        {
            this.consume();
            const right = this.parsePower();
            return { type: 'bin', op: '^', left, right };
        }
        return left;
    }

    private parseUnary(): InfixAst
    {
        if (this.peek() === '-')
        {
            this.consume();
            return { type: 'unary', op: '-', operand: this.parseUnary() };
        }
        if (this.peek() === '+') { this.consume(); return this.parseUnary(); }
        return this.parsePrimary();
    }

    private parsePrimary(): InfixAst
    {
        const ch = this.peek();

        if (ch === '(')
        {
            this.consume();
            const inner = this.parseAddSub();
            if (this.consume() !== ')') throw new Error('Infix: missing closing )');
            return inner;
        }

        if (/[0-9.]/.test(ch))
        {
            let num = '';
            while (this.pos < this.src.length && /[0-9.]/.test(this.peek())) num += this.consume();
            return { type: 'num', value: parseFloat(num) };
        }

        if (/[a-zA-Z]/.test(ch))
        {
            let name = '';
            while (this.pos < this.src.length && /[a-zA-Z]/.test(this.peek())) name += this.consume();

            if (this.peek() === '(')
            {
                this.consume();
                const arg = this.parseAddSub();
                if (this.consume() !== ')') throw new Error(`Infix: missing closing ) after ${name}(`);
                return { type: 'call', fn: name, arg };
            }
            return { type: 'var', name };
        }

        throw new Error(`Infix: unexpected '${ch}' at position ${this.pos}`);
    }
}

function parseInfix(src: string): InfixAst { return new InfixParser(src).parse(); }

function astToLatex(node: InfixAst): string
{
    switch (node.type)
    {
        case 'num': return String(node.value);
        case 'var':
        {
            if (GREEK[node.name] !== undefined) return `\\${node.name}`;
            if (node.name === 'pi') return '\\pi';
            if (node.name === 'e')  return 'e';
            if (node.name.length === 1) return node.name;
            return `\\mathrm{${node.name}}`;
        }
        case 'unary': return `-${astToLatex(node.operand)}`;
        case 'call':
        {
            const a = astToLatex(node.arg);
            switch (node.fn)
            {
                case 'sqrt': return `\\sqrt{${a}}`;
                case 'abs':  return `\\left|${a}\\right|`;
                default:
                    if (FUNCTIONS.has(node.fn)) return `\\${node.fn}\\left(${a}\\right)`;
                    return `\\mathrm{${node.fn}}\\left(${a}\\right)`;
            }
        }
        case 'bin':
        {
            const l = astToLatex(node.left);
            const r = astToLatex(node.right);
            switch (node.op)
            {
                case '+': return `${l}+${r}`;
                case '-': return `${l}-${r}`;
                case '*': return `${l}\\cdot ${r}`;
                case '/': return `\\frac{${l}}{${r}}`;
                case '^':
                {
                    const rEx = r.length > 1 ? `{${r}}` : r;
                    const lEx = (node.left.type === 'bin' || node.left.type === 'unary')
                        ? `\\left(${l}\\right)` : l;
                    return `${lEx}^${rEx}`;
                }
            }
        }
    }
}

function evalAst(node: InfixAst, vars: Record<string, number>): number
{
    switch (node.type)
    {
        case 'num':   return node.value;
        case 'var':
        {
            if (node.name === 'pi' || node.name === 'PI') return Math.PI;
            if (node.name === 'e' || node.name === 'E')   return Math.E;
            if (node.name in vars) return vars[node.name]!;
            throw new Error(`Undefined variable '${node.name}'`);
        }
        case 'unary': return -evalAst(node.operand, vars);
        case 'call':
        {
            const a = evalAst(node.arg, vars);
            const fns: Record<string, (x: number) => number> = {
                sqrt: Math.sqrt, abs: Math.abs,
                sin: Math.sin, cos: Math.cos, tan: Math.tan,
                asin: Math.asin, acos: Math.acos, atan: Math.atan,
                sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
                log: Math.log10, ln: Math.log, exp: Math.exp,
            };
            const fn = fns[node.fn];
            if (!fn) throw new Error(`Unknown function '${node.fn}'`);
            return fn(a);
        }
        case 'bin':
        {
            const l = evalAst(node.left, vars);
            const r = evalAst(node.right, vars);
            switch (node.op)
            {
                case '+': return l + r;
                case '-': return l - r;
                case '*': return l * r;
                case '/': return l / r;
                case '^': return Math.pow(l, r);
            }
        }
    }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const LateX = {
    name   : 'LateX',
    version: '1.0.0',
    install(_core: unknown): void
    {
        try
        {
            Object.defineProperty(window, 'Latex', {
                value: Latex, writable: false, enumerable: false, configurable: false,
            });
        } catch {}
    },
};

export default LateX;
