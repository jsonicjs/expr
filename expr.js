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
        od.tkn = op2tn[od.name];
        od.tin = jsonic.token(od.tkn);
    });
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
    jsonic
        .rule('val', (rs) => {
        rs
            .open([
        // {
        //   s: [PREFIX_UNARIES], b: 1, p: 'expr', g: 'expr',
        //   u: { prefix: true },
        // },
        // // TODO: counter for paren level
        // { s: [OP], p: 'expr', n: { bp: 0, ed: 1 }, g: 'expr' },
        ])
            .close([
            // {
            //   s: [SUFFIX_UNARIES], b: 1, g: 'expr', p: 'expr',
            //   u: { suffix: true },
            // },
            {
                s: [BINARIES], b: 1, g: 'expr',
                u: { binary: true },
                // r: 'expr',
                h: (r, _, a) => {
                    var _a;
                    // Only open an expression if not already in an expression.
                    a.r = !r.n.ed ? 'expr' : '';
                    if ('expr' === a.r) {
                        r.use.root = r;
                    }
                    console.log('VAL CLOSE BIN', a.r, r.n.ed, (_a = r.use.root) === null || _a === void 0 ? void 0 : _a.id);
                    return a;
                }
            },
            // { s: [CP], b: 1, g: 'expr' },
        ]);
    });
    jsonic
        .rule('expr', (rs) => {
        rs
            .bo(function box(r) {
            var _a;
            r.use.root = r.prev.use.root;
            r.n.bp = r.n.bp || Number.MAX_SAFE_INTEGER;
            r.n.ed = (r.n.ed || 0) + 1;
            console.log('EXPR BO ed=', r.n.ed, (_a = r.use.root) === null || _a === void 0 ? void 0 : _a.id);
        })
            .open([
            // {
            //   // TODO: handle overlap with SUFFIX_UNARIES
            //   s: [PREFIX_UNARIES], p: 'val', g: 'expr',
            //   c: (r: Rule) => r.parent.use.prefix,
            //   a: (r: Rule) => {
            //     let od = put2od[r.o0.tin]
            //     r.n.bp = obp[od.name][1]
            //     r.node = [od.src]
            //     r.node.expr$ = 1
            //   }
            // },
            // {
            //   s: [SUFFIX_UNARIES], g: 'expr',
            //   c: (r: Rule) => r.parent.use.suffix,
            //   a: (r: Rule) => {
            //     let od = sut2od[r.o0.tin]
            //     let val = r.parent.node
            //     r.n.bp = obp[od.name][0]
            //     r.node = [od.src, val]
            //     r.node.expr$ = 1
            //   }
            // },
            {
                s: [BINARIES], p: 'val', g: 'expr',
                // c: (r: Rule) => r.parent.use.binary,
                a: (r) => {
                    let od = bt2od[r.o0.tin];
                    // let val = r.parent.node
                    let lhs = r.prev;
                    // let lhs = r.use.root
                    // let val = lhs.node
                    let lbp = od.bp[0];
                    let rbp = od.bp[1];
                    console.log('EXP OPEN BIN A', lbp, r.n, 'r', JSON.parse(JSON.stringify(r.node)), 'lhs', JSON.parse(JSON.stringify(lhs.node)), 'root', JSON.parse(JSON.stringify(r.use.root.node)));
                    let log = '';
                    if (lbp < r.n.bp) {
                        log += 'D';
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
                        log += 'U';
                        r.node = [od.src, lhs.node[2]];
                        lhs.node[2] = r.node;
                        r.node.child$ = true;
                    }
                    r.node.expr$ = 2;
                    r.n.bp = rbp;
                    console.log('EXP OPEN BIN B', log, r.n, 'r', JSON.parse(JSON.stringify(r.node)), 'lhs', JSON.parse(JSON.stringify(lhs.node)), 'root', JSON.parse(JSON.stringify(r.use.root.node)));
                }
            },
            // { p: 'val', g: 'expr' }
        ])
            .bc(function bc(r) {
            // Last value.
            if (undefined != r.node && r.node.length - 1 < r.node.expr$) {
                r.node.push(r.child.node);
                console.log('EXPR BC PUSH', 'r', JSON.parse(JSON.stringify(r.node)), 'prev', JSON.parse(JSON.stringify(r.prev.node)), 'root', JSON.parse(JSON.stringify(r.use.root.node)));
            }
            else {
                // r.node = r.child.node
                console.log('EXPR BC REP', r.node);
            }
        })
            .close([
            {
                s: [BINARIES], b: 1, g: 'expr',
                u: { binary: true },
                r: 'expr'
                // h: (r: Rule, _, a: any) => {
                //   a.p =
                //     (// 1 === r.n.ed &&
                //       !r.parent.use.prefix &&
                //       !r.parent.use.suffix) ? 'expr' : ''
                //   console.log('EXPR CLOSE BIN', r.n, r.parent.use, a.p)
                //   return a
                // }
            },
            // { s: [CP], g: 'expr' },
            // {
            //   s: [CS], g: 'expr',
            //   // c: (r: Rule) => {
            //   //   let cn = 'expr' + r.o0.name
            //   //   console.log('CLOSE cn', cn, r.use[cn], r.n[cn], (0 < r.use[cn]))
            //   //   return (0 < r.use[cn]) && (r.use[cn] === r.n[cn])
            //   // }
            // },
        ])
            .ac((r) => {
            // if (!r.node?.child$) {
            // r.parent.node = r.node
            // r.prev.node = r.node
            // console.log('EXPR AC', r.prev.id, r.node)
            // }
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