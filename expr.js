"use strict";
/* Copyright (c) 2021 Richard Rodger, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.prattify = exports.Expr = void 0;
// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
// TODO: error on incomplete expr: 1+2+
// TODO: disambiguate infix and suffix by val.close r.o1 lookahead
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
    // Build token maps (TM).
    const prefixTM = makeOpMap(tokenize, options.op || {}, 'prefix');
    const suffixTM = makeOpMap(tokenize, options.op || {}, 'suffix');
    const infixTM = makeOpMap(tokenize, options.op || {}, 'infix');
    const parenOTM = makeParenMap(tokenize, options.paren || {});
    const parenCTM = omap(parenOTM, ([_, pdef]) => [undefined, undefined, pdef.ctin, pdef]);
    const PREFIX = Object.values(prefixTM).map(opdef => opdef.tin);
    const INFIX = Object.values(infixTM).map(opdef => opdef.tin);
    const SUFFIX = Object.values(suffixTM).map(opdef => opdef.tin);
    const hasPrefix = 0 < PREFIX.length;
    const hasInfix = 0 < INFIX.length;
    const hasSuffix = 0 < SUFFIX.length;
    const OP = Object.values(parenOTM).map(pdef => pdef.otin);
    const CP = Object.values(parenCTM).map(pdef => pdef.ctin);
    const hasParen = 0 < OP.length && 0 < CP.length;
    const CA = jsonic.token.CA;
    const TX = jsonic.token.TX;
    const NR = jsonic.token.NR;
    const ST = jsonic.token.ST;
    const VL = jsonic.token.VL;
    const VAL = [TX, NR, ST, VL];
    // An AltSpec === null is ignored.
    const NONE = null;
    jsonic
        .rule('val', (rs) => {
        rs
            .open([
            // The prefix operator of the first term of an expression.
            hasPrefix ? {
                s: [PREFIX],
                b: 1,
                n: { expr_prefix: 1, expr_suffix: 0 },
                p: 'expr',
                g: 'expr,expr-prefix',
            } : NONE,
            // An opening parenthesis of an expression.
            hasParen ? {
                s: [OP],
                b: 1,
                p: 'paren',
                g: 'expr,expr-paren',
            } : NONE,
        ])
            .close([
            // The infix operator following the first term of an expression.
            hasInfix ? {
                s: [INFIX],
                b: 1,
                n: { expr_prefix: 0, expr_suffix: 0 },
                r: (r) => !r.n.expr ? 'expr' : '',
                g: 'expr,expr-infix',
            } : NONE,
            // The suffix operator following the first term of an expression.
            hasSuffix ? {
                s: [SUFFIX],
                b: 1,
                n: { expr_prefix: 0, expr_suffix: 1 },
                r: (r) => !r.n.expr ? 'expr' : '',
                g: 'expr,expr-suffix',
            } : NONE,
            // The closing parenthesis of an expression.
            // TODO: use n.expr to validate actually in an expression?
            hasParen ? {
                s: [CP],
                b: 1,
                g: 'expr,expr-paren',
            } : NONE,
            // The opening parenthesis of an expression with a preceding value.
            // foo(1) => preval='foo', expr=['(',1]
            hasParen ? {
                s: [OP],
                b: 1,
                r: 'paren',
                c: (r) => parenOTM[r.c0.tin].preval,
                u: { paren_preval: true },
                g: 'expr,expr-paren,expr-paren-prefix',
            } : NONE,
            {
                s: [CA],
                c: (r) => 1 === r.d && 1 <= r.n.expr,
                b: 1,
                g: 'expr,list,val,imp,comma,top',
            },
            {
                s: [VAL],
                c: (r) => 1 === r.d && 1 <= r.n.expr,
                b: 1,
                g: 'expr,list,val,imp,space,top',
            },
        ]);
    });
    jsonic
        .rule('elem', (rs) => {
        rs
            .close([
            // Close implicit list within parens.
            hasParen ? {
                s: [CP],
                b: 1,
                g: 'expr,expr-paren,imp,close,list',
            } : NONE,
            // Following elem is a paren expression.
            hasParen ? {
                s: [OP],
                b: 1,
                r: 'elem',
                g: 'expr,expr-paren,imp,open,list',
            } : NONE,
        ]);
    });
    jsonic
        .rule('pair', (rs) => {
        rs
            .close([
            // Close implicit map within parens.
            hasParen ? {
                s: [CP],
                b: 1,
                g: 'expr,expr-paren,imp,map',
            } : NONE,
        ]);
    });
    jsonic
        .rule('expr', (rs) => {
        rs
            .open([
            hasPrefix ? {
                s: [PREFIX],
                c: (r) => !!r.n.expr_prefix,
                n: { expr: 1, il: 1, im: 1 },
                p: 'val',
                g: 'expr,expr-prefix',
                a: (r) => {
                    var _a;
                    const parent = r.parent;
                    const op = prefixTM[r.o0.tin];
                    r.node =
                        ((_a = parent.node) === null || _a === void 0 ? void 0 : _a.op$) ? prattify(parent.node, op) : prior(r, parent, op);
                }
            } : NONE,
            hasInfix ? {
                s: [INFIX],
                p: 'val',
                n: { expr: 1, expr_prefix: 0, il: 1, im: 1 },
                a: (r) => {
                    var _a, _b;
                    const prev = r.prev;
                    const parent = r.parent;
                    const op = infixTM[r.o0.tin];
                    // Second and further operators.
                    if ((_a = parent.node) === null || _a === void 0 ? void 0 : _a.op$) {
                        r.node = prattify(parent.node, op);
                    }
                    // First term was unary expression.
                    else if ((_b = prev.node) === null || _b === void 0 ? void 0 : _b.op$) {
                        r.node = prattify(prev.node, op);
                        r.parent = prev;
                    }
                    // First term was plain value.
                    else {
                        r.node = prior(r, prev, op);
                    }
                },
                g: 'expr,expr-infix',
            } : NONE,
            hasSuffix ? {
                s: [SUFFIX],
                n: { expr: 1, expr_prefix: 0, il: 1, im: 1 },
                a: (r) => {
                    var _a;
                    const prev = r.prev;
                    const op = suffixTM[r.o0.tin];
                    r.node =
                        ((_a = prev.node) === null || _a === void 0 ? void 0 : _a.op$) ? prattify(prev.node, op) : prior(r, prev, op);
                },
                g: 'expr,expr-suffix',
            } : NONE,
        ])
            .bc((r) => {
            var _a, _b;
            // Append final term to expression.
            if (((_a = r.node) === null || _a === void 0 ? void 0 : _a.length) - 1 < ((_b = r.node) === null || _b === void 0 ? void 0 : _b.op$.terms)) {
                r.node.push(r.child.node);
            }
        })
            .close([
            hasInfix ? {
                s: [INFIX],
                c: (r) => !r.n.expr_prefix,
                b: 1,
                r: 'expr',
                g: 'expr,expr-infix',
            } : NONE,
            hasSuffix ? {
                s: [SUFFIX],
                c: (r) => !r.n.expr_prefix,
                b: 1,
                r: 'expr',
                g: 'expr,expr-suffix',
            } : NONE,
            hasParen ? {
                s: [CP],
                b: 1,
            } : NONE,
            // Implicit list at the top level. 
            {
                s: [CA],
                c: { d: 0 },
                n: { expr: 0 },
                r: 'elem',
                a: (rule) => rule.parent.node = rule.node = [rule.node],
                g: 'expr,comma,list,top',
            },
            // Implicit list at the top level. 
            {
                s: [VAL],
                c: { d: 0 },
                n: { expr: 0 },
                b: 1,
                r: 'elem',
                a: (rule) => rule.parent.node = rule.node = [rule.node],
                g: 'expr,space,list,top',
            },
            // Implicit list indicated by comma.
            {
                s: [CA],
                c: { n: { pk: 0 } },
                n: { expr: 0 },
                b: 1,
                h: implicitList,
                g: 'expr,list,val,imp,comma',
            },
            // Implicit list indicated by space separated value.
            {
                c: { n: { pk: 0, expr_suffix: 0 } },
                n: { expr: 0 },
                h: implicitList,
                g: 'expr,list,val,imp,space',
            },
            // Expression ends with non-expression token.
            {
                g: 'expr,expr-end',
            }
        ]);
    });
    jsonic
        .rule('paren', (rs) => {
        rs
            .bo((r) => {
            // Allow implicits inside parens
            r.n.im = 0;
            r.n.il = 0;
            r.n.pk = 0;
        })
            .open([
            hasParen ? {
                s: [OP, CP],
                b: 1,
                g: 'expr,expr-paren,empty',
                c: (r) => parenOTM[r.o0.tin].name === parenCTM[r.o1.tin].name,
                a: makeOpenParen(parenOTM),
            } : NONE,
            hasParen ? {
                s: [OP],
                p: 'val',
                n: {
                    expr: 0, expr_prefix: 0, expr_suffix: 0,
                },
                g: 'expr,expr-paren,open',
                a: makeOpenParen(parenOTM),
            } : NONE,
        ])
            .close([
            hasParen ? {
                s: [CP],
                c: (r) => {
                    const pdef = parenCTM[r.c0.tin];
                    let pd = 'expr_paren_depth_' + pdef.name;
                    return !!r.n[pd];
                },
                a: makeCloseParen(parenCTM),
                g: 'expr,expr-paren,close',
            } : NONE,
        ]);
    });
};
exports.Expr = Expr;
// Convert prior (parent or previous) rule node into an expression.
function prior(rule, prior, op) {
    if (op.prefix) {
        prior.node = [op.src];
    }
    else {
        prior.node = [op.src, prior.node];
    }
    prior.node.op$ = op;
    // Ensure first term val rule contains final expression.
    rule.parent = prior;
    return prior.node;
}
function makeOpenParen(parenOTM) {
    return function openParen(r) {
        const pdef = parenOTM[r.o0.tin];
        let pd = 'expr_paren_depth_' + pdef.name;
        r.use[pd] = r.n[pd] = 1;
        r.node = undefined;
    };
}
function makeCloseParen(parenCTM) {
    return function closeParen(r) {
        var _a;
        if ((_a = r.child.node) === null || _a === void 0 ? void 0 : _a.op$) {
            r.node = r.child.node;
        }
        else if (undefined === r.node) {
            r.node = r.child.node;
        }
        const pdef = parenCTM[r.c0.tin];
        let pd = 'expr_paren_depth_' + pdef.name;
        // Construct completed paren expression.
        if (r.use[pd] === r.n[pd]) {
            const pdef = parenCTM[r.c0.tin];
            const val = r.node;
            r.node = [pdef.osrc];
            if (undefined !== val) {
                r.node[1] = val;
            }
            // r.node.paren$ = true
            r.node.paren$ = pdef;
            if (r.prev.use.paren_preval) {
                r.node.prefix$ = true;
                r.node[2] = r.node[1];
                r.node[1] = r.prev.node;
                r.prev.node = r.node;
            }
        }
    };
}
function implicitList(rule, ctx, a) {
    let paren = null;
    // Find the paren rule that contains this implicit list.
    for (let rI = ctx.rs.length - 1; -1 < rI; rI--) {
        if ('paren' === ctx.rs[rI].name) {
            paren = ctx.rs[rI];
            break;
        }
    }
    if (paren) {
        // Create a list value for the paren rule.
        if (null == paren.child.node) {
            paren.child.node = [rule.node];
            a.r = 'elem';
            a.b = 0;
        }
        // Convert paren value into a list value.
        else if (paren.child.node.op$) {
            paren.child.node = [paren.child.node];
            a.r = 'elem';
            a.b = 0;
        }
        rule.node = paren.child.node;
    }
    return a;
}
function makeOpMap(tokenize, op, anyfix) {
    return Object.entries(op)
        .filter(([_, opdef]) => opdef[anyfix])
        .reduce((odm, [name, opdef]) => {
        let tkn = '#E' + opdef.src;
        let tin = tokenize(tkn);
        odm[tin] = {
            src: opdef.src,
            terms: 'infix' === anyfix ? 2 : 1,
            left: opdef.left || 0,
            right: opdef.right || 0,
            name: name + '-' + anyfix,
            infix: 'infix' === anyfix,
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
            preval: !!pdef.preval
        };
        return a;
    }, {});
}
Expr.defaults = {
    op: {
        positive: {
            prefix: true, right: 14000, src: '+'
        },
        negative: {
            prefix: true, right: 14000, src: '-'
        },
        // test_at_p: {
        //   prefix: true, right: 15000, src: '@'
        // },
        // test_per_p: {
        //   prefix: true, right: 13000, src: '%'
        // },
        // test_bang_p: {
        //   suffix: true, left: 16000, src: '!'
        // },
        // test_quest_p: {
        //   suffix: true, left: 14000, src: '?'
        // },
        // test_tilde: {
        //   infix: true, left: 140_000, right: 150_000, src: '~'
        // },
        // NOTE: right-associative as lbp > rbp
        // Example: 2**3**4 === 2**(3**4)
        // test_exponentiation: {
        //   infix: true, left: 1700, right: 1600, src: '**'
        // },
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
            // preval: {}
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
// Pratt algorithm embeds next operator.
// NOTE: preserves referential integrity of root expression.
function prattify(expr, op) {
    let out = expr;
    if (op) {
        if (op.infix) {
            // op is lower
            if (expr.op$.suffix || op.left <= expr.op$.right) {
                expr[1] = [...expr];
                expr[1].op$ = expr.op$;
                expr[0] = op.src;
                expr.op$ = op;
                expr.length = 2;
            }
            // op is higher
            else {
                const end = expr.op$.terms;
                expr[end] = [op.src, expr[end]];
                expr[end].op$ = op;
                out = expr[end];
            }
        }
        else if (op.prefix) {
            // expr.op$ MUST be infix or prefix
            const end = expr.op$.terms;
            expr[end] = [op.src];
            expr[end].op$ = op;
            out = expr[end];
        }
        else if (op.suffix) {
            if (!expr.op$.suffix && expr.op$.right <= op.left) {
                const end = expr.op$.terms;
                // NOTE: special case: higher precedence suffix "drills" into
                // lower precedence prefixes - @@1! => @(@(1!)), not @((@1)!)
                if (expr[end].op$ &&
                    expr[end].op$.prefix &&
                    expr[end].op$.right < op.left) {
                    prattify(expr[end], op);
                }
                else {
                    expr[end] = [op.src, expr[end]];
                    expr[end].op$ = op;
                }
            }
            else {
                expr[1] = [...expr];
                expr[1].op$ = expr.op$;
                expr[0] = op.src;
                expr.op$ = op;
                expr.length = 2;
            }
        }
    }
    return out;
}
exports.prattify = prattify;
//# sourceMappingURL=expr.js.map