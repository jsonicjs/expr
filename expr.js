"use strict";
/* Copyright (c) 2021 Richard Rodger, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testing = exports.evaluate = exports.Expr = void 0;
// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
// See the `prattify` function for the core implementation.
//
// Expressions are encoded as LISP-style S-expressions using
// arrays. The operation meta data is provided as the first array
// element.  To maintain the integrity of the overall JSON AST,
// expression rules cannot simply re-assign nodes. Instead the
// existing partial expression nodes are rewritten in-place.
//
// Parentheses can have preceeding values, which allows for the using function
// call ("foo(1)") and index ("a[1]") syntax. See the tests for examples and
// configuration options.
//
// Ternary expressions are implemented as special rule that is similar to
// the parenthesis rule. You can have multiple ternaries.
//
// Standard Jsonic allows for implicit lists and maps (e.g. a,b =>
// ['a','b']) at the top level. This expression grammar also allows
// for implicits within parentheses, so that "foo(1,2)" =>
// ['(','foo',[1,2]]. To support implicits additional counters and
// flags are needed, as well as context-sensitive edge-case
// handling. See the ternary rule for a glorious example.
//
// There is a specific recurring edge-case: when expressions are the
// first item of a list, special care is need not to embed the list
// inside the expression.
// TODO: custom ctx.F for Op - make this automatic in options
// TODO: increase infix base binding values
// TODO: error on incomplete expr: 1+2+
const jsonic_next_1 = require("@jsonic/jsonic-next");
const { omap, entries, values } = jsonic_next_1.util;
// Mark Operator objects as owned by this plugin.
const OP_MARK = {};
// The plugin itself.
let Expr = function expr(jsonic, options) {
    // Ensure comment matcher is first to avoid conflicts with
    // comment markers (//, /*, etc)
    // let lexm = jsonic.options.lex?.match || []
    // let cmI: number = lexm.map((m) => m.name).indexOf('makeCommentMatcher')
    // if (0 < cmI) {
    //   jsonic.options({
    //     lex: {
    //       match: [lexm[cmI], ...lexm.slice(0, cmI), ...lexm.slice(cmI + 1)],
    //     },
    //   })
    // }
    let token = jsonic.token.bind(jsonic);
    let fixed = jsonic.fixed.bind(jsonic);
    // Build token maps (TM).
    let optop = options.op || {};
    const prefixTM = makeOpMap(token, fixed, optop, 'prefix');
    const suffixTM = makeOpMap(token, fixed, optop, 'suffix');
    const infixTM = makeOpMap(token, fixed, optop, 'infix');
    const ternaryTM = makeOpMap(token, fixed, optop, 'ternary');
    const parenOTM = makeParenMap(token, fixed, optop);
    const parenCTM = omap(parenOTM, ([_, pdef]) => [
        undefined,
        undefined,
        pdef.ctin,
        pdef,
    ]);
    let parenFixed = Object.values({ ...parenOTM, ...parenCTM }).reduce((a, p) => ((a[p.otkn] = p.osrc), (a[p.ctkn] = p.csrc), a), {});
    // NOTE: operators with same src will generate same token - this is correct.
    let operatorFixed = Object.values({
        ...prefixTM,
        ...suffixTM,
        ...infixTM,
        ...ternaryTM,
    }).reduce((a, op) => ((a[op.tkn] = op.src), a), {});
    jsonic.options({
        fixed: {
            token: { ...operatorFixed, ...parenFixed },
        },
        lex: {
            match: {
                comment: { order: 1e5 },
            },
        },
    });
    const PREFIX = values(prefixTM).map((op) => op.tin);
    const INFIX = values(infixTM).map((op) => op.tin);
    const SUFFIX = values(suffixTM).map((op) => op.tin);
    const TERN0 = values(ternaryTM)
        .filter((op) => 0 === op.use.ternary.opI)
        .map((op) => op.tin);
    const TERN1 = values(ternaryTM)
        .filter((op) => 1 === op.use.ternary.opI)
        .map((op) => op.tin);
    const OP = values(parenOTM).map((pdef) => pdef.otin);
    const CP = values(parenCTM).map((pdef) => pdef.ctin);
    const hasPrefix = 0 < PREFIX.length;
    const hasInfix = 0 < INFIX.length;
    const hasSuffix = 0 < SUFFIX.length;
    const hasTernary = 0 < TERN0.length && 0 < TERN1.length;
    const hasParen = 0 < OP.length && 0 < CP.length;
    const CA = jsonic.token.CA;
    const CS = jsonic.token.CS;
    const CB = jsonic.token.CB;
    const TX = jsonic.token.TX;
    const NR = jsonic.token.NR;
    const ST = jsonic.token.ST;
    const VL = jsonic.token.VL;
    const ZZ = jsonic.token.ZZ;
    const VAL = [TX, NR, ST, VL];
    const NONE = null;
    jsonic.rule('val', (rs) => {
        // TODO: jsonic - make it easier to handle this case
        // Implicit pair not allowed inside ternary
        if (hasTernary && TERN1.includes(jsonic.token.CL)) {
            let pairkeyalt = rs.def.open.find((a) => a.g.includes('pair'));
            pairkeyalt.c = (r) => !r.n.expr_ternary;
        }
        rs.open([
            // The prefix operator of the first term of an expression.
            hasPrefix
                ? {
                    s: [PREFIX],
                    b: 1,
                    n: { expr_prefix: 1, expr_suffix: 0 },
                    p: 'expr',
                    g: 'expr,expr-prefix',
                }
                : NONE,
            // An opening parenthesis of an expression.
            hasParen
                ? {
                    s: [OP],
                    b: 1,
                    p: 'paren',
                    c: (r, ctx) => {
                        const pdef = parenOTM[r.o0.tin];
                        let pass = true;
                        if (pdef.preval.required) {
                            pass = 'val' === r.prev.name && r.prev.use.paren_preval;
                        }
                        // Paren with preval as first term becomes root.
                        if (pass) {
                            if (1 === r.prev.i) {
                                ctx.root = () => r;
                            }
                        }
                        return pass;
                    },
                    g: 'expr,expr-paren',
                }
                : NONE,
        ]).close([
            hasTernary
                ? {
                    s: [TERN0],
                    c: (r) => !r.n.expr,
                    b: 1,
                    r: 'ternary',
                    g: 'expr,expr-ternary',
                }
                : NONE,
            // The infix operator following the first term of an expression.
            hasInfix
                ? {
                    s: [INFIX],
                    b: 1,
                    n: { expr_prefix: 0, expr_suffix: 0 },
                    r: (r) => (!r.n.expr ? 'expr' : ''),
                    g: 'expr,expr-infix',
                }
                : NONE,
            // The suffix operator following the first term of an expression.
            hasSuffix
                ? {
                    s: [SUFFIX],
                    b: 1,
                    n: { expr_prefix: 0, expr_suffix: 1 },
                    r: (r) => (!r.n.expr ? 'expr' : ''),
                    g: 'expr,expr-suffix',
                }
                : NONE,
            // The closing parenthesis of an expression.
            hasParen
                ? {
                    s: [CP],
                    c: (r) => !!r.n.expr_paren,
                    b: 1,
                    g: 'expr,expr-paren',
                }
                : NONE,
            // The opening parenthesis of an expression with a preceding value.
            // foo(1) => ['(','foo',1]
            hasParen
                ? {
                    s: [OP],
                    b: 1,
                    r: 'val',
                    c: (r) => parenOTM[r.c0.tin].preval.active,
                    u: { paren_preval: true },
                    g: 'expr,expr-paren,expr-paren-preval',
                }
                : NONE,
            hasTernary
                ? {
                    s: [TERN1],
                    c: (r) => !!r.n.expr_ternary,
                    b: 1,
                    g: 'expr,expr-ternary',
                }
                : NONE,
            // Don't create implicit list inside expression (comma separator).
            {
                s: [CA],
                c: (r) => (1 === r.d && (1 <= r.n.expr || 1 <= r.n.expr_ternary)) ||
                    (1 <= r.n.expr_ternary && 1 <= r.n.expr_paren),
                b: 1,
                g: 'expr,list,val,imp,comma,top',
            },
            // Don't create implicit list inside expression (space separator).
            {
                s: [VAL],
                c: (r) => (1 === r.d && (1 <= r.n.expr || 1 <= r.n.expr_ternary)) ||
                    (1 <= r.n.expr_ternary && 1 <= r.n.expr_paren),
                b: 1,
                g: 'expr,list,val,imp,space,top',
            },
        ]);
    });
    jsonic.rule('list', (rs) => {
        // rs.bo(false, (...rest: any) => {
        rs.bo(false, (r) => {
            // List elements are new expressions.
            // Unless this is an implicit list.
            if (!r.prev.use.implist) {
                r.n.expr = 0;
                r.n.expr_prefix = 0;
                r.n.expr_suffix = 0;
                r.n.expr_paren = 0;
                r.n.expr_ternary = 0;
            }
        }).close([
            hasParen && {
                s: [CP],
                // If end of normal list, consume `]` - it's not a close paren.
                b: (r) => (CS === r.c0.tin && !r.n.expr_paren ? 0 : 1),
            },
        ]);
    });
    jsonic.rule('map', (rs) => {
        rs.bo(false, (...rest) => {
            // Map values are new expressions.
            rest[0].n.expr = 0;
            rest[0].n.expr_prefix = 0;
            rest[0].n.expr_suffix = 0;
            rest[0].n.expr_paren = 0;
            rest[0].n.expr_ternary = 0;
        }).close([
            hasParen && {
                s: [CP],
                // If end of normal map, consume `}` - it's not a close paren.
                b: (r) => (CB === r.c0.tin && !r.n.expr_paren ? 0 : 1),
            },
        ]);
    });
    jsonic.rule('elem', (rs) => {
        rs.close([
            // Close implicit list within parens.
            hasParen
                ? {
                    s: [CP],
                    b: 1,
                    c: (r) => !!r.n.expr_paren,
                    g: 'expr,expr-paren,imp,close,list',
                }
                : NONE,
            // Following elem is a paren expression.
            hasParen
                ? {
                    s: [OP],
                    b: 1,
                    r: 'elem',
                    g: 'expr,expr-paren,imp,open,list',
                }
                : NONE,
        ]);
    });
    jsonic.rule('pair', (rs) => {
        rs.close([
            // Close implicit map within parens.
            hasParen
                ? {
                    s: [CP],
                    b: 1,
                    c: (r) => !!r.n.expr_paren || 0 < r.n.pk,
                    g: 'expr,expr-paren,imp,map',
                }
                : NONE,
        ]);
    });
    jsonic.rule('expr', (rs) => {
        rs.open([
            hasPrefix
                ? {
                    s: [PREFIX],
                    c: (r) => !!r.n.expr_prefix,
                    n: { expr: 1, dlist: 1, dmap: 1 },
                    p: 'val',
                    g: 'expr,expr-prefix',
                    a: (r) => {
                        const op = makeOp(r.o0, prefixTM);
                        r.node = isOp(r.parent.node)
                            ? prattify(r.parent.node, op)
                            : prior(r, r.parent, op);
                    },
                }
                : NONE,
            hasInfix
                ? {
                    s: [INFIX],
                    p: 'val',
                    n: { expr: 1, expr_prefix: 0, dlist: 1, dmap: 1 },
                    a: (r) => {
                        const prev = r.prev;
                        const parent = r.parent;
                        const op = makeOp(r.o0, infixTM);
                        // Second and further operators.
                        if (isOp(parent.node) && !isTernaryOp(parent.node)) {
                            r.node = prattify(parent.node, op);
                        }
                        // First term was unary expression.
                        else if (isOp(prev.node)) {
                            r.node = prattify(prev.node, op);
                            r.parent = prev;
                        }
                        // First term was plain value or ternary part.
                        else {
                            r.node = prior(r, prev, op);
                        }
                    },
                    g: 'expr,expr-infix',
                }
                : NONE,
            hasSuffix
                ? {
                    s: [SUFFIX],
                    n: { expr: 1, expr_prefix: 0, dlist: 1, dmap: 1 },
                    a: (r) => {
                        const prev = r.prev;
                        const op = makeOp(r.o0, suffixTM);
                        r.node = isOp(prev.node)
                            ? prattify(prev.node, op)
                            : prior(r, prev, op);
                    },
                    g: 'expr,expr-suffix',
                }
                : NONE,
        ])
            .bc((r) => {
            var _a;
            // Append final term to expression.
            if (isOp(r.node) && ((_a = r.node) === null || _a === void 0 ? void 0 : _a.length) - 1 < r.node[0].terms) {
                r.node.push(r.child.node);
            }
        })
            .close([
            hasInfix
                ? {
                    s: [INFIX],
                    // Complete prefix first.
                    c: (r) => !r.n.expr_prefix,
                    b: 1,
                    r: 'expr',
                    g: 'expr,expr-infix',
                }
                : NONE,
            hasSuffix
                ? {
                    s: [SUFFIX],
                    c: (r) => !r.n.expr_prefix,
                    b: 1,
                    r: 'expr',
                    g: 'expr,expr-suffix',
                }
                : NONE,
            hasParen
                ? {
                    s: [CP],
                    c: (r) => !!r.n.expr_paren,
                    b: 1,
                }
                : NONE,
            hasTernary
                ? {
                    s: [TERN0],
                    c: (r) => !r.n.expr_prefix,
                    b: 1,
                    r: 'ternary',
                    g: 'expr,expr-ternary',
                }
                : NONE,
            // Implicit list at the top level.
            {
                s: [CA],
                c: { d: 0 },
                n: { expr: 0 },
                r: 'elem',
                a: (rule) => (rule.parent.node = rule.node = [rule.node]),
                g: 'expr,comma,list,top',
            },
            // Implicit list at the top level.
            {
                s: [VAL],
                c: { d: 0 },
                n: { expr: 0 },
                b: 1,
                r: 'elem',
                a: (rule) => (rule.parent.node = rule.node = [rule.node]),
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
            // Expression ends on non-expression token.
            {
                n: { expr: 0 },
                g: 'expr,expr-end',
            },
        ])
            .ac((r) => {
            // Only evaluate at root of expr (where r.n.expr === 0)
            if (options.evaluate && 0 === r.n.expr) {
                // The parent node will contain the root of the expr tree
                r.parent.node = evaluate(r.parent, r.parent.node, options.evaluate);
            }
        });
    });
    jsonic.rule('paren', (rs) => {
        rs.bo((r) => {
            // Allow implicits inside parens
            // r.n.im = 0
            // r.n.il = 0
            r.n.dmap = 0;
            r.n.dlist = 0;
            r.n.pk = 0;
        })
            .open([
            hasParen
                ? {
                    s: [OP, CP],
                    b: 1,
                    g: 'expr,expr-paren,empty',
                    c: (r) => parenOTM[r.o0.tin].name === parenCTM[r.o1.tin].name,
                    a: makeOpenParen(parenOTM),
                }
                : NONE,
            hasParen
                ? {
                    s: [OP],
                    p: 'val',
                    n: {
                        expr_paren: 1,
                        expr: 0,
                        expr_prefix: 0,
                        expr_suffix: 0,
                    },
                    g: 'expr,expr-paren,open',
                    a: makeOpenParen(parenOTM),
                }
                : NONE,
        ])
            .close([
            hasParen
                ? {
                    s: [CP],
                    c: (r) => {
                        const pdef = parenCTM[r.c0.tin];
                        let pd = 'expr_paren_depth_' + pdef.name;
                        return !!r.n[pd];
                    },
                    a: makeCloseParen(parenCTM),
                    g: 'expr,expr-paren,close',
                }
                : NONE,
        ]);
    });
    // Ternary operators are like fancy parens.
    if (hasTernary) {
        jsonic.rule('ternary', (rs) => {
            rs.open([
                {
                    s: [TERN0],
                    p: 'val',
                    n: {
                        expr_ternary: 1,
                        expr: 0,
                        expr_prefix: 0,
                        expr_suffix: 0,
                    },
                    u: { expr_ternary_step: 1 },
                    g: 'expr,expr-ternary,open',
                    a: (r) => {
                        let op = makeOp(r.o0, ternaryTM);
                        r.use.expr_ternary_name = op.name;
                        if (isOp(r.prev.node)) {
                            r.node = makeNode(r.prev.node, op, dupNode(r.prev.node));
                        }
                        else {
                            r.node = r.prev.node = makeNode([], op, r.prev.node);
                        }
                        r.use.expr_ternary_paren =
                            r.n.expr_paren || r.prev.use.expr_ternary_paren || 0;
                        r.n.expr_paren = 0;
                    },
                },
                {
                    p: 'val',
                    c: (r) => 2 === r.prev.use.expr_ternary_step,
                    a: (r) => {
                        r.use.expr_ternary_step = r.prev.use.expr_ternary_step;
                        r.n.expr_paren = r.use.expr_ternary_paren =
                            r.prev.use.expr_ternary_paren;
                    },
                    g: 'expr,expr-ternary,step',
                },
            ]).close([
                {
                    s: [TERN1],
                    c: (r) => {
                        return (1 === r.use.expr_ternary_step &&
                            r.use.expr_ternary_name === ternaryTM[r.c0.tin].name);
                    },
                    r: 'ternary',
                    a: (r) => {
                        r.use.expr_ternary_step++;
                        r.node.push(r.child.node);
                    },
                    g: 'expr,expr-ternary,step',
                },
                // End of ternary at top level. Implicit list indicated by comma.
                {
                    s: [[CA, ...CP]],
                    c: implicitTernaryCond,
                    // Handle ternary as first item of imp list inside paren.
                    b: (_r, ctx) => (CP.includes(ctx.t0.tin) ? 1 : 0),
                    r: (r, ctx) => {
                        var _a;
                        return !CP.includes(ctx.t0.tin) &&
                            (0 === r.d ||
                                (r.prev.use.expr_ternary_paren && !((_a = r.parent.node) === null || _a === void 0 ? void 0 : _a.length)))
                            ? 'elem'
                            : '';
                    },
                    a: implicitTernaryAction,
                    g: 'expr,expr-ternary,list,val,imp,comma',
                },
                // End of ternary at top level.
                // Implicit list indicated by space separated value.
                {
                    c: implicitTernaryCond,
                    // Handle ternary as first item of imp list inside paren.
                    r: (r, ctx) => {
                        var _a;
                        return (0 === r.d ||
                            !CP.includes(ctx.t0.tin) ||
                            r.prev.use.expr_ternary_paren) &&
                            !((_a = r.parent.node) === null || _a === void 0 ? void 0 : _a.length) &&
                            ZZ !== ctx.t0.tin
                            ? 'elem'
                            : '';
                    },
                    a: implicitTernaryAction,
                    g: 'expr,expr-ternary,list,val,imp,space',
                },
                // End of ternary.
                {
                    c: (r) => 0 < r.d && 2 === r.use.expr_ternary_step,
                    a: (r) => {
                        r.node.push(r.child.node);
                    },
                    g: 'expr,expr-ternary,close',
                },
            ]);
        });
    }
};
exports.Expr = Expr;
// Convert prior (parent or previous) rule node into an expression.
function prior(rule, prior, op) {
    let prior_node = prior.node;
    if (isOp(prior.node)) {
        prior_node = dupNode(prior.node);
    }
    else {
        prior.node = [];
    }
    makeNode(prior.node, op);
    if (!op.prefix) {
        prior.node[1] = prior_node;
    }
    // Ensure first term val rule contains final expression.
    rule.parent = prior;
    return prior.node;
}
// Add token so that expression evaluator can reference source locations.
function makeOp(t, om) {
    return { ...om[t.tin], token: t, OP_MARK };
}
function makeNode(node, op, ...terms) {
    let out = node;
    out[0] = op;
    let tI = 0;
    for (; tI < terms.length; tI++) {
        out[tI + 1] = terms[tI];
    }
    out.length = tI + 1;
    return out;
}
function dupNode(node) {
    let out = [...node];
    return out;
}
function makeOpenParen(parenOTM) {
    return function openParen(r) {
        const op = makeOp(r.o0, parenOTM);
        let pd = 'expr_paren_depth_' + op.name;
        r.use[pd] = r.n[pd] = 1;
        r.node = undefined;
    };
}
function makeCloseParen(parenCTM) {
    return function closeParen(r) {
        if (isOp(r.child.node)) {
            r.node = r.child.node;
        }
        else if (undefined === r.node) {
            r.node = r.child.node;
        }
        const op = makeOp(r.c0, parenCTM);
        let pd = 'expr_paren_depth_' + op.name;
        // Construct completed paren expression.
        if (r.use[pd] === r.n[pd]) {
            const val = r.node;
            // r.node = [op.osrc]
            r.node = [op];
            if (undefined !== val) {
                r.node[1] = val;
            }
            if (r.parent.prev.use.paren_preval) {
                if (isParenOp(r.parent.prev.node)) {
                    r.node = makeNode(r.parent.prev.node, r.node[0], dupNode(r.parent.prev.node), r.node[1]);
                }
                else {
                    r.node.splice(1, 0, r.parent.prev.node);
                    r.parent.prev.node = r.node;
                }
            }
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
        else if (isOp(paren.child.node)) {
            paren.child.node = [paren.child.node];
            a.r = 'elem';
            a.b = 0;
        }
        rule.node = paren.child.node;
    }
    return a;
}
function implicitTernaryCond(r) {
    return ((0 === r.d || 1 <= r.n.expr_paren) &&
        !r.n.pk &&
        2 === r.use.expr_ternary_step);
}
function implicitTernaryAction(r, _ctx, a) {
    r.n.expr_paren = r.prev.use.expr_ternary_paren;
    r.node.push(r.child.node);
    if ('elem' === a.r) {
        r.node[0] = dupNode(r.node);
        r.node.length = 1;
    }
}
function isParenOp(node) {
    return isOpKind('paren', node);
}
function isTernaryOp(node) {
    return isOpKind('ternary', node);
}
function isOpKind(kind, node) {
    return null == node ? false : isOp(node) && true === node[0][kind];
}
function isOp(node) {
    return null == node ? false : node[0] && node[0].OP_MARK === OP_MARK;
}
function makeOpMap(token, fixed, op, anyfix) {
    return Object.entries(op)
        .filter(([_, opdef]) => opdef[anyfix])
        .reduce((odm, [name, opdef]) => {
        let tkn = '';
        let tin = -1;
        let src = '';
        if ('string' === typeof opdef.src) {
            src = opdef.src;
        }
        else {
            src = opdef.src[0];
        }
        tin = (fixed(src) || token('#E' + src));
        tkn = token(tin);
        let op = (odm[tin] = {
            src: src,
            left: opdef.left || Number.MIN_SAFE_INTEGER,
            right: opdef.right || Number.MAX_SAFE_INTEGER,
            name: name + (name.endsWith('-' + anyfix) ? '' : '-' + anyfix),
            infix: 'infix' === anyfix,
            prefix: 'prefix' === anyfix,
            suffix: 'suffix' === anyfix,
            ternary: 'ternary' === anyfix,
            tkn,
            tin,
            terms: 'ternary' === anyfix ? 3 : 'infix' === anyfix ? 2 : 1,
            use: {},
            paren: false,
            osrc: '',
            csrc: '',
            otkn: '',
            ctkn: '',
            otin: -1,
            ctin: -1,
            preval: {
                active: false,
                required: false,
            },
            token: {},
            OP_MARK,
        });
        // Handle the second operator if ternary.
        if (op.ternary) {
            let srcs = opdef.src;
            op.src = srcs[0];
            op.use.ternary = { opI: 0 };
            let op2 = { ...op };
            src = opdef.src[1];
            tin = (fixed(src) || token('#E' + src));
            tkn = token(tin);
            op2.src = src;
            op2.use = { ternary: { opI: 1 } };
            op2.tkn = tkn;
            op2.tin = tin;
            odm[tin] = op2;
        }
        return odm;
    }, {});
}
function makeParenMap(token, fixed, optop) {
    return entries(optop).reduce((a, [name, pdef]) => {
        if (pdef.paren) {
            let otin = (fixed(pdef.osrc) || token('#E' + pdef.osrc));
            let otkn = token(otin);
            let ctin = (fixed(pdef.csrc) || token('#E' + pdef.csrc));
            let ctkn = token(ctin);
            a[otin] = {
                name: name + '-paren',
                osrc: pdef.osrc,
                csrc: pdef.csrc,
                otkn,
                otin,
                ctkn,
                ctin,
                preval: {
                    // True by default if preval specified.
                    active: null == pdef.preval
                        ? false
                        : null == pdef.preval.active
                            ? true
                            : pdef.preval.active,
                    // False by default.
                    required: null == pdef.preval
                        ? false
                        : null == pdef.preval.required
                            ? false
                            : pdef.preval.required,
                },
                use: {},
                paren: true,
                src: pdef.osrc,
                // left: -1,
                // right: -1,
                left: Number.MIN_SAFE_INTEGER,
                right: Number.MAX_SAFE_INTEGER,
                infix: false,
                prefix: false,
                suffix: false,
                ternary: false,
                tkn: '',
                tin: -1,
                terms: 1,
                token: {},
                OP_MARK,
            };
        }
        return a;
    }, {});
}
Expr.defaults = {
    op: {
        positive: {
            prefix: true,
            right: 14000,
            src: '+',
        },
        negative: {
            prefix: true,
            right: 14000,
            src: '-',
        },
        // NOTE: all these are left-associative as left < right
        // Example: 2+3+4 === (2+3)+4
        addition: {
            infix: true,
            left: 140,
            right: 150,
            src: '+',
        },
        subtraction: {
            infix: true,
            left: 140,
            right: 150,
            src: '-',
        },
        multiplication: {
            infix: true,
            left: 160,
            right: 170,
            src: '*',
        },
        division: {
            infix: true,
            left: 160,
            right: 170,
            src: '/',
        },
        remainder: {
            infix: true,
            left: 160,
            right: 170,
            src: '%',
        },
        plain: {
            paren: true,
            osrc: '(',
            csrc: ')',
        },
    },
};
// Pratt algorithm embeds next operator.
// NOTE: preserves referential integrity of root expression.
function prattify(expr, op) {
    let out = expr;
    let expr_op = expr[0];
    if (op) {
        if (op.infix) {
            // op is lower
            if (expr_op.suffix || op.left <= expr_op.right) {
                makeNode(expr, op, dupNode(expr));
            }
            // op is higher
            else {
                const end = expr_op.terms;
                if (isOp(expr[end]) && expr[end][0].right < op.left) {
                    out = prattify(expr[end], op);
                }
                else {
                    out = expr[end] = makeNode([], op, expr[end]);
                }
            }
        }
        else if (op.prefix) {
            out = expr[expr_op.terms] = makeNode([], op);
        }
        else if (op.suffix) {
            if (!expr_op.suffix && expr_op.right <= op.left) {
                const end = expr_op.terms;
                // NOTE: special case: higher precedence suffix "drills" into
                // lower precedence prefixes: @@1! => @(@(1!)), not @((@1)!)
                if (isOp(expr[end]) &&
                    expr[end][0].prefix &&
                    expr[end][0].right < op.left) {
                    prattify(expr[end], op);
                }
                else {
                    expr[end] = makeNode([], op, expr[end]);
                }
            }
            else {
                makeNode(expr, op, dupNode(expr));
            }
        }
    }
    return out;
}
function evaluate(rule, expr, resolve) {
    if (null == expr) {
        return expr;
    }
    if (isOp(expr)) {
        return resolve(rule, expr[0], expr.slice(1).map((term) => evaluate(rule, term, resolve)));
    }
    return expr;
}
exports.evaluate = evaluate;
const testing = {
    prattify,
    opify: (x) => ((x.OP_MARK = OP_MARK), x),
};
exports.testing = testing;
//# sourceMappingURL=expr.js.map