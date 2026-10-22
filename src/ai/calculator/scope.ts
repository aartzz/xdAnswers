// src/ai/calculator/scope.ts
// Math primitives and constants exposed to the calculator evaluator.
(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const MATH_SCOPE: Record<string, unknown> = {
        Math: Math,
        PI: Math.PI,
        E: Math.E,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        atan2: Math.atan2,
        sinh: Math.sinh,
        cosh: Math.cosh,
        tanh: Math.tanh,
        cot: function(x: number) { return 1 / Math.tan(x); },
        ctg: function(x: number) { return 1 / Math.tan(x); },
        tg: Math.tan,
        sqrt: Math.sqrt,
        cbrt: Math.cbrt,
        abs: Math.abs,
        pow: Math.pow,
        exp: Math.exp,
        ln: Math.log,
        log: Math.log10,
        lg: Math.log10,
        log10: Math.log10,
        log2: Math.log2,
        min: Math.min,
        max: Math.max,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        factorial: function(n: number) {
            n = Math.round(Number(n));
            if (n < 0 || !isFinite(n)) return NaN;
            if (n === 0 || n === 1) return 1;
            if (n > 170) return Infinity;
            let r = 1;
            for (let i = 2; i <= n; i++) r *= i;
            return r;
        },
        comb: function(n: number, k: number) {
            n = Math.round(Number(n));
            k = Math.round(Number(k));
            if (k < 0 || k > n) return 0;
            if (k === 0 || k === n) return 1;
            k = Math.min(k, n - k);
            let c = 1;
            for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
            return Math.round(c);
        },
        perm: function(n: number, k: number) {
            n = Math.round(Number(n));
            k = Math.round(Number(k));
            if (k < 0 || k > n) return 0;
            let p = 1;
            for (let i = 0; i < k; i++) p *= (n - i);
            return p;
        },
        gcd: function(a: number, b: number) {
            a = Math.abs(Math.round(a));
            b = Math.abs(Math.round(b));
            while (b) { const t = b; b = a % b; a = t; }
            return a;
        },
        lcm: function(a: number, b: number) {
            if (!a || !b) return 0;
            return Math.abs(Math.round(a * b)) / (MATH_SCOPE.gcd as (a: number, b: number) => number)(a, b);
        }
    };

    window.xdAnswers._internal.MATH_SCOPE = MATH_SCOPE;
})();
