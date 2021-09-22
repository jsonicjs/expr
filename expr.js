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
    // NOTE: the following transformations convert the user-friendly operations
    // definition list in options.op into more useful internal lookup structures.
    const opm = jsonic.util.omap(options.op, ([n, od]) => [n, {
            ...od,
            name: n,
            tkn: '',
            tin: -1
        }]);
    const pm = jsonic.util.omap(options.paren, ([n, pd]) => [n, {
            ...pd,
            name: n,
            otkn: '',
            otin: -1,
            ctkn: '',
            ctin: -1,
            prefix: true === pd.prefix,
            suffix: true === pd.suffix,
        }]);
    console.log('pm', pm);
    // Lookup for operator binding powers.
    const obp = jsonic.util.omap(opm, ([n, od]) => [n, od.bp]);
    // Operator src may be used for an existing token, in which case, use that.
    const resolveToken = (a, name, src) => {
        var _a, _b;
        if (null != src) {
            a[src] = {
                tn: jsonic.token(jsonic.fixed(src)) ||
                    // Operator src may be used for multiple operators (eg. unary and binary).
                    ((((_a = a[src]) === null || _a === void 0 ? void 0 : _a.tn) || '') + '#expr-' + name + src),
                n: (((_b = a[src]) === null || _b === void 0 ? void 0 : _b.n) || [])
            };
            a[src].n.push(name);
        }
    };
    // Determine unique token names. Some operations may share
    // operators (eg. positive, addition).
    const tm = Object.keys(opm).reduce((a, name) => (resolveToken(a, name, opm[name].src), a), {});
    Object.keys(pm).reduce((a, name) => (resolveToken(a, name + '-open', pm[name].osrc),
        resolveToken(a, name + '-close', pm[name].csrc),
        a), tm);
    console.log('tm', tm);
    // Fixed tokens for Jsonic options.
    const fixed = jsonic.util.omap(tm, ([src, tm]) => [tm.tn, src]);
    // Lookup token name by operation or paren name. Some operations or
    // parens may share tokens (eg. negative, subtraction).
    const n2tn = Object.keys(fixed).reduce((a, tn) => (tm[fixed[tn]].n.map(on => a[on] = tn), a), {});
    console.log('fixed', fixed);
    console.log('n2tn', n2tn);
    // Tokens for the parens.
    // fixed['#expr-open-paren'] = options?.paren?.open
    // fixed['#expr-close-paren'] = options?.paren?.close
    jsonic.options({
        fixed: {
            token: fixed
        }
    });
    // Lookup token Tin by operator name.
    // Example: op2t['addition'] === jsonic.token('#expr-addition')
    // const op2t: { [opname: string]: Tin } = jsonic.util.omap(op2tn,
    //  ([on, tn]: [string, string]) => [on, jsonic.token(tn)])
    Object.values(opm).map((od) => {
        od.tkn = n2tn[od.name];
        od.tin = jsonic.token(od.tkn);
    });
    console.log('opm', opm);
    Object.values(pm).map((pd) => {
        pd.otkn = n2tn[pd.name + '-open'];
        pd.otin = jsonic.token(pd.otkn);
        pd.ctkn = n2tn[pd.name + '-close'];
        pd.ctin = jsonic.token(pd.ctkn);
    });
    console.log('pm', pm);
    const OP = jsonic.token['#expr-open-paren'];
    const CP = jsonic.token['#expr-close-paren'];
    // const CS = jsonic.token['#CS']
    // Apply `fn` to all operations of specified order.
    const ofOrder = (order, map) => Object.values(opm)
        .filter((od) => order === od.order)
        .map(map ? od => map(od) : (od => od));
    const forBinary = (fn) => ofOrder(2, fn || (x => x));
    const forUnary = (filter, map) => ofOrder(1).filter(filter).map(map);
    let bt2od = forBinary().reduce((a, od) => (a[od.tin] = od, a), {});
    const BINARIES = [...forBinary(od => od.tin)];
    const put2od = {};
    const PREFIX_UNARIES = [...forUnary((od => -1 === od.bp[0]), (od => (put2od[od.tin] = od, od.tin)))];
    const sut2od = {};
    const SUFFIX_UNARIES = [...forUnary((od => -1 === od.bp[1]), (od => (sut2od[od.tin] = od, od.tin)))];
    const po2pd = {};
    const pc2pd = {};
    const PAREN_OPENS = Object.values(pm).map(pd => {
        po2pd[pd.otin] = pd;
        return pd.otin;
    });
    const PAREN_CLOSES = Object.values(pm).map(pd => {
        pc2pd[pd.ctin] = pd;
        return pd.ctin;
    });
    console.log('PAREN_OPENS', PAREN_OPENS);
    console.log('PAREN_CLOSES', PAREN_CLOSES);
    console.log('po2pd', po2pd);
    console.log('pc2pd', pc2pd);
    jsonic
        .rule('val', (rs) => {
        rs
            .open([
            {
                s: [PREFIX_UNARIES], b: 1, p: 'expr', g: 'expr,unary,prefix',
                u: { prefix: true },
            },
            { s: [PAREN_OPENS], b: 1, p: 'expr', g: 'expr,paren' },
        ])
            .close([
            {
                s: [SUFFIX_UNARIES], b: 1, r: 'expr', g: 'expr,unary,suffix',
                u: { suffix: true },
            },
            {
                s: [BINARIES], b: 1, g: 'expr,binary',
                u: { binary: true },
                h: (r, _, a) => {
                    // Only open an expression if not already in an expression.
                    a.r = !r.n.ed ? 'expr' : '';
                    return a;
                }
            },
            {
                s: [PAREN_CLOSES], b: 1, g: 'expr,paren',
            },
            // PAREN PREFIX
            // {
            //   s: [OP],
            //   p: 'expr',
            //   b: 1,
            //   u: { paren_prefix: true },
            // },
        ]);
    });
    jsonic
        .rule('expr', (rs) => {
        rs
            .bo(function box(r) {
            // r.use.root = r.prev.use.root
            r.n.bp = r.n.bp || Number.MAX_SAFE_INTEGER;
            // r.n.ed = (r.n.ed || 0) + 1
            // TODO: change to et for term count
            r.n.ed = (r.n.ed || 0);
            // console.log('EXPR BO ed=', r.n.ed, r.use.root?.id)
        })
            .open([
            {
                // TODO: handle overlap with SUFFIX_UNARIES
                s: [PREFIX_UNARIES], p: 'val', g: 'expr',
                c: (r) => r.parent.use.prefix,
                a: (r) => {
                    r.n.ed++;
                    r.parent.use.prefix = false;
                    r.use.prefix = true;
                    let od = put2od[r.o0.tin];
                    r.n.bp = obp[od.name][1];
                    r.node = [od.src];
                    r.node.expr$ = 1;
                    r.node.prefix$ = true;
                }
            },
            {
                s: [SUFFIX_UNARIES], g: 'expr',
                c: (r) => r.prev.use.suffix,
                a: (r) => {
                    r.n.ed++;
                    r.prev.use.suffix = false;
                    r.use.suffix = true;
                    let od = sut2od[r.o0.tin];
                    let val = r.prev.node;
                    r.n.bp = obp[od.name][0];
                    r.prev.node = r.node = [od.src, val];
                    r.node.expr$ = 1;
                    r.node.suffix$ = true;
                }
            },
            {
                s: [BINARIES], p: 'val', g: 'expr',
                c: (r) => r.prev.use.binary,
                a: (r) => {
                    r.use.op = r.o0.name;
                    r.n.ed++;
                    let od = bt2od[r.o0.tin];
                    let lhs = r.prev;
                    let lbp = od.bp[0];
                    let rbp = od.bp[1];
                    if (lbp < r.n.bp) {
                        // Preserve existing array references.
                        if (lhs.node.expr$) {
                            lhs.node[1] = [...lhs.node];
                            lhs.node[0] = od.src;
                            lhs.node.length = 2;
                        }
                        else {
                            lhs.node = [od.src, lhs.node];
                        }
                        r.node = lhs.node;
                    }
                    else if (lhs.node.expr$) {
                        r.node = [od.src, lhs.node[2]];
                        lhs.node[2] = r.node;
                        r.node.child$ = true;
                    }
                    r.node.expr$ = 2;
                    r.n.bp = rbp;
                }
            },
            {
                s: [PAREN_OPENS], p: 'expr',
                n: {
                    bp: 0, ed: 0, pd: 1,
                },
                g: 'expr',
                a: (r) => {
                    r.use.pd = r.n.pd;
                    // console.log('EXPR OP',
                    //   r.prev.id, r.prev.node, r.parent.id, r.parent.node)
                    // PAREN_PREFIX/SUFFIX
                    // if ('val' === r.parent.name && r.parent.use.paren_prefix) {
                    //   console.log('OP paren prefix', r.parent.node)
                    //   r.parent.node = [r.o0.src, r.parent.node]
                    //   // r.parent.node.expr$ = 2
                    //   // TERNARY
                    //   r.parent.node.expr$ = 3
                    //   r.node = r.parent.node
                    // }
                },
            },
            { p: 'val', g: 'expr' },
        ])
            .bc(function bc(r) {
            // Last value.
            if (undefined != r.node && r.node.length - 1 < r.node.expr$
                && r.node !== r.child.node) {
                r.node.push(r.child.node);
            }
            else {
                r.node = r.child.node;
            }
        })
            .close([
            {
                s: [BINARIES], b: 1, g: 'expr',
                u: { binary: true },
                h: (r, _, a) => {
                    a.r = (!r.use.prefix && !r.use.suffix) ? 'expr' : '';
                    return a;
                }
            },
            {
                s: [PAREN_CLOSES], g: 'expr', b: 1,
                h: (r, _, a) => {
                    if (r.use.pd === r.n.pd) {
                        a.b = 0;
                        // // TERNARY
                        // a.n = a.n || {}
                        // a.n.il = 1
                        // a.r = 'expr'
                    }
                    return a;
                }
            },
            // {
            //   s: [CS], g: 'expr',
            //   c: (r: Rule) => {
            //     console.log('CS', r.c0.tin, r.name, r.id, r.use, r.node)
            //     // let cn = 'expr' + r.o0.name
            //     // console.log('CLOSE cn', cn, r.use[cn], r.n[cn], (0 < r.use[cn]))
            //     // return (0 < r.use[cn]) && (r.use[cn] === r.n[cn])
            //     // return true
            //     if (r.use.ctin === r.c0.tin) {
            //       return true
            //     }
            //     else {
            //       return false
            //     }
            //   }
            // },
            {}
        ])
            .ac((r) => {
        });
    });
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
        // TODO: move to test
        factorial: {
            order: 1, bp: [10400, -1], src: '!'
        },
        // // TODO: move to test
        // indexation: {
        //   order: 2, bp: [2700, 2600], src: '[', csrc: ']'
        // },
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
    // paren: {
    //   open: '(',
    //   close: ')',
    // }
    paren: {
        pure: { osrc: '(', csrc: ')' },
        // TODO: move to test
        // index: { osrc: '[', csrc: ']', prefix: true },
        // ternary: { osrc: '?', csrc: ':', prefix: true, suffix: true },
        // quote: { osrc: '<<', csrc: '>>', suffix: true },
    }
};
//# sourceMappingURL=expr.js.map