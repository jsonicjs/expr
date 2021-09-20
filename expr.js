"use strict";
/* Copyright (c) 2021 Richard Rodger, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluate = exports.Expr = void 0;
const ops = {
    '+': function addop(a, b) { return a + b; },
    '-': function minop(a, b) { return a - b; },
    '*': function mulop(a, b) { return a * b; },
    '/': function divop(a, b) { return a / b; },
    '%': function modop(a, b) { return a % b; },
    '^': function powop(a, b) { return a ** b; },
};
function evaluate(n) {
    if ('number' === typeof n)
        return n;
    let a = 'number' === typeof n[1] ? n[1] : evaluate(n[1]);
    let b = 'number' === typeof n[2] ? n[2] : evaluate(n[2]);
    let v = ops[n[0]](a, b);
    return v;
}
exports.evaluate = evaluate;
let Expr = function expr(jsonic, options) {
    // let eval_expr = jsonic.options.plugin?.expr?.evaluate
    // eval_expr = null == eval_expr ? true : eval_expr
    var _a, _b;
    // NOTE: the following transformations convert the user-friendly operations
    // definition list in options.op into more useful internal lookup structures.
    // Lookup operator definitions; trim the operator names.
    // const opm: { [opname: string]: OpFullDef } =
    //   options.op.reduce((a: any, od: OpDef) =>
    //     (od = jsonic.util.deep(od), od.name = od.name.trim(), a[od.name] = od, a), {})
    const opm = jsonic.util.omap(options.op, ([n, od]) => [n, {
            ...od,
            name: n,
            tkn: '',
            tin: -1
        }]);
    // Lookup for binding powers.
    const obp = jsonic.util.omap(opm, ([n, od]) => [n, od.bp]);
    // Determine unique token names. Some operations may share
    // operators (eg. positive, addition).
    const tm = Object.keys(opm).reduce((a, n) => {
        var _a, _b;
        return ((a[opm[n].src] = {
            // Operator src may be used for an existing token, in which case, use that.
            tn: jsonic.token(jsonic.fixed(opm[n].src)) ||
                ((((_a = a[opm[n].src]) === null || _a === void 0 ? void 0 : _a.tn) || '') + '#expr-' + n + opm[n].src),
            n: (((_b = a[opm[n].src]) === null || _b === void 0 ? void 0 : _b.n) || [])
        }), a[opm[n].src].n.push(n), a);
    }, {});
    // Fixed tokens for Jsonic options.
    const fixed = jsonic.util.omap(tm, ([src, tm]) => [tm.tn, src]);
    // Lookup token name by operation name. Some operations may share
    // tokens (eg. negative, subtraction).
    const op2tn = Object.keys(fixed).reduce((a, tn) => (tm[fixed[tn]].n.map(on => a[on] = tn), a), {});
    // Tokens for the parens.
    fixed['#expr-open-paren'] = (_a = options === null || options === void 0 ? void 0 : options.paren) === null || _a === void 0 ? void 0 : _a.open;
    fixed['#expr-close-paren'] = (_b = options === null || options === void 0 ? void 0 : options.paren) === null || _b === void 0 ? void 0 : _b.close;
    // console.log(opm)
    // console.log(obp)
    // console.log(tm)
    // console.log(fixed)
    // console.log(op2tn)
    jsonic.options({
        fixed: {
            token: fixed
        }
    });
    // Lookup token Tin by operator name.
    // Example: op2t['addition'] === jsonic.token('#expr-addition')
    // const op2t: { [opname: string]: Tin } = jsonic.util.omap(op2tn,
    //  ([on, tn]: [string, string]) => [on, jsonic.token(tn)])
    // console.log('op2t', op2t)
    Object.values(opm).map((od) => {
        od.tkn = op2tn[od.name];
        od.tin = jsonic.token(od.tkn);
    });
    // console.dir(opm, { depth: null })
    const OP = jsonic.token['#expr-open-paren'];
    const CP = jsonic.token['#expr-close-paren'];
    const CS = jsonic.token['#CS'];
    // Apply `fn` to all operations of specified order.
    const ofOrder = (order, map) => Object.values(opm)
        .filter((od) => order === od.order)
        .map(map ? od => map(od) : (od => od));
    const forBinary = (fn) => ofOrder(2, fn || (x => x));
    const forUnary = (filter, map) => ofOrder(1).filter(filter).map(map);
    // const unaryPrefix = forUnary().filter(od => -1 === od.bp[0])
    // const unarySuffix = forUnary().filter(od => -1 === od.bp[1])
    // console.log('P', unaryPrefix, 'S', unarySuffix)
    const BINARIES = [...forBinary(od => od.tin)];
    const put2od = {};
    const PREFIX_UNARIES = [...forUnary((od => -1 === od.bp[0]), (od => (put2od[od.tin] = od, od.tin)))];
    const sut2od = {};
    const SUFFIX_UNARIES = [...forUnary((od => -1 === od.bp[1]), (od => (sut2od[od.tin] = od, od.tin)))];
    console.log('PREFIX_UNARIES', PREFIX_UNARIES);
    console.log('SUFFIX_UNARIES', SUFFIX_UNARIES);
    jsonic
        .rule('val', (rs) => {
        rs
            .open([
            {
                s: [PREFIX_UNARIES], b: 1, p: 'expr', g: 'expr',
                u: { prefix: true },
            }
            // // TODO: counter for paren level
            // { s: [OP], p: 'expr', n: { bp: 0 }, g: 'expr' },
            // // TODO: use [PREFIX_UNARIES] instead
            // // Unary prefix creates an expression. Example: + ...
            // //...forUnary().filter(od => -1 !== od.bp[1]).map(od => ({
            // ...unaryPrefix.map(od => ({
            //   s: [od.tin],
            //   p: 'expr',
            //   a: (r: Rule) => {
            //     r.n.bp = obp[od.name][1]
            //     r.node = [od.src]
            //     r.node.expr$ = 1
            //     r.use.root = r
            //   },
            //   g: 'expr'
            // }))
        ])
            .close([
            {
                s: [SUFFIX_UNARIES], b: 1, g: 'expr', p: 'expr',
                u: { suffix: true },
                // a: (r: Rule) => { r.use.val = r.node; r.node = undefined },
            },
            {
                s: [BINARIES], b: 1, g: 'expr',
                u: { binary: true },
                // a: (r: Rule) => { r.use.val = r.node; r.node = undefined },
                h: (r, _, a) => {
                    // console.log('VAL C', r.n)
                    a.p = !r.n.ed ? 'expr' : '';
                    return a;
                }
            },
            // ...unarySuffix.map(od => ({
            //   s: [od.tin],
            //   p: 'expr',
            //   a: (r: Rule) => {
            //     r.n.bp = obp[od.name][0]
            //     r.node = [od.src, r.node]
            //     r.node.expr$ = 1
            //     r.use.root = r
            //   },
            //   g: 'expr'
            // })),
            // // Value followed by binary operator creates an expression.
            // // Example: 1 + ...
            // { s: [BINARIES], b: 1, p: 'expr', g: 'expr' },
            // { s: [CP], b: 1, g: 'expr' },
        ]);
    });
    // console.log('val open alts', jsonic.rule('val').def.open)
    // console.log('val close alts', jsonic.rule('val').def.close)
    // let unaryByTin = forUnary().reduce((a, od) => (a[od.tin] = od, a), {})
    let bt2od = forBinary().reduce((a, od) => (a[od.tin] = od, a), {});
    // console.log('unaryByTin', unaryByTin)
    // console.log('binaryByTin', binaryByTin)
    // let binary = (r: Rule) => {
    //   // let cn = 'expr' + r.o0.name
    //   // r.use[cn] = r.n[cn] = null == r.n[cn] ? 1 : r.n[cn] + 1
    //   let optin = r.o0.tin
    //   let opsrc = r.o0.src
    //   let od = binaryByTin[optin]
    //   let lbp = od.bp[0]
    //   let rbp = od.bp[1]
    //   // let val = r.parent.node
    //   // r.parent.node = undefined
    //   let val = r.use.val
    //   let pexpr = 'expr' === r.parent.parent?.name ? r.parent.parent : undefined
    //   r.use.root = pexpr?.use.root || r
    //   console.log('OP START', opsrc, val, pexpr?.node, r.use.root.node)
    //   if (lbp < r.n.bp) {
    //     console.log('OP DOWN A', r.n.bp, lbp, pexpr?.node)
    //     // Parent gets value.
    //     if (pexpr) {
    //       pexpr.node.push(val)
    //       r.node = [od.src, pexpr.node]
    //       r.use.root.node = r.node
    //     }
    //     console.log('OP DOWN B', r.node, r.use.root.node)
    //   }
    //   else {
    //     console.log('OP UP A', r.n.bp, lbp, pexpr?.node)
    //     r.node = [od.src, val]
    //     if (pexpr) {
    //       pexpr.node.push(r.node)
    //       r.use.root.node = pexpr.node
    //     }
    //     else {
    //       r.use.root.node = r.node
    //     }
    //     console.log('OP UP B', r.node, r.use.root.node)
    //   }
    //   r.n.bp = rbp
    //   r.node.expr$ = r.node.expr$ || 2
    // }
    jsonic
        .rule('expr', (rs) => {
        rs
            .bo(function box(r) {
            // console.log('EXPR', r.parent?.use)
            r.n.bp = r.n.bp || 0;
            r.n.ed = (r.n.ed || 0) + 1;
            // let val = r.parent.node
            // r.parent.node = undefined
            // r.use.val = val
            // // console.log('EXP BO', r.node)
        })
            .open([
            {
                // TODO: handle overlap with SUFFIX_UNARIES
                s: [PREFIX_UNARIES], p: 'val', g: 'expr',
                c: (r) => r.parent.use.prefix,
                a: (r) => {
                    let od = put2od[r.o0.tin];
                    r.n.bp = obp[od.name][1];
                    r.node = [od.src];
                    r.node.expr$ = 1;
                    // r.use.root = r
                }
            },
            {
                s: [SUFFIX_UNARIES], g: 'expr',
                c: (r) => r.parent.use.suffix,
                a: (r) => {
                    let od = sut2od[r.o0.tin];
                    let val = r.parent.node;
                    r.n.bp = obp[od.name][0];
                    r.node = [od.src, val];
                    r.node.expr$ = 1;
                    // if (r.parent.node?.expr$) {
                    //   r.parent.node = r.node
                    // }
                    // r.use.root = r
                }
            },
            {
                s: [BINARIES], p: 'val', g: 'expr',
                c: (r) => r.parent.use.binary,
                a: (r) => {
                    let od = bt2od[r.o0.tin];
                    let val = r.parent.node;
                    let lbp = od.bp[0];
                    let rbp = od.bp[1];
                    console.log('BIN', lbp, r.n.bp, od.src, val);
                    // r.node = [od.src, val]
                    if (lbp < r.n.bp) {
                        r.node = [od.src, val];
                        // r.parent.node = r.node
                    }
                    else {
                        if (r.parent.node.expr$) {
                            r.node = [od.src, r.parent.node[2]];
                            // console.log('QQQ', r.node)
                            r.parent.node[2] = r.node;
                            r.node.child$ = true;
                        }
                        else {
                            r.node = [od.src, val];
                            // r.parent.node = r.node
                        }
                    }
                    r.node.expr$ = 2;
                    // r.parent.node = r.node
                    // if (r.parent.node?.expr$) {
                    //   r.parent.node = r.node
                    // }
                    r.n.bp = rbp;
                }
            },
            // { p: 'val', g: 'expr' }
        ])
            .bc(function bcx(r) {
            // Last value.
            if (r.node.length - 1 < r.node.expr$) {
                r.node.push(r.child.node);
            }
        })
            .close([
            { s: [BINARIES], p: 'expr', b: 1, g: 'expr', u: { binary: true } },
            // { s: [BINARIES], p: 'expr', b: 1, g: 'expr' },
            // { s: [CP], g: 'expr' },
            // {
            //   s: [CS], g: 'expr', c: (r: Rule) => {
            //     let cn = 'expr' + r.o0.name
            //     console.log('CLOSE cn', cn, r.use[cn], r.n[cn], (0 < r.use[cn]))
            //     return (0 < r.use[cn]) && (r.use[cn] === r.n[cn])
            //   }
            // },
            // { g: 'expr' },
        ])
            .ac((r) => {
            // let pexpr = 'expr' === r.parent.parent?.name ? r.parent.parent : undefined
            // // console.log('EXPR AC', pexpr?.node, r.use.root?.node)
            // if (pexpr && r.use.root?.node) {
            //   pexpr.node = r.use.root.node
            // }
            if (!r.node.child$) {
                r.parent.node = r.node;
            }
        });
    });
    // console.dir(jsonic.rule('expr'))
};
exports.Expr = Expr;
Expr.defaults = {
    // TODO: this should not be a list, use a map for easier overrides
    op: {
        positive: {
            order: 1, bp: [-1, 10400], src: '+'
        },
        negative: {
            order: 1, bp: [-1, 10400], src: '-'
        },
        factorial: {
            order: 1, bp: [10400, -1], src: '!'
        },
        // NOTE: right-associative as lbp > rbp
        // Example: 2**3**4 === 2**(3**4)
        exponentiation: {
            order: 2, bp: [1700, 1600], src: '**'
        },
        // NOTE: all these are left-associative as lbp < rbp
        // Example: 2+3+4 === (2+3)+4
        addition: {
            order: 2, bp: [140, 150], src: '+'
        },
        subtraction: {
            order: 2, bp: [140, 150], src: '-'
        },
        multiplication: {
            order: 2, bp: [160, 170], src: '*'
        },
        division: {
            order: 2, bp: [160, 170], src: '/'
        },
        remainder: {
            order: 2, bp: [160, 170], src: '%'
        },
    },
    paren: {
        open: '(',
        close: ')',
    }
};
//# sourceMappingURL=expr.js.map