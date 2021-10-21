"use strict";
/* Copyright (c) 2021 Richard Rodger, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expr = void 0;
// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
// TODO: fix a(-b,c) - prefix unary should not apply to implicits
// TODO: fix 1+2,3+4 - implicit should be [1+2, 3+4] not 1+[2,3+4]
// TODO: fix top level: 1+2,3 === (1+2,3)
// TODO: separate paren rule?
const jsonic_1 = require("jsonic");
const { omap, entries } = jsonic_1.util;
let Expr = function expr(jsonic, options) {
    // NOTE: operators with same src will generate same token - this is correct.
    const operatorFixed = omap(options.op, ([_, od]) => ['#E' + od.src, od.src]);
    // NOTE: parens with same src will generate same token - this is correct.
    const parenFixed = omap(options.paren, ([_, od]) => ['#E' + od.osrc, od.osrc, '#E' + od.csrc, od.csrc]);
    // Add the operator tokens to the set of fixed tokens.
    jsonic.options({
        fixed: {
            token: operatorFixed
        }
    });
    // Add the paren tokens to the set of fixed tokens.
    jsonic.options({
        fixed: {
            token: parenFixed
        }
    });
    let tokenize = jsonic.token.bind(jsonic);
    const prefixTM = makeOpMap(tokenize, options.op || {}, 'prefix');
    const suffixTM = makeOpMap(tokenize, options.op || {}, 'suffix');
    const infixTM = makeOpMap(tokenize, options.op || {}, 'infix');
    const parenOTM = makeParenMap(tokenize, options.paren || {});
    const parenCTM = omap(parenOTM, ([_, pdef]) => [undefined, undefined, pdef.ctin, pdef]);
    const PREFIX = Object.values(prefixTM).map(opdef => opdef.tin);
    const INFIX_SUFFIX = [...new Set([
            ...Object.values(infixTM).map(opdef => opdef.tin),
            ...Object.values(suffixTM).map(opdef => opdef.tin),
        ])];
    const OP = Object.values(parenOTM).map(pdef => pdef.otin);
    const CP = Object.values(parenCTM).map(pdef => pdef.ctin);
    const CA = jsonic.token.CA;
    const TX = jsonic.token.TX;
    const NR = jsonic.token.NR;
    const ST = jsonic.token.ST;
    const VL = jsonic.token.VL;
    const VAL = [TX, NR, ST, VL];
    jsonic
        .rule('val', (rs) => {
        rs
            .open([
            {
                // Prefix operators occur before a value.
                s: [PREFIX],
                b: 1,
                p: 'expr',
                u: { expr_val: false },
                a: (r) => {
                    let opdef = prefixTM[r.o0.tin];
                    if (opdef && opdef.prefix) {
                        r.n.expr_prefix = (r.n.expr_prefix || 0) + 1;
                    }
                },
                g: 'expr,expr-op,expr-open',
            },
            {
                s: [OP],
                n: { il: 0, im: 0, pk: 0 },
                b: 1,
                //  p: 'expr',
                p: 'paren',
                g: 'expr,paren,open',
            },
        ])
            .close([
            {
                // Infix and suffix operators occur after a value.
                s: [INFIX_SUFFIX],
                b: 1,
                h: (r, _, a) => {
                    let opdef = infixTM[r.c0.tin] || suffixTM[r.c0.tin];
                    let pass = !r.n.expr_prefix ||
                        1 === r.n.expr_prefix ||
                        (opdef === null || opdef === void 0 ? void 0 : opdef.left) > r.n.expr_bind;
                    if (pass) {
                        r.n.expr_prefix = 0;
                    }
                    // The value node will be replaced by an expression node.
                    a.r = pass ? 'expr' : '';
                    return a;
                },
                u: { expr_val: true },
                g: 'expr,expr-op,expr-open',
            },
            {
                s: [CP],
                b: 1,
            },
            // {
            //   s: [CP],
            //   b: 1,
            //   c: (r: Rule) => {
            //     const pdef = parenCTM[r.c0.tin]
            //     let pd = 'expr_paren_depth_' + pdef.name
            //     return !!r.n[pd]
            //     // !!r.n.pd,
            //   },
            //   g: 'expr,expr-paren,expr-close',
            // },
            {
                s: [OP],
                b: 1,
                // r: 'expr',
                r: 'paren',
                c: (r) => {
                    const pdef = parenOTM[r.c0.tin];
                    return pdef.prefix;
                },
                u: { paren_prefix: true },
                g: 'expr,expr-paren,expr-open',
            },
            {
                s: [CA],
                c: (r) => 1 === r.d && 1 <= r.n.expr_term,
                b: 1,
                g: 'list,val,imp,comma,top',
            },
            {
                s: [VAL],
                c: (r) => 1 === r.d && 1 <= r.n.expr_term,
                b: 1,
                g: 'list,val,imp,space,top',
            },
        ]);
    });
    jsonic
        .rule('elem', (rs) => {
        rs
            .close([
            // Close implicit list within parens.
            {
                s: [CP],
                b: 1,
                g: 'expr,paren,imp,list',
            },
        ]);
    });
    jsonic
        .rule('pair', (rs) => {
        rs
            .close([
            // Close implicit map within parens.
            {
                s: [CP],
                b: 1,
                g: 'expr,paren,imp,map',
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
                // A infix expression, with the left value already parsed.
                s: [INFIX_SUFFIX],
                g: 'expr',
                // No implicit lists or maps inside expressions.
                n: { il: 1, im: 1 },
                h: (r, _, a) => {
                    var _a;
                    r.n.expr_term++;
                    const expr_val = !!r.prev.use.expr_val;
                    const prev = r.prev;
                    const parent = r.parent;
                    const tin = r.o0.tin;
                    const opdef = expr_val ? (infixTM[tin] || suffixTM[tin]) : prefixTM[tin];
                    if (!opdef) {
                        a.e = r.o0;
                        return a;
                    }
                    const opsrc = opdef.src;
                    const left = opdef.left;
                    const right = opdef.right;
                    let p = 'val';
                    if ((_a = parent.node) === null || _a === void 0 ? void 0 : _a.terms$) {
                        if (r.n.expr_bind < left) {
                            r.node = [opsrc];
                            if (expr_val) {
                                r.node.push(prev.node);
                            }
                            parent.node.push(r.node);
                            r.node.terms$ = 2;
                        }
                        else {
                            let infix = parent;
                            if (expr_val) {
                                infix.node.push(prev.node);
                            }
                            let root = infix;
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
                            root.node.terms$ = opdef.terms;
                            r.node = root.node;
                        }
                    }
                    // Left value was plain, so replace with an incomplete expression.
                    // Then get the right value with a child node (p=val).
                    else if (expr_val) {
                        prev.node = [opsrc, prev.node];
                        r.node = prev.node;
                        r.node.terms$ = 2;
                    }
                    // No left value, so this is a prefix operator.
                    // Get the right value with a child node (p=val).
                    else if (r.n.expr_prefix) {
                        r.node = [opsrc];
                        r.node.terms$ = 1;
                    }
                    // TODO: does this need to set up expression node?
                    // r.node = [opsrc, prev.node]
                    else if (opdef.suffix) {
                        r.node.terms$ = 1;
                        p = '';
                    }
                    // Pratt: track the right binding power to overcome with
                    // following left binding power.
                    r.n.expr_bind = right;
                    a.p = p;
                    return a;
                }
            },
            // {
            //   s: [OP],
            //   p: 'expr',
            //   n: {
            //     expr_bind: 0, expr_term: 0,// pd: 1,
            //   },
            //   g: 'expr,paren',
            //   a: (r: Rule) => {
            //     const pdef = parenOTM[r.o0.tin]
            //     let pd = 'expr_paren_depth_' + pdef.name
            //     r.use[pd] = r.n[pd] = 1
            //     r.node = undefined
            //   },
            // },
            { p: 'val', g: 'expr,val' },
        ])
            .bc(function bc(r) {
            var _a, _b;
            if (((_a = r.node) === null || _a === void 0 ? void 0 : _a.length) - 1 < ((_b = r.node) === null || _b === void 0 ? void 0 : _b.terms$)) {
                r.node.push(r.child.node);
            }
            if (r.n.expr_prefix) {
                r.n.expr_prefix--;
            }
        })
            .close([
            {
                s: [INFIX_SUFFIX],
                b: 1,
                g: 'expr',
                u: { expr_val: true },
                h: (r, _, a) => {
                    // Proceed to next term, unless this is an incomplete prefix expression.
                    let pass = !r.n.expr_prefix;
                    a.r = pass ? 'expr' : '';
                    return a;
                },
            },
            {
                s: [CP],
                b: 1,
            },
            // {
            //   s: [CP],
            //   b: 1,
            //   c: (r: Rule) => {
            //     const pdef = parenCTM[r.c0.tin]
            //     let pd = 'expr_paren_depth_' + pdef.name
            //     // !!r.n.pd
            //     return !!r.n[pd]
            //   },
            //   h: (r: Rule, _, a: any) => {
            //     if (r.child.node?.terms$) {
            //       r.node = r.child.node
            //     }
            //     else if (undefined === r.node) {
            //       r.node = r.child.node
            //     }
            //     const pdef = parenCTM[r.c0.tin]
            //     let pd = 'expr_paren_depth_' + pdef.name
            //     if (r.use[pd] === r.n[pd]) {
            //       const pdef = parenCTM[r.c0.tin]
            //       a.b = 0
            //       r.node = [pdef.osrc, r.node]
            //       r.node.paren$ = true
            //       if (r.prev.use.paren_prefix) {
            //         r.node.prefix$ = true
            //         r.node[2] = r.node[1]
            //         r.node[1] = r.prev.node
            //         r.prev.node = r.node
            //       }
            //     }
            //     return a
            //   },
            //   g: 'expr,paren',
            // },
            // Implicit list indicated by comma.
            {
                s: [CA],
                r: 'elem',
                a: (rule, ctx) => {
                    console.log('EXPR CA', rule.node, rule.child.node, rule.parent.node, rule.prev.node);
                    console.log('EXPR CA RS', ctx.rs.map(r => r.name));
                    let paren = null;
                    for (let rI = ctx.rs.length - 1; -1 < rI; rI--) {
                        if ('paren' === ctx.rs[rI].name) {
                            paren = ctx.rs[rI];
                            break;
                        }
                    }
                    if (paren) {
                        console.log('EXPR CA P', paren.child.node);
                        if (null == paren.child.node) {
                            paren.child.node = [rule.node];
                        }
                        else if (paren.child.node.terms$) {
                            paren.child.node = [paren.child.node];
                        }
                        else {
                            paren.child.node.push(rule.node);
                        }
                        rule.node = paren.child.node;
                    }
                    // rule.node = [rule.child.node]
                    // rule.parent.node = rule.prev.node = rule.node = [rule.node]
                    // rule.parent.prev.node = rule.node = [rule.node]
                },
                g: 'expr,list,val,imp,comma',
            },
            // // Implicit list indicated by space separated value.
            // {
            //   // c: { n: { il: 0, pk: 0 } },
            //   // n: { il: 1 },
            //   r: 'elem',
            //   a: (rule: Rule) => {
            //     // rule.node = [rule.child.node]
            //     rule.prev.node = rule.node = [rule.node]
            //   },
            //   g: 'expr,list,val,imp,space',
            // },
            // // Implicit list at the top level. 
            // {
            //   s: [CA],
            //   c: { d: 0 },
            //   r: 'elem',
            //   a: (rule: Rule) => rule.prev.node = rule.node = [rule.node],
            //   g: 'expr,comma,top',
            // },
            // // Implicit list at the top level. 
            // {
            //   s: [VAL],
            //   c: { d: 0 },
            //   b: 1,
            //   r: 'elem',
            //   a: (rule: Rule) => rule.prev.node = rule.node = [rule.node],
            //   g: 'expr,space,top',
            // },
            { g: 'expr,end' }
        ]);
    });
    jsonic
        .rule('paren', (rs) => {
        rs
            .open([
            {
                s: [OP],
                // p: 'expr',
                p: 'val',
                n: {
                    expr_bind: 0, expr_term: 0,
                },
                g: 'expr,paren',
                a: (r) => {
                    const pdef = parenOTM[r.o0.tin];
                    let pd = 'expr_paren_depth_' + pdef.name;
                    r.use[pd] = r.n[pd] = 1;
                    r.node = undefined;
                },
            },
        ])
            .close([
            {
                s: [CP],
                c: (r) => {
                    const pdef = parenCTM[r.c0.tin];
                    let pd = 'expr_paren_depth_' + pdef.name;
                    return !!r.n[pd];
                },
                a: (r) => {
                    var _a;
                    if ((_a = r.child.node) === null || _a === void 0 ? void 0 : _a.terms$) {
                        r.node = r.child.node;
                    }
                    else if (undefined === r.node) {
                        r.node = r.child.node;
                    }
                    const pdef = parenCTM[r.c0.tin];
                    let pd = 'expr_paren_depth_' + pdef.name;
                    if (r.use[pd] === r.n[pd]) {
                        const pdef = parenCTM[r.c0.tin];
                        r.node = [pdef.osrc, r.node];
                        r.node.paren$ = true;
                        if (r.prev.use.paren_prefix) {
                            r.node.prefix$ = true;
                            r.node[2] = r.node[1];
                            r.node[1] = r.prev.node;
                            r.prev.node = r.node;
                        }
                    }
                },
                g: 'expr,paren',
            },
        ]);
    });
};
exports.Expr = Expr;
function makeOpMap(tokenize, op, anyfix) {
    return Object.entries(op)
        .filter(([_, opdef]) => opdef[anyfix])
        .reduce((odm, [name, opdef]) => {
        let tkn = '#E' + opdef.src;
        let tin = tokenize(tkn);
        odm[tin] = {
            src: opdef.src,
            terms: 'infix' === anyfix ? 2 : 1,
            left: opdef.left,
            right: opdef.right,
            name: name + '-' + anyfix,
            prefix: 'prefix' === anyfix,
            suffix: 'suffix' === anyfix,
            tkn,
            tin,
        };
        return odm;
    }, {});
}
function makeParenMap(tokenize, paren) {
    return entries(paren)
        .reduce((a, [name, pdef]) => {
        let otkn = '#E' + pdef.osrc;
        let ctkn = '#E' + pdef.csrc;
        let otin = tokenize(otkn);
        let ctin = tokenize(ctkn);
        a[otin] = {
            name,
            osrc: pdef.osrc,
            csrc: pdef.csrc,
            otkn,
            otin,
            ctkn,
            ctin,
            prefix: !!pdef.prefix
        };
        return a;
    }, {});
}
Expr.defaults = {
    // TODO: this should not be a list, use a map for easier overrides
    op: {
        positive: {
            prefix: true, left: 14000, right: 14000, src: '+'
        },
        negative: {
            prefix: true, left: 14000, right: 14000, src: '-'
        },
        // TODO: move to test
        // factorial: {
        //   suffix: true, left:15000, right:15000, src: '!'
        // },
        // NOTE: right-associative as lbp > rbp
        // Example: 2**3**4 === 2**(3**4)
        exponentiation: {
            infix: true, left: 1700, right: 1600, src: '**'
        },
        // NOTE: all these are left-associative as lbp < rbp
        // Example: 2+3+4 === (2+3)+4
        addition: {
            infix: true, left: 140, right: 150, src: '+'
        },
        subtraction: {
            infix: true, left: 140, right: 150, src: '-'
        },
        multiplication: {
            infix: true, left: 160, right: 170, src: '*'
        },
        division: {
            infix: true, left: 160, right: 170, src: '/'
        },
        remainder: {
            infix: true, left: 160, right: 170, src: '%'
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