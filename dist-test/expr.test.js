"use strict";
/* Copyright (c) 2021-2025 Richard Rodger and other contributors, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const code_1 = require("@hapi/code");
const jsonic_1 = require("jsonic");
const __1 = require("..");
const { omap } = jsonic_1.util;
const C = (x) => JSON.parse(JSON.stringify(x));
// Walk expr tree into simplified form where first element is the op src.
const S = (x, seen) => (seen = seen ?? new WeakSet(),
    seen?.has(x) ? '[CIRCLE]' : ((x && 'object' === typeof x ? seen?.add(x) : null),
        (x && Array.isArray(x)) ?
            (0 === x.length ? x : [
                x[0].src || S(x[0], seen),
                ...(1 < x.length ? (x.slice(1).map((t) => S(t, seen))) : [])
            ]
                .filter(t => undefined !== t)) :
            (null != x && 'object' === typeof (x) ? omap(x, ([n, v]) => [n, S(v, seen)]) : x)));
const mj = (je) => (s, m) => C(S(je(s, m)));
// const _mo_ = 'toMatchObject'
const _mo_ = 'equal';
function makeOp(opspec) {
    const base = { infix: false, prefix: false, suffix: false, left: 0, right: 0 };
    const op = __1.testing.opify({
        ...base,
        name: '' + opspec.src,
        terms: opspec.infix ? 2 : 1,
        ...opspec,
    });
    return op;
}
function makeExpr(opspec, term0, term1) {
    const op = makeOp(opspec);
    const expr = [opspec];
    if (term0) {
        expr.push(term0);
    }
    if (term1) {
        expr.push(term1);
    }
    return expr;
}
(0, node_test_1.describe)('expr', () => {
    (0, node_test_1.beforeEach)(() => {
        global.console = require('console');
    });
    (0, node_test_1.test)('happy', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('1+2'))[_mo_](['+', 1, 2]);
        (0, code_1.expect)(j('-1+2'))[_mo_](['+', ['-', 1], 2]);
    });
    (0, node_test_1.test)('prattify-basic', () => {
        let prattify = __1.testing.prattify;
        let T = (expr, opdef) => C(S(prattify(expr, opdef)));
        let ME = makeExpr;
        let MO = makeOp;
        let PLUS_LA = MO({ infix: true, src: '+', left: 140, right: 150 });
        let PLUS_RA = MO({ infix: true, src: '+', left: 150, right: 140 });
        let MUL_LA = MO({ infix: true, src: '*', left: 160, right: 170 });
        let PIPE_LA = MO({ infix: true, src: '|', left: 18000, right: 17000 });
        let AT_P = MO({ prefix: true, src: '@', right: 1500 });
        let PER_P = MO({ prefix: true, src: '%', right: 1300 });
        let BANG_S = MO({ suffix: true, src: '!', left: 1600 });
        let QUEST_S = MO({ suffix: true, src: '?', left: 1400 });
        let E;
        // console.log(S(['+', 1, 2]))
        // console.log(S([{ src: '+' }, 1, 2]))
        // console.log(S([{ src: '+' }, [{ src: '+' }, 1, 2], 3]))
        // 1+2+N => (1+2)+N
        (0, code_1.expect)(T(E = ME(PLUS_LA, 1, 2), PLUS_LA))[_mo_](['+', ['+', 1, 2]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['+', ['+', 1, 2]]);
        // 1+2+N => 1+(2+N)
        (0, code_1.expect)(T(E = ME(PLUS_RA, 1, 2), PLUS_RA))[_mo_](['+', 2]);
        (0, code_1.expect)(C(S(E)))[_mo_](['+', 1, ['+', 2]]);
        // 1+2*N => 1+(2*N)
        (0, code_1.expect)(T(E = ME(PLUS_LA, 1, 2), MUL_LA))[_mo_](['*', 2]);
        (0, code_1.expect)(C(S(E)))[_mo_](['+', 1, ['*', 2]]);
        // 1*2+N => (1+2)+N
        (0, code_1.expect)(T(E = ME(MUL_LA, 1, 2), PLUS_LA))[_mo_](['+', ['*', 1, 2]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['+', ['*', 1, 2]]);
        // @1+N => (@1)+N
        (0, code_1.expect)(T(E = ME(AT_P, 1), PLUS_LA))[_mo_](['+', ['@', 1]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['+', ['@', 1]]);
        // 1!+N => (!1)+N
        (0, code_1.expect)(T(E = ME(BANG_S, 1), PLUS_LA))[_mo_](['+', ['!', 1]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['+', ['!', 1]]);
        // @1|N => @(1|N)
        (0, code_1.expect)(T(E = ME(AT_P, 1), PIPE_LA))[_mo_](['|', 1]);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['|', 1]]);
        // 1|@N => 1|(@N)
        (0, code_1.expect)(T(E = ME(PIPE_LA, 1), AT_P))[_mo_](['@']);
        (0, code_1.expect)(C(S(E)))[_mo_](['|', 1, ['@']]);
        // 1!|N => (!1)|N
        (0, code_1.expect)(T(E = ME(BANG_S, 1), PIPE_LA))[_mo_](['|', ['!', 1]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['|', ['!', 1]]);
        // 1+@N => 1+(@N)
        (0, code_1.expect)(T(E = ME(PLUS_LA, 1), AT_P))[_mo_](['@']);
        (0, code_1.expect)(C(S(E)))[_mo_](['+', 1, ['@']]);
        // @@N => @(@N)
        (0, code_1.expect)(T(E = ME(AT_P), AT_P))[_mo_](['@']);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['@']]);
        // %@N => %(@N)
        (0, code_1.expect)(T(E = ME(PER_P), AT_P))[_mo_](['@']);
        (0, code_1.expect)(C(S(E)))[_mo_](['%', ['@']]);
        // @%N => @(%N)
        (0, code_1.expect)(T(E = ME(AT_P), PER_P))[_mo_](['%']);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['%']]);
        // 1+2! => 1+(2!)
        // expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['!', 2])
        (0, code_1.expect)(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['+', 1, ['!', 2]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['+', 1, ['!', 2]]);
        // 1|2! => (1|2)!
        (0, code_1.expect)(T(E = ME(PIPE_LA, 1, 2), BANG_S))[_mo_](['!', ['|', 1, 2]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['!', ['|', 1, 2]]);
        // 1!! => !(!1)
        (0, code_1.expect)(T(E = ME(BANG_S, 1), BANG_S))[_mo_](['!', ['!', 1]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['!', ['!', 1]]);
        // 1!? => ?(!1)
        (0, code_1.expect)(T(E = ME(BANG_S, 1), QUEST_S))[_mo_](['?', ['!', 1]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['?', ['!', 1]]);
        // 1?! => !(?1)
        (0, code_1.expect)(T(E = ME(QUEST_S, 1), BANG_S))[_mo_](['!', ['?', 1]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['!', ['?', 1]]);
        // @1! => @(1!)
        // expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['!', 1])
        (0, code_1.expect)(T(E = ME(AT_P, 1), BANG_S))[_mo_](['@', ['!', 1]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['!', 1]]);
        // @1? => (@1)?
        (0, code_1.expect)(T(E = ME(AT_P, 1), QUEST_S))[_mo_](['?', ['@', 1]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['?', ['@', 1]]);
        // @@1! => @(@(1!))
        // expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['!', 1])
        (0, code_1.expect)(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['@', ['@', ['!', 1]]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['@', ['!', 1]]]);
        // @@1? => (@(@1))?
        (0, code_1.expect)(T(E = ME(AT_P, ME(AT_P, 1)), QUEST_S))[_mo_](['?', ['@', ['@', 1]]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['?', ['@', ['@', 1]]]);
    });
    (0, node_test_1.test)('prattify-assoc', () => {
        let prattify = __1.testing.prattify;
        let T = (expr, opdef) => C(S(prattify(expr, opdef)));
        let ME = makeExpr;
        let MO = makeOp;
        let AT_LA = MO({ infix: true, src: '@', left: 14, right: 15 });
        let PER_RA = MO({ infix: true, src: '%', left: 17, right: 16 });
        let E;
        // 1@2@N
        (0, code_1.expect)(T(E = ME(AT_LA, 1, 2), AT_LA))[_mo_](['@', ['@', 1, 2]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['@', 1, 2]]);
        // 1@2@3@N
        (0, code_1.expect)(T(E = ME(AT_LA, ME(AT_LA, 1, 2), 3), AT_LA))[_mo_](['@', ['@', ['@', 1, 2], 3]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['@', ['@', 1, 2], 3]]);
        // 1@2@3@4@N
        (0, code_1.expect)(T(E = ME(AT_LA, ME(AT_LA, ME(AT_LA, 1, 2), 3), 4), AT_LA))[_mo_](['@', ['@', ['@', ['@', 1, 2], 3], 4]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['@', ['@', ['@', 1, 2], 3], 4]]);
        // 1@2@3@4@5@N
        (0, code_1.expect)(T(E = ME(AT_LA, ME(AT_LA, ME(AT_LA, ME(AT_LA, 1, 2), 3), 4), 5), AT_LA))[_mo_](['@', ['@', ['@', ['@', ['@', 1, 2], 3], 4], 5]]);
        (0, code_1.expect)(C(S(E)))[_mo_](['@', ['@', ['@', ['@', ['@', 1, 2], 3], 4], 5]]);
        // 1%2%N
        (0, code_1.expect)(T(E = ME(PER_RA, 1, 2), PER_RA))[_mo_](['%', 2]);
        (0, code_1.expect)(C(S(E)))[_mo_](['%', 1, ['%', 2]]);
        // 1%2%3%N
        (0, code_1.expect)(T(E = ME(PER_RA, 1, ME(PER_RA, 2, 3)), PER_RA))[_mo_](['%', 3]);
        (0, code_1.expect)(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3]]]);
        // 1%2%3%4%N
        (0, code_1.expect)(T(E = ME(PER_RA, 1, ME(PER_RA, 2, ME(PER_RA, 3, 4))), PER_RA))[_mo_](['%', 4]);
        (0, code_1.expect)(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3, ['%', 4]]]]);
        // 1%2%3%4%5%N
        (0, code_1.expect)(T(E = ME(PER_RA, 1, ME(PER_RA, 2, ME(PER_RA, 3, ME(PER_RA, 4, 5)))), PER_RA))[_mo_](['%', 5]);
        (0, code_1.expect)(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3, ['%', 4, ['%', 5]]]]]);
    });
    (0, node_test_1.test)('binary', () => {
        const j = mj(jsonic_1.Jsonic.make()
            // .use(Debug, { print: false, trace: true })
            .use(__1.Expr));
        // console.log(j('1+2+3'))
        // console.log(j('+1+2+3'))
        (0, code_1.expect)(j('1+2'))[_mo_](['+', 1, 2]);
        (0, code_1.expect)(j('1*2'))[_mo_](['*', 1, 2]);
        (0, code_1.expect)(j('1*2+3'))[_mo_](['+', ['*', 1, 2], 3]);
        (0, code_1.expect)(j('1+2*3'))[_mo_](['+', 1, ['*', 2, 3]]);
        (0, code_1.expect)(j('1*2*3'))[_mo_](['*', ['*', 1, 2], 3]);
        (0, code_1.expect)(j('1+2+3+4'))[_mo_](['+', ['+', ['+', 1, 2], 3], 4]);
        (0, code_1.expect)(j('1*2+3+4'))[_mo_](['+', ['+', ['*', 1, 2], 3], 4]);
        (0, code_1.expect)(j('1+2*3+4'))[_mo_](['+', ['+', 1, ['*', 2, 3]], 4]);
        (0, code_1.expect)(j('1+2+3*4'))[_mo_](['+', ['+', 1, 2], ['*', 3, 4]]);
        (0, code_1.expect)(j('1+2*3*4'))[_mo_](['+', 1, ['*', ['*', 2, 3], 4]]);
        (0, code_1.expect)(j('1*2+3*4'))[_mo_](['+', ['*', 1, 2], ['*', 3, 4]]);
        (0, code_1.expect)(j('1*2*3+4'))[_mo_](['+', ['*', ['*', 1, 2], 3], 4]);
        (0, code_1.expect)(j('1*2*3*4'))[_mo_](['*', ['*', ['*', 1, 2], 3], 4]);
        (0, code_1.expect)(j('1+2+3+4+5'))[_mo_](['+', ['+', ['+', ['+', 1, 2], 3], 4], 5]);
        (0, code_1.expect)(j('1*2+3+4+5'))[_mo_](['+', ['+', ['+', ['*', 1, 2], 3], 4], 5]);
        (0, code_1.expect)(j('1+2*3+4+5'))[_mo_](['+', ['+', ['+', 1, ['*', 2, 3]], 4], 5]);
        (0, code_1.expect)(j('1+2+3*4+5'))[_mo_](['+', ['+', ['+', 1, 2], ['*', 3, 4]], 5]);
        (0, code_1.expect)(j('1+2+3+4*5'))[_mo_](['+', ['+', ['+', 1, 2], 3], ['*', 4, 5]]);
        (0, code_1.expect)(j('1*2*3+4+5'))[_mo_](['+', ['+', ['*', ['*', 1, 2], 3], 4], 5]);
        (0, code_1.expect)(j('1+2*3*4+5'))[_mo_](['+', ['+', 1, ['*', ['*', 2, 3], 4]], 5]);
        (0, code_1.expect)(j('1+2+3*4*5'))[_mo_](['+', ['+', 1, 2], ['*', ['*', 3, 4], 5]]);
        (0, code_1.expect)(j('1*2+3+4*5'))[_mo_](['+', ['+', ['*', 1, 2], 3], ['*', 4, 5]]);
        (0, code_1.expect)(j('1*2+3*4+5'))[_mo_](['+', ['+', ['*', 1, 2], ['*', 3, 4]], 5]);
        (0, code_1.expect)(j('1+2*3+4*5'))[_mo_](['+', ['+', 1, ['*', 2, 3]], ['*', 4, 5]]);
        (0, code_1.expect)(j('1+2*3*4*5'))[_mo_](['+', 1, ['*', ['*', ['*', 2, 3], 4], 5]]);
        (0, code_1.expect)(j('1*2+3*4*5'))[_mo_](['+', ['*', 1, 2], ['*', ['*', 3, 4], 5]]);
        (0, code_1.expect)(j('1*2*3+4*5'))[_mo_](['+', ['*', ['*', 1, 2], 3], ['*', 4, 5]]);
        (0, code_1.expect)(j('1*2*3*4+5'))[_mo_](['+', ['*', ['*', ['*', 1, 2], 3], 4], 5]);
        (0, code_1.expect)(j('1*2*3*4*5'))[_mo_](['*', ['*', ['*', ['*', 1, 2], 3], 4], 5]);
    });
    (0, node_test_1.test)('structure', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('a:1+2'))[_mo_]({ a: ['+', 1, 2] });
        (0, code_1.expect)(j('a:1+2,b:3+4'))[_mo_]({ a: ['+', 1, 2], b: ['+', 3, 4] });
        (0, code_1.expect)(j('[1+2]'))[_mo_]([['+', 1, 2]]);
        (0, code_1.expect)(j('[1+2,3+4]'))[_mo_]([['+', 1, 2], ['+', 3, 4]]);
        (0, code_1.expect)(j('{a:[1+2]}'))[_mo_]({ a: [['+', 1, 2]] });
    });
    (0, node_test_1.test)('implicit-list-top-basic', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('1,2'))[_mo_]([1, 2]);
        (0, code_1.expect)(j('1+2,3'))[_mo_]([['+', 1, 2], 3]);
        (0, code_1.expect)(j('1+2+3,4'))[_mo_]([['+', ['+', 1, 2], 3], 4]);
        (0, code_1.expect)(j('1+2+3+4,5'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5]);
        (0, code_1.expect)(j('1 2'))[_mo_]([1, 2]);
        (0, code_1.expect)(j('1+2 3'))[_mo_]([['+', 1, 2], 3]);
        (0, code_1.expect)(j('1+2+3 4'))[_mo_]([['+', ['+', 1, 2], 3], 4]);
        (0, code_1.expect)(j('1+2+3+4 5'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5]);
        (0, code_1.expect)(j('1,2,11'))[_mo_]([1, 2, 11]);
        (0, code_1.expect)(j('1+2,3,11'))[_mo_]([['+', 1, 2], 3, 11]);
        (0, code_1.expect)(j('1+2+3,4,11'))[_mo_]([['+', ['+', 1, 2], 3], 4, 11]);
        (0, code_1.expect)(j('1+2+3+4,5,11'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        (0, code_1.expect)(j('1 2 11'))[_mo_]([1, 2, 11]);
        (0, code_1.expect)(j('1+2 3 11'))[_mo_]([['+', 1, 2], 3, 11]);
        (0, code_1.expect)(j('1+2+3 4 11'))[_mo_]([['+', ['+', 1, 2], 3], 4, 11]);
        (0, code_1.expect)(j('1+2+3+4 5 11'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        (0, code_1.expect)(j('22,1,2,11'))[_mo_]([22, 1, 2, 11]);
        (0, code_1.expect)(j('22,1+2,3,11'))[_mo_]([22, ['+', 1, 2], 3, 11]);
        (0, code_1.expect)(j('22,1+2+3,4,11'))[_mo_]([22, ['+', ['+', 1, 2], 3], 4, 11]);
        (0, code_1.expect)(j('22,1+2+3+4,5,11'))[_mo_]([22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        (0, code_1.expect)(j('22 1 2 11'))[_mo_]([22, 1, 2, 11]);
        (0, code_1.expect)(j('22 1+2 3 11'))[_mo_]([22, ['+', 1, 2], 3, 11]);
        (0, code_1.expect)(j('22 1+2+3 4 11'))[_mo_]([22, ['+', ['+', 1, 2], 3], 4, 11]);
        (0, code_1.expect)(j('22 1+2+3+4 5 11'))[_mo_]([22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        (0, code_1.expect)(j('[true,false],1,2,11'))[_mo_]([[true, false], 1, 2, 11]);
        (0, code_1.expect)(j('[true,false],1+2,3,11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11]);
        (0, code_1.expect)(j('[true,false],1+2+3,4,11'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11]);
        (0, code_1.expect)(j('[true,false],1+2+3+4,5,11'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        (0, code_1.expect)(j('[true,false] 1 2 11'))[_mo_]([[true, false], 1, 2, 11]);
        (0, code_1.expect)(j('[true,false] 1+2 3 11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11]);
        (0, code_1.expect)(j('[true,false] 1+2+3 4 11'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11]);
        (0, code_1.expect)(j('[true,false] 1+2+3+4 5 11'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        (0, code_1.expect)(j('[true,false],1,2,{x:11,y:22}'))[_mo_]([[true, false], 1, 2, { x: 11, y: 22 }]);
        (0, code_1.expect)(j('[true,false],1+2,3,{x:11,y:22}'))[_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]);
        (0, code_1.expect)(j('[true,false],1+2+3,4,{x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]);
        (0, code_1.expect)(j('[true,false],1+2+3+4,5,{x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]);
        (0, code_1.expect)(j('[true,false] 1 2 {x:11,y:22}'))[_mo_]([[true, false], 1, 2, { x: 11, y: 22 }]);
        (0, code_1.expect)(j('[true,false] 1+2 3 {x:11,y:22}'))[_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]);
        (0, code_1.expect)(j('[true,false] 1+2+3 4 {x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]);
        (0, code_1.expect)(j('[true,false] 1+2+3+4 5 {x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]);
        (0, code_1.expect)(j('1+2,3+4'))[_mo_]([['+', 1, 2], ['+', 3, 4]]);
        (0, code_1.expect)(j('1+2,3+4,5+6'))[_mo_]([['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]);
    });
    (0, node_test_1.test)('implicit-list-top-paren', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('(1,2)'))[_mo_](['(', [1, 2]]);
        (0, code_1.expect)(j('(1+2,3)'))[_mo_](['(', [['+', 1, 2], 3]]);
        (0, code_1.expect)(j('(1+2+3,4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]]);
        (0, code_1.expect)(j('(1+2+3+4,5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]]);
        (0, code_1.expect)(j('(1 2)'))[_mo_](['(', [1, 2]]);
        (0, code_1.expect)(j('(1+2 3)'))[_mo_](['(', [['+', 1, 2], 3]]);
        (0, code_1.expect)(j('(1+2+3 4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]]);
        (0, code_1.expect)(j('(1+2+3+4 5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]]);
        (0, code_1.expect)(j('(1,2,11)'))[_mo_](['(', [1, 2, 11]]);
        (0, code_1.expect)(j('(1+2,3,11)'))[_mo_](['(', [['+', 1, 2], 3, 11]]);
        (0, code_1.expect)(j('(1+2+3,4,11)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4, 11]]);
        (0, code_1.expect)(j('(1+2+3+4,5,11)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        (0, code_1.expect)(j('(1 2 11)'))[_mo_](['(', [1, 2, 11]]);
        (0, code_1.expect)(j('(1+2 3 11)'))[_mo_](['(', [['+', 1, 2], 3, 11]]);
        (0, code_1.expect)(j('(1+2+3 4 11)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4, 11]]);
        (0, code_1.expect)(j('(1+2+3+4 5 11)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        (0, code_1.expect)(j('(22,1,2,11)'))[_mo_](['(', [22, 1, 2, 11]]);
        (0, code_1.expect)(j('(22,1+2,3,11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]]);
        (0, code_1.expect)(j('(22,1+2+3,4,11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]]);
        (0, code_1.expect)(j('(22,1+2+3+4,5,11)'))[_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        (0, code_1.expect)(j('(22 1 2 11)'))[_mo_](['(', [22, 1, 2, 11]]);
        (0, code_1.expect)(j('(22 1+2 3 11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]]);
        (0, code_1.expect)(j('(22 1+2+3 4 11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]]);
        (0, code_1.expect)(j('(22 1+2+3+4 5 11)'))[_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        (0, code_1.expect)(j('([true,false],1,2,11)'))[_mo_](['(', [[true, false], 1, 2, 11]]);
        (0, code_1.expect)(j('([true,false],1+2,3,11)'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]]);
        (0, code_1.expect)(j('([true,false],1+2+3,4,11)'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]]);
        (0, code_1.expect)(j('([true,false],1+2+3+4,5,11)'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        (0, code_1.expect)(j('([true,false] 1 2 11)'))[_mo_](['(', [[true, false], 1, 2, 11]]);
        (0, code_1.expect)(j('([true,false] 1+2 3 11)'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]]);
        (0, code_1.expect)(j('([true,false] 1+2+3 4 11)'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]]);
        (0, code_1.expect)(j('([true,false] 1+2+3+4 5 11)'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        (0, code_1.expect)(j('([true,false],1,2,{x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]]);
        (0, code_1.expect)(j('([true,false],1+2,3,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]]);
        (0, code_1.expect)(j('([true,false],1+2+3,4,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]]);
        (0, code_1.expect)(j('([true,false],1+2+3+4,5,{x:11,y:22})'))[_mo_](['(', [[true, false],
                ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]]);
        (0, code_1.expect)(j('([true,false] 1 2 {x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]]);
        (0, code_1.expect)(j('([true,false] 1+2 3 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]]);
        (0, code_1.expect)(j('([true,false] 1+2+3 4 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]]);
        (0, code_1.expect)(j('([true,false] 1+2+3+4 5 {x:11,y:22})'))[_mo_](['(', [[true, false],
                ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]]);
        (0, code_1.expect)(j('(1+2,3+4)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4]]]);
        (0, code_1.expect)(j('(1+2,3+4,5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        (0, code_1.expect)(j('(1+2 3+4)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4]]]);
        (0, code_1.expect)(j('(1+2 3+4 5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
    });
    (0, node_test_1.test)('map-implicit-list-paren', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('a:(1,2),b:0'))[_mo_]({ a: ['(', [1, 2]], b: 0 });
        (0, code_1.expect)(j('a:(1+2,3),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 });
        (0, code_1.expect)(j('a:(1+2+3,4),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 });
        (0, code_1.expect)(j('a:(1+2+3+4,5),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 });
        (0, code_1.expect)(j('a:(1 2),b:0'))[_mo_]({ a: ['(', [1, 2]], b: 0 });
        (0, code_1.expect)(j('a:(1+2 3),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 });
        (0, code_1.expect)(j('a:(1+2+3 4),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 });
        (0, code_1.expect)(j('a:(1+2+3+4 5),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 });
        (0, code_1.expect)(j('a:(1,2,11),b:0'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('a:(1+2,3,11),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('a:(1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('a:(1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('a:(1 2 11),b:0'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('a:(1+2 3 11),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('a:(1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('a:(1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('a:(22,1,2,11),b:0'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('a:(22,1+2,3,11),b:0'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('a:(22,1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('a:(22,1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('a:(22 1 2 11),b:0'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('a:(22 1+2 3 11),b:0'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('a:(22 1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('a:(22 1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false],1,2,11),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false],1+2,3,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false],1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false],1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false] 1 2 11),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false] 1+2 3 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false] 1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false] 1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('a:([true,false],1,2,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('a:([true,false],1+2,3,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('a:([true,false],1+2+3,4,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('a:([true,false],1+2+3+4,5,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('a:([true,false] 1 2 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('a:([true,false] 1+2 3 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('a:([true,false] 1+2+3 4 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('a:([true,false] 1+2+3+4 5 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:(1,2),b:0}'))[_mo_]({ a: ['(', [1, 2]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2,3),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2+3,4),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2+3+4,5),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 });
        (0, code_1.expect)(j('{a:(1 2),b:0}'))[_mo_]({ a: ['(', [1, 2]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2 3),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2+3 4),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2+3+4 5),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 });
        (0, code_1.expect)(j('{a:(1,2,11),b:0}'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2,3,11),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(1 2 11),b:0}'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2 3 11),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(22,1,2,11),b:0}'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(22,1+2,3,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(22,1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(22,1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(22 1 2 11),b:0}'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(22 1+2 3 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(22 1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('{a:(22 1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false],1,2,11),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false],1+2,3,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false],1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false],1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false] 1 2 11),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false] 1+2 3 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false] 1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false] 1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false],1,2,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false],1+2,3,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false],1+2+3,4,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false],1+2+3+4,5,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false] 1 2 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false] 1+2 3 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false] 1+2+3 4 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:([true,false] 1+2+3+4 5 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 });
        (0, code_1.expect)(j('{a:(1+2,3+4)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4]]] });
        (0, code_1.expect)(j('{a:(1+2,3+4,5+6)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]] });
        (0, code_1.expect)(j('{a:(1+2 3+4)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4]]] });
        (0, code_1.expect)(j('{a:(1+2 3+4 5+6)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]] });
    });
    (0, node_test_1.test)('unary-prefix-basic', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('1')).equal(1);
        (0, code_1.expect)(j('z')).equal('z');
        (0, code_1.expect)(j('-1'))[_mo_](['-', 1]);
        (0, code_1.expect)(j('- 1'))[_mo_](['-', 1]);
        (0, code_1.expect)(j('+1'))[_mo_](['+', 1]);
        (0, code_1.expect)(j('+ 1'))[_mo_](['+', 1]);
        (0, code_1.expect)(j('--1'))[_mo_](['-', ['-', 1]]);
        (0, code_1.expect)(j('---1'))[_mo_](['-', ['-', ['-', 1]]]);
        (0, code_1.expect)(j('++1'))[_mo_](['+', ['+', 1]]);
        (0, code_1.expect)(j('+++1'))[_mo_](['+', ['+', ['+', 1]]]);
        (0, code_1.expect)(j('-+1'))[_mo_](['-', ['+', 1]]);
        (0, code_1.expect)(j('+-1'))[_mo_](['+', ['-', 1]]);
        (0, code_1.expect)(j('--+1'))[_mo_](['-', ['-', ['+', 1]]]);
        (0, code_1.expect)(j('-+-1'))[_mo_](['-', ['+', ['-', 1]]]);
        (0, code_1.expect)(j('+--1'))[_mo_](['+', ['-', ['-', 1]]]);
        (0, code_1.expect)(j('-++1'))[_mo_](['-', ['+', ['+', 1]]]);
        (0, code_1.expect)(j('++-1'))[_mo_](['+', ['+', ['-', 1]]]);
        (0, code_1.expect)(j('-z'))[_mo_](['-', 'z']);
        (0, code_1.expect)(j('- z'))[_mo_](['-', 'z']);
        (0, code_1.expect)(j('+z'))[_mo_](['+', 'z']);
        (0, code_1.expect)(j('+ z'))[_mo_](['+', 'z']);
        (0, code_1.expect)(j('--z'))[_mo_](['-', ['-', 'z']]);
        (0, code_1.expect)(j('---z'))[_mo_](['-', ['-', ['-', 'z']]]);
        (0, code_1.expect)(j('++z'))[_mo_](['+', ['+', 'z']]);
        (0, code_1.expect)(j('+++z'))[_mo_](['+', ['+', ['+', 'z']]]);
        (0, code_1.expect)(j('-+z'))[_mo_](['-', ['+', 'z']]);
        (0, code_1.expect)(j('+-z'))[_mo_](['+', ['-', 'z']]);
        (0, code_1.expect)(j('--+z'))[_mo_](['-', ['-', ['+', 'z']]]);
        (0, code_1.expect)(j('-+-z'))[_mo_](['-', ['+', ['-', 'z']]]);
        (0, code_1.expect)(j('+--z'))[_mo_](['+', ['-', ['-', 'z']]]);
        (0, code_1.expect)(j('-++z'))[_mo_](['-', ['+', ['+', 'z']]]);
        (0, code_1.expect)(j('++-z'))[_mo_](['+', ['+', ['-', 'z']]]);
        (0, code_1.expect)(j('-{z:1}'))[_mo_](['-', { z: 1 }]);
        (0, code_1.expect)(j('- {z:1}'))[_mo_](['-', { z: 1 }]);
        (0, code_1.expect)(j('+{z:1}'))[_mo_](['+', { z: 1 }]);
        (0, code_1.expect)(j('+ {z:1}'))[_mo_](['+', { z: 1 }]);
        (0, code_1.expect)(j('-{z:1,y:2}'))[_mo_](['-', { z: 1, y: 2 }]);
        (0, code_1.expect)(j('- {z:1,y:2}'))[_mo_](['-', { z: 1, y: 2 }]);
        (0, code_1.expect)(j('+{z:1,y:2}'))[_mo_](['+', { z: 1, y: 2 }]);
        (0, code_1.expect)(j('+ {z:1,y:2}'))[_mo_](['+', { z: 1, y: 2 }]);
        (0, code_1.expect)(j('-{z:1 y:2}'))[_mo_](['-', { z: 1, y: 2 }]);
        (0, code_1.expect)(j('- {z:1 y:2}'))[_mo_](['-', { z: 1, y: 2 }]);
        (0, code_1.expect)(j('+{z:1 y:2}'))[_mo_](['+', { z: 1, y: 2 }]);
        (0, code_1.expect)(j('+ {z:1 y:2}'))[_mo_](['+', { z: 1, y: 2 }]);
        (0, code_1.expect)(j('-{z:1,y:2,x:3}'))[_mo_](['-', { z: 1, y: 2, x: 3 }]);
        (0, code_1.expect)(j('- {z:1,y:2,x:3}'))[_mo_](['-', { z: 1, y: 2, x: 3 }]);
        (0, code_1.expect)(j('+{z:1,y:2,x:3}'))[_mo_](['+', { z: 1, y: 2, x: 3 }]);
        (0, code_1.expect)(j('+ {z:1,y:2,x:3}'))[_mo_](['+', { z: 1, y: 2, x: 3 }]);
        (0, code_1.expect)(j('-{z:1 y:2 x:3}'))[_mo_](['-', { z: 1, y: 2, x: 3 }]);
        (0, code_1.expect)(j('- {z:1 y:2 x:3}'))[_mo_](['-', { z: 1, y: 2, x: 3 }]);
        (0, code_1.expect)(j('+{z:1 y:2 x:3}'))[_mo_](['+', { z: 1, y: 2, x: 3 }]);
        (0, code_1.expect)(j('+ {z:1 y:2 x:3}'))[_mo_](['+', { z: 1, y: 2, x: 3 }]);
        (0, code_1.expect)(j('-{z:-1}'))[_mo_](['-', { z: ['-', 1] }]);
        (0, code_1.expect)(j('- {z:-1}'))[_mo_](['-', { z: ['-', 1] }]);
        (0, code_1.expect)(j('+{z:+1}'))[_mo_](['+', { z: ['+', 1] }]);
        (0, code_1.expect)(j('+ {z:+1}'))[_mo_](['+', { z: ['+', 1] }]);
        (0, code_1.expect)(j('-{z:2-1}'))[_mo_](['-', { z: ['-', 2, 1] }]);
        (0, code_1.expect)(j('- {z:2-1}'))[_mo_](['-', { z: ['-', 2, 1] }]);
        (0, code_1.expect)(j('+{z:2+1}'))[_mo_](['+', { z: ['+', 2, 1] }]);
        (0, code_1.expect)(j('+ {z:2+1}'))[_mo_](['+', { z: ['+', 2, 1] }]);
        (0, code_1.expect)(j('--{z:1}'))[_mo_](['-', ['-', { z: 1 }]]);
        (0, code_1.expect)(j('---{z:1}'))[_mo_](['-', ['-', ['-', { z: 1 }]]]);
        (0, code_1.expect)(j('++{z:1}'))[_mo_](['+', ['+', { z: 1 }]]);
        (0, code_1.expect)(j('+++{z:1}'))[_mo_](['+', ['+', ['+', { z: 1 }]]]);
        (0, code_1.expect)(j('-+{z:1}'))[_mo_](['-', ['+', { z: 1 }]]);
        (0, code_1.expect)(j('+-{z:1}'))[_mo_](['+', ['-', { z: 1 }]]);
        (0, code_1.expect)(j('--+{z:1}'))[_mo_](['-', ['-', ['+', { z: 1 }]]]);
        (0, code_1.expect)(j('-+-{z:1}'))[_mo_](['-', ['+', ['-', { z: 1 }]]]);
        (0, code_1.expect)(j('+--{z:1}'))[_mo_](['+', ['-', ['-', { z: 1 }]]]);
        (0, code_1.expect)(j('-++{z:1}'))[_mo_](['-', ['+', ['+', { z: 1 }]]]);
        (0, code_1.expect)(j('++-{z:1}'))[_mo_](['+', ['+', ['-', { z: 1 }]]]);
        (0, code_1.expect)(j('-[11,22]'))[_mo_](['-', [11, 22]]);
        (0, code_1.expect)(j('- [11,22]'))[_mo_](['-', [11, 22]]);
        (0, code_1.expect)(j('+[11,22]'))[_mo_](['+', [11, 22]]);
        (0, code_1.expect)(j('+ [11,22]'))[_mo_](['+', [11, 22]]);
        (0, code_1.expect)(j('--[11,22]'))[_mo_](['-', ['-', [11, 22]]]);
        (0, code_1.expect)(j('---[11,22]'))[_mo_](['-', ['-', ['-', [11, 22]]]]);
        (0, code_1.expect)(j('++[11,22]'))[_mo_](['+', ['+', [11, 22]]]);
        (0, code_1.expect)(j('+++[11,22]'))[_mo_](['+', ['+', ['+', [11, 22]]]]);
        (0, code_1.expect)(j('-+[11,22]'))[_mo_](['-', ['+', [11, 22]]]);
        (0, code_1.expect)(j('+-[11,22]'))[_mo_](['+', ['-', [11, 22]]]);
        (0, code_1.expect)(j('--+[11,22]'))[_mo_](['-', ['-', ['+', [11, 22]]]]);
        (0, code_1.expect)(j('-+-[11,22]'))[_mo_](['-', ['+', ['-', [11, 22]]]]);
        (0, code_1.expect)(j('+--[11,22]'))[_mo_](['+', ['-', ['-', [11, 22]]]]);
        (0, code_1.expect)(j('-++[11,22]'))[_mo_](['-', ['+', ['+', [11, 22]]]]);
        (0, code_1.expect)(j('++-[11,22]'))[_mo_](['+', ['+', ['-', [11, 22]]]]);
        (0, code_1.expect)(j('1+2'))[_mo_](['+', 1, 2]);
        (0, code_1.expect)(j('-1+2'))[_mo_](['+', ['-', 1], 2]);
        (0, code_1.expect)(j('--1+2'))[_mo_](['+', ['-', ['-', 1]], 2]);
        (0, code_1.expect)(j('-1+-2'))[_mo_](['+', ['-', 1], ['-', 2]]);
        (0, code_1.expect)(j('1+-2'))[_mo_](['+', 1, ['-', 2]]);
        (0, code_1.expect)(j('1++2'))[_mo_](['+', 1, ['+', 2]]);
        (0, code_1.expect)(j('-1++2'))[_mo_](['+', ['-', 1], ['+', 2]]);
        (0, code_1.expect)(j('-1+2+3'))[_mo_](['+', ['+', ['-', 1], 2], 3]);
        (0, code_1.expect)(j('-1+-2+3'))[_mo_](['+', ['+', ['-', 1], ['-', 2]], 3]);
        (0, code_1.expect)(j('-1+-2+-3'))[_mo_](['+', ['+', ['-', 1], ['-', 2]], ['-', 3]]);
        (0, code_1.expect)(j('-1+2+-3'))[_mo_](['+', ['+', ['-', 1], 2], ['-', 3]]);
        (0, code_1.expect)(j('1+2+3'))[_mo_](['+', ['+', 1, 2], 3]);
        (0, code_1.expect)(j('1+-2+3'))[_mo_](['+', ['+', 1, ['-', 2]], 3]);
        (0, code_1.expect)(j('1+-2+-3'))[_mo_](['+', ['+', 1, ['-', 2]], ['-', 3]]);
        (0, code_1.expect)(j('1+2+-3'))[_mo_](['+', ['+', 1, 2], ['-', 3]]);
    });
    (0, node_test_1.test)('unary-prefix-edge', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                at: {
                    prefix: true, right: 15000, src: '@'
                },
                tight: {
                    infix: true, left: 120_000, right: 130_000, src: '~'
                },
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('@1')).equal(['@', 1]);
        (0, code_1.expect)(j('@@1')).equal(['@', ['@', 1]]);
        (0, code_1.expect)(j('@@@1')).equal(['@', ['@', ['@', 1]]]);
        // Precedence does not matter within prefix sequences.
        (0, code_1.expect)(j('-@1')).equal(['-', ['@', 1]]);
        (0, code_1.expect)(j('@-1')).equal(['@', ['-', 1]]);
        (0, code_1.expect)(j('--@1')).equal(['-', ['-', ['@', 1]]]);
        (0, code_1.expect)(j('@--1')).equal(['@', ['-', ['-', 1]]]);
        (0, code_1.expect)(j('@@-1')).equal(['@', ['@', ['-', 1]]]);
        (0, code_1.expect)(j('-@@1')).equal(['-', ['@', ['@', 1]]]);
        (0, code_1.expect)(j('-@-1')).equal(['-', ['@', ['-', 1]]]);
        (0, code_1.expect)(j('@-@1')).equal(['@', ['-', ['@', 1]]]);
        (0, code_1.expect)(j('@1+2')).equal(['+', ['@', 1], 2]);
        (0, code_1.expect)(j('1+@2')).equal(['+', 1, ['@', 2]]);
        (0, code_1.expect)(j('@1+@2')).equal(['+', ['@', 1], ['@', 2]]);
        (0, code_1.expect)(j('@1+2+3')).equal(['+', ['+', ['@', 1], 2], 3]);
        (0, code_1.expect)(j('1+@2+3')).equal(['+', ['+', 1, ['@', 2]], 3]);
        (0, code_1.expect)(j('@1+@2+3')).equal(['+', ['+', ['@', 1], ['@', 2]], 3]);
        (0, code_1.expect)(j('@1+2+@3')).equal(['+', ['+', ['@', 1], 2], ['@', 3]]);
        (0, code_1.expect)(j('1+@2+@3')).equal(['+', ['+', 1, ['@', 2]], ['@', 3]]);
        (0, code_1.expect)(j('@1+@2+@3')).equal(['+', ['+', ['@', 1], ['@', 2]], ['@', 3]]);
        // Tighter!
        (0, code_1.expect)(j('@1~2')).equal(['@', ['~', 1, 2]]);
        (0, code_1.expect)(j('1~@2')).equal(['~', 1, ['@', 2]]);
        (0, code_1.expect)(j('@1~@2')).equal(['@', ['~', 1, ['@', 2]]]);
        (0, code_1.expect)(j('@1~2+3')).equal(['+', ['@', ['~', 1, 2]], 3]);
        (0, code_1.expect)(j('1~@2+3')).equal(['+', ['~', 1, ['@', 2]], 3]);
        (0, code_1.expect)(j('@1~@2+3')).equal(['+', ['@', ['~', 1, ['@', 2]]], 3]);
        (0, code_1.expect)(j('@1~2~3')).equal(['@', ['~', ['~', 1, 2], 3]]);
        (0, code_1.expect)(j('1~@2~3')).equal(['~', ['~', 1, ['@', 2]], 3]);
        (0, code_1.expect)(j('@1~@2~3')).equal(['@', ['~', ['~', 1, ['@', 2]], 3]]);
    });
    (0, node_test_1.test)('unary-suffix-basic', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                factorial: {
                    suffix: true, left: 15000, src: '!'
                },
                question: {
                    suffix: true, left: 13000, src: '?'
                },
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('1')).equal(1);
        (0, code_1.expect)(j('z')).equal('z');
        (0, code_1.expect)(j('1!'))[_mo_](['!', 1]);
        (0, code_1.expect)(j('1 !'))[_mo_](['!', 1]);
        (0, code_1.expect)(j('1!!'))[_mo_](['!', ['!', 1]]);
        (0, code_1.expect)(j('1!!!'))[_mo_](['!', ['!', ['!', 1]]]);
        (0, code_1.expect)(j('z!'))[_mo_](['!', 'z']);
        (0, code_1.expect)(j('z !'))[_mo_](['!', 'z']);
        (0, code_1.expect)(j('1?'))[_mo_](['?', 1]);
        (0, code_1.expect)(j('1 ?'))[_mo_](['?', 1]);
        (0, code_1.expect)(j('1??'))[_mo_](['?', ['?', 1]]);
        (0, code_1.expect)(j('1???'))[_mo_](['?', ['?', ['?', 1]]]);
        (0, code_1.expect)(j('1+2!'))[_mo_](['+', 1, ['!', 2]]);
        (0, code_1.expect)(j('1!+2'))[_mo_](['+', ['!', 1], 2]);
        (0, code_1.expect)(j('1!+2!'))[_mo_](['+', ['!', 1], ['!', 2]]);
        (0, code_1.expect)(j('1+2!!'))[_mo_](['+', 1, ['!', ['!', 2]]]);
        (0, code_1.expect)(j('1!!+2'))[_mo_](['+', ['!', ['!', 1]], 2]);
        (0, code_1.expect)(j('1!!+2!!'))[_mo_](['+', ['!', ['!', 1]], ['!', ['!', 2]]]);
        (0, code_1.expect)(j('1+2?'))[_mo_](['+', 1, ['?', 2]]);
        (0, code_1.expect)(j('1?+2'))[_mo_](['+', ['?', 1], 2]);
        (0, code_1.expect)(j('1?+2?'))[_mo_](['+', ['?', 1], ['?', 2]]);
        (0, code_1.expect)(j('1+2??'))[_mo_](['+', 1, ['?', ['?', 2]]]);
        (0, code_1.expect)(j('1??+2'))[_mo_](['+', ['?', ['?', 1]], 2]);
        (0, code_1.expect)(j('1??+2??'))[_mo_](['+', ['?', ['?', 1]], ['?', ['?', 2]]]);
        (0, code_1.expect)(j('0+1+2!'))[_mo_](['+', ['+', 0, 1], ['!', 2]]);
        (0, code_1.expect)(j('0+1!+2'))[_mo_](['+', ['+', 0, ['!', 1]], 2]);
        (0, code_1.expect)(j('0+1!+2!'))[_mo_](['+', ['+', 0, ['!', 1]], ['!', 2]]);
        (0, code_1.expect)(j('0!+1!+2!'))[_mo_](['+', ['+', ['!', 0], ['!', 1]], ['!', 2]]);
        (0, code_1.expect)(j('0!+1!+2'))[_mo_](['+', ['+', ['!', 0], ['!', 1]], 2]);
        (0, code_1.expect)(j('0!+1+2!'))[_mo_](['+', ['+', ['!', 0], 1], ['!', 2]]);
        (0, code_1.expect)(j('0!+1+2'))[_mo_](['+', ['+', ['!', 0], 1], 2]);
    });
    (0, node_test_1.test)('unary-suffix-edge', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                factorial: {
                    suffix: true, left: 15000, src: '!'
                },
                question: {
                    suffix: true, left: 13000, src: '?'
                },
                tight: {
                    infix: true, left: 120_000, right: 130_000, src: '~'
                },
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('1!')).equal(['!', 1]);
        (0, code_1.expect)(j('1!!')).equal(['!', ['!', 1]]);
        (0, code_1.expect)(j('1!!!')).equal(['!', ['!', ['!', 1]]]);
        // Precedence does not matter within prefix sequences.
        (0, code_1.expect)(j('1!?')).equal(['?', ['!', 1]]);
        (0, code_1.expect)(j('1?!')).equal(['!', ['?', 1]]);
        (0, code_1.expect)(j('1!??')).equal(['?', ['?', ['!', 1]]]);
        (0, code_1.expect)(j('1??!')).equal(['!', ['?', ['?', 1]]]);
        (0, code_1.expect)(j('1?!!')).equal(['!', ['!', ['?', 1]]]);
        (0, code_1.expect)(j('1!!?')).equal(['?', ['!', ['!', 1]]]);
        (0, code_1.expect)(j('1?!?')).equal(['?', ['!', ['?', 1]]]);
        (0, code_1.expect)(j('1!?!')).equal(['!', ['?', ['!', 1]]]);
        (0, code_1.expect)(j('1!+2')).equal(['+', ['!', 1], 2]);
        (0, code_1.expect)(j('1+2!')).equal(['+', 1, ['!', 2]]);
        (0, code_1.expect)(j('1!+2!')).equal(['+', ['!', 1], ['!', 2]]);
        (0, code_1.expect)(j('1!+2+3')).equal(['+', ['+', ['!', 1], 2], 3]);
        (0, code_1.expect)(j('1+2!+3')).equal(['+', ['+', 1, ['!', 2]], 3]);
        (0, code_1.expect)(j('1!+2!+3')).equal(['+', ['+', ['!', 1], ['!', 2]], 3]);
        (0, code_1.expect)(j('1!+2+3!')).equal(['+', ['+', ['!', 1], 2], ['!', 3]]);
        (0, code_1.expect)(j('1+2!+3!')).equal(['+', ['+', 1, ['!', 2]], ['!', 3]]);
        (0, code_1.expect)(j('1!+2!+3!')).equal(['+', ['+', ['!', 1], ['!', 2]], ['!', 3]]);
        // Tighter!
        (0, code_1.expect)(j('1!~2')).equal(['~', ['!', 1], 2]);
        (0, code_1.expect)(j('1~2!')).equal(['!', ['~', 1, 2]]);
        (0, code_1.expect)(j('1!~2!')).equal(['!', ['~', ['!', 1], 2]]);
        (0, code_1.expect)(j('1!~2+3')).equal(['+', ['~', ['!', 1], 2], 3]);
        (0, code_1.expect)(j('1~2!+3')).equal(['+', ['!', ['~', 1, 2]], 3]);
        (0, code_1.expect)(j('1!~2!+3')).equal(['+', ['!', ['~', ['!', 1], 2]], 3]);
        (0, code_1.expect)(j('1!~2~3')).equal(['~', ['~', ['!', 1], 2], 3]);
        (0, code_1.expect)(j('1~2!~3')).equal(['~', ['!', ['~', 1, 2]], 3]);
        (0, code_1.expect)(j('1!~2!~3')).equal(['~', ['!', ['~', ['!', 1], 2]], 3]);
    });
    (0, node_test_1.test)('unary-suffix-structure', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                factorial: {
                    suffix: true, left: 15000, src: '!'
                },
                question: {
                    suffix: true, left: 13000, src: '?'
                },
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('1!,2!'))[_mo_]([['!', 1], ['!', 2]]);
        (0, code_1.expect)(j('1!,2!,3!'))[_mo_]([['!', 1], ['!', 2], ['!', 3]]);
        (0, code_1.expect)(j('1!,2!,3!,4!'))[_mo_]([['!', 1], ['!', 2], ['!', 3], ['!', 4]]);
        (0, code_1.expect)(j('1! 2!'))[_mo_]([['!', 1], ['!', 2]]);
        (0, code_1.expect)(j('1! 2! 3!'))[_mo_]([['!', 1], ['!', 2], ['!', 3]]);
        (0, code_1.expect)(j('1! 2! 3! 4!'))[_mo_]([['!', 1], ['!', 2], ['!', 3], ['!', 4]]);
        (0, code_1.expect)(j('[1!,2!]'))[_mo_]([['!', 1], ['!', 2]]);
        (0, code_1.expect)(j('[1!,2!,3!]'))[_mo_]([['!', 1], ['!', 2], ['!', 3]]);
        (0, code_1.expect)(j('[1!,2!,3!,4!]'))[_mo_]([['!', 1], ['!', 2], ['!', 3], ['!', 4]]);
        (0, code_1.expect)(j('[1! 2!]'))[_mo_]([['!', 1], ['!', 2]]);
        (0, code_1.expect)(j('[1! 2! 3!]'))[_mo_]([['!', 1], ['!', 2], ['!', 3]]);
        (0, code_1.expect)(j('[1! 2! 3! 4!]'))[_mo_]([['!', 1], ['!', 2], ['!', 3], ['!', 4]]);
        (0, code_1.expect)(j('a:1!'))[_mo_]({ a: ['!', 1] });
        (0, code_1.expect)(j('a:1!,b:2!'))[_mo_]({ a: ['!', 1], b: ['!', 2] });
        (0, code_1.expect)(j('a:1!,b:2!,c:3!'))[_mo_]({ a: ['!', 1], b: ['!', 2], c: ['!', 3] });
        (0, code_1.expect)(j('a:1!,b:2!,c:3!,d:4!'))[_mo_]({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] });
        (0, code_1.expect)(j('a:1! b:2!'))[_mo_]({ a: ['!', 1], b: ['!', 2] });
        (0, code_1.expect)(j('a:1! b:2! c:3!'))[_mo_]({ a: ['!', 1], b: ['!', 2], c: ['!', 3] });
        (0, code_1.expect)(j('a:1! b:2! c:3!,d:4!'))[_mo_]({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] });
        (0, code_1.expect)(j('{a:1!}'))[_mo_]({ a: ['!', 1] });
        (0, code_1.expect)(j('{a:1!,b:2!}'))[_mo_]({ a: ['!', 1], b: ['!', 2] });
        (0, code_1.expect)(j('{a:1!,b:2!,c:3!}'))[_mo_]({ a: ['!', 1], b: ['!', 2], c: ['!', 3] });
        (0, code_1.expect)(j('{a:1!,b:2!,c:3!,d:4!}'))[_mo_]({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] });
        (0, code_1.expect)(j('{a:1! b:2!}'))[_mo_]({ a: ['!', 1], b: ['!', 2] });
        (0, code_1.expect)(j('{a:1! b:2! c:3!}'))[_mo_]({ a: ['!', 1], b: ['!', 2], c: ['!', 3] });
        (0, code_1.expect)(j('{a:1! b:2! c:3! d:4!}'))[_mo_]({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] });
    });
    (0, node_test_1.test)('unary-suffix-prefix', () => {
        const je = jsonic_1.Jsonic.make()
            // .use(Debug, {
            //   trace: {
            //     rule: true,
            //     parse: false,
            //     lex: false,
            //     node: false,
            //     step: false,
            //     stack: false,
            //   }
            // })
            .use(__1.Expr, {
            op: {
                factorial: {
                    suffix: true, left: 15000, src: '!'
                },
                question: {
                    suffix: true, left: 13000, src: '?'
                },
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('-1!')).equal(['-', ['!', 1]]);
        (0, code_1.expect)(j('--1!')).equal(['-', ['-', ['!', 1]]]);
        (0, code_1.expect)(j('-1!!')).equal(['-', ['!', ['!', 1]]]);
        (0, code_1.expect)(j('--1!!')).equal(['-', ['-', ['!', ['!', 1]]]]);
        (0, code_1.expect)(j('-1!+2')).equal(['+', ['-', ['!', 1]], 2]);
        (0, code_1.expect)(j('--1!+2')).equal(['+', ['-', ['-', ['!', 1]]], 2]);
        (0, code_1.expect)(j('---1!+2')).equal(['+', ['-', ['-', ['-', ['!', 1]]]], 2]);
        (0, code_1.expect)(j('-1?')).equal(['?', ['-', 1]]);
        (0, code_1.expect)(j('--1?')).equal(['?', ['-', ['-', 1]]]);
        (0, code_1.expect)(j('-1??')).equal(['?', ['?', ['-', 1]]]);
        (0, code_1.expect)(j('--1??')).equal(['?', ['?', ['-', ['-', 1]]]]);
        (0, code_1.expect)(j('-1!?')).equal(['?', ['-', ['!', 1]]]);
        (0, code_1.expect)(j('-1!?!')).equal(['!', ['?', ['-', ['!', 1]]]]);
        (0, code_1.expect)(j('-1?+2')).equal(['+', ['?', ['-', 1]], 2]);
        (0, code_1.expect)(j('--1?+2')).equal(['+', ['?', ['-', ['-', 1]]], 2]);
        (0, code_1.expect)(j('-1??+2')).equal(['+', ['?', ['?', ['-', 1]]], 2]);
        (0, code_1.expect)(j('--1??+2')).equal(['+', ['?', ['?', ['-', ['-', 1]]]], 2]);
        (0, code_1.expect)(j('(-20)!')).equal(['!', ['(', ['-', 20]]]);
        (0, code_1.expect)(j('-(21!)')).equal(['-', ['(', ['!', 21]]]);
    });
    (0, node_test_1.test)('unary-suffix-paren', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                factorial: {
                    suffix: true, left: 15000, src: '!'
                },
                question: {
                    suffix: true, left: 13000, src: '?'
                },
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('(1)')).equal(['(', 1]);
        (0, code_1.expect)(j('(z)')).equal(['(', 'z']);
        (0, code_1.expect)(j('(1!)'))[_mo_](['(', ['!', 1]]);
        (0, code_1.expect)(j('(1 !)'))[_mo_](['(', ['!', 1]]);
        (0, code_1.expect)(j('(z!)'))[_mo_](['(', ['!', 'z']]);
        (0, code_1.expect)(j('(z !)'))[_mo_](['(', ['!', 'z']]);
        (0, code_1.expect)(j('(1+2!)'))[_mo_](['(', ['+', 1, ['!', 2]]]);
        (0, code_1.expect)(j('(1!+2)'))[_mo_](['(', ['+', ['!', 1], 2]]);
        (0, code_1.expect)(j('(1!+2!)'))[_mo_](['(', ['+', ['!', 1], ['!', 2]]]);
        (0, code_1.expect)(j('(0+1+2!)'))[_mo_](['(', ['+', ['+', 0, 1], ['!', 2]]]);
        (0, code_1.expect)(j('(0+1!+2)'))[_mo_](['(', ['+', ['+', 0, ['!', 1]], 2]]);
        (0, code_1.expect)(j('(0+1!+2!)'))[_mo_](['(', ['+', ['+', 0, ['!', 1]], ['!', 2]]]);
        (0, code_1.expect)(j('(0!+1!+2!)'))[_mo_](['(', ['+', ['+', ['!', 0], ['!', 1]], ['!', 2]]]);
        (0, code_1.expect)(j('(0!+1!+2)'))[_mo_](['(', ['+', ['+', ['!', 0], ['!', 1]], 2]]);
        (0, code_1.expect)(j('(0!+1+2!)'))[_mo_](['(', ['+', ['+', ['!', 0], 1], ['!', 2]]]);
        (0, code_1.expect)(j('(0!+1+2)'))[_mo_](['(', ['+', ['+', ['!', 0], 1], 2]]);
    });
    (0, node_test_1.test)('paren-basic', () => {
        const j = mj(jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(__1.Expr));
        (0, code_1.expect)(j('100+200'))[_mo_](['+', 100, 200]);
        (0, code_1.expect)(j('(100)'))[_mo_](['(', 100]);
        (0, code_1.expect)(j('(100)+200'))[_mo_](['+', ['(', 100], 200]);
        (0, code_1.expect)(j('100+(200)'))[_mo_](['+', 100, ['(', 200]]);
        (0, code_1.expect)(j('(1+2)'))[_mo_](['(', ['+', 1, 2]]);
        (0, code_1.expect)(j('(1+2+3)'))[_mo_](['(', ['+', ['+', 1, 2], 3]]);
        (0, code_1.expect)(j('(1+2+3+4)'))[_mo_](['(', ['+', ['+', ['+', 1, 2], 3], 4]]);
        (0, code_1.expect)(j('((1))'))[_mo_](['(', ['(', 1]]);
        (0, code_1.expect)(j('(((1)))'))[_mo_](['(', ['(', ['(', 1]]]);
        (0, code_1.expect)(j('((((1))))'))[_mo_](['(', ['(', ['(', ['(', 1]]]]);
        (0, code_1.expect)(j('(1+2)+3'))[_mo_](['+', ['(', ['+', 1, 2]], 3]);
        (0, code_1.expect)(j('1+(2+3)'))[_mo_](['+', 1, ['(', ['+', 2, 3]]]);
        (0, code_1.expect)(j('((1+2))+3'))[_mo_](['+', ['(', ['(', ['+', 1, 2]]], 3]);
        (0, code_1.expect)(j('1+((2+3))'))[_mo_](['+', 1, ['(', ['(', ['+', 2, 3]]]]);
        (0, code_1.expect)(j('(1)+2+3'))[_mo_](['+', ['+', ['(', 1], 2], 3]);
        (0, code_1.expect)(j('100+200+300'))[_mo_](['+', ['+', 100, 200], 300]);
        (0, code_1.expect)(j('100+(200)+300'))[_mo_](['+', ['+', 100, ['(', 200]], 300]);
        (0, code_1.expect)(j('1+2+(3)'))[_mo_](['+', ['+', 1, 2], ['(', 3]]);
        (0, code_1.expect)(j('1+(2)+(3)'))[_mo_](['+', ['+', 1, ['(', 2]], ['(', 3]]);
        (0, code_1.expect)(j('(1)+2+(3)'))[_mo_](['+', ['+', ['(', 1], 2], ['(', 3]]);
        (0, code_1.expect)(j('(1)+(2)+3'))[_mo_](['+', ['+', ['(', 1], ['(', 2]], 3]);
        (0, code_1.expect)(j('(1)+(2)+(3)'))[_mo_](['+', ['+', ['(', 1], ['(', 2]], ['(', 3]]);
        (0, code_1.expect)(j('(1+2)*3'))[_mo_](['*', ['(', ['+', 1, 2]], 3]);
        (0, code_1.expect)(j('1*(2+3)'))[_mo_](['*', 1, ['(', ['+', 2, 3]]]);
        (0, code_1.expect)(j('(a)'))[_mo_](['(', 'a']);
        (0, code_1.expect)(j('("a")'))[_mo_](['(', 'a']);
        (0, code_1.expect)(j('([])'))[_mo_](['(', []]);
        (0, code_1.expect)(j('([a])'))[_mo_](['(', ['a']]);
        (0, code_1.expect)(j('([a,b])'))[_mo_](['(', ['a', 'b']]);
        (0, code_1.expect)(j('([a b])'))[_mo_](['(', ['a', 'b']]);
        (0, code_1.expect)(j('([a,b,c])'))[_mo_](['(', ['a', 'b', 'c']]);
        (0, code_1.expect)(j('([a b c])'))[_mo_](['(', ['a', 'b', 'c']]);
        (0, code_1.expect)(j('({})'))[_mo_](['(', {}]);
        (0, code_1.expect)(j('({a:1})'))[_mo_](['(', { a: 1 }]);
        (0, code_1.expect)(j('({a:1,b:2})'))[_mo_](['(', { a: 1, b: 2 }]);
        (0, code_1.expect)(j('({a:1 b:2})'))[_mo_](['(', { a: 1, b: 2 }]);
        (0, code_1.expect)(j('({a:1,b:2,c:3})'))[_mo_](['(', { a: 1, b: 2, c: 3 }]);
        (0, code_1.expect)(j('({a:1 b:2 c:3})'))[_mo_](['(', { a: 1, b: 2, c: 3 }]);
        (0, code_1.expect)(j('(a:1)'))[_mo_](['(', { a: 1 }]);
        (0, code_1.expect)(j('()'))[_mo_](['(']);
        (0, code_1.expect)(j('(),()'))[_mo_]([['('], ['(']]);
        (0, code_1.expect)(j('(),(),()'))[_mo_]([['('], ['('], ['(']]);
        (0, code_1.expect)(j('() ()'))[_mo_]([['('], ['(']]);
        (0, code_1.expect)(j('() () ()'))[_mo_]([['('], ['('], ['(']]);
        (0, code_1.expect)(j('[()]'))[_mo_]([['(']]);
        (0, code_1.expect)(j('[(),()]'))[_mo_]([['('], ['(']]);
        (0, code_1.expect)(j('[(),(),()]'))[_mo_]([['('], ['('], ['(']]);
        (0, code_1.expect)(j('[() ()]'))[_mo_]([['('], ['(']]);
        (0, code_1.expect)(j('[() () ()]'))[_mo_]([['('], ['('], ['(']]);
        (0, code_1.expect)(j('{a:()}'))[_mo_]({ a: ['('] });
        (0, code_1.expect)(j('{a:(),b:()}'))[_mo_]({ a: ['('], b: ['('] });
        (0, code_1.expect)(j('{a:(),b:(),c:()}'))[_mo_]({ a: ['('], b: ['('], c: ['('] });
        (0, code_1.expect)(j('{a:() b:()}'))[_mo_]({ a: ['('], b: ['('] });
        (0, code_1.expect)(j('{a:() b:() c:()}'))[_mo_]({ a: ['('], b: ['('], c: ['('] });
    });
    (0, node_test_1.test)('paren-map-implicit-structure-comma', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('{a:(1)}'))[_mo_]({ a: ['(', 1] });
        (0, code_1.expect)(j('{a:(1,2)}'))[_mo_]({ a: ['(', [1, 2]] });
        (0, code_1.expect)(j('{a:(1,2,3)}'))[_mo_]({ a: ['(', [1, 2, 3]] });
        (0, code_1.expect)(j('{a:(1),b:9}'))[_mo_]({ a: ['(', 1], b: 9 });
        (0, code_1.expect)(j('{a:(1,2),b:9}'))[_mo_]({ a: ['(', [1, 2]], b: 9 });
        (0, code_1.expect)(j('{a:(1,2,3),b:9}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 });
        (0, code_1.expect)(j('{a:(1),b:9,c:8}'))[_mo_]({ a: ['(', 1], b: 9, c: 8 });
        (0, code_1.expect)(j('{a:(1,2),b:9,c:8}'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 });
        (0, code_1.expect)(j('{a:(1,2,3),b:9,c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        (0, code_1.expect)(j('{a:(1),b:(9)}'))[_mo_]({ a: ['(', 1], b: ['(', 9] });
        (0, code_1.expect)(j('{a:(1,2),b:(9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] });
        (0, code_1.expect)(j('{a:(1,2,3),b:(9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        (0, code_1.expect)(j('{a:(1),b:(9),c:8}'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{a:(1,2),b:(9),c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{a:(1,2,3),b:(9),c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{a:(1),b:(8,9)}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{a:(1,2),b:(8,9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{a:(1,2,3),b:(8,9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{a:(1),b:(8,9),c:8}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{a:(1,2),b:(8,9),c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{a:(1,2,3),b:(8,9),c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1)}'))[_mo_]({ d: 0, a: ['(', 1] });
        (0, code_1.expect)(j('{d:0,a:(1,2)}'))[_mo_]({ d: 0, a: ['(', [1, 2]] });
        (0, code_1.expect)(j('{d:0,a:(1,2,3)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] });
        (0, code_1.expect)(j('{d:0,a:(1),b:9}'))[_mo_]({ d: 0, a: ['(', 1], b: 9 });
        (0, code_1.expect)(j('{d:0,a:(1,2),b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 });
        (0, code_1.expect)(j('{d:0,a:(1,2,3),b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        (0, code_1.expect)(j('{d:0,a:(1),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1,2),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1,2,3),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1),b:(9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] });
        (0, code_1.expect)(j('{d:0,a:(1,2),b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        (0, code_1.expect)(j('{d:0,a:(1,2,3),b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        (0, code_1.expect)(j('{d:0,a:(1),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1,2),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1,2,3),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{d:0,a:(1,2),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{d:0,a:(1,2,3),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{d:0,a:(1),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1,2),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1,2,3),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('a:(1)'))[_mo_]({ a: ['(', 1] });
        (0, code_1.expect)(j('a:(1,2)'))[_mo_]({ a: ['(', [1, 2]] });
        (0, code_1.expect)(j('a:(1,2,3)'))[_mo_]({ a: ['(', [1, 2, 3]] });
        (0, code_1.expect)(j('a:(1),b:9'))[_mo_]({ a: ['(', 1], b: 9 });
        (0, code_1.expect)(j('a:(1,2),b:9'))[_mo_]({ a: ['(', [1, 2]], b: 9 });
        (0, code_1.expect)(j('a:(1,2,3),b:9'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 });
        (0, code_1.expect)(j('a:(1),b:9,c:8'))[_mo_]({ a: ['(', 1], b: 9, c: 8 });
        (0, code_1.expect)(j('a:(1,2),b:9,c:8'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 });
        (0, code_1.expect)(j('a:(1,2,3),b:9,c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        (0, code_1.expect)(j('a:(1),b:(9)'))[_mo_]({ a: ['(', 1], b: ['(', 9] });
        (0, code_1.expect)(j('a:(1,2),b:(9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] });
        (0, code_1.expect)(j('a:(1,2,3),b:(9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        (0, code_1.expect)(j('a:(1),b:(9),c:8'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('a:(1,2),b:(9),c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('a:(1,2,3),b:(9),c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('a:(1),b:(8,9)'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('a:(1,2),b:(8,9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('a:(1,2,3),b:(8,9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('a:(1),b:(8,9),c:8'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('a:(1,2),b:(8,9),c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('a:(1,2,3),b:(8,9),c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1)'))[_mo_]({ d: 0, a: ['(', 1] });
        (0, code_1.expect)(j('d:0,a:(1,2)'))[_mo_]({ d: 0, a: ['(', [1, 2]] });
        (0, code_1.expect)(j('d:0,a:(1,2,3)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] });
        (0, code_1.expect)(j('d:0,a:(1),b:9'))[_mo_]({ d: 0, a: ['(', 1], b: 9 });
        (0, code_1.expect)(j('d:0,a:(1,2),b:9'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 });
        (0, code_1.expect)(j('d:0,a:(1,2,3),b:9'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        (0, code_1.expect)(j('d:0,a:(1),b:9,c:8'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 });
        (0, code_1.expect)(j('d:0,a:(1,2),b:9,c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        (0, code_1.expect)(j('d:0,a:(1,2,3),b:9,c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        (0, code_1.expect)(j('d:0,a:(1),b:(9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] });
        (0, code_1.expect)(j('d:0,a:(1,2),b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        (0, code_1.expect)(j('d:0,a:(1,2,3),b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        (0, code_1.expect)(j('d:0,a:(1),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1,2),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1,2,3),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1),b:(8,9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('d:0,a:(1,2),b:(8,9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('d:0,a:(1,2,3),b:(8,9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('d:0,a:(1),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1,2),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1,2,3),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
    });
    (0, node_test_1.test)('paren-map-implicit-structure-space', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('{a:(1)}'))[_mo_]({ a: ['(', 1] });
        (0, code_1.expect)(j('{a:(1 2)}'))[_mo_]({ a: ['(', [1, 2]] });
        (0, code_1.expect)(j('{a:(1 2 3)}'))[_mo_]({ a: ['(', [1, 2, 3]] });
        (0, code_1.expect)(j('{a:(1) b:9}'))[_mo_]({ a: ['(', 1], b: 9 });
        (0, code_1.expect)(j('{a:(1 2) b:9}'))[_mo_]({ a: ['(', [1, 2]], b: 9 });
        (0, code_1.expect)(j('{a:(1 2 3) b:9}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 });
        (0, code_1.expect)(j('{a:(1) b:9 c:8}'))[_mo_]({ a: ['(', 1], b: 9, c: 8 });
        (0, code_1.expect)(j('{a:(1 2) b:9 c:8}'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 });
        (0, code_1.expect)(j('{a:(1 2 3) b:9 c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        (0, code_1.expect)(j('{a:(1) b:(9)}'))[_mo_]({ a: ['(', 1], b: ['(', 9] });
        (0, code_1.expect)(j('{a:(1 2) b:(9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] });
        (0, code_1.expect)(j('{a:(1 2 3) b:(9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        (0, code_1.expect)(j('{a:(1) b:(9) c:8}'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{a:(1 2) b:(9) c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{a:(1 2 3) b:(9) c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{a:(1) b:(8 9)}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{a:(1 2) b:(8 9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{a:(1 2 3) b:(8 9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{a:(1) b:(8 9) c:8}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{a:(1 2) b:(8 9) c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{a:(1 2 3) b:(8 9) c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1)}'))[_mo_]({ d: 0, a: ['(', 1] });
        (0, code_1.expect)(j('{d:0,a:(1 2)}'))[_mo_]({ d: 0, a: ['(', [1, 2]] });
        (0, code_1.expect)(j('{d:0,a:(1 2 3)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] });
        (0, code_1.expect)(j('{d:0,a:(1) b:9}'))[_mo_]({ d: 0, a: ['(', 1], b: 9 });
        (0, code_1.expect)(j('{d:0,a:(1 2) b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 });
        (0, code_1.expect)(j('{d:0,a:(1 2 3) b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        (0, code_1.expect)(j('{d:0,a:(1) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1 2) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1 2 3) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1) b:(9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] });
        (0, code_1.expect)(j('{d:0,a:(1 2) b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        (0, code_1.expect)(j('{d:0,a:(1 2 3) b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        (0, code_1.expect)(j('{d:0,a:(1) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1 2) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1 2 3) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{d:0,a:(1 2) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{d:0,a:(1 2 3) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('{d:0,a:(1) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1 2) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('{d:0,a:(1 2 3) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('a:(1)'))[_mo_]({ a: ['(', 1] });
        (0, code_1.expect)(j('a:(1 2)'))[_mo_]({ a: ['(', [1, 2]] });
        (0, code_1.expect)(j('a:(1 2 3)'))[_mo_]({ a: ['(', [1, 2, 3]] });
        (0, code_1.expect)(j('a:(1) b:9'))[_mo_]({ a: ['(', 1], b: 9 });
        (0, code_1.expect)(j('a:(1 2) b:9'))[_mo_]({ a: ['(', [1, 2]], b: 9 });
        (0, code_1.expect)(j('a:(1 2 3) b:9'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 });
        (0, code_1.expect)(j('a:(1) b:9 c:8'))[_mo_]({ a: ['(', 1], b: 9, c: 8 });
        (0, code_1.expect)(j('a:(1 2) b:9 c:8'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 });
        (0, code_1.expect)(j('a:(1 2 3) b:9 c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        (0, code_1.expect)(j('a:(1) b:(9)'))[_mo_]({ a: ['(', 1], b: ['(', 9] });
        (0, code_1.expect)(j('a:(1 2) b:(9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] });
        (0, code_1.expect)(j('a:(1 2 3) b:(9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        (0, code_1.expect)(j('a:(1) b:(9) c:8'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('a:(1 2) b:(9) c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('a:(1 2 3) b:(9) c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('a:(1) b:(8 9)'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('a:(1 2) b:(8 9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('a:(1 2 3) b:(8 9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('a:(1) b:(8 9) c:8'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('a:(1 2) b:(8 9) c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('a:(1 2 3) b:(8 9) c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1)'))[_mo_]({ d: 0, a: ['(', 1] });
        (0, code_1.expect)(j('d:0,a:(1 2)'))[_mo_]({ d: 0, a: ['(', [1, 2]] });
        (0, code_1.expect)(j('d:0,a:(1 2 3)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] });
        (0, code_1.expect)(j('d:0,a:(1) b:9'))[_mo_]({ d: 0, a: ['(', 1], b: 9 });
        (0, code_1.expect)(j('d:0,a:(1 2) b:9'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 });
        (0, code_1.expect)(j('d:0,a:(1 2 3) b:9'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        (0, code_1.expect)(j('d:0,a:(1) b:9 c:8'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 });
        (0, code_1.expect)(j('d:0,a:(1 2) b:9 c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        (0, code_1.expect)(j('d:0,a:(1 2 3) b:9 c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        (0, code_1.expect)(j('d:0,a:(1) b:(9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] });
        (0, code_1.expect)(j('d:0,a:(1 2) b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        (0, code_1.expect)(j('d:0,a:(1 2 3) b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        (0, code_1.expect)(j('d:0,a:(1) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1 2) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1 2 3) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1) b:(8 9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('d:0,a:(1 2) b:(8 9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('d:0,a:(1 2 3) b:(8 9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        (0, code_1.expect)(j('d:0,a:(1) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1 2) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        (0, code_1.expect)(j('d:0,a:(1 2 3) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
    });
    (0, node_test_1.test)('paren-list-implicit-structure-comma', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('[(1)]'))[_mo_]([['(', 1]]);
        (0, code_1.expect)(j('[(1,2)]'))[_mo_]([['(', [1, 2]]]);
        (0, code_1.expect)(j('[(1,2,3)]'))[_mo_]([['(', [1, 2, 3]]]);
        (0, code_1.expect)(j('[(1),9]'))[_mo_]([['(', 1], 9]);
        (0, code_1.expect)(j('[(1,2),9]'))[_mo_]([['(', [1, 2]], 9]);
        (0, code_1.expect)(j('[(1,2,3),9]'))[_mo_]([['(', [1, 2, 3]], 9]);
        (0, code_1.expect)(j('[(1),9,8]'))[_mo_]([['(', 1], 9, 8]);
        (0, code_1.expect)(j('[(1,2),9,8]'))[_mo_]([['(', [1, 2]], 9, 8]);
        (0, code_1.expect)(j('[(1,2,3),9,8]'))[_mo_]([['(', [1, 2, 3]], 9, 8]);
        (0, code_1.expect)(j('[(1),(9)]'))[_mo_]([['(', 1], ['(', 9]]);
        (0, code_1.expect)(j('[(1,2),(9)]'))[_mo_]([['(', [1, 2]], ['(', 9]]);
        (0, code_1.expect)(j('[(1,2,3),(9)]'))[_mo_]([['(', [1, 2, 3]], ['(', 9]]);
        (0, code_1.expect)(j('[(1),(9),8]'))[_mo_]([['(', 1], ['(', 9], 8]);
        (0, code_1.expect)(j('[(1,2),(9),8]'))[_mo_]([['(', [1, 2]], ['(', 9], 8]);
        (0, code_1.expect)(j('[(1,2,3),(9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8]);
        (0, code_1.expect)(j('[(1),(9),(8)]'))[_mo_]([['(', 1], ['(', 9], ['(', 8]]);
        (0, code_1.expect)(j('[(1),(8,9)]'))[_mo_]([['(', 1], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[(1,2),(8,9)]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[(1,2,3),(8,9)]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[(1),(8,9),8]'))[_mo_]([['(', 1], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[(1,2),(8,9),8]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[(1,2,3),(8,9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[0,(1)]'))[_mo_]([0, ['(', 1]]);
        (0, code_1.expect)(j('[0,(1,2)]'))[_mo_]([0, ['(', [1, 2]]]);
        (0, code_1.expect)(j('[0,(1,2,3)]'))[_mo_]([0, ['(', [1, 2, 3]]]);
        (0, code_1.expect)(j('[0,(1),9]'))[_mo_]([0, ['(', 1], 9]);
        (0, code_1.expect)(j('[0,(1,2),9]'))[_mo_]([0, ['(', [1, 2]], 9]);
        (0, code_1.expect)(j('[0,(1,2,3),9]'))[_mo_]([0, ['(', [1, 2, 3]], 9]);
        (0, code_1.expect)(j('[0,(1),9,8]'))[_mo_]([0, ['(', 1], 9, 8]);
        (0, code_1.expect)(j('[0,(1,2),9,8]'))[_mo_]([0, ['(', [1, 2]], 9, 8]);
        (0, code_1.expect)(j('[0,(1,2,3),9,8]'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8]);
        (0, code_1.expect)(j('[0,(1),(9)]'))[_mo_]([0, ['(', 1], ['(', 9]]);
        (0, code_1.expect)(j('[0,(1,2),(9)]'))[_mo_]([0, ['(', [1, 2]], ['(', 9]]);
        (0, code_1.expect)(j('[0,(1,2,3),(9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]]);
        (0, code_1.expect)(j('[0,(1),(9),8]'))[_mo_]([0, ['(', 1], ['(', 9], 8]);
        (0, code_1.expect)(j('[0,(1,2),(9),8]'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8]);
        (0, code_1.expect)(j('[0,(1,2,3),(9),8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        (0, code_1.expect)(j('[0,(1),(8,9)]'))[_mo_]([0, ['(', 1], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[0,(1,2),(8,9)]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[0,(1,2,3),(8,9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[0,(1),(8,9),8]'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[0,(1,2),(8,9),8]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[0,(1,2,3),(8,9),8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('(1)'))[_mo_](['(', 1]);
        (0, code_1.expect)(j('(1,2)'))[_mo_](['(', [1, 2]]);
        (0, code_1.expect)(j('(1,2,3)'))[_mo_](['(', [1, 2, 3]]);
        (0, code_1.expect)(j('(1),9'))[_mo_]([['(', 1], 9]);
        (0, code_1.expect)(j('(1,2),9'))[_mo_]([['(', [1, 2]], 9]);
        (0, code_1.expect)(j('(1,2,3),9'))[_mo_]([['(', [1, 2, 3]], 9]);
        (0, code_1.expect)(j('(1),9,8'))[_mo_]([['(', 1], 9, 8]);
        (0, code_1.expect)(j('(1,2),9,8'))[_mo_]([['(', [1, 2]], 9, 8]);
        (0, code_1.expect)(j('(1,2,3),9,8'))[_mo_]([['(', [1, 2, 3]], 9, 8]);
        (0, code_1.expect)(j('(1),(9)'))[_mo_]([['(', 1], ['(', 9]]);
        (0, code_1.expect)(j('(1,2),(9)'))[_mo_]([['(', [1, 2]], ['(', 9]]);
        (0, code_1.expect)(j('(1,2,3),(9)'))[_mo_]([['(', [1, 2, 3]], ['(', 9]]);
        (0, code_1.expect)(j('(1),(9),(8)'))[_mo_]([['(', 1], ['(', 9], ['(', 8]]);
        (0, code_1.expect)(j('(1),(9),8'))[_mo_]([['(', 1], ['(', 9], 8]);
        (0, code_1.expect)(j('(1,2),(9),8'))[_mo_]([['(', [1, 2]], ['(', 9], 8]);
        (0, code_1.expect)(j('(1,2,3),(9),8'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8]);
        (0, code_1.expect)(j('(1),(8,9)'))[_mo_]([['(', 1], ['(', [8, 9]]]);
        (0, code_1.expect)(j('(1,2),(8,9)'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('(1,2,3),(8,9)'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('(1),(8,9),8'))[_mo_]([['(', 1], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('(1,2),(8,9),8'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('(1,2,3),(8,9),8'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('0,(1)'))[_mo_]([0, ['(', 1]]);
        (0, code_1.expect)(j('0,(1,2)'))[_mo_]([0, ['(', [1, 2]]]);
        (0, code_1.expect)(j('0,(1,2,3)'))[_mo_]([0, ['(', [1, 2, 3]]]);
        (0, code_1.expect)(j('0,(1),9'))[_mo_]([0, ['(', 1], 9]);
        (0, code_1.expect)(j('0,(1,2),9'))[_mo_]([0, ['(', [1, 2]], 9]);
        (0, code_1.expect)(j('0,(1,2,3),9'))[_mo_]([0, ['(', [1, 2, 3]], 9]);
        (0, code_1.expect)(j('0,(1),9,8'))[_mo_]([0, ['(', 1], 9, 8]);
        (0, code_1.expect)(j('0,(1,2),9,8'))[_mo_]([0, ['(', [1, 2]], 9, 8]);
        (0, code_1.expect)(j('0,(1,2,3),9,8'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8]);
        (0, code_1.expect)(j('0,(1),(9)'))[_mo_]([0, ['(', 1], ['(', 9]]);
        (0, code_1.expect)(j('0,(1,2),(9)'))[_mo_]([0, ['(', [1, 2]], ['(', 9]]);
        (0, code_1.expect)(j('0,(1,2,3),(9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]]);
        (0, code_1.expect)(j('0,(1),(9),8'))[_mo_]([0, ['(', 1], ['(', 9], 8]);
        (0, code_1.expect)(j('0,(1,2),(9),8'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8]);
        (0, code_1.expect)(j('0,(1,2,3),(9),8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        (0, code_1.expect)(j('0,(1),(8,9)'))[_mo_]([0, ['(', 1], ['(', [8, 9]]]);
        (0, code_1.expect)(j('0,(1,2),(8,9)'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('0,(1,2,3),(8,9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('0,(1),(8,9),8'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('0,(1,2),(8,9),8'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('0,(1,2,3),(8,9),8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
    });
    (0, node_test_1.test)('paren-list-implicit-structure-space', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('[(1)]'))[_mo_]([['(', 1]]);
        (0, code_1.expect)(j('[(1 2)]'))[_mo_]([['(', [1, 2]]]);
        (0, code_1.expect)(j('[(1 2 3)]'))[_mo_]([['(', [1, 2, 3]]]);
        (0, code_1.expect)(j('[(1) 9]'))[_mo_]([['(', 1], 9]);
        (0, code_1.expect)(j('[(1 2) 9]'))[_mo_]([['(', [1, 2]], 9]);
        (0, code_1.expect)(j('[(1 2 3) 9]'))[_mo_]([['(', [1, 2, 3]], 9]);
        (0, code_1.expect)(j('[(1) 9 8]'))[_mo_]([['(', 1], 9, 8]);
        (0, code_1.expect)(j('[(1 2) 9 8]'))[_mo_]([['(', [1, 2]], 9, 8]);
        (0, code_1.expect)(j('[(1 2 3) 9 8]'))[_mo_]([['(', [1, 2, 3]], 9, 8]);
        (0, code_1.expect)(j('[(1) (9)]'))[_mo_]([['(', 1], ['(', 9]]);
        (0, code_1.expect)(j('[(1 2) (9)]'))[_mo_]([['(', [1, 2]], ['(', 9]]);
        (0, code_1.expect)(j('[(1 2 3) (9)]'))[_mo_]([['(', [1, 2, 3]], ['(', 9]]);
        (0, code_1.expect)(j('[(1) (9) (8)]'))[_mo_]([['(', 1], ['(', 9], ['(', 8]]);
        (0, code_1.expect)(j('[(1) (9) 8]'))[_mo_]([['(', 1], ['(', 9], 8]);
        (0, code_1.expect)(j('[(1 2) (9) 8]'))[_mo_]([['(', [1, 2]], ['(', 9], 8]);
        (0, code_1.expect)(j('[(1 2 3) (9) 8]'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8]);
        (0, code_1.expect)(j('[(1) (8,9)]'))[_mo_]([['(', 1], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[(1 2) (8,9)]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[(1 2 3) (8,9)]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[(1) (8,9),8]'))[_mo_]([['(', 1], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[(1 2) (8,9),8]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[(1 2 3) (8,9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[0 (1)]'))[_mo_]([0, ['(', 1]]);
        (0, code_1.expect)(j('[0 (1 2)]'))[_mo_]([0, ['(', [1, 2]]]);
        (0, code_1.expect)(j('[0 (1 2 3)]'))[_mo_]([0, ['(', [1, 2, 3]]]);
        (0, code_1.expect)(j('[0 (1) 9]'))[_mo_]([0, ['(', 1], 9]);
        (0, code_1.expect)(j('[0 (1 2) 9]'))[_mo_]([0, ['(', [1, 2]], 9]);
        (0, code_1.expect)(j('[0 (1 2 3) 9]'))[_mo_]([0, ['(', [1, 2, 3]], 9]);
        (0, code_1.expect)(j('[0 (1) 9 8]'))[_mo_]([0, ['(', 1], 9, 8]);
        (0, code_1.expect)(j('[0 (1 2) 9 8]'))[_mo_]([0, ['(', [1, 2]], 9, 8]);
        (0, code_1.expect)(j('[0 (1 2 3) 9 8]'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8]);
        (0, code_1.expect)(j('[0 (1) (9)]'))[_mo_]([0, ['(', 1], ['(', 9]]);
        (0, code_1.expect)(j('[0 (1 2) (9)]'))[_mo_]([0, ['(', [1, 2]], ['(', 9]]);
        (0, code_1.expect)(j('[0 (1 2 3) (9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]]);
        (0, code_1.expect)(j('[0 (1) (9) 8]'))[_mo_]([0, ['(', 1], ['(', 9], 8]);
        (0, code_1.expect)(j('[0 (1 2) (9) 8]'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8]);
        (0, code_1.expect)(j('[0 (1 2 3) (9) 8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        (0, code_1.expect)(j('[0 (1) (8 9)]'))[_mo_]([0, ['(', 1], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[0 (1 2) (8 9)]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[0 (1 2 3) (8 9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('[0 (1) (8 9) 8]'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[0 (1 2) (8 9) 8]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('[0 (1 2 3) (8 9) 8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('(1)'))[_mo_](['(', 1]);
        (0, code_1.expect)(j('(1 2)'))[_mo_](['(', [1, 2]]);
        (0, code_1.expect)(j('(1 2 3)'))[_mo_](['(', [1, 2, 3]]);
        (0, code_1.expect)(j('(1) 9'))[_mo_]([['(', 1], 9]);
        (0, code_1.expect)(j('(1 2) 9'))[_mo_]([['(', [1, 2]], 9]);
        (0, code_1.expect)(j('(1 2 3) 9'))[_mo_]([['(', [1, 2, 3]], 9]);
        (0, code_1.expect)(j('(1) 9 8'))[_mo_]([['(', 1], 9, 8]);
        (0, code_1.expect)(j('(1 2) 9 8'))[_mo_]([['(', [1, 2]], 9, 8]);
        (0, code_1.expect)(j('(1 2 3) 9 8'))[_mo_]([['(', [1, 2, 3]], 9, 8]);
        (0, code_1.expect)(j('(1) (9)'))[_mo_]([['(', 1], ['(', 9]]);
        (0, code_1.expect)(j('(1 2) (9)'))[_mo_]([['(', [1, 2]], ['(', 9]]);
        (0, code_1.expect)(j('(1 2 3) (9)'))[_mo_]([['(', [1, 2, 3]], ['(', 9]]);
        (0, code_1.expect)(j('(1) (9) 8'))[_mo_]([['(', 1], ['(', 9], 8]);
        (0, code_1.expect)(j('(1 2) (9) 8'))[_mo_]([['(', [1, 2]], ['(', 9], 8]);
        (0, code_1.expect)(j('(1 2 3) (9) 8'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8]);
        (0, code_1.expect)(j('(1) (9) (8)'))[_mo_]([['(', 1], ['(', 9], ['(', 8]]);
        (0, code_1.expect)(j('(1) (8 9)'))[_mo_]([['(', 1], ['(', [8, 9]]]);
        (0, code_1.expect)(j('(1 2) (8 9)'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('(1 2 3) (8 9)'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('(1) (8 9) 8'))[_mo_]([['(', 1], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('(1 2) (8 9) 8'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('(1 2 3) (8 9) 8'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('0 (1)'))[_mo_]([0, ['(', 1]]);
        (0, code_1.expect)(j('0 (1 2)'))[_mo_]([0, ['(', [1, 2]]]);
        (0, code_1.expect)(j('0 (1 2 3)'))[_mo_]([0, ['(', [1, 2, 3]]]);
        (0, code_1.expect)(j('0 (1) 9'))[_mo_]([0, ['(', 1], 9]);
        (0, code_1.expect)(j('0 (1 2) 9'))[_mo_]([0, ['(', [1, 2]], 9]);
        (0, code_1.expect)(j('0 (1 2 3) 9'))[_mo_]([0, ['(', [1, 2, 3]], 9]);
        (0, code_1.expect)(j('0 (1) 9 8'))[_mo_]([0, ['(', 1], 9, 8]);
        (0, code_1.expect)(j('0 (1 2) 9 8'))[_mo_]([0, ['(', [1, 2]], 9, 8]);
        (0, code_1.expect)(j('0 (1 2 3) 9 8'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8]);
        (0, code_1.expect)(j('0 (1) (9)'))[_mo_]([0, ['(', 1], ['(', 9]]);
        (0, code_1.expect)(j('0 (1 2) (9)'))[_mo_]([0, ['(', [1, 2]], ['(', 9]]);
        (0, code_1.expect)(j('0 (1 2 3) (9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]]);
        (0, code_1.expect)(j('0 (1) (9) 8'))[_mo_]([0, ['(', 1], ['(', 9], 8]);
        (0, code_1.expect)(j('0 (1 2) (9) 8'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8]);
        (0, code_1.expect)(j('0 (1 2 3) (9) 8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        (0, code_1.expect)(j('0 (1) (8 9)'))[_mo_]([0, ['(', 1], ['(', [8, 9]]]);
        (0, code_1.expect)(j('0 (1 2) (8 9)'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('0 (1 2 3) (8 9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        (0, code_1.expect)(j('0 (1) (8 9) 8'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('0 (1 2) (8 9) 8'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        (0, code_1.expect)(j('0 (1 2 3) (8 9) 8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
    });
    (0, node_test_1.test)('paren-implicit-list', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('(a)'))[_mo_](['(', 'a']);
        (0, code_1.expect)(j('(a,b)'))[_mo_](['(', ['a', 'b']]);
        (0, code_1.expect)(j('(a,b,c)'))[_mo_](['(', ['a', 'b', 'c']]);
        (0, code_1.expect)(j('(a,b,c,d)'))[_mo_](['(', ['a', 'b', 'c', 'd']]);
        (0, code_1.expect)(j('(1,2)'))[_mo_](['(', [1, 2]]);
        (0, code_1.expect)(j('(1+2,3)'))[_mo_](['(', [['+', 1, 2], 3]]);
        (0, code_1.expect)(j('(1+2+3,4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]]);
        (0, code_1.expect)(j('(1+2+3+4,5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]]);
        (0, code_1.expect)(j('(1+2,3,4)'))[_mo_](['(', [['+', 1, 2], 3, 4]]);
        (0, code_1.expect)(j('(1+2,3+4,5)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], 5]]);
        (0, code_1.expect)(j('(1+2,3+4,5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        (0, code_1.expect)(j('(a b)'))[_mo_](['(', ['a', 'b']]);
        (0, code_1.expect)(j('(a b c)'))[_mo_](['(', ['a', 'b', 'c']]);
        (0, code_1.expect)(j('(1+2 3)'))[_mo_](['(', [['+', 1, 2], 3]]);
        (0, code_1.expect)(j('(1+2 3 4)'))[_mo_](['(', [['+', 1, 2], 3, 4]]);
        (0, code_1.expect)(j('(1+2 3+4 5)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], 5]]);
        (0, code_1.expect)(j('(1+2 3+4 5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        // Default plain paren does not have a prefix, so this is an implicit list.
        (0, code_1.expect)(j('foo(1,a)'))[_mo_](['foo', ['(', [1, 'a']]]);
        (0, code_1.expect)(j('foo,(1,a)'))[_mo_](['foo', ['(', [1, 'a']]]);
        (0, code_1.expect)(j('foo (1,a)'))[_mo_](['foo', ['(', [1, 'a']]]);
    });
    (0, node_test_1.test)('paren-implicit-map', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('(a:1,b:2)'))[_mo_](['(', { a: 1, b: 2 }]);
        (0, code_1.expect)(j('(a:1 b:2)'))[_mo_](['(', { a: 1, b: 2 }]);
        (0, code_1.expect)(j('(a:1,b:2,c:3)'))[_mo_](['(', { a: 1, b: 2, c: 3 }]);
        (0, code_1.expect)(j('(a:1 b:2 c:3)'))[_mo_](['(', { a: 1, b: 2, c: 3 }]);
        (0, code_1.expect)(j('(a:1+2,b:3)'))[_mo_](['(', { a: ['+', 1, 2], b: 3 }]);
        (0, code_1.expect)(j('(a:1+2,b:3,c:4)'))[_mo_](['(', { a: ['+', 1, 2], b: 3, c: 4 }]);
        (0, code_1.expect)(j('(a:1+2,b:3+4,c:5)'))[_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }]);
        (0, code_1.expect)(j('(a:1+2,b:3+4,c:5+6)'))[_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }]);
        (0, code_1.expect)(j('(a:1+2 b:3)'))[_mo_](['(', { a: ['+', 1, 2], b: 3 }]);
        (0, code_1.expect)(j('(a:1+2 b:3 c:4)'))[_mo_](['(', { a: ['+', 1, 2], b: 3, c: 4 }]);
        (0, code_1.expect)(j('(a:1+2 b:3+4 c:5)'))[_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }]);
        (0, code_1.expect)(j('(a:1+2 b:3+4 c:5+6)'))[_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }]);
    });
    (0, node_test_1.test)('add-paren', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                angle: {
                    paren: true, osrc: '<', csrc: '>'
                }
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('<1>'))[_mo_](['<', 1]);
        (0, code_1.expect)(j('<<1>>'))[_mo_](['<', ['<', 1]]);
        (0, code_1.expect)(j('(<1>)'))[_mo_](['(', ['<', 1]]);
        (0, code_1.expect)(j('<(1)>'))[_mo_](['<', ['(', 1]]);
        (0, code_1.expect)(() => j('<1)')).throw(/unexpected/);
        (0, code_1.expect)(j('1*(2+3)'))[_mo_](['*', 1, ['(', ['+', 2, 3]]]);
        (0, code_1.expect)(j('1*<2+3>'))[_mo_](['*', 1, ['<', ['+', 2, 3]]]);
    });
    (0, node_test_1.test)('paren-preval-basic', () => {
        const je = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(__1.Expr, {
            op: {
                // plain: {
                //   preval: {},
                // },
                angle: {
                    osrc: '<',
                    csrc: '>',
                    paren: true,
                    preval: { active: true },
                }
            }
        });
        const j = mj(je);
        // expect(j('(1)'))[_mo_](['(', 1])
        // expect(j('(1),2'))[_mo_]([['(', 1], 2])
        // expect(j('3(1),2'))[_mo_]([['(', 3, 1], 2])
        // // This has a paren preval.
        // expect(j('foo(1,a)'))[_mo_](['(', 'foo', [1, 'a']])
        // expect(j('foo (1,a)'))[_mo_](['(', 'foo', [1, 'a']])
        // expect(j('foo(a:1,b:2)'))[_mo_](['(', 'foo', { a: 1, b: 2 }])
        // expect(j('foo(a:b:1,c:2)'))[_mo_](['(', 'foo', { a: { b: 1 }, c: 2 }])
        (0, code_1.expect)(j('B<C>'))[_mo_](['<', 'B', 'C']);
        (0, code_1.expect)(j('a:b<c>'))[_mo_]({ a: ['<', 'b', 'c'] });
        (0, code_1.expect)(j('a:b<c,d>'))[_mo_]({ a: ['<', 'b', ['c', 'd']] });
        (0, code_1.expect)(j('a:b<1+2,3+4>'))[_mo_]({ a: ['<', 'b', [['+', 1, 2], ['+', 3, 4]]] });
        (0, code_1.expect)(j('<1>'))[_mo_](['<', 1]);
        (0, code_1.expect)(j('1<2>'))[_mo_](['<', 1, 2]);
        // TODO: more general: preexpr not just preval!
        // expect(j('<1><2>'))[_mo_](['<', ['<', 1], 2])
        // expect(j('1<2><3>'))[_mo_](['<', ['<', 1, 2], 3])
        // expect(j('<1><2><3>'))[_mo_](['<', ['<', ['<', 1], 2], 3])
        // expect(j('1<2><3><4>'))[_mo_](['<', ['<', ['<', 1, 2], 3], 4])
        // expect(j('<1><2><3><4>'))[_mo_](['<', ['<', ['<', ['<', 1], 2], 3], 4])
        // expect(j('1<2><3><4><5>'))[_mo_](['<', ['<', ['<', ['<', 1, 2], 3], 4], 5])
        (0, code_1.expect)(j('a:<1>'))[_mo_]({ a: ['<', 1] });
        (0, code_1.expect)(j('a:1<2>'))[_mo_]({ a: ['<', 1, 2] });
        // expect(j('a:<1><2>'))[_mo_]({ a: ['<', ['<', 1], 2] })
        // expect(j('a:1<2><3>'))[_mo_]({ a: ['<', ['<', 1, 2], 3] })
        // expect(j('a:<1><2><3>'))[_mo_]({ a: ['<', ['<', ['<', 1], 2], 3] })
        // expect(j('a:1<2><3><4>'))[_mo_]({ a: ['<', ['<', ['<', 1, 2], 3], 4] })
        // expect(j('a:<1><2><3><4>'))[_mo_]({ a: ['<', ['<', ['<', ['<', 1], 2], 3], 4] })
        // expect(j('a:1<2><3><4><5>'))
        // [_mo_]({ a: ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5] })
        (0, code_1.expect)(j('9+<1>'))[_mo_](['+', 9, ['<', 1]]);
        (0, code_1.expect)(j('9+1<2>'))[_mo_](['+', 9, ['<', 1, 2]]);
        // expect(j('9+<1><2>'))[_mo_](['+', 9, ['<', ['<', 1], 2]])
        // expect(j('9+1<2><3>'))[_mo_](['+', 9, ['<', ['<', 1, 2], 3]])
        // expect(j('9+<1><2><3>'))[_mo_](['+', 9, ['<', ['<', ['<', 1], 2], 3]])
        // expect(j('9+1<2><3><4>'))[_mo_](['+', 9, ['<', ['<', ['<', 1, 2], 3], 4]])
        // expect(j('9+<1><2><3><4>'))
        // [_mo_](['+', 9, ['<', ['<', ['<', ['<', 1], 2], 3], 4]])
        // expect(j('9+1<2><3><4><5>'))
        // [_mo_](['+', 9, ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5]])
        (0, code_1.expect)(j('<1>+9'))[_mo_](['+', ['<', 1], 9]);
        (0, code_1.expect)(j('1<2>+9'))[_mo_](['+', ['<', 1, 2], 9]);
        // expect(j('<1><2>+9'))[_mo_](['+', ['<', ['<', 1], 2], 9])
        // expect(j('1<2><3>+9'))[_mo_](['+', ['<', ['<', 1, 2], 3], 9])
        // expect(j('<1><2><3>+9'))[_mo_](['+', ['<', ['<', ['<', 1], 2], 3], 9])
        // expect(j('1<2><3><4>+9'))[_mo_](['+', ['<', ['<', ['<', 1, 2], 3], 4], 9])
        // expect(j('<1><2><3><4>+9'))
        // [_mo_](['+', ['<', ['<', ['<', ['<', 1], 2], 3], 4], 9])
        // expect(j('1<2><3><4><5>+9'))
        // [_mo_](['+', ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5], 9])
    });
    (0, node_test_1.test)('paren-preval-overload', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                factorial: {
                    suffix: true, left: 15000, src: '!'
                },
                square: {
                    osrc: '[',
                    csrc: ']',
                    paren: true,
                    preval: { required: true },
                },
                brace: {
                    osrc: '{',
                    csrc: '}',
                    paren: true,
                    preval: { required: true },
                }
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('[1]'))[_mo_]([1]);
        (0, code_1.expect)(j('a[1]'))[_mo_](['[', 'a', 1]);
        (0, code_1.expect)(j('[a[1]]'))[_mo_]([['[', 'a', 1]]);
        (0, code_1.expect)(j('a:[1]'))[_mo_]({ a: [1] });
        (0, code_1.expect)(j('a:b[1]'))[_mo_]({ a: ['[', 'b', 1] });
        (0, code_1.expect)(j('a:[b[1]]'))[_mo_]({ a: [['[', 'b', 1]] });
        (0, code_1.expect)(j('{a:[1]}'))[_mo_]({ a: [1] });
        (0, code_1.expect)(j('{a:b[1]}'))[_mo_]({ a: ['[', 'b', 1] });
        (0, code_1.expect)(j('{a:[b[1]]}'))[_mo_]({ a: [['[', 'b', 1]] });
        (0, code_1.expect)(j('-[1]+2'))[_mo_](['+', ['-', [1]], 2]);
        (0, code_1.expect)(j('-a[1]+2'))[_mo_](['+', ['-', ['[', 'a', 1]], 2]);
        (0, code_1.expect)(j('-[a[1]]+2'))[_mo_](['+', ['-', [['[', 'a', 1]]], 2]);
        (0, code_1.expect)(j('-a:[1]+2'))[_mo_](['-', { a: ['+', [1], 2] }]);
        (0, code_1.expect)(j('-a:b[1]+2'))[_mo_](['-', { a: ['+', ['[', 'b', 1], 2] }]);
        (0, code_1.expect)(j('-a:[b[1]]+2'))[_mo_](['-', { a: ['+', [['[', 'b', 1]], 2] }]);
        (0, code_1.expect)(j('-{a:[1]+2}'))[_mo_](['-', { a: ['+', [1], 2] }]);
        (0, code_1.expect)(j('-{a:b[1]+2}'))[_mo_](['-', { a: ['+', ['[', 'b', 1], 2] }]);
        (0, code_1.expect)(j('-{a:[b[1]]+2}'))[_mo_](['-', { a: ['+', [['[', 'b', 1]], 2] }]);
        (0, code_1.expect)(j('2+[1]'))[_mo_](['+', 2, [1]]);
        (0, code_1.expect)(j('2+a[1]'))[_mo_](['+', 2, ['[', 'a', 1]]);
        (0, code_1.expect)(j('2+[a[1]]'))[_mo_](['+', 2, [['[', 'a', 1]]]);
        (0, code_1.expect)(j('2+a:[1]'))[_mo_](['+', 2, { a: [1] }]);
        (0, code_1.expect)(j('2+a:b[1]'))[_mo_](['+', 2, { a: ['[', 'b', 1] }]);
        (0, code_1.expect)(j('2+a:[b[1]]'))[_mo_](['+', 2, { a: [['[', 'b', 1]] }]);
        (0, code_1.expect)(j('2+{a:[1]}'))[_mo_](['+', 2, { a: [1] }]);
        (0, code_1.expect)(j('2+{a:b[1]}'))[_mo_](['+', 2, { a: ['[', 'b', 1] }]);
        (0, code_1.expect)(j('2+{a:[b[1]]}'))[_mo_](['+', 2, { a: [['[', 'b', 1]] }]);
        (0, code_1.expect)(j('a[b[1]]'))[_mo_](['[', 'a', ['[', 'b', 1]]);
        (0, code_1.expect)(j('a[b[c[1]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', 1]]]);
        (0, code_1.expect)(j('a[b[c[d[1]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', 1]]]]);
        (0, code_1.expect)(j('a[b[[1]]]'))[_mo_](['[', 'a', ['[', 'b', [1]]]);
        (0, code_1.expect)(j('a[b[c[[1]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', [1]]]]);
        (0, code_1.expect)(j('a[b[c[d[[1]]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [1]]]]]);
        (0, code_1.expect)(j('a[b[[1,2]]]'))[_mo_](['[', 'a', ['[', 'b', [1, 2]]]);
        (0, code_1.expect)(j('a[b[c[[1,2]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', [1, 2]]]]);
        (0, code_1.expect)(j('a[b[c[d[[1,2]]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [1, 2]]]]]);
        (0, code_1.expect)(j('a[b[[x[1]]]]'))[_mo_](['[', 'a', ['[', 'b', [['[', 'x', 1]]]]);
        (0, code_1.expect)(j('a[b[c[[x[1]]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', [['[', 'x', 1]]]]]);
        (0, code_1.expect)(j('a[b[c[d[[x[1]]]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [['[', 'x', 1]]]]]]);
        (0, code_1.expect)(j('a{1}'))[_mo_](['{', 'a', 1]);
        (0, code_1.expect)(j('a{b{1}}'))[_mo_](['{', 'a', ['{', 'b', 1]]);
        (0, code_1.expect)(j('a{b{c{1}}}'))[_mo_](['{', 'a', ['{', 'b', ['{', 'c', 1]]]);
        (0, code_1.expect)(j('a{1+2}'))[_mo_](['{', 'a', ['+', 1, 2]]);
        (0, code_1.expect)(j('a{b{1+2}}'))[_mo_](['{', 'a', ['{', 'b', ['+', 1, 2]]]);
        (0, code_1.expect)(j('a{b{c{1+2}}}'))[_mo_](['{', 'a', ['{', 'b', ['{', 'c', ['+', 1, 2]]]]);
        (0, code_1.expect)(j('a{{x:1}}'))[_mo_](['{', 'a', { x: 1 }]);
        (0, code_1.expect)(j('a{{x:1,y:2}}'))[_mo_](['{', 'a', { x: 1, y: 2 }]);
    });
    (0, node_test_1.test)('paren-preval-implicit', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                plain: {
                    preval: true
                }
            }
        });
        const j = mj(je);
        // But this is an implicit list.
        (0, code_1.expect)(j('foo,(1,a)'))[_mo_](['foo', ['(', [1, 'a']]]);
        (0, code_1.expect)(j('foo,(1+2,a)'))[_mo_](['foo', ['(', [['+', 1, 2], 'a']]]);
        (0, code_1.expect)(j('foo,(1+2+3,a)'))[_mo_](['foo', ['(', [['+', ['+', 1, 2], 3], 'a']]]);
    });
    (0, node_test_1.test)('add-infix', () => {
        const je = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                foo: {
                    infix: true, left: 180, right: 190, src: 'foo'
                }
            }
        });
        const j = mj(je);
        (0, code_1.expect)(j('1 foo 2'))[_mo_](['foo', 1, 2]);
    });
    // TODO: provide as external tests for other plugins
    (0, node_test_1.test)('json-base', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('1')).equal(1);
        (0, code_1.expect)(j('"a"')).equal('a');
        (0, code_1.expect)(j('true')).equal(true);
        (0, code_1.expect)(j('[1,"a",false,[],{},[2],{a:3}]'))[_mo_]([1, "a", false, [], {}, [2], { a: 3 }]);
        (0, code_1.expect)(j('{ "a": 1, "b": "B", "c": null, "d": [1, 2]' +
            ', "e": { "f": [{}], "g": { "h": [] } } }'))[_mo_]({
            "a": 1, "b": "B", "c": null, "d": [1, 2],
            "e": { "f": [{}], "g": { "h": [] } }
        });
    });
    (0, node_test_1.test)('jsonic-base', () => {
        const j = mj(jsonic_1.Jsonic.make().use(__1.Expr));
        (0, code_1.expect)(j('1 "a" true # foo'))[_mo_]([1, 'a', true]);
        (0, code_1.expect)(j('x:1 y:"a" z:true // bar'))[_mo_]({ x: 1, y: 'a', z: true });
        (0, code_1.expect)(j('a:b:1 \n /* zed */ a:c:{\nd:e:[1 2]}'))[_mo_]({
            a: {
                b: 1,
                c: { d: { e: [1, 2] } }
            }
        });
    });
    (0, node_test_1.test)('example-dotpath', () => {
        let opts = {
            op: {
                'dot-infix': {
                    src: '.',
                    infix: true,
                    left: 15_000_000,
                    right: 14_000_000,
                },
                'dot-prefix': {
                    src: '.',
                    prefix: true,
                    right: 14_000_000,
                }
            }
        };
        const je0 = jsonic_1.Jsonic.make().use(__1.Expr, opts);
        const j0 = mj(je0);
        /*
            expect(j0('a.b'))[_mo_](['.', 'a', 'b'])
            expect(j0('a.b.c'))[_mo_](['.', 'a', ['.', 'b', 'c']])
        
            expect(j0('a.b+c.d'))[_mo_](['+', ['.', 'a', 'b'], ['.', 'c', 'd']])
        
            expect(j0('.a'))[_mo_](['.', 'a'])
            expect(j0('.a.b'))[_mo_](['.', ['.', 'a', 'b']])
            expect(j0('.a.b.c'))[_mo_](['.', ['.', 'a', ['.', 'b', 'c']]])
        
            expect(j0('a..b'))[_mo_](['.', 'a', ['.', 'b']])
            expect(j0('a..b.c'))[_mo_](['.', 'a', ['.', ['.', 'b', 'c']]])
            expect(j0('a..b..c'))[_mo_](['.', 'a', ['.', ['.', 'b', ['.', 'c']]]])
        
            expect(j0('..a'))[_mo_](['.', ['.', 'a']])
            expect(j0('...a'))[_mo_](['.', ['.', ['.', 'a']]])
            expect(j0('....a'))[_mo_](['.', ['.', ['.', ['.', 'a']]]])
        
            expect(j0('..a.b'))[_mo_](['.', ['.', ['.', 'a', 'b']]])
            expect(j0('...a.b'))[_mo_](['.', ['.', ['.', ['.', 'a', 'b']]]])
            expect(j0('....a.b'))[_mo_](['.', ['.', ['.', ['.', ['.', 'a', 'b']]]]])
        
            expect(j0('..a.b.c'))[_mo_](['.', ['.', ['.', 'a', ['.', 'b', 'c']]]])
            expect(j0('...a.b.c'))[_mo_](['.', ['.', ['.', ['.', 'a', ['.', 'b', 'c']]]]])
            expect(j0('....a.b.c'))
            [_mo_](['.', ['.', ['.', ['.', ['.', 'a', ['.', 'b', 'c']]]]]])
        
            expect(j0('$.a.b'))[_mo_](['.', '$', ['.', 'a', 'b']])
            expect(j0('$.a.b.c'))[_mo_](['.', '$', ['.', 'a', ['.', 'b', 'c']]])
        */
        let resolve = (_rule, _ctx, op, terms) => {
            let out = undefined;
            if ('dot-infix' === op.name) {
                out = terms.join('/');
            }
            else if ('dot-prefix' === op.name) {
                out = '/' + terms[0];
            }
            else if ('plain-paren' === op.name) {
                out = terms[0];
            }
            else if ('positive-prefix' === op.name) {
                out = terms[0];
            }
            else if ('addition-infix' === op.name) {
                out = terms[0] + terms[1];
            }
            // console.log('EVAL', op.name, terms, '->', out)
            return out;
        };
        let r = null;
        let c = null;
        (0, code_1.expect)((0, __1.evaluation)(r, c, je0('a.b'), resolve)).equal('a/b');
        (0, code_1.expect)((0, __1.evaluation)(r, c, je0('a.b.c'), resolve)).equal('a/b/c');
        (0, code_1.expect)((0, __1.evaluation)(r, c, je0('a.b.c.d'), resolve)).equal('a/b/c/d');
        (0, code_1.expect)((0, __1.evaluation)(r, c, je0('.a'), resolve)).equal('/a');
        (0, code_1.expect)((0, __1.evaluation)(r, c, je0('.a.b'), resolve)).equal('/a/b');
        const je1 = jsonic_1.Jsonic.make()
            // .use(Debug, {
            //   print: false,
            //   trace: {
            //     step: true,
            //     rule: true,
            //     lex: true,
            //     parse: true,
            //     node: true,
            //     stack: true,
            //   }
            // })
            .use(__1.Expr, {
            ...opts,
            evaluate: resolve
        });
        (0, code_1.expect)(je1('a.b')).equal('a/b');
        (0, code_1.expect)(je1('a.b.c')).equal('a/b/c');
        (0, code_1.expect)(je1('a.b.c.d')).equal('a/b/c/d');
        (0, code_1.expect)(je1('{x:a.b}')).equal({ x: 'a/b' });
        (0, code_1.expect)(je1('{x:a.b.c}')).equal({ x: 'a/b/c' });
        (0, code_1.expect)(je1('{x:a.b.c.d}')).equal({ x: 'a/b/c/d' });
        (0, code_1.expect)(je1('x:a.b')).equal({ x: 'a/b' });
        (0, code_1.expect)(je1('x:a.b.c')).equal({ x: 'a/b/c' });
        (0, code_1.expect)(je1('x:a.b.c.d')).equal({ x: 'a/b/c/d' });
        (0, code_1.expect)(je1('a.b')).equal('a/b');
        (0, code_1.expect)(je1('a.b.c')).equal('a/b/c');
        (0, code_1.expect)(je1('a.b.c.d')).equal('a/b/c/d');
        (0, code_1.expect)(je1('(a)')).equal('a');
        (0, code_1.expect)(je1('(a.b)')).equal('a/b');
        (0, code_1.expect)(je1('(a.b.c)')).equal('a/b/c');
        (0, code_1.expect)(je1('+1')).equal(1);
        (0, code_1.expect)(je1('+a')).equal('a');
        (0, code_1.expect)(je1('(+a)')).equal('a');
        (0, code_1.expect)(je1('1+2')).equal(3);
        (0, code_1.expect)(je1('+3+4')).equal(7);
        (0, code_1.expect)(je1('(1+2)')).equal(3);
        (0, code_1.expect)(je1('(+3)')).equal(3);
        (0, code_1.expect)(je1('+3+4')).equal(7);
        (0, code_1.expect)(je1('(+3+4)')).equal(7);
    });
    (0, node_test_1.test)('evaluate-math', () => {
        let ME = makeExpr;
        let MO = makeOp;
        let PLUS = MO({ name: 'addition-infix', infix: true, src: '+' });
        let MF = {
            'addition-infix': (a, b) => a + b,
            'subtraction-infix': (a, b) => a - b,
            'multiplication-infix': (a, b) => a * b,
            'negative-prefix': (a) => -1 * a,
            'positive-prefix': (a) => a,
            'plain-paren': (a) => a,
        };
        let mr = (_r, _ctx, op, terms) => {
            // console.log('MR', op.name, terms)
            let mf = MF[op.name];
            return mf ? mf(...terms) : NaN;
        };
        const j = jsonic_1.Jsonic.make().use(__1.Expr);
        let r = null;
        let c = null;
        (0, code_1.expect)((0, __1.evaluation)(r, c, ME(PLUS, 1, 2), mr)).equal(3);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('1+2'), mr)).equal(3);
        (0, code_1.expect)((0, __1.evaluation)(r, c, ME(PLUS, ME(PLUS, 1, 2), 3), mr)).equal(6);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('1+2+3'), mr)).equal(6);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('1*2+3'), mr)).equal(5);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('1+2*3'), mr)).equal(7);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('(1)'), mr)).equal(1);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('(1+2)'), mr)).equal(3);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('3+(1+2)'), mr)).equal(6);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('(1+2)+3'), mr)).equal(6);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('(1+2)*3'), mr)).equal(9);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('3*(1+2)'), mr)).equal(9);
        const je = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(__1.Expr, {
            evaluate: mr
        });
        (0, code_1.expect)(je('11+22')).equal(33);
        (0, code_1.expect)(je('a:11+22')).equal({ a: 33 });
        (0, code_1.expect)(je('[11+22]')).equal([33]);
        (0, code_1.expect)(je('112')).equal(112);
        (0, code_1.expect)(je('+112')).equal(112);
        (0, code_1.expect)(je('a:(113)')).equal({ a: 113 });
        (0, code_1.expect)(je('(113)')).equal(113);
        (0, code_1.expect)(je('((114))')).equal(114);
        (0, code_1.expect)(je('(((115)))')).equal(115);
        (0, code_1.expect)(je('111+(222)')).equal(333);
        (0, code_1.expect)(je('(111)+222')).equal(333);
        (0, code_1.expect)(je('(111)+(222)')).equal(333);
        (0, code_1.expect)(je('111+222')).equal(333);
        (0, code_1.expect)(je('(111+222)')).equal(333);
        (0, code_1.expect)(je('(111+222)')).equal(333);
        (0, code_1.expect)(je('(1+2)*4')).equal(12);
        (0, code_1.expect)(je('1+(2*4)')).equal(9);
        (0, code_1.expect)(je('((1+2)*4)')).equal(12);
        (0, code_1.expect)(je('(1+(2*4))')).equal(9);
        (0, code_1.expect)(je('1-3')).equal(-2);
        (0, code_1.expect)(je('-1')).equal(-1);
        (0, code_1.expect)(je('+1')).equal(1);
        (0, code_1.expect)(je('1+(-3)')).equal(-2);
    });
    (0, node_test_1.test)('evaluate-sets', () => {
        let MF = {
            'plain-paren': (a) => a,
            'union-infix': (a, b) => [...new Set([...a, ...b])].sort(),
            'intersection-infix': (a, b) => Object
                .entries(b.reduce((s, e) => (s[e] = 1 + (s[e] || 0), s), a.reduce((s, e) => (s[e] = 1 + (s[e] || 0), s), {})))
                .filter((en) => 1 < en[1])
                .map(en => parseInt(en[0]))
                .sort(),
        };
        let mr = (_r, _ctx, op, terms) => {
            let mf = MF[op.name];
            return mf ? mf(...terms) : [];
        };
        const j = jsonic_1.Jsonic.make().use(__1.Expr, {
            op: {
                union: {
                    infix: true, src: 'U', left: 140, right: 150,
                },
                intersection: {
                    infix: true, src: 'N', left: 140, right: 150,
                },
            }
        });
        let r = null;
        let c = null;
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('[1]U[2]'), mr)).equal([1, 2]);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('[1,3]U[1,2]'), mr)).equal([1, 2, 3]);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('[1,3]N[1,2]'), mr)).equal([1]);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('[1,3]N[2]'), mr)).equal([]);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('[1,3]N[2,1]'), mr)).equal([1]);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('[1,3]N[2]U[1,2]'), mr)).equal([1, 2]);
        (0, code_1.expect)((0, __1.evaluation)(r, c, j('[1,3]N([2]U[1,2])'), mr)).equal([1]);
    });
    (0, node_test_1.test)('mini-config', () => {
        const funcMap = {
            floor: (v) => isNaN(v) ? undefined : Math.floor(v)
        };
        let MF = {
            'addition-infix': (a, b) => {
                // console.log('ADD', a, b)
                return a + b;
            },
            'subtraction-infix': (a, b) => a - b,
            'plain-paren': (a) => a,
            'func-paren': (...a) => {
                let out = a[1];
                const fname = a[0];
                if ('' !== fname) {
                    const func = funcMap[fname];
                    out = null == func ? undefined : func(...a.slice(1));
                }
                out = null == out ? null : out;
                // console.log('FUNC', fname, a, '->', out)
                return out;
            }
        };
        const j0 = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(__1.Expr, {
            op: {
                // plain: null,
                func: {
                    paren: true,
                    preval: true,
                    osrc: '<',
                    csrc: '>',
                },
            },
            evaluate: (r, _ctx, op, terms) => {
                let mf = MF[op.name];
                // console.log('EVAL-j0', op.name, terms, 'R', r.name, r.i, r.u, r.k, r.n, 'P', r.parent.i, r.parent.u, 'mf', mf)
                // r.parent.prev?.u?.paren_preval, op.name, terms, mf)
                // if (r.parent.prev?.u?.paren_preval) {
                if (
                // r.n.expr_paren
                'func-paren' === op.name
                    && !r.u.paren_preval
                // && !r.parent.parent?.u?.paren_preval
                // && !r.parent.prev?.u?.paren_preval
                // && !r.parent.u?.paren_preval
                ) {
                    terms = ['', ...terms];
                }
                // return mf ? mf(...terms) : undefined
                let out = mf ? mf(...terms) : null;
                out = undefined === out ? null : out;
                // console.log('EVAL-j0-terms', terms, '->', out, mf)
                return out;
            }
        });
        (0, code_1.expect)(j0('11+22')).equal(33);
        (0, code_1.expect)(j0('44-33')).equal(11);
        (0, code_1.expect)(j0('(44-33)+11')).equal(22);
        (0, code_1.expect)(j0('44-(33+11)')).equal(0);
        (0, code_1.expect)(j0('44-33+11')).equal(22);
        (0, code_1.expect)(j0('(1.1)')).equal(1.1);
        (0, code_1.expect)(j0('[0,(1)]')).equal([0, 1]);
        (0, code_1.expect)(j0('[0 (1)]')).equal([0, 1]);
        (0, code_1.expect)(j0('floor<1.5>')).equal(1);
        (0, code_1.expect)(j0('a:floor<2.5>')).equal({ a: 2 });
        (0, code_1.expect)(j0('{b:floor<3.5>}')).equal({ b: 3 });
        (0, code_1.expect)(j0('[floor<4.5>]')).equal([4]);
        (0, code_1.expect)(j0('[0 floor<5.5>]')).equal([0, 5]);
        (0, code_1.expect)(j0('1+floor<1.5>')).equal(2);
        (0, code_1.expect)(j0('1+floor<1.5>+3')).equal(5);
        (0, code_1.expect)(j0('floor<1.5>+4')).equal(5);
        (0, code_1.expect)(j0('a:floor<1.5>+4')).equal({ a: 5 });
        (0, code_1.expect)(j0('a:(1+2) b:floor<1.9>')).equal({ a: 3, b: 1 });
        (0, code_1.expect)(j0('()')).equal(null);
        (0, code_1.expect)(j0('<>')).equal(null);
        (0, code_1.expect)(j0('<1>')).equal(1);
        (0, code_1.expect)(j0('c:<2>')).equal({ c: 2 });
        (0, code_1.expect)(j0('a:floor<>')).equal({ a: null });
        (0, code_1.expect)(j0('floor<>')).equal(null);
        (0, code_1.expect)(j0('[floor<>]')).equal([null]);
        (0, code_1.expect)(j0('floor<"a">')).equal(null);
        (0, code_1.expect)(j0('a:floor<"a">')).equal({ a: null });
        (0, code_1.expect)(j0('[1 (2) (2+1) floor<4.5>]')).equal([1, 2, 3, 4]);
        (0, code_1.expect)(j0('1 (2) (2+1) floor<4.5>')).equal([1, 2, 3, 4]);
        (0, code_1.expect)(j0('bad<9>')).equal(null);
        const j1 = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(__1.Expr, {
            op: {
                plain: null,
                func: {
                    paren: true,
                    preval: {
                        active: true,
                        allow: ['floor']
                    },
                    osrc: '(',
                    csrc: ')',
                },
            },
            evaluate: (r, _ctx, op, terms) => {
                let mf = MF[op.name];
                // console.log('EVAL-j1', op.name, terms, 'R', r.i, r.u, r.k, r.n, 'P', r.parent.i, r.parent.u, 'mf', mf)
                // r.parent.prev?.u?.paren_preval, op.name, terms, mf)
                // if (r.parent.prev?.u?.paren_preval) {
                if (
                // r.n.expr_paren
                'func-paren' === op.name
                    && !r.u.paren_preval
                // && !r.parent.parent?.u?.paren_preval
                // && !r.parent.prev?.u?.paren_preval
                // && !r.parent?.u.paren_preval
                ) {
                    terms = ['', ...terms];
                }
                let out = mf ? mf(...terms) : NaN;
                out = undefined === out ? null : out;
                // console.log('EVAL', op.name, terms, '->', out)
                return out;
            }
        });
        (0, code_1.expect)(j1('()')).equal(null);
        (0, code_1.expect)(j1('(0)')).equal(0);
        (0, code_1.expect)(j1('(0+1)')).equal(1);
        (0, code_1.expect)(j1('[(0) 1]')).equal([0, 1]);
        // TODO
        // expect(() => j1('[0 (1) 2]')).toThrow('Invalid operation: 0')
        (0, code_1.expect)(j1('[0,(1),2]')).equal([0, 1, 2]);
        (0, code_1.expect)(j1('[0,(1)]')).equal([0, 1]);
        // TODO
        // expect(() => j1('[0 (1)]')).toThrow('Invalid operation: 0')
        (0, code_1.expect)(j1('[(1)]')).equal([1]);
        (0, code_1.expect)(j1('[0,(1)]')).equal([0, 1]);
        (0, code_1.expect)(j1('[(0),(1)]')).equal([0, 1]);
        (0, code_1.expect)(j1('(0),(1)')).equal([0, 1]);
        // expect(() => j1('[(0) (1)]')).toThrow('Invalid operation: (')
        // expect(() => j1('(0) (1)')).toThrow('Invalid operation: (')
        (0, code_1.expect)(j1('floor(1.1)')).equal(1);
        (0, code_1.expect)(j1('floor (1.1)')).equal(1);
        // TODO
        // expect(j1('(floor) (1.1)')).equal(1)
        // expect(() => j1('(0+1) (1+1)')).toThrow('Invalid operation: (')
        (0, code_1.expect)(j1('floor(0.5)')).equal(0);
        (0, code_1.expect)(j1('a:floor(2.5)')).equal({ a: 2 });
        (0, code_1.expect)(j1('{b:floor(3.5)}')).equal({ b: 3 });
        (0, code_1.expect)(j1('[floor(4.5)]')).equal([4]);
        (0, code_1.expect)(j1('[0 floor(5.5)]')).equal([0, 5]);
        (0, code_1.expect)(j1('[(0) 1 floor(5.5)]')).equal([0, 1, 5]);
        (0, code_1.expect)(j1('[(0) floor(5.5)]')).equal([0, 5]);
        (0, code_1.expect)(j1('[0,(1),floor(5.5)]')).equal([0, 1, 5]);
        (0, code_1.expect)(j1('[1,(2),(2+1)]')).equal([1, 2, 3]);
        (0, code_1.expect)(j1('[1,(2),(2+1),floor(4.5)]')).equal([1, 2, 3, 4]);
        (0, code_1.expect)(j1('a:floor(1.5)')).equal({ a: 1 });
        // TODO
        // expect(() => j1('b:bad(2.5)')).toThrow('Invalid operation: bad')
        (0, code_1.expect)(j1('[3+2]')).equal([5]);
        (0, code_1.expect)(j1('[3+(2)]')).equal([5]);
        (0, code_1.expect)(j1('[(3)+2]')).equal([5]);
        (0, code_1.expect)(j1('[(3)+(2)]')).equal([5]);
        (0, code_1.expect)(j1('[(3+2)]')).equal([5]);
        (0, code_1.expect)(j1('[(3+(2))]')).equal([5]);
        (0, code_1.expect)(j1('[((3)+2)]')).equal([5]);
        (0, code_1.expect)(j1('[((3)+(2))]')).equal([5]);
        (0, code_1.expect)(j1('[1,3+2]')).equal([1, 5]);
        (0, code_1.expect)(j1('[1,3+(2)]')).equal([1, 5]);
        (0, code_1.expect)(j1('[1,(3)+2]')).equal([1, 5]);
        (0, code_1.expect)(j1('[1,(3)+(2)]')).equal([1, 5]);
        (0, code_1.expect)(j1('[1,(3+2)]')).equal([1, 5]);
        (0, code_1.expect)(j1('[1,(3+(2))]')).equal([1, 5]);
        (0, code_1.expect)(j1('[1,((3)+2)]')).equal([1, 5]);
        (0, code_1.expect)(j1('[1,((3)+(2))]')).equal([1, 5]);
        (0, code_1.expect)(j1('[3+2,4]')).equal([5, 4]);
        (0, code_1.expect)(j1('[3+(2),4]')).equal([5, 4]);
        (0, code_1.expect)(j1('[(3)+2,4]')).equal([5, 4]);
        (0, code_1.expect)(j1('[(3)+(2),4]')).equal([5, 4]);
        (0, code_1.expect)(j1('[(3+2),4]')).equal([5, 4]);
        (0, code_1.expect)(j1('[(3+(2)),4]')).equal([5, 4]);
        (0, code_1.expect)(j1('[((3)+2),4]')).equal([5, 4]);
        (0, code_1.expect)(j1('[((3)+(2)),4]')).equal([5, 4]);
        (0, code_1.expect)(j1('[1,3+2,4]')).equal([1, 5, 4]);
        (0, code_1.expect)(j1('[1,3+(2),4]')).equal([1, 5, 4]);
        (0, code_1.expect)(j1('[1,(3)+2,4]')).equal([1, 5, 4]);
        (0, code_1.expect)(j1('[1,(3)+(2),4]')).equal([1, 5, 4]);
        (0, code_1.expect)(j1('[1,(3+2),4]')).equal([1, 5, 4]);
        (0, code_1.expect)(j1('[1,(3+(2)),4]')).equal([1, 5, 4]);
        (0, code_1.expect)(j1('[1,((3)+2),4]')).equal([1, 5, 4]);
        (0, code_1.expect)(j1('[1,((3)+(2)),4]')).equal([1, 5, 4]);
        (0, code_1.expect)(j1('1+floor(1.1)')).equal(2);
        (0, code_1.expect)(j1('floor(1.1)+1')).equal(2);
        (0, code_1.expect)(j1('1+floor(1.1)+1')).equal(3);
        (0, code_1.expect)(j1('a:(2)+1')).equal({ a: 3 });
        (0, code_1.expect)(j1('a:1+floor(1.1)')).equal({ a: 2 });
        (0, code_1.expect)(j1('a:(1.1)+1')).equal({ a: 2.1 });
        (0, code_1.expect)(j1('a:floor(1.1)+1')).equal({ a: 2 });
        (0, code_1.expect)(j1('a:1+floor(1.1)+1')).equal({ a: 3 });
        (0, code_1.expect)(j1('[1+floor(1.1)]')).equal([2]);
        (0, code_1.expect)(j1('[floor(1.1)+2]')).equal([3]);
        (0, code_1.expect)(j1('[3+floor(1.1)+2]')).equal([6]);
        (0, code_1.expect)(j1('b:1.1+1,c:C0')).equal({ b: 2.1, c: 'C0' });
        (0, code_1.expect)(j1('b:(1.1+1),c:C0a')).equal({ b: 2.1, c: 'C0a' });
        (0, code_1.expect)(j1('b:(1.1)+1,c:C1')).equal({ b: 2.1, c: 'C1' });
        (0, code_1.expect)(j1('b:((1.1)+1),c:C1a')).equal({ b: 2.1, c: 'C1a' });
        (0, code_1.expect)(j1('b:1+floor(1.1),c:C2c')).equal({ b: 2, c: 'C2c' });
        (0, code_1.expect)(j1('b:floor(1.1)+1,c:C2d')).equal({ b: 2, c: 'C2d' });
        (0, code_1.expect)(j1('b:(floor(1.1)),c:C2a')).equal({ b: 1, c: 'C2a' });
        (0, code_1.expect)(j1('b:(1+floor(1.1)),c:C2b')).equal({ b: 2, c: 'C2b' });
        (0, code_1.expect)(j1('1+(floor(1.1))')).equal(2);
        (0, code_1.expect)(j1('(11,22)')).equal([11, 22]);
        (0, code_1.expect)(j1('21+31')).equal(52);
        (0, code_1.expect)(j1('(21)+31')).equal(52);
        (0, code_1.expect)(j1('(21+31)')).equal(52);
        (0, code_1.expect)(j1('(floor(2.2))')).equal(2);
        (0, code_1.expect)(j1('((floor(2.2)))')).equal(2);
        (0, code_1.expect)(j1('(floor(2.2))+1')).equal(3);
        (0, code_1.expect)(j1('floor(2.2)+3')).equal(5);
        (0, code_1.expect)(j1('(floor(1.1)+2)')).equal(3);
        (0, code_1.expect)(j1('b:(floor(1.1)+2),c:C2c')).equal({ b: 3, c: 'C2c' });
    });
});
//# sourceMappingURL=expr.test.js.map