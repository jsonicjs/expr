"use strict";
/* Copyright (c) 2021 Richard Rodger, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.prattify = exports.Expr = void 0;
// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
// TODO: increase infix base binding values
// TODO: error on incomplete expr: 1+2+
// TODO: disambiguate infix and suffix by val.close r.o1 lookahead
// TODO: ternary as special rule
const jsonic_1 = require("jsonic");
const { omap, entries } = jsonic_1.util;
let Expr = function expr(jsonic, options) {
    var _a;
    // Ensure comment matcher is first to avoid conflicts with
    // comment markers (//, /*, etc)
    let lexm = ((_a = jsonic.options.lex) === null || _a === void 0 ? void 0 : _a.match) || [];
    let cmI = lexm.map(m => m.name).indexOf('makeCommentMatcher');
    if (0 < cmI) {
        jsonic.options({
            lex: {
                match: [
                    lexm[cmI],
                    ...lexm.slice(0, cmI),
                    ...lexm.slice(cmI + 1),
                ]
            }
        });
    }
    let token = jsonic.token.bind(jsonic);
    let fixed = jsonic.fixed.bind(jsonic);
    // NOTE: operators with same src will generate same token - this is correct.
    const operatorFixed = omap(options.op, ([_, od]) => [
        fixed(od.src) ? token(fixed(od.src)) : '#E' + od.src, od.src
    ]);
    // NOTE: parens with same src will generate same token - this is correct.
    const parenFixed = omap(options.paren, ([_, od]) => [
        fixed(od.osrc) ? token(fixed(od.osrc)) : '#E' + od.osrc, od.osrc,
        fixed(od.csrc) ? token(fixed(od.csrc)) : '#E' + od.csrc, od.csrc
    ]);
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
    // Build token maps (TM).
    const prefixTM = makeOpMap(token, options.op || {}, 'prefix');
    const suffixTM = makeOpMap(token, options.op || {}, 'suffix');
    const infixTM = makeOpMap(token, options.op || {}, 'infix');
    const parenOTM = makeParenMap(token, fixed, options.paren || {});
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
    const NONE = null;
    const QUEST_SRC = '?';
    const SEMI_SRC = ';';
    const QUEST_TIN = fixed(QUEST_SRC);
    const SEMI_TIN = fixed(SEMI_SRC);
    const QUEST_NAME = token(QUEST_TIN) || 'E#' + QUEST_SRC;
    const SEMI_NAME = token(SEMI_TIN) || 'E#' + SEMI_SRC;
    // console.log('AAA', jsonic.fixed)
    // console.log('BBB', jsonic.fixed(QUEST_SRC), QUEST_NAME)
    jsonic.options({
        fixed: {
            token: {
                [QUEST_NAME]: QUEST_SRC,
                [SEMI_NAME]: SEMI_SRC,
            }
        }
    });
    const QUEST = token(QUEST_NAME);
    const SEMI = token(SEMI_NAME);
    // console.log(jsonic.fixed)
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
                c: (r, ctx) => {
                    const pdef = parenOTM[r.o0.tin];
                    let pass = true;
                    if (pdef.preval) {
                        if (pdef.preval.required) {
                            pass = 'val' === r.prev.name && r.prev.use.paren_preval;
                        }
                    }
                    // Paren with preval as first term becomes root.
                    if (pass) {
                        if (1 === r.prev.id) {
                            ctx.root = () => r.node;
                        }
                    }
                    return pass;
                },
                g: 'expr,expr-paren',
            } : NONE,
        ])
            .close([
            // {
            //   c: (r: Rule) => {
            //     // console.log('VAL POSTVAL CHECK', r.prev.use, r.node, r.prev.node)
            //     if (r.prev.use.paren_postval) {
            //       r.prev.node.push(r.node)
            //     }
            //     // if (r.prev.prev?.use?.paren_postval) {
            //     //   r.prev.prev.node.push(r.node)
            //     // }
            //     // else if (r.prev.use.paren_postval) {
            //     //   r.prev.node.push(r.node)
            //     // }
            //     return false
            //   },
            // },
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
                c: (r) => !!r.n.expr_paren,
                b: 1,
                g: 'expr,expr-paren',
            } : NONE,
            // The opening parenthesis of an expression with a preceding value.
            // foo(1) => preval='foo', expr=['(',1]
            hasParen ? {
                s: [OP],
                b: 1,
                r: 'val',
                c: (r) => parenOTM[r.c0.tin].preval.active,
                u: { paren_preval: true },
                g: 'expr,expr-paren,expr-paren-prefix',
            } : NONE,
            {
                s: [QUEST],
                b: 1,
                c: (r) => !r.n.expr,
                r: 'ternary',
                g: 'expr,expr-ternary',
            },
            {
                s: [SEMI],
                c: (r) => !!r.n.expr_ternary,
                b: 1,
                g: 'expr,expr-ternary',
            },
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
    jsonic.rule('list', (rs) => {
        let orig_bo = rs.def.bo;
        rs
            .bo((...rest) => {
            orig_bo(...rest);
            rest[0].n.expr = 0;
            rest[0].n.expr_prefix = 0;
            rest[0].n.expr_suffix = 0;
            rest[0].n.expr_paren = 0;
        });
    });
    jsonic.rule('map', (rs) => {
        let orig_bo = rs.def.bo;
        rs
            .bo((...rest) => {
            orig_bo(...rest);
            rest[0].n.expr = 0;
            rest[0].n.expr_prefix = 0;
            rest[0].n.expr_suffix = 0;
            rest[0].n.expr_paren = 0;
        });
    });
    jsonic
        .rule('elem', (rs) => {
        rs
            .close([
            // Close implicit list within parens.
            hasParen ? {
                s: [CP],
                b: 1,
                c: (r) => !!r.n.expr_paren,
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
                c: (r) => !!r.n.expr_paren || 0 < r.n.pk,
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
                    // console.log('INFIX OPEN', r.node, 'parent', r.parent.node, 'prev', r.prev.node)
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
            var _a, _b, _c;
            // Append final term to expression.
            if (((_a = r.node) === null || _a === void 0 ? void 0 : _a.length) - 1 < ((_c = (_b = r.node) === null || _b === void 0 ? void 0 : _b.op$) === null || _c === void 0 ? void 0 : _c.terms)) {
                r.node.push(r.child.node);
            }
        })
            .close([
            hasInfix ? {
                s: [INFIX],
                // Complete prefix first.
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
                c: (r) => !!r.n.expr_paren,
                b: 1,
            } : NONE,
            {
                s: [QUEST],
                c: (r) => !r.n.expr_prefix,
                b: 1,
                r: 'ternary',
                g: 'expr,expr-ternary',
            },
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
                    expr_paren: 1, expr: 0, expr_prefix: 0, expr_suffix: 0,
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
                // // postval can only be required
                // r: (r: Rule) => {
                //   const pdef = parenCTM[r.c0.tin]
                //   // console.log('R pdef', pdef)
                //   if (pdef.postval.active) {
                //     r.use.paren_postval = true
                //     return 'val'
                //   }
                //   return ''
                // },
                a: makeCloseParen(parenCTM),
                g: 'expr,expr-paren,close',
            } : NONE,
        ]);
    });
    jsonic
        .rule('ternary', (rs) => {
        rs
            .open([
            {
                s: [QUEST],
                p: 'val',
                n: {
                    expr_ternary: 1, expr_paren: 0, expr: 0, expr_prefix: 0, expr_suffix: 0,
                },
                u: { expr_ternary_step: 1 },
                g: 'expr,expr-ternary,open',
                a: (r) => {
                    var _a;
                    // console.log('TERN QUEST', r.prev.node)
                    if ((_a = r.prev.node) === null || _a === void 0 ? void 0 : _a.op$) {
                        let node = ['?', [...r.prev.node]];
                        node[1].op$ = r.prev.node.op$;
                        r.prev.node[0] = node[0];
                        r.prev.node[1] = node[1];
                        r.prev.node.length = 2;
                        r.node = r.prev.node;
                    }
                    else {
                        r.node = ['?', r.prev.node];
                        r.prev.node = r.node;
                    }
                    r.prev.node.ternary$ = { src: '?' };
                    delete r.prev.node.op$;
                },
            },
            {
                p: 'val',
                c: (r) => 2 === r.prev.use.expr_ternary_step,
                a: (r) => {
                    r.use.expr_ternary_step = r.prev.use.expr_ternary_step;
                },
                g: 'expr,expr-ternary,step',
            },
        ])
            .close([
            {
                s: [SEMI],
                c: (r) => 1 === r.use.expr_ternary_step,
                r: 'ternary',
                a: (r) => {
                    r.use.expr_ternary_step++;
                    r.node.push(r.child.node);
                },
                g: 'expr,expr-ternary,step',
            },
            {
                c: (r) => 2 === r.use.expr_ternary_step,
                a: (r) => {
                    r.node.push(r.child.node);
                },
                g: 'expr,expr-ternary,close',
            }
        ]);
    });
};
exports.Expr = Expr;
// Convert prior (parent or previous) rule node into an expression.
function prior(rule, prior, op) {
    var _a, _b;
    let prior_node = (((_a = prior.node) === null || _a === void 0 ? void 0 : _a.op$) || ((_b = prior.node) === null || _b === void 0 ? void 0 : _b.paren$)) ? [...prior.node] : prior.node;
    if (null == prior.node || (!prior.node.op$ && !prior.node.paren$)) {
        prior.node = [];
    }
    prior.node[0] = op.src;
    prior.node.length = 1;
    if (!op.prefix) {
        prior.node[1] = prior_node;
    }
    prior.node.op$ = op;
    delete prior.node.paren$;
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
        var _a, _b;
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
            const val = r.node;
            r.node = [pdef.osrc];
            if (undefined !== val) {
                r.node[1] = val;
            }
            r.node.paren$ = pdef;
            if (r.parent.prev.use.paren_preval) {
                if ((_b = r.parent.prev.node) === null || _b === void 0 ? void 0 : _b.paren$) {
                    r.parent.prev.node[1] = [...r.parent.prev.node];
                    r.parent.prev.node[1].paren$ = r.parent.prev.node.paren$;
                    r.parent.prev.node[2] = r.node[1];
                    r.parent.prev.node[0] = r.node.paren$.osrc;
                    r.parent.prev.node.length = 3;
                    r.parent.prev.node.paren$ = r.node.paren$;
                    r.node = r.parent.prev.node;
                }
                else {
                    r.node.splice(1, 0, r.parent.prev.node);
                    r.parent.prev.node = r.node;
                }
            }
            // if (pdef.postval.active) {
            //   r.use.paren_postval = true
            // }
        }
    };
}
function implicitList(rule, ctx, a) {
    let paren = null;
    // Find the paren rule that contains this implicit list.
    for (let rI = ctx.rsI - 1; -1 < rI; rI--) {
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
function makeParenMap(tokenize, fixed, paren) {
    return entries(paren)
        .reduce((a, [name, pdef]) => {
        let otin = (fixed(pdef.osrc) || tokenize('#E' + pdef.osrc));
        let otkn = tokenize(otin);
        let ctin = (fixed(pdef.csrc) || tokenize('#E' + pdef.csrc));
        let ctkn = tokenize(ctin);
        a[otin] = {
            name,
            osrc: pdef.osrc,
            csrc: pdef.csrc,
            otkn,
            otin,
            ctkn,
            ctin,
            preval: {
                // True by default if preval specified.
                active: null == pdef.preval ? false :
                    null == pdef.preval.active ? true : pdef.preval.active,
                // False by default.
                required: null == pdef.preval ? false :
                    null == pdef.preval.required ? false : pdef.preval.required,
            },
            // postval: {
            //   // True by default if postval specified.
            //   active: null == pdef.postval ? false :
            //     null == pdef.postval.active ? true : pdef.postval.active,
            //   // False by default.
            //   required: null == pdef.postval ? false :
            //     null == pdef.postval.required ? false : pdef.postval.required,
            // },
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
        },
    }
};
const jj = (x) => JSON.parse(JSON.stringify(x));
// Pratt algorithm embeds next operator.
// NOTE: preserves referential integrity of root expression.
function prattify(expr, op) {
    var _a, _b;
    let out = expr;
    let log = '';
    let in_expr = jj(expr);
    if (op) {
        if (op.infix) {
            log += 'I';
            // let lower = ('?' === op.src && ';' === expr[2]?.op$?.src)
            // op is lower
            // if (lower || expr.op$.suffix || op.left <= expr.op$.right) {
            if (expr.op$.suffix || op.left <= expr.op$.right) {
                log += 'L';
                expr[1] = [...expr];
                expr[1].op$ = expr.op$;
                expr[0] = op.src;
                expr.op$ = op;
                expr.length = 2;
            }
            // op is higher
            else {
                log += 'H';
                const end = expr.op$.terms;
                // let done = true
                // let done = (';' === op.src && '?' === expr[end]?.op$?.src && ';' === expr[end][2]?.op$?.src)
                // console.log('TERN', op.src, done, '/', jj(expr), '/', jj(expr[end]))
                //if (!done && expr[end]?.op$?.right < op.left) {
                if (((_b = (_a = expr[end]) === null || _a === void 0 ? void 0 : _a.op$) === null || _b === void 0 ? void 0 : _b.right) < op.left) {
                    log += 'P';
                    out = prattify(expr[end], op);
                }
                else {
                    log += 'E';
                    expr[end] = [op.src, expr[end]];
                    expr[end].op$ = op;
                    out = expr[end];
                }
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
    // console.log('PRATT', log,
    //   // in_expr_op,
    //   in_expr,
    //   '::',
    //   op?.src,
    //   '/',
    //   jj(expr),
    //   '/',
    //   jj(out),
    //   '')
    return out;
}
exports.prattify = prattify;
//# sourceMappingURL=expr.js.map