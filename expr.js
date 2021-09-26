"use strict";
/* Copyright (c) 2021 Richard Rodger, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expr = void 0;
let Expr = function expr(jsonic, options) {
    const operators = {
        '#E+': '+',
        '#E-': '-',
        '#E*': '*',
        // '#E%': '%',
        '#E**': '**',
        '#E!': '!',
    };
    jsonic.options({
        fixed: {
            token: operators
        }
    });
    jsonic.options({
        fixed: {
            token: {
                '#E(': '(',
                '#E)': ')',
            }
        }
    });
    const OPERATORS = Object.keys(operators).map(tn => jsonic.token(tn));
    const novalopm = {
        [jsonic.token('#E-')]: {
            order: 1,
            src: '-',
            name: 'negative-prefix',
            // left: 14000,
            // right: 14000,
            left: 14000,
            right: 14000,
            tin: jsonic.token('#E-'),
            tkn: '#E-',
            prefix: true,
            suffix: false,
        },
    };
    const valopm = {
        [jsonic.token('#E+')]: {
            order: 2,
            src: '+',
            name: 'addition',
            left: 140,
            right: 150,
            tin: jsonic.token('#E+'),
            tkn: '#E+',
            prefix: false,
            suffix: false,
        },
        [jsonic.token('#E*')]: {
            order: 2,
            src: '*',
            name: 'multiplication',
            left: 160,
            right: 170,
            tin: jsonic.token('#E*'),
            tkn: '#E*',
            prefix: false,
            suffix: false,
        },
        [jsonic.token('#E**')]: {
            order: 2,
            src: '**',
            name: 'exponentiation',
            left: 1700,
            right: 1600,
            tin: jsonic.token('#E**'),
            tkn: '#E**',
            prefix: false,
            suffix: false,
        },
        [jsonic.token('#E!')]: {
            order: 1,
            src: '!',
            name: 'factorial-suffix',
            left: 15000,
            right: 15000,
            // left: 13000,
            // right: 13000,
            tin: jsonic.token('#E!'),
            tkn: '#E!',
            prefix: false,
            suffix: true,
        },
    };
    const OP = jsonic.token['#E('];
    const CP = jsonic.token['#E)'];
    jsonic
        .rule('val', (rs) => {
        rs
            .open([
            {
                s: [OPERATORS],
                b: 1,
                p: 'expr',
                u: { expr_val: false },
                a: (r) => {
                    let opdef = novalopm[r.o0.tin];
                    if (opdef && opdef.prefix) {
                        r.n.expr_prefix = (r.n.expr_prefix || 0) + 1;
                    }
                },
                g: 'expr,expr-op,expr-open',
            },
            {
                s: [OP],
                b: 1,
                p: 'expr',
                // n: { expr_prefix: 0 },
                g: 'expr,expr-paren,expr-open',
            },
        ])
            .close([
            {
                s: [OPERATORS],
                b: 1,
                // r: 'expr',
                h: (r, _, a) => {
                    let opdef = valopm[r.c0.tin];
                    // let pass = (!r.n.expr_prefix || r.n.expr_prefix < 2) // || opdef?.left > r.use.expr_bind
                    let pass = !r.n.expr_prefix ||
                        1 === r.n.expr_prefix ||
                        (opdef === null || opdef === void 0 ? void 0 : opdef.left) > r.n.expr_bind;
                    if (pass) {
                        r.n.expr_prefix = 0;
                    }
                    a.r = pass ? 'expr' : '';
                    return a;
                },
                // n: { expr_prefix: 0 },
                u: { expr_val: true },
                g: 'expr,expr-op,expr-open',
            },
            {
                s: [CP],
                b: 1,
                c: (r) => !!r.n.pd,
                g: 'expr,expr-paren,expr-close',
            },
            // TODO: make configurable
            {
                s: [OP],
                b: 1,
                r: 'expr',
                // n: { expr_prefix: 0 },
                u: { paren_prefix: true },
                g: 'expr,expr-paren,expr-open',
            },
        ]);
    });
    jsonic
        .rule('elem', (rs) => {
        rs
            .close([
            {
                s: [CP], b: 1, g: 'expr,paren',
                c: (r) => !!r.n.pd
            },
        ]);
    });
    jsonic
        .rule('pair', (rs) => {
        rs
            .close([
            {
                s: [CP], b: 1, g: 'expr,paren',
                c: (r) => !!r.n.pd
            },
        ]);
    });
    jsonic
        .rule('expr', (rs) => {
        rs
            .bo(function box(r) {
            r.n.expr_bind = r.n.expr_bind || 0;
            r.n.expr_term = r.n.expr_term || 0;
            if (r.n.expr_prefix) {
                r.n.expr_prefix++;
            }
        })
            .open([
            {
                s: [OPERATORS],
                g: 'expr',
                h: (r, _, a) => {
                    var _a;
                    r.n.expr_term++;
                    const expr_val = !!r.prev.use.expr_val;
                    const prev = r.prev;
                    const parent = r.parent;
                    const tin = r.o0.tin;
                    const opdef = expr_val ? valopm[tin] : novalopm[tin];
                    if (!opdef) {
                        a.e = r.o0;
                        return a;
                    }
                    const opsrc = opdef.src;
                    const left = opdef.left;
                    const right = opdef.right;
                    let p = 'val';
                    if ((_a = parent.node) === null || _a === void 0 ? void 0 : _a.expr$) {
                        if (r.n.expr_bind < left) {
                            r.node = [opsrc];
                            if (expr_val) {
                                r.node.push(prev.node);
                            }
                            parent.node.push(r.node);
                            r.node.expr$ = 2;
                        }
                        else {
                            let binary = parent;
                            if (expr_val) {
                                binary.node.push(prev.node);
                            }
                            let root = binary;
                            // TODO: make this more robust using node.op$ marker
                            for (let pI = 0; pI < r.n.expr_term - 2 && root.node[0] !== opsrc; pI++) {
                                root = root.parent;
                                if ('expr' !== root.name) {
                                    root = root.parent;
                                }
                            }
                            root.node[1] = [...root.node];
                            root.node[0] = opsrc;
                            root.node.length = 2;
                            root.node.expr$ = opdef.order;
                            r.node = root.node;
                        }
                    }
                    else if (expr_val) {
                        prev.node = [opsrc, prev.node];
                        r.node = prev.node;
                        r.node.expr$ = 2;
                    }
                    else {
                        r.node = [opsrc];
                        r.node.expr$ = 1;
                    }
                    if (opdef.suffix) {
                        r.node.expr$ = 1;
                        p = '';
                    }
                    r.n.expr_bind = right;
                    a.p = p;
                    return a;
                }
            },
            {
                s: [OP],
                p: 'expr',
                n: {
                    expr_bind: 0, expr_term: 0, pd: 1,
                },
                g: 'expr,paren',
                a: (r) => {
                    r.use.pd = r.n.pd;
                    r.node = undefined;
                },
            },
            { p: 'val', g: 'expr,val' },
        ])
            .bc(function bc(r) {
            var _a, _b;
            if (((_a = r.node) === null || _a === void 0 ? void 0 : _a.length) - 1 < ((_b = r.node) === null || _b === void 0 ? void 0 : _b.expr$)) {
                r.node.push(r.child.node);
            }
            if (r.n.expr_prefix) {
                r.n.expr_prefix--;
            }
        })
            .close([
            {
                s: [OPERATORS],
                b: 1,
                g: 'expr',
                u: { expr_val: true },
                h: (r, _, a) => {
                    let opdef = valopm[r.c0.tin];
                    let pass = !r.n.expr_prefix;
                    a.r = pass ? 'expr' : '';
                    return a;
                },
            },
            {
                s: [CP],
                b: 1,
                c: (r) => !!r.n.pd,
                h: (r, _, a) => {
                    var _a;
                    if ((_a = r.child.node) === null || _a === void 0 ? void 0 : _a.expr$) {
                        r.node = r.child.node;
                    }
                    else if (undefined === r.node) {
                        r.node = r.child.node;
                    }
                    if (r.use.pd === r.n.pd) {
                        a.b = 0;
                        r.node = ['(', r.node];
                        r.node.paren$ = true;
                        if (r.prev.use.paren_prefix) {
                            //   r.prev.node = r.node
                            r.node[0] = '((';
                            r.node[2] = r.node[1];
                            r.node[1] = r.prev.node;
                            r.prev.node = r.node;
                        }
                    }
                    return a;
                },
                g: 'expr,paren',
            },
            { g: 'expr,expr-end' }
        ]);
    });
};
exports.Expr = Expr;
Expr.defaults = {
    // TODO: this should not be a list, use a map for easier overrides
    op: {
        positive: {
            order: 1, left: 14000, right: 14000, src: '+'
        },
        negative: {
            order: 1, left: 14000, right: 14000, src: '-'
        },
        // TODO: move to test
        // factorial: {
        //   order: 1, left:15000, right:15000, src: '!'
        // },
        // // TODO: move to test
        // indexation: {
        //   order: 2, left:2700, 2600], src: '[', csrc: ']'
        // },
        // NOTE: right-associative as lbp > rbp
        // Example: 2**3**4 === 2**(3**4)
        exponentiation: {
            order: 2, left: 1700, right: 1600, src: '**'
        },
        // NOTE: all these are left-associative as lbp < rbp
        // Example: 2+3+4 === (2+3)+4
        addition: {
            order: 2, left: 140, right: 150, src: '+'
        },
        subtraction: {
            order: 2, left: 140, right: 150, src: '-'
        },
        multiplication: {
            order: 2, left: 160, right: 170, src: '*'
        },
        division: {
            order: 2, left: 160, right: 170, src: '/'
        },
        remainder: {
            order: 2, left: 160, right: 170, src: '%'
        },
    },
    paren: {
        pure: {
            osrc: '(', csrc: ')',
            // prefix: {}
        },
        // TODO: move to test
        // index: {
        //   osrc: '[', csrc: ']', prefix: {
        //     required: true
        //   }
        // },
        // func: {
        //   osrc: '<', csrc: '>',
        //   prefix: {
        //     // required: false
        //   }
        // },
        // ternary: { osrc: '?', csrc: ':', prefix: {}, suffix: {} },
        // ternary: { osrc: '<', csrc: '>', prefix: true, suffix: true },
        // quote: { osrc: '<<', csrc: '>>', prefix: {}, suffix: {} },
    }
};
//# sourceMappingURL=expr.js.map