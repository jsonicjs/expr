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
    // Lookup operator definitions; trim the operator names.
    const opm = options.op.reduce((a, od) => (od = jsonic.util.deep(od), od.name = od.name.trim(), a[od.name] = od, a), {});
    // Lookup for binding powers.
    const obp = jsonic.util.omap(opm, ([n, od]) => [n, od.bp]);
    // Determine unique token names. Some operations may share
    // operators (eg. positive, addition).
    const tm = Object.keys(opm).reduce((a, n) => {
        var _a, _b;
        return ((a[opm[n].src] = {
            tn: (((_a = a[opm[n].src]) === null || _a === void 0 ? void 0 : _a.tn) || '') + '#expr-' + n + opm[n].src,
            n: (((_b = a[opm[n].src]) === null || _b === void 0 ? void 0 : _b.n) || [])
        }), a[opm[n].src].n.push(n), a);
    }, {});
    // Fixed tokens for Jsonic options.
    const fixed = jsonic.util.omap(tm, ([src, tm]) => [tm.tn, src]);
    // Lookup token name by operation name. Some operations may share
    // tokens (eg. negative, subtraction).
    const op2tn = Object.keys(fixed).reduce((a, tn) => (tm[fixed[tn]].n.map(on => a[on] = tn), a), {});
    // Tokens for the parens.
    fixed['#expr-open-paren'] = options.paren.open;
    fixed['#expr-close-paren'] = options.paren.close;
    // console.log(opm)
    // console.log(obp)
    // console.log(tm)
    // console.log(fixed)
    // console.log(op2tn)
    jsonic.options({
        fixed: {
            token: fixed
            // token: {
            //   // // '#E^': { c: '^' },
            //   // '#E*': '*',
            //   // // '#E/': '/' ,
            //   // // '#E%': '%' ,
            //   // '#E+': '+',
            //   // '#E-': '-',
            //   // '#E(': '(',
            //   // '#E)': ')',
            // }
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
    console.dir(opm, { depth: null });
    // // let NR = jsonic.token.NR
    // let ADD = jsonic.token['#E+']
    // let MIN = jsonic.token['#E-']
    // let MUL = jsonic.token['#E*']
    // // let DIV = jsonic.token['#E/']
    // // let MOD = jsonic.token['#E%']
    // // let POW = jsonic.token['#E^']
    // let OP = jsonic.token['#E(']
    // let CP = jsonic.token['#E)']
    // let t2op = {
    //   [ADD]: '+',
    //   [MIN]: '-',
    //   [MUL]: '*',
    //   // [DIV]: '/',
    //   // [MOD]: '%',
    //   // [POW]: '^',
    // }
    // let obp = {
    //   [ADD]: [120, 130],
    //   [MUL]: [220, 230],
    //   [MIN]: [-1, 1120],
    // }
    // let op2tin = {
    //   '+': ADD,
    //   '*': MUL,
    //   '-': MIN,
    // }
    const OP = jsonic.token['#expr-open-paren'];
    const CP = jsonic.token['#expr-close-paren'];
    // Apply `fn` to all operations of specified order.
    const ofOrder = (order, fn) => Object.values(opm)
        .filter((od) => order === od.order)
        .map(od => fn(od));
    const forUnary = (fn) => ofOrder(1, fn || (x => x));
    const forBinary = (fn) => ofOrder(2, fn || (x => x));
    const BINARIES = [...forBinary(od => od.tin)];
    jsonic
        .rule('val', (rs) => {
        rs
            .open([
            { s: [OP], p: 'expr', n: { bp: 0 }, },
            // Unary creates an expression. Example: + ...
            ...forUnary(od => ({
                s: [od.tin],
                p: 'expr',
                a: (r) => {
                    r.n.bp = obp[od.name][1];
                    r.node = [od.src];
                    r.node.expr$ = 1;
                }
            }))
            // {
            //   s: [MIN], p: 'expr', a: (r: Rule) => {
            //     r.n.bp = obp[MIN][1]
            //     r.node = [t2op[MIN]]
            //     r.node.expr$ = 1
            //   }
            // }
        ])
            .close([
            // Value followed by binary operator creates an expression.
            // Example: 1 + ...
            // Rule is in CLOSE state, so replace with expr Rule. 
            {
                s: [BINARIES], r: 'expr', b: 1
            },
            // {
            //   s: [[ADD, MUL]], r: 'expr', b: 1
            // },
            { s: [CP], b: 1 }
        ]);
    });
    // console.log('val open alts', jsonic.rule('val').def.open)
    // console.log('val close alts', jsonic.rule('val').def.close)
    let unaryByTin = forUnary().reduce((a, od) => (a[od.tin] = od, a), {});
    let binaryByTin = forBinary().reduce((a, od) => (a[od.tin] = od, a), {});
    // console.log('unaryByTin', unaryByTin)
    // console.log('binaryByTin', binaryByTin)
    let binary = (r) => {
        let optin = r.o0.tin;
        let opsrc = r.o0.src;
        // let lbp = obp[optin][0]
        // let rbp = obp[optin][1]
        let od = binaryByTin[optin];
        let lbp = od.bp[0];
        let rbp = od.bp[1];
        let val = r.prev.node;
        if (undefined === val) {
            val = r.parent.use.root;
        }
        console.log('OP START', r.id, r.n, lbp, r.n.bp);
        if (lbp < r.n.bp) {
            console.log('UP A', opsrc, 'n', r.node, 'prev', r.prev.node, 'parent', r.parent.node);
            // r.parent.node[2] = val
            r.parent.node.push(val);
            r.node = [opsrc, r.parent.node];
            r.use.root = r.node;
            console.log('UP B', opsrc, 'n', r.node, 'prev', r.prev.node, 'parent', r.parent.node);
        }
        else {
            console.log('DOWN A', opsrc, 'n', r.node, 'prev', r.prev.node, 'parent', r.parent.node);
            if ('expr' === r.parent.name && null != r.parent.node) {
                // r.parent.node[2] = r.node = [opsrc, val]
                r.parent.node.push(r.node = [opsrc, val]);
                r.use.root = r.parent.node;
            }
            else {
                r.node = [opsrc, val];
                r.use.root = r.node;
            }
            console.log('DOWN B', opsrc, 'n', r.node, 'prev', r.prev.node, 'parent', r.parent.node);
        }
        r.n.bp = rbp;
        r.node.expr$ = r.node.expr$ || 2;
        // console.log('OP END', opsrc, r.n.bp, r.node, r.parent.node)
    };
    jsonic
        .rule('expr', (rs) => {
        rs
            .bo(function box(r) {
            r.n.bp = r.n.bp || 0;
            // console.log('EXP BO', r.node)
        })
            .open([
            { s: [BINARIES], a: binary, p: 'val' },
            // {
            //   s: [[ADD, MUL]], p: 'val',
            //   a: binary
            // },
            { p: 'val' }
        ])
            // .ao(function aox(r: Rule) {
            //   // console.log('EXP AO', r.node)
            // })
            .bc(function bcx(r) {
            if (null != r.node && r.node.length - 1 < r.node.expr$) {
                r.node.push(r.child.node);
                // if (undefined === r.node[1]) {
                //   r.node[1] = r.child.node
                // }
                // else if (undefined === r.node[2]) {
                //   r.node[2] = r.child.node
                // }
            }
        })
            .close([
            // { s: [[ADD, MUL]], p: 'expr', b: 1 },
            { s: [BINARIES], p: 'expr', b: 1 },
            { s: [CP] },
            { s: [] },
        ])
            .ac(function acx(r) {
            // console.log('EXP AC', r.node,
            //   'prev:', r.prev.name, r.prev.id, r.prev.node,
            //   'parent:', r.parent.name, r.parent.id, r.parent.node,
            // )
            // TODO: test for each cse below and commentary
            if (null == r.use.root) {
                r.node = r.child.node;
            }
            else if ('expr' === r.parent.name) {
                r.parent.use.root = r.use.root;
            }
            else if ('val' === r.prev.name) {
                r.prev.node = r.use.root;
            }
            else if ('val' === r.parent.name) {
                r.parent.node = r.use.root;
            }
        });
    });
    // console.dir(jsonic.rule('expr'))
};
exports.Expr = Expr;
Expr.defaults = {
    op: [
        { name: 'positive      ', order: 1, bp: [-1, 100400], src: '+' },
        { name: 'negative      ', order: 1, bp: [-1, 100400], src: '-' },
        // NOTE: right-associative as lbp > rbp
        // Example: 2**3**4 === 2**(3**4)
        { name: 'exponentiation', order: 2, bp: [1700, 1600], src: '**' },
        // NOTE: all these are left-associative as lbp < rbp
        // Example: 2+3+4 === (2+3)+4
        { name: 'addition      ', order: 2, bp: [140, 150], src: '+' },
        { name: 'subtraction   ', order: 2, bp: [140, 150], src: '-' },
        { name: 'multiplication', order: 2, bp: [160, 170], src: '*' },
        { name: 'division      ', order: 2, bp: [160, 170], src: '/' },
        { name: 'remainder     ', order: 2, bp: [160, 170], src: '%' },
    ],
    paren: {
        open: '(',
        close: ')',
    }
};
//# sourceMappingURL=expr.js.map