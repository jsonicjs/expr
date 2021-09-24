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
    // console.log(OPERATORS)
    const novalopm = {
        [jsonic.token('#E-')]: {
            order: 1,
            src: '-',
            name: 'negative-prefix',
            left: 14000,
            right: 14000,
            tin: jsonic.token('#E-'),
            tkn: '#E-',
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
            suffix: false,
        },
        [jsonic.token('#E!')]: {
            order: 1,
            src: '!',
            name: 'factorial-suffix',
            // left: 15000,
            // right: 15000,
            left: 13000,
            right: 13000,
            tin: jsonic.token('#E!'),
            tkn: '#E!',
            suffix: true,
        },
    };
    const OP = jsonic.token['#E('];
    const CP = jsonic.token['#E)'];
    console.log('fixed', jsonic.fixed);
    // console.log('novalopm', novalopm)
    // console.log('valopm', valopm)
    jsonic
        .rule('val', (rs) => {
        rs
            .open([
            {
                s: [OPERATORS],
                b: 1,
                p: 'expr',
                u: { expr_val: false },
                g: 'expr',
            },
            {
                s: [OP],
                b: 1,
                p: 'expr',
                g: 'expr,paren',
            },
        ])
            .close([
            {
                s: [OPERATORS],
                b: 1,
                r: 'expr',
                u: { expr_val: true },
                g: 'expr',
            },
            {
                s: [CP],
                b: 1,
                g: 'expr,paren',
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
                        console.log('EXPR OPEN parent A', r.node, parent.node, r.n, left, prev.node, expr_val);
                        if (r.n.expr_bind < left) {
                            console.log('EXPR OPEN UP');
                            r.node = [opsrc];
                            if (expr_val) {
                                r.node.push(prev.node);
                            }
                            parent.node.push(r.node);
                            r.node.expr$ = 2;
                        }
                        else {
                            console.log('EXPR OPEN DOWN A', parent.node, expr_val, prev.node);
                            if (expr_val) {
                                parent.node.push(prev.node);
                            }
                            console.log('EXPR OPEN DOWN B', parent.node, expr_val, prev.node);
                            // console.log('EXPR OPEN DOWN C', r.n.expr_term,
                            //   parent.parent.node,
                            //   parent.parent.parent.node,
                            // )
                            let root = parent;
                            // TODO: make this more robust using node.op$ marker
                            if (root.node[0] !== opsrc) {
                                for (let pI = 0; pI < r.n.expr_term - 2; pI++) {
                                    console.log('EXPR OPEN DOWN C', r.n.expr_term, pI, root.node);
                                    root = root.parent;
                                }
                            }
                            console.log('EXPR OPEN DOWN D', root.node);
                            // parent.node[1] = [...parent.node]
                            // parent.node[0] = opsrc
                            // parent.node.length = parent.node.length - 1
                            // r.node = parent.node
                            root.node[1] = [...root.node];
                            root.node[0] = opsrc;
                            // root.node.length = root.node.length - 1
                            root.node.length = 2;
                            r.node = root.node;
                        }
                        console.log('EXPR OPEN parent Z', r.node, parent.node, prev.node);
                    }
                    else if (expr_val) {
                        console.log('EXPR OPEN prev A', r.node, prev.node, parent.node);
                        prev.node = [opsrc, prev.node];
                        r.node = prev.node;
                        r.node.expr$ = 2;
                        console.log('EXPR OPEN prev Z', r.node, prev.node, parent.node);
                    }
                    else {
                        console.log('EXPR OPEN prefix A', r.node);
                        r.node = [opsrc];
                        r.node.expr$ = 1;
                        console.log('EXPR OPEN prefix Z', r.node);
                    }
                    if (opdef.suffix) {
                        r.node.expr$ = 1;
                        p = '';
                        console.log('EXPR OPEN suffix', r.node);
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
                },
            },
            { p: 'val', g: 'expr,val' },
        ])
            .bc(function bc(r) {
            var _a, _b, _c;
            console.log('EXPR BC A', r.node, r.child.node);
            if (((_a = r.node) === null || _a === void 0 ? void 0 : _a.length) - 1 < ((_b = r.node) === null || _b === void 0 ? void 0 : _b.expr$)) {
                r.node.push(r.child.node);
            }
            console.log('EXPR BC Z', r.node, (_c = r.node) === null || _c === void 0 ? void 0 : _c.expr$);
        })
            .close([
            {
                s: [OPERATORS],
                b: 1,
                r: 'expr',
                g: 'expr',
                u: { expr_val: true },
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
                    if (r.use.pd === r.n.pd) {
                        a.b = 0;
                        r.node = ['(', r.node];
                        r.node.paren$ = true;
                    }
                    return a;
                },
                g: 'expr,paren',
            },
            // { g: 'expr,expr-end' }
        ]);
    });
};
exports.Expr = Expr;
//# sourceMappingURL=expr.js.map