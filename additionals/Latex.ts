/**
 * @module    LateX
 * @author    Riccardo Angeli
 * @version   0.1.0
 *
 * LaTeX/MathML rendering for AriannA.
 * Converts LaTeX strings to MathML (browser-native) or SVG.
 *
 * ── The MathML situation in 2026 ──────────────────────────────────────────────
 *
 *   MathML Core is now supported in ALL major browsers (Chrome 109+, Safari 14+, Firefox).
 *   AriannA already has 29 MathML elements in the Namespace registry.
 *   The only missing piece: LaTeX → MathML conversion.
 *
 * ── Options for the parser ────────────────────────────────────────────────────
 *
 *   A) MathJax — the gold standard. 300KB. Too heavy.
 *   B) KaTeX   — fast, 250KB. Could wrap as peer dep.
 *   C) temml   — LaTeX→MathML, pure JS, 200KB. Best for AriannA.
 *   D) Custom  — implement subset ourselves. 4-6 weeks, ~40KB.
 *
 *   Recommendation: wrap temml as optional peer dep for complete coverage.
 *   Implement a lightweight subset ourselves for common cases:
 *   fractions, roots, superscript, subscript, Greek letters, common operators.
 *   This covers 80% of use cases in 20KB.
 *
 * ── Development time ──────────────────────────────────────────────────────────
 *
 *   Week 1-2: LaTeX tokenizer + AST
 *   Week 3-4: Common subset → MathML output
 *             (fractions, roots, sums, integrals, matrices, Greek)
 *   Week 5:   temml wrapper for complete coverage
 *   Week 6:   AriannA Real/Virtual integration (render inline in Real nodes)
 *
 *   Total: 6 weeks for complete coverage.
 *   The tokenizer + AST is the foundation — do it right.
 *
 * ── Key use case: Horizon + Hiram ─────────────────────────────────────────────
 *
 *   Horizon needs formula display for data lineage rules.
 *   Hiram needs cadastral calculations displayed with proper notation.
 *   Latex is therefore a BUSINESS-CRITICAL addon, not academic.
 *
 * @example
 *   Core.use(Latex);
 *
 *   // Render LaTeX inline in a Real node
 *   Real("#formula").latex("E = mc^2");
 *   Real("#integral").latex("\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}");
 *
 *   // Render to MathML string
 *   const mathml = Latex.toMathML("x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}");
 *
 *   // Render to SVG (for environments without MathML support)
 *   const svg = Latex.toSVG("\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}");
 *
 *   // Reactive — update formula when State changes
 *   const state = new State({ formula: "E = mc^2" });
 *   const el    = Real("#display");
 *   state.subscribe(() => el.latex(state.State.formula));
 */

import { Core } from "../core/index.ts";

// ── Basic LaTeX → MathML subset ───────────────────────────────────────────────

const GREEK: Record<string, string> = {
  alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",zeta:"ζ",eta:"η",theta:"θ",
  iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",pi:"π",rho:"ρ",sigma:"σ",
  tau:"τ",upsilon:"υ",phi:"φ",chi:"χ",psi:"ψ",omega:"ω",
  Alpha:"Α",Beta:"Β",Gamma:"Γ",Delta:"Δ",Theta:"Θ",Lambda:"Λ",Pi:"Π",
  Sigma:"Σ",Phi:"Φ",Psi:"Ψ",Omega:"Ω",
};

const OPS: Record<string, string> = {
  "\pm":"±","\times":"×","\div":"÷","\leq":"≤","\geq":"≥","\neq":"≠",
  "\approx":"≈","\infty":"∞","\partial":"∂","\nabla":"∇","\forall":"∀",
  "\exists":"∃","\in":"∈","\notin":"∉","\subset":"⊂","\supset":"⊃",
  "\cup":"∪","\cap":"∩","\cdot":"·","\ldots":"…","\cdots":"⋯",
};

export const Latex = {
  /** Convert LaTeX string to MathML string */
  toMathML(latex: string): string {
    // Basic subset — fractions, powers, subscripts, Greek, operators
    let s = latex.trim();

    // Replace Greek letters
    for (const [cmd, char] of Object.entries(GREEK)) {
      s = s.replace(new RegExp(`\\${cmd}\b`, "g"), `<mi>${char}</mi>`);
    }

    // Replace operators
    for (const [cmd, char] of Object.entries(OPS)) {
      s = s.replace(new RegExp(cmd.replace(/\\/g, "\\\\"), "g"), `<mo>${char}</mo>`);
    }

    // Fractions: rac{a}{b}
    s = s.replace(/\frac\{([^}]+)\}\{([^}]+)\}/g, "<mfrac><mrow>$1</mrow><mrow>$2</mrow></mfrac>");

    // Square root: \sqrt{x}
    s = s.replace(/\sqrt\{([^}]+)\}/g, "<msqrt><mrow>$1</mrow></msqrt>");

    // Superscript: x^{...} or x^y
    s = s.replace(/\{([^}]+)\}\^\{([^}]+)\}/g, "<msup><mrow>$1</mrow><mrow>$2</mrow></msup>");
    s = s.replace(/(\w)\^(\w)/g, "<msup><mi>$1</mi><mi>$2</mi></msup>");

    // Subscript: x_{...} or x_y
    s = s.replace(/\{([^}]+)\}_\{([^}]+)\}/g, "<msub><mrow>$1</mrow><mrow>$2</mrow></msub>");
    s = s.replace(/(\w)_(\w)/g, "<msub><mi>$1</mi><mi>$2</mi></msub>");

    // Sum/integral
    s = s.replace(/\sum/g, "<mo>∑</mo>");
    s = s.replace(/\int/g, "<mo>∫</mo>");
    s = s.replace(/\prod/g, "<mo>∏</mo>");
    s = s.replace(/\lim/g, "<mo>lim</mo>");

    // Numbers and plain letters
    s = s.replace(/(\d+)/g, "<mn>$1</mn>");
    s = s.replace(/([a-zA-Z](?!>|<))/g, "<mi>$1</mi>");

    // Remove extra {}
    s = s.replace(/\{([^{}]*)\}/g, "$1");

    return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>${s}</mrow></math>`;
  },

  /** Render LaTeX into an HTML element */
  render(el: Element, latex: string): void {
    el.innerHTML = Latex.toMathML(latex);
  },
};

// ── Plugin ────────────────────────────────────────────────────────────────────

export const LateX = {
  name: "LateX", version: "0.1.0",
  install(core: typeof Core): void {
    try { Object.defineProperty(window, "Latex", { value: Latex, writable: false, enumerable: false, configurable: false }); } catch {}
  },
};
export default LateX;
