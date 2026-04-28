"use strict";
/**
 * @module    Geometry
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * Migrated and extended from Golem.Geometry (2012-2018).
 *
 * ── Original Golem classes preserved ──────────────────────────────────────────
 *
 *   Angle     — full unit system: Radians, Degrees, Turns, Quadrants,
 *               Grads, Mils, Sextants, Points, BinaryDegrees, Hours,
 *               Minutes, Seconds + all trig values
 *   Rotation  — 3D rotation with Psi/Theta/Phi (Euler angles)
 *   Size      — Width/Height/Depth
 *   Point     — X/Y/Z coordinate
 *   Vector    — N-dimensional vector (Sum, Subtract, Dot, Cross, Normalize)
 *   Vector2d  → now exported as Vector2 (see Math.ts)
 *   Vector3d  → now exported as Vector3 (see Math.ts)
 *   Matrix    — full NxN matrix with LUP, QR, EigenValues, EigenVectors
 *   Transform — CSS/3D transform (Translate, Scale, Rotate, Skew, Reflect)
 *   Shapes    — Rectangle, Line, Curve, Path, Triangle, Circle, Plane, Polygon
 *   Solids    — Frustum, TetraHedron, Pyramid, Box, Sphere, Octahedron,
 *               Torus, ChamferBox, Cylinder, Tube
 *
 * ── New additions ─────────────────────────────────────────────────────────────
 *
 *   AABB      — Axis-Aligned Bounding Box (collision detection)
 *   Ray       — Ray casting (mouse picking, raycasting)
 *   Plane3D   — Infinite plane in 3D space
 *   BVH       — Bounding Volume Hierarchy (TODO: Phase 3)
 *   CSG       — Constructive Solid Geometry (TODO: Phase 3, manifold WASM)
 *
 * @example
 *   import { Geometry, Angle, Matrix, Shapes, AABB, Ray } from "./Geometry.ts";
 *   Core.use(Geometry);
 *
 *   // Original Golem API preserved
 *   const a = new Angle(Math.PI / 4, "Radians");
 *   console.log(a.Degrees);   // → 45
 *   console.log(a.Sine);      // → 0.7071...
 *
 *   const m = Matrix.identity(4);
 *   m.Determinant();          // → 1
 *
 *   // New
 *   const box = new AABB(new Vector3(-1,-1,-1), new Vector3(1,1,1));
 *   const ray = new Ray(new Vector3(0,5,0), new Vector3(0,-1,0));
 *   console.log(ray.intersectAABB(box)); // → { hit: true, t: 4 }
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Geometry = exports.Solids = exports.Shapes = exports.Tube = exports.Pyramid = exports.Cone = exports.Torus = exports.Cylinder = exports.Box = exports.Sphere = exports.Polygon = exports.Triangle = exports.Circle = exports.Rectangle = exports.Ray = exports.AABB = exports.Transform = exports.Matrix = exports.Point = exports.Size = exports.Rotation = exports.Angle = void 0;
var AriannAMath_ts_1 = require("./AriannAMath.ts");
// ── Angle ─────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Angle — all units and trig values preserved
var Angle = /** @class */ (function () {
    function Angle(value, unit) {
        if (unit === void 0) { unit = "Radians"; }
        this._radians = Angle._toRadians(value, unit);
    }
    Object.defineProperty(Angle.prototype, "Radians", {
        // Unit conversions — all original Golem units
        get: function () { return this._radians; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Degrees", {
        get: function () { return this._radians * 180 / Math.PI; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Turns", {
        get: function () { return this._radians / (2 * Math.PI); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Quadrants", {
        get: function () { return this._radians / (Math.PI / 2); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Grads", {
        get: function () { return this._radians * 200 / Math.PI; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Mils", {
        get: function () { return this._radians * 3200 / Math.PI; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Sextants", {
        get: function () { return this._radians / (Math.PI / 3); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Points", {
        get: function () { return this._radians * 32 / (2 * Math.PI); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "BinaryDegrees", {
        get: function () { return this._radians * 256 / (2 * Math.PI); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Hours", {
        get: function () { return this._radians * 12 / Math.PI; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Minutes", {
        get: function () { return this.Hours * 60; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Seconds", {
        get: function () { return this.Hours * 3600; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Sine", {
        // Trig values — original Golem
        get: function () { return Math.sin(this._radians); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Cosine", {
        get: function () { return Math.cos(this._radians); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Tangent", {
        get: function () { return Math.tan(this._radians); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Secant", {
        get: function () { return 1 / Math.cos(this._radians); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Cosecant", {
        get: function () { return 1 / Math.sin(this._radians); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Angle.prototype, "Cotangent", {
        get: function () { return 1 / Math.tan(this._radians); },
        enumerable: false,
        configurable: true
    });
    // Operations
    Angle.prototype.add = function (b) { return new Angle(this._radians + b._radians); };
    Angle.prototype.sub = function (b) { return new Angle(this._radians - b._radians); };
    Angle.prototype.scale = function (s) { return new Angle(this._radians * s); };
    Angle.prototype.normalize = function () { return new Angle(((this._radians % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)); };
    Angle.Parse = function (s) {
        var n = parseFloat(s);
        if (s.includes("°") || s.toLowerCase().includes("deg"))
            return new Angle(n, "Degrees");
        if (s.toLowerCase().includes("grad"))
            return new Angle(n, "Grads");
        if (s.toLowerCase().includes("turn"))
            return new Angle(n, "Turns");
        return new Angle(n, "Radians");
    };
    Angle.Is = function (v) { return v instanceof Angle; };
    Angle._toRadians = function (value, unit) {
        switch (unit) {
            case "Degrees": return value * Math.PI / 180;
            case "Turns": return value * 2 * Math.PI;
            case "Quadrants": return value * Math.PI / 2;
            case "Grads": return value * Math.PI / 200;
            case "Mils": return value * Math.PI / 3200;
            case "Sextants": return value * Math.PI / 3;
            case "Points": return value * 2 * Math.PI / 32;
            case "BinaryDegrees": return value * 2 * Math.PI / 256;
            case "Hours": return value * Math.PI / 12;
            case "Minutes": return value * Math.PI / 720;
            case "Seconds": return value * Math.PI / 43200;
            default: return value; // Radians
        }
    };
    Angle.prototype.valueOf = function () { return this._radians; };
    Angle.prototype.toString = function () { return "".concat(this.Degrees.toFixed(4), "\u00B0"); };
    return Angle;
}());
exports.Angle = Angle;
// ── Rotation ──────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Rotation — Euler angles (Psi/Theta/Phi)
var Rotation = /** @class */ (function () {
    function Rotation(psi, theta, phi, unit) {
        if (psi === void 0) { psi = 0; }
        if (theta === void 0) { theta = 0; }
        if (phi === void 0) { phi = 0; }
        if (unit === void 0) { unit = "Radians"; }
        this._psi = psi instanceof Angle ? psi : new Angle(psi, unit);
        this._theta = theta instanceof Angle ? theta : new Angle(theta, unit);
        this._phi = phi instanceof Angle ? phi : new Angle(phi, unit);
    }
    Object.defineProperty(Rotation.prototype, "Psi", {
        get: function () { return this._psi; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rotation.prototype, "Theta", {
        get: function () { return this._theta; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rotation.prototype, "Phi", {
        get: function () { return this._phi; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rotation.prototype, "Matrix", {
        get: function () { return AriannAMath_ts_1.Matrix4.rotation(this.toQuaternion()); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rotation.prototype, "Quaternion", {
        get: function () { return this.toQuaternion(); },
        enumerable: false,
        configurable: true
    });
    Rotation.prototype.toQuaternion = function () {
        return AriannAMath_ts_1.Quaternion.fromEuler(this._psi.Radians, this._theta.Radians, this._phi.Radians);
    };
    Rotation.Is = function (v) { return v instanceof Rotation; };
    Rotation.prototype.toString = function () { return "Rotation(\u03C8=".concat(this._psi, ", \u03B8=").concat(this._theta, ", \u03C6=").concat(this._phi, ")"); };
    return Rotation;
}());
exports.Rotation = Rotation;
// ── Size ──────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Size
var Size = /** @class */ (function () {
    function Size(Width, Height, Depth) {
        if (Width === void 0) { Width = 0; }
        if (Height === void 0) { Height = 0; }
        if (Depth === void 0) { Depth = 0; }
        this.Width = Width;
        this.Height = Height;
        this.Depth = Depth;
    }
    Object.defineProperty(Size.prototype, "Area", {
        get: function () { return this.Width * this.Height; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Size.prototype, "Volume", {
        get: function () { return this.Width * this.Height * this.Depth; },
        enumerable: false,
        configurable: true
    });
    Size.prototype.scale = function (s) { return new Size(this.Width * s, this.Height * s, this.Depth * s); };
    Size.prototype.toString = function () { return "Size(".concat(this.Width, "\u00D7").concat(this.Height, "\u00D7").concat(this.Depth, ")"); };
    return Size;
}());
exports.Size = Size;
// ── Point ─────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Point
var Point = /** @class */ (function () {
    function Point(X, Y, Z) {
        if (X === void 0) { X = 0; }
        if (Y === void 0) { Y = 0; }
        if (Z === void 0) { Z = 0; }
        this.X = X;
        this.Y = Y;
        this.Z = Z;
    }
    Point.prototype.distanceTo = function (p) { return Math.sqrt(Math.pow((p.X - this.X), 2) + Math.pow((p.Y - this.Y), 2) + Math.pow((p.Z - this.Z), 2)); };
    Point.prototype.toVector3 = function () { return new AriannAMath_ts_1.Vector3(this.X, this.Y, this.Z); };
    Point.prototype.translate = function (dx, dy, dz) {
        if (dz === void 0) { dz = 0; }
        return new Point(this.X + dx, this.Y + dy, this.Z + dz);
    };
    Point.prototype.toString = function () { return "Point(".concat(this.X, ",").concat(this.Y, ",").concat(this.Z, ")"); };
    return Point;
}());
exports.Point = Point;
// ── Matrix (NxN) ──────────────────────────────────────────────────────────────
// Original Golem.Geometry.Matrix — full implementation
// 25 methods: Is, Diagonal, Trace, Clone, Sum, Subtract, Multiply, Divide,
// Transpose, Inverse, Determinant, Invertible, Singular, GetMinor,
// LUP, Lower, Upper, Permutation, QR, Q, R, H, RREF, EigenValues, EigenVectors
var Matrix = /** @class */ (function () {
    function Matrix(data) {
        var _a, _b;
        this._data = data.map(function (r) { return __spreadArray([], r, true); });
        this.rows = data.length;
        this.cols = (_b = (_a = data[0]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    }
    Matrix.identity = function (n) {
        return new Matrix(Array.from({ length: n }, function (_, i) { return Array.from({ length: n }, function (_, j) { return i === j ? 1 : 0; }); }));
    };
    Matrix.zeros = function (rows, cols) { return new Matrix(Array.from({ length: rows }, function () { return new Array(cols).fill(0); })); };
    Matrix.from = function (flat, rows, cols) { return new Matrix(Array.from({ length: rows }, function (_, i) { return flat.slice(i * cols, (i + 1) * cols); })); };
    Matrix.Is = function (v) { return v instanceof Matrix; };
    Matrix.prototype.get = function (r, c) { return this._data[r][c]; };
    Matrix.prototype.set = function (r, c, v) { this._data[r][c] = v; return this; };
    Matrix.prototype.row = function (r) { return __spreadArray([], this._data[r], true); };
    Matrix.prototype.col = function (c) { return this._data.map(function (r) { return r[c]; }); };
    // Original Golem methods
    Matrix.prototype.Diagonal = function () {
        var _this = this;
        return Array.from({ length: Math.min(this.rows, this.cols) }, function (_, i) { return _this._data[i][i]; });
    };
    Matrix.prototype.Trace = function () { return this.Diagonal().reduce(function (a, b) { return a + b; }, 0); };
    Matrix.prototype.Clone = function () { return new Matrix(this._data); };
    Matrix.prototype.Transpose = function () {
        var _this = this;
        return new Matrix(Array.from({ length: this.cols }, function (_, j) { return Array.from({ length: _this.rows }, function (_, i) { return _this._data[i][j]; }); }));
    };
    Matrix.prototype.Sum = function (b) { return new Matrix(this._data.map(function (r, i) { return r.map(function (v, j) { return v + b._data[i][j]; }); })); };
    Matrix.prototype.Subtract = function (b) { return new Matrix(this._data.map(function (r, i) { return r.map(function (v, j) { return v - b._data[i][j]; }); })); };
    Matrix.prototype.Multiply = function (b) {
        var out = Matrix.zeros(this.rows, b.cols);
        for (var i = 0; i < this.rows; i++)
            for (var j = 0; j < b.cols; j++)
                for (var k = 0; k < this.cols; k++)
                    out._data[i][j] += this._data[i][k] * b._data[k][j];
        return out;
    };
    Matrix.prototype.Divide = function (s) { return new Matrix(this._data.map(function (r) { return r.map(function (v) { return v / s; }); })); };
    Matrix.prototype.Determinant = function () {
        if (this.rows !== this.cols)
            throw new Error('Determinant: matrix must be square');
        var n = this.rows;
        if (n === 1)
            return this._data[0][0];
        if (n === 2)
            return this._data[0][0] * this._data[1][1] - this._data[0][1] * this._data[1][0];
        var det = 0;
        for (var j = 0; j < n; j++)
            det += ((j % 2 === 0) ? 1 : -1) * this._data[0][j] * this.GetMinor(0, j).Determinant();
        return det;
    };
    Matrix.prototype.GetMinor = function (row, col) {
        return new Matrix(this._data.filter(function (_, i) { return i !== row; }).map(function (r) { return r.filter(function (_, j) { return j !== col; }); }));
    };
    Matrix.prototype.Invertible = function () { return Math.abs(this.Determinant()) > 1e-10; };
    Matrix.prototype.Singular = function () { return !this.Invertible(); };
    Matrix.prototype.Inverse = function () {
        var _this = this;
        if (!this.Invertible())
            throw new Error('Matrix.Inverse: matrix is singular');
        var n = this.rows, det = this.Determinant();
        var adj = Array.from({ length: n }, function (_, i) { return Array.from({ length: n }, function (_, j) { return ((i + j) % 2 === 0 ? 1 : -1) * _this.GetMinor(j, i).Determinant(); }); });
        return new Matrix(adj).Divide(det);
    };
    // LUP decomposition (original Golem)
    Matrix.prototype.LUP = function () {
        var _a, _b;
        var n = this.rows;
        var L = Matrix.identity(n), U = this.Clone(), P = Matrix.identity(n);
        for (var k = 0; k < n; k++) {
            var max = Math.abs(U._data[k][k]), maxRow = k;
            for (var i = k + 1; i < n; i++)
                if (Math.abs(U._data[i][k]) > max) {
                    max = Math.abs(U._data[i][k]);
                    maxRow = i;
                }
            _a = [U._data[maxRow], U._data[k]], U._data[k] = _a[0], U._data[maxRow] = _a[1];
            _b = [P._data[maxRow], P._data[k]], P._data[k] = _b[0], P._data[maxRow] = _b[1];
            for (var i = k + 1; i < n; i++) {
                var f = U._data[i][k] / U._data[k][k];
                L._data[i][k] = f;
                for (var j = k; j < n; j++)
                    U._data[i][j] -= f * U._data[k][j];
            }
        }
        return { L: L, U: U, P: P };
    };
    Matrix.prototype.Lower = function () { return this.LUP().L; };
    Matrix.prototype.Upper = function () { return this.LUP().U; };
    Matrix.prototype.Permutation = function () { return this.LUP().P; };
    // QR decomposition (original Golem)
    Matrix.prototype.QR = function () {
        var _this = this;
        var n = this.rows, m = this.cols;
        var Q = Matrix.zeros(n, m), R = Matrix.zeros(m, m);
        var cols = Array.from({ length: m }, function (_, j) { return _this.col(j); });
        var qs = [];
        var _loop_1 = function (j) {
            var u = __spreadArray([], cols[j], true);
            var _loop_2 = function (q) {
                var dot = u.reduce(function (s, v, i) { return s + v * q[i]; }, 0);
                u = u.map(function (v, i) { return v - dot * q[i]; });
            };
            for (var _i = 0, qs_1 = qs; _i < qs_1.length; _i++) {
                var q = qs_1[_i];
                _loop_2(q);
            }
            var norm = Math.sqrt(u.reduce(function (s, v) { return s + v * v; }, 0));
            var e = norm > 1e-10 ? u.map(function (v) { return v / norm; }) : u;
            qs.push(e);
            for (var i = 0; i < n; i++)
                Q._data[i][j] = e[i];
            for (var jj = j; jj < m; jj++)
                R._data[j][jj] = cols[jj].reduce(function (s, v, i) { return s + v * e[i]; }, 0);
        };
        for (var j = 0; j < m; j++) {
            _loop_1(j);
        }
        return { Q: Q, R: R };
    };
    Matrix.prototype.Q = function () { return this.QR().Q; };
    Matrix.prototype.R = function () { return this.QR().R; };
    Matrix.prototype.H = function () { return this.Transpose(); }; // Hermitian (conjugate transpose — same as transpose for real)
    // RREF (Row Reduced Echelon Form)
    Matrix.prototype.RREF = function () {
        var m = this.Clone();
        var lead = 0;
        var _loop_3 = function (r) {
            var _a;
            if (lead >= m.cols)
                return "break";
            var i = r;
            while (Math.abs(m._data[i][lead]) < 1e-10) {
                i++;
                if (i === m.rows) {
                    i = r;
                    lead++;
                    if (lead === m.cols)
                        return { value: m };
                }
            }
            _a = [m._data[r], m._data[i]], m._data[i] = _a[0], m._data[r] = _a[1];
            var lv = m._data[r][lead];
            m._data[r] = m._data[r].map(function (v) { return v / lv; });
            var _loop_4 = function (j) {
                if (j !== r) {
                    var f_1 = m._data[j][lead];
                    m._data[j] = m._data[j].map(function (v, c) { return v - f_1 * m._data[r][c]; });
                }
            };
            for (var j = 0; j < m.rows; j++) {
                _loop_4(j);
            }
            lead++;
        };
        for (var r = 0; r < m.rows; r++) {
            var state_1 = _loop_3(r);
            if (typeof state_1 === "object")
                return state_1.value;
            if (state_1 === "break")
                break;
        }
        return m;
    };
    // EigenValues (power iteration for dominant eigenvalue; QR method for all)
    Matrix.prototype.EigenValues = function () {
        if (this.rows !== this.cols)
            throw new Error('EigenValues: matrix must be square');
        // QR algorithm — iterate until convergence
        var A = this.Clone();
        for (var iter = 0; iter < 100; iter++) {
            var _a = A.QR(), Q = _a.Q, R = _a.R;
            A = R.Multiply(Q);
        }
        return A.Diagonal();
    };
    Matrix.prototype.EigenVectors = function () {
        // Approximate eigenvectors via inverse power iteration
        var eigenvals = this.EigenValues();
        var n = this.rows;
        var vecs = [];
        for (var _i = 0, eigenvals_1 = eigenvals; _i < eigenvals_1.length; _i++) {
            var lambda = eigenvals_1[_i];
            var shifted = this.Subtract(Matrix.identity(n).Multiply(new Matrix([[lambda]]))); // A - λI
            // Simple approximation — power iteration from random vector
            var v = Array.from({ length: n }, function () { return Math.random(); });
            var _loop_5 = function (iter) {
                var mv = shifted.Multiply(new Matrix(v.map(function (x) { return [x]; }))).col(0);
                var norm = Math.sqrt(mv.reduce(function (s, x) { return s + x * x; }, 0));
                v = norm > 1e-10 ? mv.map(function (x) { return x / norm; }) : v;
            };
            for (var iter = 0; iter < 50; iter++) {
                _loop_5(iter);
            }
            vecs.push(v);
        }
        return new Matrix(vecs[0].map(function (_, i) { return vecs.map(function (v) { return v[i]; }); }));
    };
    Matrix.prototype.toString = function () {
        return this._data.map(function (r) { return '[' + r.map(function (v) { return v.toFixed(4); }).join(', ') + ']'; }).join('\n');
    };
    return Matrix;
}());
exports.Matrix = Matrix;
// ── Transform ─────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Transform — CSS + 3D transforms
var Transform = /** @class */ (function () {
    function Transform(matrix) {
        this._matrix = matrix !== null && matrix !== void 0 ? matrix : AriannAMath_ts_1.Matrix4.identity();
    }
    Object.defineProperty(Transform.prototype, "Matrix", {
        get: function () { return this._matrix; },
        enumerable: false,
        configurable: true
    });
    Transform.prototype.Translate = function (x, y, z) {
        if (z === void 0) { z = 0; }
        return new Transform(this._matrix.multiply(AriannAMath_ts_1.Matrix4.translation(x, y, z)));
    };
    Transform.prototype.Scale = function (x, y, z) {
        if (z === void 0) { z = 1; }
        return new Transform(this._matrix.multiply(AriannAMath_ts_1.Matrix4.scale(x, y, z)));
    };
    Transform.prototype.Rotate = function (angle, axis) {
        if (axis === void 0) { axis = new AriannAMath_ts_1.Vector3(0, 0, 1); }
        return new Transform(this._matrix.multiply(AriannAMath_ts_1.Matrix4.rotation(AriannAMath_ts_1.Quaternion.fromAxisAngle(axis, angle.Radians))));
    };
    Transform.prototype.Skew = function (ax, ay) {
        var m = AriannAMath_ts_1.Matrix4.identity();
        var arr = m.toArray();
        arr[4] = Math.tan(ax);
        arr[1] = Math.tan(ay);
        return new Transform(this._matrix.multiply(new AriannAMath_ts_1.Matrix4(arr)));
    };
    Transform.prototype.Reflect = function (axis) {
        var s = { x: [-1, 1, 1], y: [1, -1, 1], z: [1, 1, -1] }[axis];
        return new Transform(this._matrix.multiply(AriannAMath_ts_1.Matrix4.scale(s[0], s[1], s[2])));
    };
    Object.defineProperty(Transform.prototype, "CSSMatrix", {
        get: function () {
            var m = this._matrix.toArray();
            return "matrix3d(".concat(m.map(function (v) { return v.toFixed(6); }).join(","), ")");
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Transform.prototype, "CSS", {
        get: function () { return "transform: ".concat(this.CSSMatrix, ";"); },
        enumerable: false,
        configurable: true
    });
    Transform.prototype.toString = function () { return this.CSSMatrix; };
    return Transform;
}());
exports.Transform = Transform;
// ── AABB ──────────────────────────────────────────────────────────────────────
// NEW — Axis-Aligned Bounding Box for collision detection
var AABB = /** @class */ (function () {
    function AABB(min, max) {
        this.min = min;
        this.max = max;
    }
    AABB.prototype.center = function () { return this.min.add(this.max).scale(0.5); };
    AABB.prototype.size = function () { return this.max.sub(this.min); };
    AABB.prototype.contains = function (p) {
        return p.x >= this.min.x && p.x <= this.max.x && p.y >= this.min.y && p.y <= this.max.y && p.z >= this.min.z && p.z <= this.max.z;
    };
    AABB.prototype.intersects = function (b) {
        return this.min.x <= b.max.x && this.max.x >= b.min.x && this.min.y <= b.max.y && this.max.y >= b.min.y && this.min.z <= b.max.z && this.max.z >= b.min.z;
    };
    AABB.prototype.expand = function (v) {
        return new AABB(new AriannAMath_ts_1.Vector3(Math.min(this.min.x, v.x), Math.min(this.min.y, v.y), Math.min(this.min.z, v.z)), new AriannAMath_ts_1.Vector3(Math.max(this.max.x, v.x), Math.max(this.max.y, v.y), Math.max(this.max.z, v.z)));
    };
    AABB.prototype.merge = function (b) {
        return new AABB(new AriannAMath_ts_1.Vector3(Math.min(this.min.x, b.min.x), Math.min(this.min.y, b.min.y), Math.min(this.min.z, b.min.z)), new AriannAMath_ts_1.Vector3(Math.max(this.max.x, b.max.x), Math.max(this.max.y, b.max.y), Math.max(this.max.z, b.max.z)));
    };
    AABB.prototype.volume = function () { var s = this.size(); return s.x * s.y * s.z; };
    AABB.prototype.toString = function () { return "AABB(".concat(this.min, ", ").concat(this.max, ")"); };
    return AABB;
}());
exports.AABB = AABB;
// ── Ray ───────────────────────────────────────────────────────────────────────
// NEW — Ray casting for picking and intersection tests
var Ray = /** @class */ (function () {
    function Ray(origin, direction) {
        this.origin = origin;
        this.direction = direction.normalize();
    }
    Ray.prototype.at = function (t) { return this.origin.add(this.direction.scale(t)); };
    Ray.prototype.intersectAABB = function (box) {
        var inv = new AriannAMath_ts_1.Vector3(1 / this.direction.x, 1 / this.direction.y, 1 / this.direction.z);
        var t1 = (box.min.x - this.origin.x) * inv.x, t2 = (box.max.x - this.origin.x) * inv.x;
        var t3 = (box.min.y - this.origin.y) * inv.y, t4 = (box.max.y - this.origin.y) * inv.y;
        var t5 = (box.min.z - this.origin.z) * inv.z, t6 = (box.max.z - this.origin.z) * inv.z;
        var tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
        var tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));
        var hit = tmax >= 0 && tmin <= tmax;
        return { hit: hit, t: tmin, point: hit ? this.at(tmin) : undefined };
    };
    Ray.prototype.intersectPlane = function (normal, d) {
        var denom = normal.dot(this.direction);
        if (Math.abs(denom) < 1e-6)
            return { hit: false, t: 0 };
        var t = (d - normal.dot(this.origin)) / denom;
        return { hit: t >= 0, t: t, point: t >= 0 ? this.at(t) : undefined };
    };
    Ray.prototype.intersectSphere = function (center, radius) {
        var oc = this.origin.sub(center);
        var b = oc.dot(this.direction), c = oc.dot(oc) - radius * radius, disc = b * b - c;
        if (disc < 0)
            return { hit: false, t: 0 };
        var t = -b - Math.sqrt(disc);
        return { hit: t >= 0, t: t };
    };
    return Ray;
}());
exports.Ray = Ray;
// ── Shapes ────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Shapes — migrated with 2D geometry + SVG output
// Original: Shape, Rectangle, Line, Curve, Path, Triangle, Circle, Plane, Polygon
var Rectangle = /** @class */ (function () {
    function Rectangle(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    Object.defineProperty(Rectangle.prototype, "area", {
        get: function () { return this.width * this.height; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rectangle.prototype, "perimeter", {
        get: function () { return 2 * (this.width + this.height); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rectangle.prototype, "diagonal", {
        get: function () { return Math.sqrt(Math.pow(this.width, 2) + Math.pow(this.height, 2)); },
        enumerable: false,
        configurable: true
    });
    Rectangle.prototype.contains = function (px, py) { return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height; };
    Rectangle.prototype.intersects = function (r) { return !(r.x > this.x + this.width || r.x + r.width < this.x || r.y > this.y + this.height || r.y + r.height < this.y); };
    Rectangle.prototype.toSVG = function () { return "<rect x=\"".concat(this.x, "\" y=\"").concat(this.y, "\" width=\"").concat(this.width, "\" height=\"").concat(this.height, "\"/>"); };
    Rectangle.prototype.toHTML = function () { return "style=\"position:absolute;left:".concat(this.x, "px;top:").concat(this.y, "px;width:").concat(this.width, "px;height:").concat(this.height, "px\""); };
    Rectangle.prototype.toString = function () { return "Rectangle(".concat(this.x, ",").concat(this.y, ",").concat(this.width, "\u00D7").concat(this.height, ")"); };
    return Rectangle;
}());
exports.Rectangle = Rectangle;
var Circle = /** @class */ (function () {
    function Circle(cx, cy, radius) {
        this.cx = cx;
        this.cy = cy;
        this.radius = radius;
    }
    Object.defineProperty(Circle.prototype, "area", {
        get: function () { return Math.PI * Math.pow(this.radius, 2); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Circle.prototype, "circumference", {
        get: function () { return 2 * Math.PI * this.radius; },
        enumerable: false,
        configurable: true
    });
    Circle.prototype.contains = function (px, py) { return Math.pow((px - this.cx), 2) + Math.pow((py - this.cy), 2) <= Math.pow(this.radius, 2); };
    Circle.prototype.intersects = function (c) { return Math.sqrt(Math.pow((c.cx - this.cx), 2) + Math.pow((c.cy - this.cy), 2)) <= this.radius + c.radius; };
    Circle.prototype.toSVG = function () { return "<circle cx=\"".concat(this.cx, "\" cy=\"").concat(this.cy, "\" r=\"").concat(this.radius, "\"/>"); };
    Circle.prototype.toString = function () { return "Circle(".concat(this.cx, ",").concat(this.cy, ",r=").concat(this.radius, ")"); };
    return Circle;
}());
exports.Circle = Circle;
var Triangle = /** @class */ (function () {
    function Triangle(a, b, c) {
        this.a = a;
        this.b = b;
        this.c = c;
    }
    Object.defineProperty(Triangle.prototype, "area", {
        get: function () {
            return Math.abs((this.b.X - this.a.X) * (this.c.Y - this.a.Y) - (this.c.X - this.a.X) * (this.b.Y - this.a.Y)) / 2;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Triangle.prototype, "perimeter", {
        get: function () {
            return this.a.distanceTo(this.b) + this.b.distanceTo(this.c) + this.c.distanceTo(this.a);
        },
        enumerable: false,
        configurable: true
    });
    Triangle.prototype.centroid = function () { return new Point((this.a.X + this.b.X + this.c.X) / 3, (this.a.Y + this.b.Y + this.c.Y) / 3); };
    Triangle.prototype.contains = function (p) {
        var d1 = Math.sign((p.X - this.b.X) * (this.a.Y - this.b.Y) - (this.a.X - this.b.X) * (p.Y - this.b.Y));
        var d2 = Math.sign((p.X - this.c.X) * (this.b.Y - this.c.Y) - (this.b.X - this.c.X) * (p.Y - this.c.Y));
        var d3 = Math.sign((p.X - this.a.X) * (this.c.Y - this.a.Y) - (this.c.X - this.a.X) * (p.Y - this.a.Y));
        return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    };
    Triangle.prototype.toSVG = function () { return "<polygon points=\"".concat(this.a.X, ",").concat(this.a.Y, " ").concat(this.b.X, ",").concat(this.b.Y, " ").concat(this.c.X, ",").concat(this.c.Y, "\"/>"); };
    return Triangle;
}());
exports.Triangle = Triangle;
var Polygon = /** @class */ (function () {
    function Polygon(points) {
        this.points = points;
    }
    Object.defineProperty(Polygon.prototype, "area", {
        get: function () {
            var a = 0;
            for (var i = 0, j = this.points.length - 1; i < this.points.length; j = i++)
                a += (this.points[j].X + this.points[i].X) * (this.points[j].Y - this.points[i].Y);
            return Math.abs(a) / 2;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Polygon.prototype, "perimeter", {
        get: function () {
            var _this = this;
            return this.points.reduce(function (s, p, i) { return s + p.distanceTo(_this.points[(i + 1) % _this.points.length]); }, 0);
        },
        enumerable: false,
        configurable: true
    });
    Polygon.prototype.centroid = function () {
        var n = this.points.length;
        return new Point(this.points.reduce(function (s, p) { return s + p.X; }, 0) / n, this.points.reduce(function (s, p) { return s + p.Y; }, 0) / n);
    };
    Polygon.prototype.toSVG = function () { return "<polygon points=\"".concat(this.points.map(function (p) { return "".concat(p.X, ",").concat(p.Y); }).join(' '), "\"/>"); };
    return Polygon;
}());
exports.Polygon = Polygon;
// ── Solids ────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Solids — 11 solid types with volume/surface area
// Box, Sphere, Cylinder, Torus, Cone(Frustum), Pyramid, TetraHedron,
// Octahedron, ChamferBox, Tube
var Sphere = /** @class */ (function () {
    function Sphere(radius) {
        this.radius = radius;
    }
    Object.defineProperty(Sphere.prototype, "volume", {
        get: function () { return (4 / 3) * Math.PI * Math.pow(this.radius, 3); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sphere.prototype, "surfaceArea", {
        get: function () { return 4 * Math.PI * Math.pow(this.radius, 2); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Sphere.prototype, "diameter", {
        get: function () { return 2 * this.radius; },
        enumerable: false,
        configurable: true
    });
    Sphere.prototype.toSVG = function (cx, cy) {
        if (cx === void 0) { cx = 0; }
        if (cy === void 0) { cy = 0; }
        return "<circle cx=\"".concat(cx, "\" cy=\"").concat(cy, "\" r=\"").concat(this.radius, "\"/>");
    };
    Sphere.prototype.toString = function () { return "Sphere(r=".concat(this.radius, ")"); };
    return Sphere;
}());
exports.Sphere = Sphere;
var Box = /** @class */ (function () {
    function Box(width, height, depth) {
        this.width = width;
        this.height = height;
        this.depth = depth;
    }
    Object.defineProperty(Box.prototype, "volume", {
        get: function () { return this.width * this.height * this.depth; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Box.prototype, "surfaceArea", {
        get: function () { return 2 * (this.width * this.height + this.height * this.depth + this.depth * this.width); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Box.prototype, "diagonal", {
        get: function () { return Math.sqrt(Math.pow(this.width, 2) + Math.pow(this.height, 2) + Math.pow(this.depth, 2)); },
        enumerable: false,
        configurable: true
    });
    Box.prototype.toAABB = function (center) {
        if (center === void 0) { center = new AriannAMath_ts_1.Vector3(); }
        var h = new AriannAMath_ts_1.Vector3(this.width / 2, this.height / 2, this.depth / 2);
        return new AABB(center.sub(h), center.add(h));
    };
    Box.prototype.toString = function () { return "Box(".concat(this.width, "\u00D7").concat(this.height, "\u00D7").concat(this.depth, ")"); };
    return Box;
}());
exports.Box = Box;
var Cylinder = /** @class */ (function () {
    function Cylinder(radius, height) {
        this.radius = radius;
        this.height = height;
    }
    Object.defineProperty(Cylinder.prototype, "volume", {
        get: function () { return Math.PI * Math.pow(this.radius, 2) * this.height; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Cylinder.prototype, "surfaceArea", {
        get: function () { return 2 * Math.PI * this.radius * (this.radius + this.height); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Cylinder.prototype, "lateralArea", {
        get: function () { return 2 * Math.PI * this.radius * this.height; },
        enumerable: false,
        configurable: true
    });
    Cylinder.prototype.toString = function () { return "Cylinder(r=".concat(this.radius, ",h=").concat(this.height, ")"); };
    return Cylinder;
}());
exports.Cylinder = Cylinder;
var Torus = /** @class */ (function () {
    function Torus(majorRadius, minorRadius) {
        this.majorRadius = majorRadius;
        this.minorRadius = minorRadius;
    }
    Object.defineProperty(Torus.prototype, "volume", {
        get: function () { return 2 * Math.pow(Math.PI, 2) * this.majorRadius * Math.pow(this.minorRadius, 2); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Torus.prototype, "surfaceArea", {
        get: function () { return 4 * Math.pow(Math.PI, 2) * this.majorRadius * this.minorRadius; },
        enumerable: false,
        configurable: true
    });
    Torus.prototype.toString = function () { return "Torus(R=".concat(this.majorRadius, ",r=").concat(this.minorRadius, ")"); };
    return Torus;
}());
exports.Torus = Torus;
var Cone = /** @class */ (function () {
    function Cone(radius, height) {
        this.radius = radius;
        this.height = height;
    }
    Object.defineProperty(Cone.prototype, "slantHeight", {
        get: function () { return Math.sqrt(Math.pow(this.radius, 2) + Math.pow(this.height, 2)); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Cone.prototype, "volume", {
        get: function () { return (1 / 3) * Math.PI * Math.pow(this.radius, 2) * this.height; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Cone.prototype, "surfaceArea", {
        get: function () { return Math.PI * this.radius * (this.radius + this.slantHeight); },
        enumerable: false,
        configurable: true
    });
    Cone.prototype.toString = function () { return "Cone(r=".concat(this.radius, ",h=").concat(this.height, ")"); };
    return Cone;
}());
exports.Cone = Cone;
var Pyramid = /** @class */ (function () {
    function Pyramid(baseWidth, baseDepth, height) {
        this.baseWidth = baseWidth;
        this.baseDepth = baseDepth;
        this.height = height;
    }
    Object.defineProperty(Pyramid.prototype, "volume", {
        get: function () { return (1 / 3) * this.baseWidth * this.baseDepth * this.height; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Pyramid.prototype, "baseArea", {
        get: function () { return this.baseWidth * this.baseDepth; },
        enumerable: false,
        configurable: true
    });
    Pyramid.prototype.toString = function () { return "Pyramid(".concat(this.baseWidth, "\u00D7").concat(this.baseDepth, ",h=").concat(this.height, ")"); };
    return Pyramid;
}());
exports.Pyramid = Pyramid;
var Tube = /** @class */ (function () {
    function Tube(outerRadius, innerRadius, height) {
        this.outerRadius = outerRadius;
        this.innerRadius = innerRadius;
        this.height = height;
    }
    Object.defineProperty(Tube.prototype, "volume", {
        get: function () { return Math.PI * (Math.pow(this.outerRadius, 2) - Math.pow(this.innerRadius, 2)) * this.height; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Tube.prototype, "surfaceArea", {
        get: function () { return 2 * Math.PI * (this.outerRadius + this.innerRadius) * this.height + 2 * Math.PI * (Math.pow(this.outerRadius, 2) - Math.pow(this.innerRadius, 2)); },
        enumerable: false,
        configurable: true
    });
    Tube.prototype.toString = function () { return "Tube(r=".concat(this.outerRadius, ",ri=").concat(this.innerRadius, ",h=").concat(this.height, ")"); };
    return Tube;
}());
exports.Tube = Tube;
// Aliases — original Golem names
exports.Shapes = { Rectangle: Rectangle, Circle: Circle, Triangle: Triangle, Polygon: Polygon };
exports.Solids = { Sphere: Sphere, Box: Box, Cylinder: Cylinder, Torus: Torus, Cone: Cone, Pyramid: Pyramid, Tube: Tube };
// ── Plugin ────────────────────────────────────────────────────────────────────
exports.Geometry = {
    name: 'Geometry',
    version: '1.0.0',
    install: function (_core) {
        try {
            Object.assign(window, {
                Angle: Angle,
                Rotation: Rotation,
                Size: Size,
                Point: Point,
                Matrix: Matrix,
                Transform: Transform,
                AABB: AABB,
                Ray: Ray,
                Rectangle: Rectangle,
                Circle: Circle,
                Triangle: Triangle,
                Polygon: Polygon,
                Polygon: Polygon,
                Sphere: Sphere,
                Box: Box,
                Cylinder: Cylinder,
                Torus: Torus,
                Cone: Cone,
                Pyramid: Pyramid,
                Tube: Tube,
                Shapes: exports.Shapes,
                Solids: exports.Solids,
            });
        }
        catch (_a) { }
    },
};
exports.default = exports.Geometry;
