"use strict";
/* Copyright (c) 2021-2025 Richard Rodger and other contributors, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
const jsonic_1 = require("jsonic");
const expr_1 = require("../expr");
const { omap } = jsonic_1.util;
const C = (x) => JSON.parse(JSON.stringify(x));
// Walk expr tree into simplified form where first element is the op src.
const S = (x, seen) => (seen = seen !== null && seen !== void 0 ? seen : new WeakSet(),
    (seen === null || seen === void 0 ? void 0 : seen.has(x)) ? '[CIRCLE]' : ((x && 'object' === typeof x ? seen === null || seen === void 0 ? void 0 : seen.add(x) : null),
        (x && Array.isArray(x)) ?
            (0 === x.length ? x : [
                x[0].src || S(x[0], seen),
                ...(1 < x.length ? (x.slice(1).map((t) => S(t, seen))) : [])
            ]
                .filter(t => undefined !== t)) :
            (null != x && 'object' === typeof (x) ? omap(x, ([n, v]) => [n, S(v, seen)]) : x)));
const mj = (je) => (s, m) => C(S(je(s, m)));
const _mo_ = 'toMatchObject';
function makeOp(opspec) {
    const base = { infix: false, prefix: false, suffix: false, left: 0, right: 0 };
    const op = expr_1.testing.opify({
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
describe('expr', () => {
    beforeEach(() => {
        global.console = require('console');
    });
    test('happy', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('1+2')).toMatchObject(['+', 1, 2]);
        expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2]);
    });
    test('prattify-basic', () => {
        let prattify = expr_1.testing.prattify;
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
        expect(T(E = ME(PLUS_LA, 1, 2), PLUS_LA))[_mo_](['+', ['+', 1, 2]]);
        expect(C(S(E)))[_mo_](['+', ['+', 1, 2]]);
        // 1+2+N => 1+(2+N)
        expect(T(E = ME(PLUS_RA, 1, 2), PLUS_RA))[_mo_](['+', 2]);
        expect(C(S(E)))[_mo_](['+', 1, ['+', 2]]);
        // 1+2*N => 1+(2*N)
        expect(T(E = ME(PLUS_LA, 1, 2), MUL_LA))[_mo_](['*', 2]);
        expect(C(S(E)))[_mo_](['+', 1, ['*', 2]]);
        // 1*2+N => (1+2)+N
        expect(T(E = ME(MUL_LA, 1, 2), PLUS_LA))[_mo_](['+', ['*', 1, 2]]);
        expect(C(S(E)))[_mo_](['+', ['*', 1, 2]]);
        // @1+N => (@1)+N
        expect(T(E = ME(AT_P, 1), PLUS_LA))[_mo_](['+', ['@', 1]]);
        expect(C(S(E)))[_mo_](['+', ['@', 1]]);
        // 1!+N => (!1)+N
        expect(T(E = ME(BANG_S, 1), PLUS_LA))[_mo_](['+', ['!', 1]]);
        expect(C(S(E)))[_mo_](['+', ['!', 1]]);
        // @1|N => @(1|N)
        expect(T(E = ME(AT_P, 1), PIPE_LA))[_mo_](['|', 1]);
        expect(C(S(E)))[_mo_](['@', ['|', 1]]);
        // 1|@N => 1|(@N)
        expect(T(E = ME(PIPE_LA, 1), AT_P))[_mo_](['@']);
        expect(C(S(E)))[_mo_](['|', 1, ['@']]);
        // 1!|N => (!1)|N
        expect(T(E = ME(BANG_S, 1), PIPE_LA))[_mo_](['|', ['!', 1]]);
        expect(C(S(E)))[_mo_](['|', ['!', 1]]);
        // 1+@N => 1+(@N)
        expect(T(E = ME(PLUS_LA, 1), AT_P))[_mo_](['@']);
        expect(C(S(E)))[_mo_](['+', 1, ['@']]);
        // @@N => @(@N)
        expect(T(E = ME(AT_P), AT_P))[_mo_](['@']);
        expect(C(S(E)))[_mo_](['@', ['@']]);
        // %@N => %(@N)
        expect(T(E = ME(PER_P), AT_P))[_mo_](['@']);
        expect(C(S(E)))[_mo_](['%', ['@']]);
        // @%N => @(%N)
        expect(T(E = ME(AT_P), PER_P))[_mo_](['%']);
        expect(C(S(E)))[_mo_](['@', ['%']]);
        // 1+2! => 1+(2!)
        // expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['!', 2])
        expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['+', 1, ['!', 2]]);
        expect(C(S(E)))[_mo_](['+', 1, ['!', 2]]);
        // 1|2! => (1|2)!
        expect(T(E = ME(PIPE_LA, 1, 2), BANG_S))[_mo_](['!', ['|', 1, 2]]);
        expect(C(S(E)))[_mo_](['!', ['|', 1, 2]]);
        // 1!! => !(!1)
        expect(T(E = ME(BANG_S, 1), BANG_S))[_mo_](['!', ['!', 1]]);
        expect(C(S(E)))[_mo_](['!', ['!', 1]]);
        // 1!? => ?(!1)
        expect(T(E = ME(BANG_S, 1), QUEST_S))[_mo_](['?', ['!', 1]]);
        expect(C(S(E)))[_mo_](['?', ['!', 1]]);
        // 1?! => !(?1)
        expect(T(E = ME(QUEST_S, 1), BANG_S))[_mo_](['!', ['?', 1]]);
        expect(C(S(E)))[_mo_](['!', ['?', 1]]);
        // @1! => @(1!)
        // expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['!', 1])
        expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['@', ['!', 1]]);
        expect(C(S(E)))[_mo_](['@', ['!', 1]]);
        // @1? => (@1)?
        expect(T(E = ME(AT_P, 1), QUEST_S))[_mo_](['?', ['@', 1]]);
        expect(C(S(E)))[_mo_](['?', ['@', 1]]);
        // @@1! => @(@(1!))
        // expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['!', 1])
        expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['@', ['@', ['!', 1]]]);
        expect(C(S(E)))[_mo_](['@', ['@', ['!', 1]]]);
        // @@1? => (@(@1))?
        expect(T(E = ME(AT_P, ME(AT_P, 1)), QUEST_S))[_mo_](['?', ['@', ['@', 1]]]);
        expect(C(S(E)))[_mo_](['?', ['@', ['@', 1]]]);
    });
    test('prattify-assoc', () => {
        let prattify = expr_1.testing.prattify;
        let T = (expr, opdef) => C(S(prattify(expr, opdef)));
        let ME = makeExpr;
        let MO = makeOp;
        let AT_LA = MO({ infix: true, src: '@', left: 14, right: 15 });
        let PER_RA = MO({ infix: true, src: '%', left: 17, right: 16 });
        let E;
        // 1@2@N
        expect(T(E = ME(AT_LA, 1, 2), AT_LA))[_mo_](['@', ['@', 1, 2]]);
        expect(C(S(E)))[_mo_](['@', ['@', 1, 2]]);
        // 1@2@3@N
        expect(T(E = ME(AT_LA, ME(AT_LA, 1, 2), 3), AT_LA))[_mo_](['@', ['@', ['@', 1, 2], 3]]);
        expect(C(S(E)))[_mo_](['@', ['@', ['@', 1, 2], 3]]);
        // 1@2@3@4@N
        expect(T(E = ME(AT_LA, ME(AT_LA, ME(AT_LA, 1, 2), 3), 4), AT_LA))[_mo_](['@', ['@', ['@', ['@', 1, 2], 3], 4]]);
        expect(C(S(E)))[_mo_](['@', ['@', ['@', ['@', 1, 2], 3], 4]]);
        // 1@2@3@4@5@N
        expect(T(E = ME(AT_LA, ME(AT_LA, ME(AT_LA, ME(AT_LA, 1, 2), 3), 4), 5), AT_LA))[_mo_](['@', ['@', ['@', ['@', ['@', 1, 2], 3], 4], 5]]);
        expect(C(S(E)))[_mo_](['@', ['@', ['@', ['@', ['@', 1, 2], 3], 4], 5]]);
        // 1%2%N
        expect(T(E = ME(PER_RA, 1, 2), PER_RA))[_mo_](['%', 2]);
        expect(C(S(E)))[_mo_](['%', 1, ['%', 2]]);
        // 1%2%3%N
        expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, 3)), PER_RA))[_mo_](['%', 3]);
        expect(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3]]]);
        // 1%2%3%4%N
        expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, ME(PER_RA, 3, 4))), PER_RA))[_mo_](['%', 4]);
        expect(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3, ['%', 4]]]]);
        // 1%2%3%4%5%N
        expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, ME(PER_RA, 3, ME(PER_RA, 4, 5)))), PER_RA))[_mo_](['%', 5]);
        expect(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3, ['%', 4, ['%', 5]]]]]);
    });
    test('binary', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('1+2'))[_mo_](['+', 1, 2]);
        expect(j('1*2'))[_mo_](['*', 1, 2]);
        expect(j('1+2+3'))[_mo_](['+', ['+', 1, 2], 3]);
        expect(j('1*2+3'))[_mo_](['+', ['*', 1, 2], 3]);
        expect(j('1+2*3'))[_mo_](['+', 1, ['*', 2, 3]]);
        expect(j('1*2*3'))[_mo_](['*', ['*', 1, 2], 3]);
        expect(j('1+2+3+4'))[_mo_](['+', ['+', ['+', 1, 2], 3], 4]);
        expect(j('1*2+3+4'))[_mo_](['+', ['+', ['*', 1, 2], 3], 4]);
        expect(j('1+2*3+4'))[_mo_](['+', ['+', 1, ['*', 2, 3]], 4]);
        expect(j('1+2+3*4'))[_mo_](['+', ['+', 1, 2], ['*', 3, 4]]);
        expect(j('1+2*3*4'))[_mo_](['+', 1, ['*', ['*', 2, 3], 4]]);
        expect(j('1*2+3*4'))[_mo_](['+', ['*', 1, 2], ['*', 3, 4]]);
        expect(j('1*2*3+4'))[_mo_](['+', ['*', ['*', 1, 2], 3], 4]);
        expect(j('1*2*3*4'))[_mo_](['*', ['*', ['*', 1, 2], 3], 4]);
        expect(j('1+2+3+4+5'))[_mo_](['+', ['+', ['+', ['+', 1, 2], 3], 4], 5]);
        expect(j('1*2+3+4+5'))[_mo_](['+', ['+', ['+', ['*', 1, 2], 3], 4], 5]);
        expect(j('1+2*3+4+5'))[_mo_](['+', ['+', ['+', 1, ['*', 2, 3]], 4], 5]);
        expect(j('1+2+3*4+5'))[_mo_](['+', ['+', ['+', 1, 2], ['*', 3, 4]], 5]);
        expect(j('1+2+3+4*5'))[_mo_](['+', ['+', ['+', 1, 2], 3], ['*', 4, 5]]);
        expect(j('1*2*3+4+5'))[_mo_](['+', ['+', ['*', ['*', 1, 2], 3], 4], 5]);
        expect(j('1+2*3*4+5'))[_mo_](['+', ['+', 1, ['*', ['*', 2, 3], 4]], 5]);
        expect(j('1+2+3*4*5'))[_mo_](['+', ['+', 1, 2], ['*', ['*', 3, 4], 5]]);
        expect(j('1*2+3+4*5'))[_mo_](['+', ['+', ['*', 1, 2], 3], ['*', 4, 5]]);
        expect(j('1*2+3*4+5'))[_mo_](['+', ['+', ['*', 1, 2], ['*', 3, 4]], 5]);
        expect(j('1+2*3+4*5'))[_mo_](['+', ['+', 1, ['*', 2, 3]], ['*', 4, 5]]);
        expect(j('1+2*3*4*5'))[_mo_](['+', 1, ['*', ['*', ['*', 2, 3], 4], 5]]);
        expect(j('1*2+3*4*5'))[_mo_](['+', ['*', 1, 2], ['*', ['*', 3, 4], 5]]);
        expect(j('1*2*3+4*5'))[_mo_](['+', ['*', ['*', 1, 2], 3], ['*', 4, 5]]);
        expect(j('1*2*3*4+5'))[_mo_](['+', ['*', ['*', ['*', 1, 2], 3], 4], 5]);
        expect(j('1*2*3*4*5'))[_mo_](['*', ['*', ['*', ['*', 1, 2], 3], 4], 5]);
    });
    test('structure', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('a:1+2'))[_mo_]({ a: ['+', 1, 2] });
        expect(j('a:1+2,b:3+4'))[_mo_]({ a: ['+', 1, 2], b: ['+', 3, 4] });
        expect(j('[1+2]'))[_mo_]([['+', 1, 2]]);
        expect(j('[1+2,3+4]'))[_mo_]([['+', 1, 2], ['+', 3, 4]]);
        expect(j('{a:[1+2]}'))[_mo_]({ a: [['+', 1, 2]] });
    });
    test('implicit-list-top-basic', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('1,2'))[_mo_]([1, 2]);
        expect(j('1+2,3'))[_mo_]([['+', 1, 2], 3]);
        expect(j('1+2+3,4'))[_mo_]([['+', ['+', 1, 2], 3], 4]);
        expect(j('1+2+3+4,5'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5]);
        expect(j('1 2'))[_mo_]([1, 2]);
        expect(j('1+2 3'))[_mo_]([['+', 1, 2], 3]);
        expect(j('1+2+3 4'))[_mo_]([['+', ['+', 1, 2], 3], 4]);
        expect(j('1+2+3+4 5'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5]);
        expect(j('1,2,11'))[_mo_]([1, 2, 11]);
        expect(j('1+2,3,11'))[_mo_]([['+', 1, 2], 3, 11]);
        expect(j('1+2+3,4,11'))[_mo_]([['+', ['+', 1, 2], 3], 4, 11]);
        expect(j('1+2+3+4,5,11'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        expect(j('1 2 11'))[_mo_]([1, 2, 11]);
        expect(j('1+2 3 11'))[_mo_]([['+', 1, 2], 3, 11]);
        expect(j('1+2+3 4 11'))[_mo_]([['+', ['+', 1, 2], 3], 4, 11]);
        expect(j('1+2+3+4 5 11'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        expect(j('22,1,2,11'))[_mo_]([22, 1, 2, 11]);
        expect(j('22,1+2,3,11'))[_mo_]([22, ['+', 1, 2], 3, 11]);
        expect(j('22,1+2+3,4,11'))[_mo_]([22, ['+', ['+', 1, 2], 3], 4, 11]);
        expect(j('22,1+2+3+4,5,11'))[_mo_]([22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        expect(j('22 1 2 11'))[_mo_]([22, 1, 2, 11]);
        expect(j('22 1+2 3 11'))[_mo_]([22, ['+', 1, 2], 3, 11]);
        expect(j('22 1+2+3 4 11'))[_mo_]([22, ['+', ['+', 1, 2], 3], 4, 11]);
        expect(j('22 1+2+3+4 5 11'))[_mo_]([22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        expect(j('[true,false],1,2,11'))[_mo_]([[true, false], 1, 2, 11]);
        expect(j('[true,false],1+2,3,11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11]);
        expect(j('[true,false],1+2+3,4,11'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11]);
        expect(j('[true,false],1+2+3+4,5,11'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        expect(j('[true,false] 1 2 11'))[_mo_]([[true, false], 1, 2, 11]);
        expect(j('[true,false] 1+2 3 11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11]);
        expect(j('[true,false] 1+2+3 4 11'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11]);
        expect(j('[true,false] 1+2+3+4 5 11'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]);
        expect(j('[true,false],1,2,{x:11,y:22}'))[_mo_]([[true, false], 1, 2, { x: 11, y: 22 }]);
        expect(j('[true,false],1+2,3,{x:11,y:22}'))[_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]);
        expect(j('[true,false],1+2+3,4,{x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]);
        expect(j('[true,false],1+2+3+4,5,{x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]);
        expect(j('[true,false] 1 2 {x:11,y:22}'))[_mo_]([[true, false], 1, 2, { x: 11, y: 22 }]);
        expect(j('[true,false] 1+2 3 {x:11,y:22}'))[_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]);
        expect(j('[true,false] 1+2+3 4 {x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]);
        expect(j('[true,false] 1+2+3+4 5 {x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]);
        expect(j('1+2,3+4'))[_mo_]([['+', 1, 2], ['+', 3, 4]]);
        expect(j('1+2,3+4,5+6'))[_mo_]([['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]);
    });
    test('implicit-list-top-paren', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('(1,2)'))[_mo_](['(', [1, 2]]);
        expect(j('(1+2,3)'))[_mo_](['(', [['+', 1, 2], 3]]);
        expect(j('(1+2+3,4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]]);
        expect(j('(1+2+3+4,5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]]);
        expect(j('(1 2)'))[_mo_](['(', [1, 2]]);
        expect(j('(1+2 3)'))[_mo_](['(', [['+', 1, 2], 3]]);
        expect(j('(1+2+3 4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]]);
        expect(j('(1+2+3+4 5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]]);
        expect(j('(1,2,11)'))[_mo_](['(', [1, 2, 11]]);
        expect(j('(1+2,3,11)'))[_mo_](['(', [['+', 1, 2], 3, 11]]);
        expect(j('(1+2+3,4,11)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4, 11]]);
        expect(j('(1+2+3+4,5,11)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        expect(j('(1 2 11)'))[_mo_](['(', [1, 2, 11]]);
        expect(j('(1+2 3 11)'))[_mo_](['(', [['+', 1, 2], 3, 11]]);
        expect(j('(1+2+3 4 11)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4, 11]]);
        expect(j('(1+2+3+4 5 11)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        expect(j('(22,1,2,11)'))[_mo_](['(', [22, 1, 2, 11]]);
        expect(j('(22,1+2,3,11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]]);
        expect(j('(22,1+2+3,4,11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]]);
        expect(j('(22,1+2+3+4,5,11)'))[_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        expect(j('(22 1 2 11)'))[_mo_](['(', [22, 1, 2, 11]]);
        expect(j('(22 1+2 3 11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]]);
        expect(j('(22 1+2+3 4 11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]]);
        expect(j('(22 1+2+3+4 5 11)'))[_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        expect(j('([true,false],1,2,11)'))[_mo_](['(', [[true, false], 1, 2, 11]]);
        expect(j('([true,false],1+2,3,11)'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]]);
        expect(j('([true,false],1+2+3,4,11)'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]]);
        expect(j('([true,false],1+2+3+4,5,11)'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        expect(j('([true,false] 1 2 11)'))[_mo_](['(', [[true, false], 1, 2, 11]]);
        expect(j('([true,false] 1+2 3 11)'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]]);
        expect(j('([true,false] 1+2+3 4 11)'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]]);
        expect(j('([true,false] 1+2+3+4 5 11)'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]]);
        expect(j('([true,false],1,2,{x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]]);
        expect(j('([true,false],1+2,3,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]]);
        expect(j('([true,false],1+2+3,4,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]]);
        expect(j('([true,false],1+2+3+4,5,{x:11,y:22})'))[_mo_](['(', [[true, false],
                ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]]);
        expect(j('([true,false] 1 2 {x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]]);
        expect(j('([true,false] 1+2 3 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]]);
        expect(j('([true,false] 1+2+3 4 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]]);
        expect(j('([true,false] 1+2+3+4 5 {x:11,y:22})'))[_mo_](['(', [[true, false],
                ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]]);
        expect(j('(1+2,3+4)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4]]]);
        expect(j('(1+2,3+4,5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        expect(j('(1+2 3+4)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4]]]);
        expect(j('(1+2 3+4 5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
    });
    test('map-implicit-list-paren', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('a:(1,2),b:0'))[_mo_]({ a: ['(', [1, 2]], b: 0 });
        expect(j('a:(1+2,3),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 });
        expect(j('a:(1+2+3,4),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 });
        expect(j('a:(1+2+3+4,5),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 });
        expect(j('a:(1 2),b:0'))[_mo_]({ a: ['(', [1, 2]], b: 0 });
        expect(j('a:(1+2 3),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 });
        expect(j('a:(1+2+3 4),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 });
        expect(j('a:(1+2+3+4 5),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 });
        expect(j('a:(1,2,11),b:0'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 });
        expect(j('a:(1+2,3,11),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 });
        expect(j('a:(1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('a:(1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('a:(1 2 11),b:0'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 });
        expect(j('a:(1+2 3 11),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 });
        expect(j('a:(1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('a:(1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('a:(22,1,2,11),b:0'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 });
        expect(j('a:(22,1+2,3,11),b:0'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 });
        expect(j('a:(22,1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('a:(22,1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('a:(22 1 2 11),b:0'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 });
        expect(j('a:(22 1+2 3 11),b:0'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 });
        expect(j('a:(22 1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('a:(22 1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('a:([true,false],1,2,11),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 });
        expect(j('a:([true,false],1+2,3,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 });
        expect(j('a:([true,false],1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('a:([true,false],1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('a:([true,false] 1 2 11),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 });
        expect(j('a:([true,false] 1+2 3 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 });
        expect(j('a:([true,false] 1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('a:([true,false] 1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('a:([true,false],1,2,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 });
        expect(j('a:([true,false],1+2,3,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 });
        expect(j('a:([true,false],1+2+3,4,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 });
        expect(j('a:([true,false],1+2+3+4,5,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 });
        expect(j('a:([true,false] 1 2 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 });
        expect(j('a:([true,false] 1+2 3 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 });
        expect(j('a:([true,false] 1+2+3 4 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 });
        expect(j('a:([true,false] 1+2+3+4 5 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:(1,2),b:0}'))[_mo_]({ a: ['(', [1, 2]], b: 0 });
        expect(j('{a:(1+2,3),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 });
        expect(j('{a:(1+2+3,4),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 });
        expect(j('{a:(1+2+3+4,5),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 });
        expect(j('{a:(1 2),b:0}'))[_mo_]({ a: ['(', [1, 2]], b: 0 });
        expect(j('{a:(1+2 3),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 });
        expect(j('{a:(1+2+3 4),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 });
        expect(j('{a:(1+2+3+4 5),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 });
        expect(j('{a:(1,2,11),b:0}'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 });
        expect(j('{a:(1+2,3,11),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 });
        expect(j('{a:(1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('{a:(1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('{a:(1 2 11),b:0}'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 });
        expect(j('{a:(1+2 3 11),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 });
        expect(j('{a:(1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('{a:(1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('{a:(22,1,2,11),b:0}'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 });
        expect(j('{a:(22,1+2,3,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 });
        expect(j('{a:(22,1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('{a:(22,1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('{a:(22 1 2 11),b:0}'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 });
        expect(j('{a:(22 1+2 3 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 });
        expect(j('{a:(22 1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('{a:(22 1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('{a:([true,false],1,2,11),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 });
        expect(j('{a:([true,false],1+2,3,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 });
        expect(j('{a:([true,false],1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('{a:([true,false],1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('{a:([true,false] 1 2 11),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 });
        expect(j('{a:([true,false] 1+2 3 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 });
        expect(j('{a:([true,false] 1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 });
        expect(j('{a:([true,false] 1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 });
        expect(j('{a:([true,false],1,2,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:([true,false],1+2,3,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:([true,false],1+2+3,4,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:([true,false],1+2+3+4,5,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:([true,false] 1 2 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:([true,false] 1+2 3 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:([true,false] 1+2+3 4 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:([true,false] 1+2+3+4 5 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 });
        expect(j('{a:(1+2,3+4)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4]]] });
        expect(j('{a:(1+2,3+4,5+6)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]] });
        expect(j('{a:(1+2 3+4)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4]]] });
        expect(j('{a:(1+2 3+4 5+6)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]] });
    });
    test('unary-prefix-basic', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('1')).toEqual(1);
        expect(j('z')).toEqual('z');
        expect(j('-1')).toMatchObject(['-', 1]);
        expect(j('- 1')).toMatchObject(['-', 1]);
        expect(j('+1')).toMatchObject(['+', 1]);
        expect(j('+ 1')).toMatchObject(['+', 1]);
        expect(j('--1')).toMatchObject(['-', ['-', 1]]);
        expect(j('---1')).toMatchObject(['-', ['-', ['-', 1]]]);
        expect(j('++1')).toMatchObject(['+', ['+', 1]]);
        expect(j('+++1')).toMatchObject(['+', ['+', ['+', 1]]]);
        expect(j('-+1')).toMatchObject(['-', ['+', 1]]);
        expect(j('+-1')).toMatchObject(['+', ['-', 1]]);
        expect(j('--+1')).toMatchObject(['-', ['-', ['+', 1]]]);
        expect(j('-+-1')).toMatchObject(['-', ['+', ['-', 1]]]);
        expect(j('+--1')).toMatchObject(['+', ['-', ['-', 1]]]);
        expect(j('-++1')).toMatchObject(['-', ['+', ['+', 1]]]);
        expect(j('++-1')).toMatchObject(['+', ['+', ['-', 1]]]);
        expect(j('-z')).toMatchObject(['-', 'z']);
        expect(j('- z')).toMatchObject(['-', 'z']);
        expect(j('+z')).toMatchObject(['+', 'z']);
        expect(j('+ z')).toMatchObject(['+', 'z']);
        expect(j('--z')).toMatchObject(['-', ['-', 'z']]);
        expect(j('---z')).toMatchObject(['-', ['-', ['-', 'z']]]);
        expect(j('++z')).toMatchObject(['+', ['+', 'z']]);
        expect(j('+++z')).toMatchObject(['+', ['+', ['+', 'z']]]);
        expect(j('-+z')).toMatchObject(['-', ['+', 'z']]);
        expect(j('+-z')).toMatchObject(['+', ['-', 'z']]);
        expect(j('--+z')).toMatchObject(['-', ['-', ['+', 'z']]]);
        expect(j('-+-z')).toMatchObject(['-', ['+', ['-', 'z']]]);
        expect(j('+--z')).toMatchObject(['+', ['-', ['-', 'z']]]);
        expect(j('-++z')).toMatchObject(['-', ['+', ['+', 'z']]]);
        expect(j('++-z')).toMatchObject(['+', ['+', ['-', 'z']]]);
        expect(j('-{z:1}')).toMatchObject(['-', { z: 1 }]);
        expect(j('- {z:1}')).toMatchObject(['-', { z: 1 }]);
        expect(j('+{z:1}')).toMatchObject(['+', { z: 1 }]);
        expect(j('+ {z:1}')).toMatchObject(['+', { z: 1 }]);
        expect(j('-{z:1,y:2}')).toMatchObject(['-', { z: 1, y: 2 }]);
        expect(j('- {z:1,y:2}')).toMatchObject(['-', { z: 1, y: 2 }]);
        expect(j('+{z:1,y:2}')).toMatchObject(['+', { z: 1, y: 2 }]);
        expect(j('+ {z:1,y:2}')).toMatchObject(['+', { z: 1, y: 2 }]);
        expect(j('-{z:1 y:2}')).toMatchObject(['-', { z: 1, y: 2 }]);
        expect(j('- {z:1 y:2}')).toMatchObject(['-', { z: 1, y: 2 }]);
        expect(j('+{z:1 y:2}')).toMatchObject(['+', { z: 1, y: 2 }]);
        expect(j('+ {z:1 y:2}')).toMatchObject(['+', { z: 1, y: 2 }]);
        expect(j('-{z:1,y:2,x:3}')).toMatchObject(['-', { z: 1, y: 2, x: 3 }]);
        expect(j('- {z:1,y:2,x:3}')).toMatchObject(['-', { z: 1, y: 2, x: 3 }]);
        expect(j('+{z:1,y:2,x:3}')).toMatchObject(['+', { z: 1, y: 2, x: 3 }]);
        expect(j('+ {z:1,y:2,x:3}')).toMatchObject(['+', { z: 1, y: 2, x: 3 }]);
        expect(j('-{z:1 y:2 x:3}')).toMatchObject(['-', { z: 1, y: 2, x: 3 }]);
        expect(j('- {z:1 y:2 x:3}')).toMatchObject(['-', { z: 1, y: 2, x: 3 }]);
        expect(j('+{z:1 y:2 x:3}')).toMatchObject(['+', { z: 1, y: 2, x: 3 }]);
        expect(j('+ {z:1 y:2 x:3}')).toMatchObject(['+', { z: 1, y: 2, x: 3 }]);
        expect(j('-{z:-1}')).toMatchObject(['-', { z: ['-', 1] }]);
        expect(j('- {z:-1}')).toMatchObject(['-', { z: ['-', 1] }]);
        expect(j('+{z:+1}')).toMatchObject(['+', { z: ['+', 1] }]);
        expect(j('+ {z:+1}')).toMatchObject(['+', { z: ['+', 1] }]);
        expect(j('-{z:2-1}')).toMatchObject(['-', { z: ['-', 2, 1] }]);
        expect(j('- {z:2-1}')).toMatchObject(['-', { z: ['-', 2, 1] }]);
        expect(j('+{z:2+1}')).toMatchObject(['+', { z: ['+', 2, 1] }]);
        expect(j('+ {z:2+1}')).toMatchObject(['+', { z: ['+', 2, 1] }]);
        expect(j('--{z:1}')).toMatchObject(['-', ['-', { z: 1 }]]);
        expect(j('---{z:1}')).toMatchObject(['-', ['-', ['-', { z: 1 }]]]);
        expect(j('++{z:1}')).toMatchObject(['+', ['+', { z: 1 }]]);
        expect(j('+++{z:1}')).toMatchObject(['+', ['+', ['+', { z: 1 }]]]);
        expect(j('-+{z:1}')).toMatchObject(['-', ['+', { z: 1 }]]);
        expect(j('+-{z:1}')).toMatchObject(['+', ['-', { z: 1 }]]);
        expect(j('--+{z:1}')).toMatchObject(['-', ['-', ['+', { z: 1 }]]]);
        expect(j('-+-{z:1}')).toMatchObject(['-', ['+', ['-', { z: 1 }]]]);
        expect(j('+--{z:1}')).toMatchObject(['+', ['-', ['-', { z: 1 }]]]);
        expect(j('-++{z:1}')).toMatchObject(['-', ['+', ['+', { z: 1 }]]]);
        expect(j('++-{z:1}')).toMatchObject(['+', ['+', ['-', { z: 1 }]]]);
        expect(j('-[11,22]')).toMatchObject(['-', [11, 22]]);
        expect(j('- [11,22]')).toMatchObject(['-', [11, 22]]);
        expect(j('+[11,22]')).toMatchObject(['+', [11, 22]]);
        expect(j('+ [11,22]')).toMatchObject(['+', [11, 22]]);
        expect(j('--[11,22]')).toMatchObject(['-', ['-', [11, 22]]]);
        expect(j('---[11,22]')).toMatchObject(['-', ['-', ['-', [11, 22]]]]);
        expect(j('++[11,22]')).toMatchObject(['+', ['+', [11, 22]]]);
        expect(j('+++[11,22]')).toMatchObject(['+', ['+', ['+', [11, 22]]]]);
        expect(j('-+[11,22]')).toMatchObject(['-', ['+', [11, 22]]]);
        expect(j('+-[11,22]')).toMatchObject(['+', ['-', [11, 22]]]);
        expect(j('--+[11,22]')).toMatchObject(['-', ['-', ['+', [11, 22]]]]);
        expect(j('-+-[11,22]')).toMatchObject(['-', ['+', ['-', [11, 22]]]]);
        expect(j('+--[11,22]')).toMatchObject(['+', ['-', ['-', [11, 22]]]]);
        expect(j('-++[11,22]')).toMatchObject(['-', ['+', ['+', [11, 22]]]]);
        expect(j('++-[11,22]')).toMatchObject(['+', ['+', ['-', [11, 22]]]]);
        expect(j('1+2')).toMatchObject(['+', 1, 2]);
        expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2]);
        expect(j('--1+2')).toMatchObject(['+', ['-', ['-', 1]], 2]);
        expect(j('-1+-2')).toMatchObject(['+', ['-', 1], ['-', 2]]);
        expect(j('1+-2')).toMatchObject(['+', 1, ['-', 2]]);
        expect(j('1++2')).toMatchObject(['+', 1, ['+', 2]]);
        expect(j('-1++2')).toMatchObject(['+', ['-', 1], ['+', 2]]);
        expect(j('-1+2+3')).toMatchObject(['+', ['+', ['-', 1], 2], 3]);
        expect(j('-1+-2+3')).toMatchObject(['+', ['+', ['-', 1], ['-', 2]], 3]);
        expect(j('-1+-2+-3')).toMatchObject(['+', ['+', ['-', 1], ['-', 2]], ['-', 3]]);
        expect(j('-1+2+-3')).toMatchObject(['+', ['+', ['-', 1], 2], ['-', 3]]);
        expect(j('1+2+3')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('1+-2+3')).toMatchObject(['+', ['+', 1, ['-', 2]], 3]);
        expect(j('1+-2+-3')).toMatchObject(['+', ['+', 1, ['-', 2]], ['-', 3]]);
        expect(j('1+2+-3')).toMatchObject(['+', ['+', 1, 2], ['-', 3]]);
    });
    test('unary-prefix-edge', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            op: {
                at: {
                    prefix: true, right: 15000, src: '@'
                },
                tight: {
                    infix: true, left: 120000, right: 130000, src: '~'
                },
            }
        });
        const j = mj(je);
        expect(j('@1')).toEqual(['@', 1]);
        expect(j('@@1')).toEqual(['@', ['@', 1]]);
        expect(j('@@@1')).toEqual(['@', ['@', ['@', 1]]]);
        // Precedence does not matter within prefix sequences.
        expect(j('-@1')).toEqual(['-', ['@', 1]]);
        expect(j('@-1')).toEqual(['@', ['-', 1]]);
        expect(j('--@1')).toEqual(['-', ['-', ['@', 1]]]);
        expect(j('@--1')).toEqual(['@', ['-', ['-', 1]]]);
        expect(j('@@-1')).toEqual(['@', ['@', ['-', 1]]]);
        expect(j('-@@1')).toEqual(['-', ['@', ['@', 1]]]);
        expect(j('-@-1')).toEqual(['-', ['@', ['-', 1]]]);
        expect(j('@-@1')).toEqual(['@', ['-', ['@', 1]]]);
        expect(j('@1+2')).toEqual(['+', ['@', 1], 2]);
        expect(j('1+@2')).toEqual(['+', 1, ['@', 2]]);
        expect(j('@1+@2')).toEqual(['+', ['@', 1], ['@', 2]]);
        expect(j('@1+2+3')).toEqual(['+', ['+', ['@', 1], 2], 3]);
        expect(j('1+@2+3')).toEqual(['+', ['+', 1, ['@', 2]], 3]);
        expect(j('@1+@2+3')).toEqual(['+', ['+', ['@', 1], ['@', 2]], 3]);
        expect(j('@1+2+@3')).toEqual(['+', ['+', ['@', 1], 2], ['@', 3]]);
        expect(j('1+@2+@3')).toEqual(['+', ['+', 1, ['@', 2]], ['@', 3]]);
        expect(j('@1+@2+@3')).toEqual(['+', ['+', ['@', 1], ['@', 2]], ['@', 3]]);
        // Tighter!
        expect(j('@1~2')).toEqual(['@', ['~', 1, 2]]);
        expect(j('1~@2')).toEqual(['~', 1, ['@', 2]]);
        expect(j('@1~@2')).toEqual(['@', ['~', 1, ['@', 2]]]);
        expect(j('@1~2+3')).toEqual(['+', ['@', ['~', 1, 2]], 3]);
        expect(j('1~@2+3')).toEqual(['+', ['~', 1, ['@', 2]], 3]);
        expect(j('@1~@2+3')).toEqual(['+', ['@', ['~', 1, ['@', 2]]], 3]);
        expect(j('@1~2~3')).toEqual(['@', ['~', ['~', 1, 2], 3]]);
        expect(j('1~@2~3')).toEqual(['~', ['~', 1, ['@', 2]], 3]);
        expect(j('@1~@2~3')).toEqual(['@', ['~', ['~', 1, ['@', 2]], 3]]);
    });
    test('unary-suffix-basic', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
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
        expect(j('1')).toEqual(1);
        expect(j('z')).toEqual('z');
        expect(j('1!')).toMatchObject(['!', 1]);
        expect(j('1 !')).toMatchObject(['!', 1]);
        expect(j('1!!')).toMatchObject(['!', ['!', 1]]);
        expect(j('1!!!')).toMatchObject(['!', ['!', ['!', 1]]]);
        expect(j('z!')).toMatchObject(['!', 'z']);
        expect(j('z !')).toMatchObject(['!', 'z']);
        expect(j('1?')).toMatchObject(['?', 1]);
        expect(j('1 ?')).toMatchObject(['?', 1]);
        expect(j('1??')).toMatchObject(['?', ['?', 1]]);
        expect(j('1???')).toMatchObject(['?', ['?', ['?', 1]]]);
        expect(j('1+2!')).toMatchObject(['+', 1, ['!', 2]]);
        expect(j('1!+2')).toMatchObject(['+', ['!', 1], 2]);
        expect(j('1!+2!')).toMatchObject(['+', ['!', 1], ['!', 2]]);
        expect(j('1+2!!')).toMatchObject(['+', 1, ['!', ['!', 2]]]);
        expect(j('1!!+2')).toMatchObject(['+', ['!', ['!', 1]], 2]);
        expect(j('1!!+2!!')).toMatchObject(['+', ['!', ['!', 1]], ['!', ['!', 2]]]);
        expect(j('1+2?')).toMatchObject(['+', 1, ['?', 2]]);
        expect(j('1?+2')).toMatchObject(['+', ['?', 1], 2]);
        expect(j('1?+2?')).toMatchObject(['+', ['?', 1], ['?', 2]]);
        expect(j('1+2??')).toMatchObject(['+', 1, ['?', ['?', 2]]]);
        expect(j('1??+2')).toMatchObject(['+', ['?', ['?', 1]], 2]);
        expect(j('1??+2??')).toMatchObject(['+', ['?', ['?', 1]], ['?', ['?', 2]]]);
        expect(j('0+1+2!')).toMatchObject(['+', ['+', 0, 1], ['!', 2]]);
        expect(j('0+1!+2')).toMatchObject(['+', ['+', 0, ['!', 1]], 2]);
        expect(j('0+1!+2!')).toMatchObject(['+', ['+', 0, ['!', 1]], ['!', 2]]);
        expect(j('0!+1!+2!')).toMatchObject(['+', ['+', ['!', 0], ['!', 1]], ['!', 2]]);
        expect(j('0!+1!+2')).toMatchObject(['+', ['+', ['!', 0], ['!', 1]], 2]);
        expect(j('0!+1+2!')).toMatchObject(['+', ['+', ['!', 0], 1], ['!', 2]]);
        expect(j('0!+1+2')).toMatchObject(['+', ['+', ['!', 0], 1], 2]);
    });
    test('unary-suffix-edge', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            op: {
                factorial: {
                    suffix: true, left: 15000, src: '!'
                },
                question: {
                    suffix: true, left: 13000, src: '?'
                },
                tight: {
                    infix: true, left: 120000, right: 130000, src: '~'
                },
            }
        });
        const j = mj(je);
        expect(j('1!')).toEqual(['!', 1]);
        expect(j('1!!')).toEqual(['!', ['!', 1]]);
        expect(j('1!!!')).toEqual(['!', ['!', ['!', 1]]]);
        // Precedence does not matter within prefix sequences.
        expect(j('1!?')).toEqual(['?', ['!', 1]]);
        expect(j('1?!')).toEqual(['!', ['?', 1]]);
        expect(j('1!??')).toEqual(['?', ['?', ['!', 1]]]);
        expect(j('1??!')).toEqual(['!', ['?', ['?', 1]]]);
        expect(j('1?!!')).toEqual(['!', ['!', ['?', 1]]]);
        expect(j('1!!?')).toEqual(['?', ['!', ['!', 1]]]);
        expect(j('1?!?')).toEqual(['?', ['!', ['?', 1]]]);
        expect(j('1!?!')).toEqual(['!', ['?', ['!', 1]]]);
        expect(j('1!+2')).toEqual(['+', ['!', 1], 2]);
        expect(j('1+2!')).toEqual(['+', 1, ['!', 2]]);
        expect(j('1!+2!')).toEqual(['+', ['!', 1], ['!', 2]]);
        expect(j('1!+2+3')).toEqual(['+', ['+', ['!', 1], 2], 3]);
        expect(j('1+2!+3')).toEqual(['+', ['+', 1, ['!', 2]], 3]);
        expect(j('1!+2!+3')).toEqual(['+', ['+', ['!', 1], ['!', 2]], 3]);
        expect(j('1!+2+3!')).toEqual(['+', ['+', ['!', 1], 2], ['!', 3]]);
        expect(j('1+2!+3!')).toEqual(['+', ['+', 1, ['!', 2]], ['!', 3]]);
        expect(j('1!+2!+3!')).toEqual(['+', ['+', ['!', 1], ['!', 2]], ['!', 3]]);
        // Tighter!
        expect(j('1!~2')).toEqual(['~', ['!', 1], 2]);
        expect(j('1~2!')).toEqual(['!', ['~', 1, 2]]);
        expect(j('1!~2!')).toEqual(['!', ['~', ['!', 1], 2]]);
        expect(j('1!~2+3')).toEqual(['+', ['~', ['!', 1], 2], 3]);
        expect(j('1~2!+3')).toEqual(['+', ['!', ['~', 1, 2]], 3]);
        expect(j('1!~2!+3')).toEqual(['+', ['!', ['~', ['!', 1], 2]], 3]);
        expect(j('1!~2~3')).toEqual(['~', ['~', ['!', 1], 2], 3]);
        expect(j('1~2!~3')).toEqual(['~', ['!', ['~', 1, 2]], 3]);
        expect(j('1!~2!~3')).toEqual(['~', ['!', ['~', ['!', 1], 2]], 3]);
    });
    test('unary-suffix-structure', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
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
        expect(j('1!,2!')).toMatchObject([['!', 1], ['!', 2]]);
        expect(j('1!,2!,3!')).toMatchObject([['!', 1], ['!', 2], ['!', 3]]);
        expect(j('1!,2!,3!,4!')).toMatchObject([['!', 1], ['!', 2], ['!', 3], ['!', 4]]);
        expect(j('1! 2!')).toMatchObject([['!', 1], ['!', 2]]);
        expect(j('1! 2! 3!')).toMatchObject([['!', 1], ['!', 2], ['!', 3]]);
        expect(j('1! 2! 3! 4!')).toMatchObject([['!', 1], ['!', 2], ['!', 3], ['!', 4]]);
        expect(j('[1!,2!]')).toMatchObject([['!', 1], ['!', 2]]);
        expect(j('[1!,2!,3!]')).toMatchObject([['!', 1], ['!', 2], ['!', 3]]);
        expect(j('[1!,2!,3!,4!]')).toMatchObject([['!', 1], ['!', 2], ['!', 3], ['!', 4]]);
        expect(j('[1! 2!]')).toMatchObject([['!', 1], ['!', 2]]);
        expect(j('[1! 2! 3!]')).toMatchObject([['!', 1], ['!', 2], ['!', 3]]);
        expect(j('[1! 2! 3! 4!]')).toMatchObject([['!', 1], ['!', 2], ['!', 3], ['!', 4]]);
        expect(j('a:1!')).toMatchObject({ a: ['!', 1] });
        expect(j('a:1!,b:2!')).toMatchObject({ a: ['!', 1], b: ['!', 2] });
        expect(j('a:1!,b:2!,c:3!')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3] });
        expect(j('a:1!,b:2!,c:3!,d:4!')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] });
        expect(j('a:1! b:2!')).toMatchObject({ a: ['!', 1], b: ['!', 2] });
        expect(j('a:1! b:2! c:3!')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3] });
        expect(j('a:1! b:2! c:3!,d:4!')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] });
        expect(j('{a:1!}')).toMatchObject({ a: ['!', 1] });
        expect(j('{a:1!,b:2!}')).toMatchObject({ a: ['!', 1], b: ['!', 2] });
        expect(j('{a:1!,b:2!,c:3!}')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3] });
        expect(j('{a:1!,b:2!,c:3!,d:4!}')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] });
        expect(j('{a:1! b:2!}')).toMatchObject({ a: ['!', 1], b: ['!', 2] });
        expect(j('{a:1! b:2! c:3!}')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3] });
        expect(j('{a:1! b:2! c:3! d:4!}')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] });
    });
    test('unary-suffix-prefix', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
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
        expect(j('-1!')).toEqual(['-', ['!', 1]]);
        expect(j('--1!')).toEqual(['-', ['-', ['!', 1]]]);
        expect(j('-1!!')).toEqual(['-', ['!', ['!', 1]]]);
        expect(j('--1!!')).toEqual(['-', ['-', ['!', ['!', 1]]]]);
        expect(j('-1!+2')).toEqual(['+', ['-', ['!', 1]], 2]);
        expect(j('--1!+2')).toEqual(['+', ['-', ['-', ['!', 1]]], 2]);
        expect(j('---1!+2')).toEqual(['+', ['-', ['-', ['-', ['!', 1]]]], 2]);
        expect(j('-1?')).toEqual(['?', ['-', 1]]);
        expect(j('--1?')).toEqual(['?', ['-', ['-', 1]]]);
        expect(j('-1??')).toEqual(['?', ['?', ['-', 1]]]);
        expect(j('--1??')).toEqual(['?', ['?', ['-', ['-', 1]]]]);
        expect(j('-1!?')).toEqual(['?', ['-', ['!', 1]]]);
        expect(j('-1!?!')).toEqual(['!', ['?', ['-', ['!', 1]]]]);
        expect(j('-1?+2')).toEqual(['+', ['?', ['-', 1]], 2]);
        expect(j('--1?+2')).toEqual(['+', ['?', ['-', ['-', 1]]], 2]);
        expect(j('-1??+2')).toEqual(['+', ['?', ['?', ['-', 1]]], 2]);
        expect(j('--1??+2')).toEqual(['+', ['?', ['?', ['-', ['-', 1]]]], 2]);
    });
    test('unary-suffix-paren', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
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
        expect(j('(1)')).toEqual(['(', 1]);
        expect(j('(z)')).toEqual(['(', 'z']);
        expect(j('(1!)')).toMatchObject(['(', ['!', 1]]);
        expect(j('(1 !)')).toMatchObject(['(', ['!', 1]]);
        expect(j('(z!)')).toMatchObject(['(', ['!', 'z']]);
        expect(j('(z !)')).toMatchObject(['(', ['!', 'z']]);
        expect(j('(1+2!)')).toMatchObject(['(', ['+', 1, ['!', 2]]]);
        expect(j('(1!+2)')).toMatchObject(['(', ['+', ['!', 1], 2]]);
        expect(j('(1!+2!)')).toMatchObject(['(', ['+', ['!', 1], ['!', 2]]]);
        expect(j('(0+1+2!)')).toMatchObject(['(', ['+', ['+', 0, 1], ['!', 2]]]);
        expect(j('(0+1!+2)')).toMatchObject(['(', ['+', ['+', 0, ['!', 1]], 2]]);
        expect(j('(0+1!+2!)')).toMatchObject(['(', ['+', ['+', 0, ['!', 1]], ['!', 2]]]);
        expect(j('(0!+1!+2!)')).toMatchObject(['(', ['+', ['+', ['!', 0], ['!', 1]], ['!', 2]]]);
        expect(j('(0!+1!+2)')).toMatchObject(['(', ['+', ['+', ['!', 0], ['!', 1]], 2]]);
        expect(j('(0!+1+2!)')).toMatchObject(['(', ['+', ['+', ['!', 0], 1], ['!', 2]]]);
        expect(j('(0!+1+2)')).toMatchObject(['(', ['+', ['+', ['!', 0], 1], 2]]);
    });
    test('paren-basic', () => {
        const j = mj(jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(expr_1.Expr));
        expect(j('100+200')).toMatchObject(['+', 100, 200]);
        expect(j('(100)')).toMatchObject(['(', 100]);
        expect(j('(100)+200')).toMatchObject(['+', ['(', 100], 200]);
        expect(j('100+(200)')).toMatchObject(['+', 100, ['(', 200]]);
        expect(j('(1+2)')).toMatchObject(['(', ['+', 1, 2]]);
        expect(j('(1+2+3)')).toMatchObject(['(', ['+', ['+', 1, 2], 3]]);
        expect(j('(1+2+3+4)')).toMatchObject(['(', ['+', ['+', ['+', 1, 2], 3], 4]]);
        expect(j('((1))')).toMatchObject(['(', ['(', 1]]);
        expect(j('(((1)))')).toMatchObject(['(', ['(', ['(', 1]]]);
        expect(j('((((1))))')).toMatchObject(['(', ['(', ['(', ['(', 1]]]]);
        expect(j('(1+2)+3')).toMatchObject(['+', ['(', ['+', 1, 2]], 3]);
        expect(j('1+(2+3)')).toMatchObject(['+', 1, ['(', ['+', 2, 3]]]);
        expect(j('((1+2))+3')).toMatchObject(['+', ['(', ['(', ['+', 1, 2]]], 3]);
        expect(j('1+((2+3))')).toMatchObject(['+', 1, ['(', ['(', ['+', 2, 3]]]]);
        expect(j('(1)+2+3')).toMatchObject(['+', ['+', ['(', 1], 2], 3]);
        expect(j('100+200+300')).toMatchObject(['+', ['+', 100, 200], 300]);
        expect(j('100+(200)+300')).toMatchObject(['+', ['+', 100, ['(', 200]], 300]);
        expect(j('1+2+(3)')).toMatchObject(['+', ['+', 1, 2], ['(', 3]]);
        expect(j('1+(2)+(3)')).toMatchObject(['+', ['+', 1, ['(', 2]], ['(', 3]]);
        expect(j('(1)+2+(3)')).toMatchObject(['+', ['+', ['(', 1], 2], ['(', 3]]);
        expect(j('(1)+(2)+3')).toMatchObject(['+', ['+', ['(', 1], ['(', 2]], 3]);
        expect(j('(1)+(2)+(3)')).toMatchObject(['+', ['+', ['(', 1], ['(', 2]], ['(', 3]]);
        expect(j('(1+2)*3')).toMatchObject(['*', ['(', ['+', 1, 2]], 3]);
        expect(j('1*(2+3)')).toMatchObject(['*', 1, ['(', ['+', 2, 3]]]);
        expect(j('(a)')).toMatchObject(['(', 'a']);
        expect(j('("a")')).toMatchObject(['(', 'a']);
        expect(j('([])')).toMatchObject(['(', []]);
        expect(j('([a])')).toMatchObject(['(', ['a']]);
        expect(j('([a,b])')).toMatchObject(['(', ['a', 'b']]);
        expect(j('([a b])')).toMatchObject(['(', ['a', 'b']]);
        expect(j('([a,b,c])')).toMatchObject(['(', ['a', 'b', 'c']]);
        expect(j('([a b c])')).toMatchObject(['(', ['a', 'b', 'c']]);
        expect(j('({})')).toMatchObject(['(', {}]);
        expect(j('({a:1})')).toMatchObject(['(', { a: 1 }]);
        expect(j('({a:1,b:2})')).toMatchObject(['(', { a: 1, b: 2 }]);
        expect(j('({a:1 b:2})')).toMatchObject(['(', { a: 1, b: 2 }]);
        expect(j('({a:1,b:2,c:3})')).toMatchObject(['(', { a: 1, b: 2, c: 3 }]);
        expect(j('({a:1 b:2 c:3})')).toMatchObject(['(', { a: 1, b: 2, c: 3 }]);
        expect(j('(a:1)')).toMatchObject(['(', { a: 1 }]);
        expect(j('()')).toMatchObject(['(']);
        expect(j('(),()')).toMatchObject([['('], ['(']]);
        expect(j('(),(),()')).toMatchObject([['('], ['('], ['(']]);
        expect(j('() ()')).toMatchObject([['('], ['(']]);
        expect(j('() () ()')).toMatchObject([['('], ['('], ['(']]);
        expect(j('[()]')).toMatchObject([['(']]);
        expect(j('[(),()]')).toMatchObject([['('], ['(']]);
        expect(j('[(),(),()]')).toMatchObject([['('], ['('], ['(']]);
        expect(j('[() ()]')).toMatchObject([['('], ['(']]);
        expect(j('[() () ()]')).toMatchObject([['('], ['('], ['(']]);
        expect(j('{a:()}')).toMatchObject({ a: ['('] });
        expect(j('{a:(),b:()}')).toMatchObject({ a: ['('], b: ['('] });
        expect(j('{a:(),b:(),c:()}')).toMatchObject({ a: ['('], b: ['('], c: ['('] });
        expect(j('{a:() b:()}')).toMatchObject({ a: ['('], b: ['('] });
        expect(j('{a:() b:() c:()}')).toMatchObject({ a: ['('], b: ['('], c: ['('] });
    });
    test('paren-map-implicit-structure-comma', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('{a:(1)}'))[_mo_]({ a: ['(', 1] });
        expect(j('{a:(1,2)}'))[_mo_]({ a: ['(', [1, 2]] });
        expect(j('{a:(1,2,3)}'))[_mo_]({ a: ['(', [1, 2, 3]] });
        expect(j('{a:(1),b:9}'))[_mo_]({ a: ['(', 1], b: 9 });
        expect(j('{a:(1,2),b:9}'))[_mo_]({ a: ['(', [1, 2]], b: 9 });
        expect(j('{a:(1,2,3),b:9}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 });
        expect(j('{a:(1),b:9,c:8}'))[_mo_]({ a: ['(', 1], b: 9, c: 8 });
        expect(j('{a:(1,2),b:9,c:8}'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('{a:(1,2,3),b:9,c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('{a:(1),b:(9)}'))[_mo_]({ a: ['(', 1], b: ['(', 9] });
        expect(j('{a:(1,2),b:(9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('{a:(1,2,3),b:(9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('{a:(1),b:(9),c:8}'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('{a:(1,2),b:(9),c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('{a:(1,2,3),b:(9),c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('{a:(1),b:(8,9)}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('{a:(1,2),b:(8,9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('{a:(1,2,3),b:(8,9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('{a:(1),b:(8,9),c:8}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('{a:(1,2),b:(8,9),c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('{a:(1,2,3),b:(8,9),c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1)}'))[_mo_]({ d: 0, a: ['(', 1] });
        expect(j('{d:0,a:(1,2)}'))[_mo_]({ d: 0, a: ['(', [1, 2]] });
        expect(j('{d:0,a:(1,2,3)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] });
        expect(j('{d:0,a:(1),b:9}'))[_mo_]({ d: 0, a: ['(', 1], b: 9 });
        expect(j('{d:0,a:(1,2),b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 });
        expect(j('{d:0,a:(1,2,3),b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        expect(j('{d:0,a:(1),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 });
        expect(j('{d:0,a:(1,2),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('{d:0,a:(1,2,3),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('{d:0,a:(1),b:(9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] });
        expect(j('{d:0,a:(1,2),b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('{d:0,a:(1,2,3),b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('{d:0,a:(1),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1,2),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1,2,3),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1,2),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1,2,3),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1,2),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1,2,3),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1)'))[_mo_]({ a: ['(', 1] });
        expect(j('a:(1,2)'))[_mo_]({ a: ['(', [1, 2]] });
        expect(j('a:(1,2,3)'))[_mo_]({ a: ['(', [1, 2, 3]] });
        expect(j('a:(1),b:9'))[_mo_]({ a: ['(', 1], b: 9 });
        expect(j('a:(1,2),b:9'))[_mo_]({ a: ['(', [1, 2]], b: 9 });
        expect(j('a:(1,2,3),b:9'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 });
        expect(j('a:(1),b:9,c:8'))[_mo_]({ a: ['(', 1], b: 9, c: 8 });
        expect(j('a:(1,2),b:9,c:8'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('a:(1,2,3),b:9,c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('a:(1),b:(9)'))[_mo_]({ a: ['(', 1], b: ['(', 9] });
        expect(j('a:(1,2),b:(9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('a:(1,2,3),b:(9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('a:(1),b:(9),c:8'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('a:(1,2),b:(9),c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('a:(1,2,3),b:(9),c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('a:(1),b:(8,9)'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('a:(1,2),b:(8,9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('a:(1,2,3),b:(8,9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('a:(1),b:(8,9),c:8'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1,2),b:(8,9),c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1,2,3),b:(8,9),c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1)'))[_mo_]({ d: 0, a: ['(', 1] });
        expect(j('d:0,a:(1,2)'))[_mo_]({ d: 0, a: ['(', [1, 2]] });
        expect(j('d:0,a:(1,2,3)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] });
        expect(j('d:0,a:(1),b:9'))[_mo_]({ d: 0, a: ['(', 1], b: 9 });
        expect(j('d:0,a:(1,2),b:9'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 });
        expect(j('d:0,a:(1,2,3),b:9'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        expect(j('d:0,a:(1),b:9,c:8'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 });
        expect(j('d:0,a:(1,2),b:9,c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('d:0,a:(1,2,3),b:9,c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('d:0,a:(1),b:(9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] });
        expect(j('d:0,a:(1,2),b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('d:0,a:(1,2,3),b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('d:0,a:(1),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1,2),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1,2,3),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1),b:(8,9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1,2),b:(8,9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1,2,3),b:(8,9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1,2),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1,2,3),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
    });
    test('paren-map-implicit-structure-space', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('{a:(1)}'))[_mo_]({ a: ['(', 1] });
        expect(j('{a:(1 2)}'))[_mo_]({ a: ['(', [1, 2]] });
        expect(j('{a:(1 2 3)}'))[_mo_]({ a: ['(', [1, 2, 3]] });
        expect(j('{a:(1) b:9}'))[_mo_]({ a: ['(', 1], b: 9 });
        expect(j('{a:(1 2) b:9}'))[_mo_]({ a: ['(', [1, 2]], b: 9 });
        expect(j('{a:(1 2 3) b:9}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 });
        expect(j('{a:(1) b:9 c:8}'))[_mo_]({ a: ['(', 1], b: 9, c: 8 });
        expect(j('{a:(1 2) b:9 c:8}'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('{a:(1 2 3) b:9 c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('{a:(1) b:(9)}'))[_mo_]({ a: ['(', 1], b: ['(', 9] });
        expect(j('{a:(1 2) b:(9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('{a:(1 2 3) b:(9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('{a:(1) b:(9) c:8}'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('{a:(1 2) b:(9) c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('{a:(1 2 3) b:(9) c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('{a:(1) b:(8 9)}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('{a:(1 2) b:(8 9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('{a:(1 2 3) b:(8 9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('{a:(1) b:(8 9) c:8}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('{a:(1 2) b:(8 9) c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('{a:(1 2 3) b:(8 9) c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1)}'))[_mo_]({ d: 0, a: ['(', 1] });
        expect(j('{d:0,a:(1 2)}'))[_mo_]({ d: 0, a: ['(', [1, 2]] });
        expect(j('{d:0,a:(1 2 3)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] });
        expect(j('{d:0,a:(1) b:9}'))[_mo_]({ d: 0, a: ['(', 1], b: 9 });
        expect(j('{d:0,a:(1 2) b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 });
        expect(j('{d:0,a:(1 2 3) b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        expect(j('{d:0,a:(1) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 });
        expect(j('{d:0,a:(1 2) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('{d:0,a:(1 2 3) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('{d:0,a:(1) b:(9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] });
        expect(j('{d:0,a:(1 2) b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('{d:0,a:(1 2 3) b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('{d:0,a:(1) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1 2) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1 2 3) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1 2) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1 2 3) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1 2) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1 2 3) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1)'))[_mo_]({ a: ['(', 1] });
        expect(j('a:(1 2)'))[_mo_]({ a: ['(', [1, 2]] });
        expect(j('a:(1 2 3)'))[_mo_]({ a: ['(', [1, 2, 3]] });
        expect(j('a:(1) b:9'))[_mo_]({ a: ['(', 1], b: 9 });
        expect(j('a:(1 2) b:9'))[_mo_]({ a: ['(', [1, 2]], b: 9 });
        expect(j('a:(1 2 3) b:9'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 });
        expect(j('a:(1) b:9 c:8'))[_mo_]({ a: ['(', 1], b: 9, c: 8 });
        expect(j('a:(1 2) b:9 c:8'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('a:(1 2 3) b:9 c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('a:(1) b:(9)'))[_mo_]({ a: ['(', 1], b: ['(', 9] });
        expect(j('a:(1 2) b:(9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('a:(1 2 3) b:(9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('a:(1) b:(9) c:8'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('a:(1 2) b:(9) c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('a:(1 2 3) b:(9) c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('a:(1) b:(8 9)'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('a:(1 2) b:(8 9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('a:(1 2 3) b:(8 9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('a:(1) b:(8 9) c:8'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1 2) b:(8 9) c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1 2 3) b:(8 9) c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1)'))[_mo_]({ d: 0, a: ['(', 1] });
        expect(j('d:0,a:(1 2)'))[_mo_]({ d: 0, a: ['(', [1, 2]] });
        expect(j('d:0,a:(1 2 3)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] });
        expect(j('d:0,a:(1) b:9'))[_mo_]({ d: 0, a: ['(', 1], b: 9 });
        expect(j('d:0,a:(1 2) b:9'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 });
        expect(j('d:0,a:(1 2 3) b:9'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        expect(j('d:0,a:(1) b:9 c:8'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 });
        expect(j('d:0,a:(1 2) b:9 c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('d:0,a:(1 2 3) b:9 c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('d:0,a:(1) b:(9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] });
        expect(j('d:0,a:(1 2) b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('d:0,a:(1 2 3) b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('d:0,a:(1) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1 2) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1 2 3) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1) b:(8 9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1 2) b:(8 9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1 2 3) b:(8 9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1 2) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1 2 3) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
    });
    test('paren-list-implicit-structure-comma', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('[(1)]'))[_mo_]([['(', 1]]);
        expect(j('[(1,2)]'))[_mo_]([['(', [1, 2]]]);
        expect(j('[(1,2,3)]'))[_mo_]([['(', [1, 2, 3]]]);
        expect(j('[(1),9]'))[_mo_]([['(', 1], 9]);
        expect(j('[(1,2),9]'))[_mo_]([['(', [1, 2]], 9]);
        expect(j('[(1,2,3),9]'))[_mo_]([['(', [1, 2, 3]], 9]);
        expect(j('[(1),9,8]'))[_mo_]([['(', 1], 9, 8]);
        expect(j('[(1,2),9,8]'))[_mo_]([['(', [1, 2]], 9, 8]);
        expect(j('[(1,2,3),9,8]'))[_mo_]([['(', [1, 2, 3]], 9, 8]);
        expect(j('[(1),(9)]'))[_mo_]([['(', 1], ['(', 9]]);
        expect(j('[(1,2),(9)]'))[_mo_]([['(', [1, 2]], ['(', 9]]);
        expect(j('[(1,2,3),(9)]'))[_mo_]([['(', [1, 2, 3]], ['(', 9]]);
        expect(j('[(1),(9),8]'))[_mo_]([['(', 1], ['(', 9], 8]);
        expect(j('[(1,2),(9),8]'))[_mo_]([['(', [1, 2]], ['(', 9], 8]);
        expect(j('[(1,2,3),(9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('[(1),(9),(8)]'))[_mo_]([['(', 1], ['(', 9], ['(', 8]]);
        expect(j('[(1),(8,9)]'))[_mo_]([['(', 1], ['(', [8, 9]]]);
        expect(j('[(1,2),(8,9)]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('[(1,2,3),(8,9)]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('[(1),(8,9),8]'))[_mo_]([['(', 1], ['(', [8, 9]], 8]);
        expect(j('[(1,2),(8,9),8]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('[(1,2,3),(8,9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('[0,(1)]'))[_mo_]([0, ['(', 1]]);
        expect(j('[0,(1,2)]'))[_mo_]([0, ['(', [1, 2]]]);
        expect(j('[0,(1,2,3)]'))[_mo_]([0, ['(', [1, 2, 3]]]);
        expect(j('[0,(1),9]'))[_mo_]([0, ['(', 1], 9]);
        expect(j('[0,(1,2),9]'))[_mo_]([0, ['(', [1, 2]], 9]);
        expect(j('[0,(1,2,3),9]'))[_mo_]([0, ['(', [1, 2, 3]], 9]);
        expect(j('[0,(1),9,8]'))[_mo_]([0, ['(', 1], 9, 8]);
        expect(j('[0,(1,2),9,8]'))[_mo_]([0, ['(', [1, 2]], 9, 8]);
        expect(j('[0,(1,2,3),9,8]'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8]);
        expect(j('[0,(1),(9)]'))[_mo_]([0, ['(', 1], ['(', 9]]);
        expect(j('[0,(1,2),(9)]'))[_mo_]([0, ['(', [1, 2]], ['(', 9]]);
        expect(j('[0,(1,2,3),(9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]]);
        expect(j('[0,(1),(9),8]'))[_mo_]([0, ['(', 1], ['(', 9], 8]);
        expect(j('[0,(1,2),(9),8]'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8]);
        expect(j('[0,(1,2,3),(9),8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('[0,(1),(8,9)]'))[_mo_]([0, ['(', 1], ['(', [8, 9]]]);
        expect(j('[0,(1,2),(8,9)]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('[0,(1,2,3),(8,9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('[0,(1),(8,9),8]'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8]);
        expect(j('[0,(1,2),(8,9),8]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('[0,(1,2,3),(8,9),8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('(1)'))[_mo_](['(', 1]);
        expect(j('(1,2)'))[_mo_](['(', [1, 2]]);
        expect(j('(1,2,3)'))[_mo_](['(', [1, 2, 3]]);
        expect(j('(1),9'))[_mo_]([['(', 1], 9]);
        expect(j('(1,2),9'))[_mo_]([['(', [1, 2]], 9]);
        expect(j('(1,2,3),9'))[_mo_]([['(', [1, 2, 3]], 9]);
        expect(j('(1),9,8'))[_mo_]([['(', 1], 9, 8]);
        expect(j('(1,2),9,8'))[_mo_]([['(', [1, 2]], 9, 8]);
        expect(j('(1,2,3),9,8'))[_mo_]([['(', [1, 2, 3]], 9, 8]);
        expect(j('(1),(9)'))[_mo_]([['(', 1], ['(', 9]]);
        expect(j('(1,2),(9)'))[_mo_]([['(', [1, 2]], ['(', 9]]);
        expect(j('(1,2,3),(9)'))[_mo_]([['(', [1, 2, 3]], ['(', 9]]);
        expect(j('(1),(9),(8)'))[_mo_]([['(', 1], ['(', 9], ['(', 8]]);
        expect(j('(1),(9),8'))[_mo_]([['(', 1], ['(', 9], 8]);
        expect(j('(1,2),(9),8'))[_mo_]([['(', [1, 2]], ['(', 9], 8]);
        expect(j('(1,2,3),(9),8'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('(1),(8,9)'))[_mo_]([['(', 1], ['(', [8, 9]]]);
        expect(j('(1,2),(8,9)'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('(1,2,3),(8,9)'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('(1),(8,9),8'))[_mo_]([['(', 1], ['(', [8, 9]], 8]);
        expect(j('(1,2),(8,9),8'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('(1,2,3),(8,9),8'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('0,(1)'))[_mo_]([0, ['(', 1]]);
        expect(j('0,(1,2)'))[_mo_]([0, ['(', [1, 2]]]);
        expect(j('0,(1,2,3)'))[_mo_]([0, ['(', [1, 2, 3]]]);
        expect(j('0,(1),9'))[_mo_]([0, ['(', 1], 9]);
        expect(j('0,(1,2),9'))[_mo_]([0, ['(', [1, 2]], 9]);
        expect(j('0,(1,2,3),9'))[_mo_]([0, ['(', [1, 2, 3]], 9]);
        expect(j('0,(1),9,8'))[_mo_]([0, ['(', 1], 9, 8]);
        expect(j('0,(1,2),9,8'))[_mo_]([0, ['(', [1, 2]], 9, 8]);
        expect(j('0,(1,2,3),9,8'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8]);
        expect(j('0,(1),(9)'))[_mo_]([0, ['(', 1], ['(', 9]]);
        expect(j('0,(1,2),(9)'))[_mo_]([0, ['(', [1, 2]], ['(', 9]]);
        expect(j('0,(1,2,3),(9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]]);
        expect(j('0,(1),(9),8'))[_mo_]([0, ['(', 1], ['(', 9], 8]);
        expect(j('0,(1,2),(9),8'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8]);
        expect(j('0,(1,2,3),(9),8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('0,(1),(8,9)'))[_mo_]([0, ['(', 1], ['(', [8, 9]]]);
        expect(j('0,(1,2),(8,9)'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('0,(1,2,3),(8,9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('0,(1),(8,9),8'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8]);
        expect(j('0,(1,2),(8,9),8'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('0,(1,2,3),(8,9),8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
    });
    test('paren-list-implicit-structure-space', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('[(1)]'))[_mo_]([['(', 1]]);
        expect(j('[(1 2)]'))[_mo_]([['(', [1, 2]]]);
        expect(j('[(1 2 3)]'))[_mo_]([['(', [1, 2, 3]]]);
        expect(j('[(1) 9]'))[_mo_]([['(', 1], 9]);
        expect(j('[(1 2) 9]'))[_mo_]([['(', [1, 2]], 9]);
        expect(j('[(1 2 3) 9]'))[_mo_]([['(', [1, 2, 3]], 9]);
        expect(j('[(1) 9 8]'))[_mo_]([['(', 1], 9, 8]);
        expect(j('[(1 2) 9 8]'))[_mo_]([['(', [1, 2]], 9, 8]);
        expect(j('[(1 2 3) 9 8]'))[_mo_]([['(', [1, 2, 3]], 9, 8]);
        expect(j('[(1) (9)]'))[_mo_]([['(', 1], ['(', 9]]);
        expect(j('[(1 2) (9)]'))[_mo_]([['(', [1, 2]], ['(', 9]]);
        expect(j('[(1 2 3) (9)]'))[_mo_]([['(', [1, 2, 3]], ['(', 9]]);
        expect(j('[(1) (9) (8)]'))[_mo_]([['(', 1], ['(', 9], ['(', 8]]);
        expect(j('[(1) (9) 8]'))[_mo_]([['(', 1], ['(', 9], 8]);
        expect(j('[(1 2) (9) 8]'))[_mo_]([['(', [1, 2]], ['(', 9], 8]);
        expect(j('[(1 2 3) (9) 8]'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('[(1) (8,9)]'))[_mo_]([['(', 1], ['(', [8, 9]]]);
        expect(j('[(1 2) (8,9)]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('[(1 2 3) (8,9)]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('[(1) (8,9),8]'))[_mo_]([['(', 1], ['(', [8, 9]], 8]);
        expect(j('[(1 2) (8,9),8]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('[(1 2 3) (8,9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('[0 (1)]'))[_mo_]([0, ['(', 1]]);
        expect(j('[0 (1 2)]'))[_mo_]([0, ['(', [1, 2]]]);
        expect(j('[0 (1 2 3)]'))[_mo_]([0, ['(', [1, 2, 3]]]);
        expect(j('[0 (1) 9]'))[_mo_]([0, ['(', 1], 9]);
        expect(j('[0 (1 2) 9]'))[_mo_]([0, ['(', [1, 2]], 9]);
        expect(j('[0 (1 2 3) 9]'))[_mo_]([0, ['(', [1, 2, 3]], 9]);
        expect(j('[0 (1) 9 8]'))[_mo_]([0, ['(', 1], 9, 8]);
        expect(j('[0 (1 2) 9 8]'))[_mo_]([0, ['(', [1, 2]], 9, 8]);
        expect(j('[0 (1 2 3) 9 8]'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8]);
        expect(j('[0 (1) (9)]'))[_mo_]([0, ['(', 1], ['(', 9]]);
        expect(j('[0 (1 2) (9)]'))[_mo_]([0, ['(', [1, 2]], ['(', 9]]);
        expect(j('[0 (1 2 3) (9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]]);
        expect(j('[0 (1) (9) 8]'))[_mo_]([0, ['(', 1], ['(', 9], 8]);
        expect(j('[0 (1 2) (9) 8]'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8]);
        expect(j('[0 (1 2 3) (9) 8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('[0 (1) (8 9)]'))[_mo_]([0, ['(', 1], ['(', [8, 9]]]);
        expect(j('[0 (1 2) (8 9)]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('[0 (1 2 3) (8 9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('[0 (1) (8 9) 8]'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8]);
        expect(j('[0 (1 2) (8 9) 8]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('[0 (1 2 3) (8 9) 8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('(1)'))[_mo_](['(', 1]);
        expect(j('(1 2)'))[_mo_](['(', [1, 2]]);
        expect(j('(1 2 3)'))[_mo_](['(', [1, 2, 3]]);
        expect(j('(1) 9'))[_mo_]([['(', 1], 9]);
        expect(j('(1 2) 9'))[_mo_]([['(', [1, 2]], 9]);
        expect(j('(1 2 3) 9'))[_mo_]([['(', [1, 2, 3]], 9]);
        expect(j('(1) 9 8'))[_mo_]([['(', 1], 9, 8]);
        expect(j('(1 2) 9 8'))[_mo_]([['(', [1, 2]], 9, 8]);
        expect(j('(1 2 3) 9 8'))[_mo_]([['(', [1, 2, 3]], 9, 8]);
        expect(j('(1) (9)'))[_mo_]([['(', 1], ['(', 9]]);
        expect(j('(1 2) (9)'))[_mo_]([['(', [1, 2]], ['(', 9]]);
        expect(j('(1 2 3) (9)'))[_mo_]([['(', [1, 2, 3]], ['(', 9]]);
        expect(j('(1) (9) 8'))[_mo_]([['(', 1], ['(', 9], 8]);
        expect(j('(1 2) (9) 8'))[_mo_]([['(', [1, 2]], ['(', 9], 8]);
        expect(j('(1 2 3) (9) 8'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('(1) (9) (8)'))[_mo_]([['(', 1], ['(', 9], ['(', 8]]);
        expect(j('(1) (8 9)'))[_mo_]([['(', 1], ['(', [8, 9]]]);
        expect(j('(1 2) (8 9)'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('(1 2 3) (8 9)'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('(1) (8 9) 8'))[_mo_]([['(', 1], ['(', [8, 9]], 8]);
        expect(j('(1 2) (8 9) 8'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('(1 2 3) (8 9) 8'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('0 (1)'))[_mo_]([0, ['(', 1]]);
        expect(j('0 (1 2)'))[_mo_]([0, ['(', [1, 2]]]);
        expect(j('0 (1 2 3)'))[_mo_]([0, ['(', [1, 2, 3]]]);
        expect(j('0 (1) 9'))[_mo_]([0, ['(', 1], 9]);
        expect(j('0 (1 2) 9'))[_mo_]([0, ['(', [1, 2]], 9]);
        expect(j('0 (1 2 3) 9'))[_mo_]([0, ['(', [1, 2, 3]], 9]);
        expect(j('0 (1) 9 8'))[_mo_]([0, ['(', 1], 9, 8]);
        expect(j('0 (1 2) 9 8'))[_mo_]([0, ['(', [1, 2]], 9, 8]);
        expect(j('0 (1 2 3) 9 8'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8]);
        expect(j('0 (1) (9)'))[_mo_]([0, ['(', 1], ['(', 9]]);
        expect(j('0 (1 2) (9)'))[_mo_]([0, ['(', [1, 2]], ['(', 9]]);
        expect(j('0 (1 2 3) (9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]]);
        expect(j('0 (1) (9) 8'))[_mo_]([0, ['(', 1], ['(', 9], 8]);
        expect(j('0 (1 2) (9) 8'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8]);
        expect(j('0 (1 2 3) (9) 8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('0 (1) (8 9)'))[_mo_]([0, ['(', 1], ['(', [8, 9]]]);
        expect(j('0 (1 2) (8 9)'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('0 (1 2 3) (8 9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('0 (1) (8 9) 8'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8]);
        expect(j('0 (1 2) (8 9) 8'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('0 (1 2 3) (8 9) 8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
    });
    test('paren-implicit-list', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('(a)'))[_mo_](['(', 'a']);
        expect(j('(a,b)'))[_mo_](['(', ['a', 'b']]);
        expect(j('(a,b,c)'))[_mo_](['(', ['a', 'b', 'c']]);
        expect(j('(a,b,c,d)'))[_mo_](['(', ['a', 'b', 'c', 'd']]);
        expect(j('(1,2)'))[_mo_](['(', [1, 2]]);
        expect(j('(1+2,3)'))[_mo_](['(', [['+', 1, 2], 3]]);
        expect(j('(1+2+3,4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]]);
        expect(j('(1+2+3+4,5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]]);
        expect(j('(1+2,3,4)'))[_mo_](['(', [['+', 1, 2], 3, 4]]);
        expect(j('(1+2,3+4,5)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], 5]]);
        expect(j('(1+2,3+4,5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        expect(j('(a b)'))[_mo_](['(', ['a', 'b']]);
        expect(j('(a b c)'))[_mo_](['(', ['a', 'b', 'c']]);
        expect(j('(1+2 3)'))[_mo_](['(', [['+', 1, 2], 3]]);
        expect(j('(1+2 3 4)'))[_mo_](['(', [['+', 1, 2], 3, 4]]);
        expect(j('(1+2 3+4 5)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], 5]]);
        expect(j('(1+2 3+4 5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        // Default plain paren does not have a prefix, so this is an implicit list.
        expect(j('foo(1,a)'))[_mo_](['foo', ['(', [1, 'a']]]);
        expect(j('foo,(1,a)'))[_mo_](['foo', ['(', [1, 'a']]]);
        expect(j('foo (1,a)'))[_mo_](['foo', ['(', [1, 'a']]]);
    });
    test('paren-implicit-map', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('(a:1,b:2)'))[_mo_](['(', { a: 1, b: 2 }]);
        expect(j('(a:1 b:2)'))[_mo_](['(', { a: 1, b: 2 }]);
        expect(j('(a:1,b:2,c:3)'))[_mo_](['(', { a: 1, b: 2, c: 3 }]);
        expect(j('(a:1 b:2 c:3)'))[_mo_](['(', { a: 1, b: 2, c: 3 }]);
        expect(j('(a:1+2,b:3)'))[_mo_](['(', { a: ['+', 1, 2], b: 3 }]);
        expect(j('(a:1+2,b:3,c:4)'))[_mo_](['(', { a: ['+', 1, 2], b: 3, c: 4 }]);
        expect(j('(a:1+2,b:3+4,c:5)'))[_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }]);
        expect(j('(a:1+2,b:3+4,c:5+6)'))[_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }]);
        expect(j('(a:1+2 b:3)'))[_mo_](['(', { a: ['+', 1, 2], b: 3 }]);
        expect(j('(a:1+2 b:3 c:4)'))[_mo_](['(', { a: ['+', 1, 2], b: 3, c: 4 }]);
        expect(j('(a:1+2 b:3+4 c:5)'))[_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }]);
        expect(j('(a:1+2 b:3+4 c:5+6)'))[_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }]);
    });
    test('add-paren', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            op: {
                angle: {
                    paren: true, osrc: '<', csrc: '>'
                }
            }
        });
        const j = mj(je);
        expect(j('<1>'))[_mo_](['<', 1]);
        expect(j('<<1>>'))[_mo_](['<', ['<', 1]]);
        expect(j('(<1>)'))[_mo_](['(', ['<', 1]]);
        expect(j('<(1)>'))[_mo_](['<', ['(', 1]]);
        expect(() => j('<1)')).toThrow('unexpected');
        expect(j('1*(2+3)'))[_mo_](['*', 1, ['(', ['+', 2, 3]]]);
        expect(j('1*<2+3>'))[_mo_](['*', 1, ['<', ['+', 2, 3]]]);
    });
    test('paren-preval-basic', () => {
        const je = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(expr_1.Expr, {
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
        expect(j('B<C>'))[_mo_](['<', 'B', 'C']);
        expect(j('a:b<c>'))[_mo_]({ a: ['<', 'b', 'c'] });
        expect(j('a:b<c,d>'))[_mo_]({ a: ['<', 'b', ['c', 'd']] });
        expect(j('a:b<1+2,3+4>'))[_mo_]({ a: ['<', 'b', [['+', 1, 2], ['+', 3, 4]]] });
        expect(j('<1>'))[_mo_](['<', 1]);
        expect(j('1<2>'))[_mo_](['<', 1, 2]);
        // TODO: more general: preexpr not just preval!
        // expect(j('<1><2>'))[_mo_](['<', ['<', 1], 2])
        // expect(j('1<2><3>'))[_mo_](['<', ['<', 1, 2], 3])
        // expect(j('<1><2><3>'))[_mo_](['<', ['<', ['<', 1], 2], 3])
        // expect(j('1<2><3><4>'))[_mo_](['<', ['<', ['<', 1, 2], 3], 4])
        // expect(j('<1><2><3><4>'))[_mo_](['<', ['<', ['<', ['<', 1], 2], 3], 4])
        // expect(j('1<2><3><4><5>'))[_mo_](['<', ['<', ['<', ['<', 1, 2], 3], 4], 5])
        expect(j('a:<1>'))[_mo_]({ a: ['<', 1] });
        expect(j('a:1<2>'))[_mo_]({ a: ['<', 1, 2] });
        // expect(j('a:<1><2>'))[_mo_]({ a: ['<', ['<', 1], 2] })
        // expect(j('a:1<2><3>'))[_mo_]({ a: ['<', ['<', 1, 2], 3] })
        // expect(j('a:<1><2><3>'))[_mo_]({ a: ['<', ['<', ['<', 1], 2], 3] })
        // expect(j('a:1<2><3><4>'))[_mo_]({ a: ['<', ['<', ['<', 1, 2], 3], 4] })
        // expect(j('a:<1><2><3><4>'))[_mo_]({ a: ['<', ['<', ['<', ['<', 1], 2], 3], 4] })
        // expect(j('a:1<2><3><4><5>'))
        // [_mo_]({ a: ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5] })
        expect(j('9+<1>'))[_mo_](['+', 9, ['<', 1]]);
        expect(j('9+1<2>'))[_mo_](['+', 9, ['<', 1, 2]]);
        // expect(j('9+<1><2>'))[_mo_](['+', 9, ['<', ['<', 1], 2]])
        // expect(j('9+1<2><3>'))[_mo_](['+', 9, ['<', ['<', 1, 2], 3]])
        // expect(j('9+<1><2><3>'))[_mo_](['+', 9, ['<', ['<', ['<', 1], 2], 3]])
        // expect(j('9+1<2><3><4>'))[_mo_](['+', 9, ['<', ['<', ['<', 1, 2], 3], 4]])
        // expect(j('9+<1><2><3><4>'))
        // [_mo_](['+', 9, ['<', ['<', ['<', ['<', 1], 2], 3], 4]])
        // expect(j('9+1<2><3><4><5>'))
        // [_mo_](['+', 9, ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5]])
        expect(j('<1>+9'))[_mo_](['+', ['<', 1], 9]);
        expect(j('1<2>+9'))[_mo_](['+', ['<', 1, 2], 9]);
        // expect(j('<1><2>+9'))[_mo_](['+', ['<', ['<', 1], 2], 9])
        // expect(j('1<2><3>+9'))[_mo_](['+', ['<', ['<', 1, 2], 3], 9])
        // expect(j('<1><2><3>+9'))[_mo_](['+', ['<', ['<', ['<', 1], 2], 3], 9])
        // expect(j('1<2><3><4>+9'))[_mo_](['+', ['<', ['<', ['<', 1, 2], 3], 4], 9])
        // expect(j('<1><2><3><4>+9'))
        // [_mo_](['+', ['<', ['<', ['<', ['<', 1], 2], 3], 4], 9])
        // expect(j('1<2><3><4><5>+9'))
        // [_mo_](['+', ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5], 9])
    });
    test('paren-preval-overload', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
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
        expect(j('[1]'))[_mo_]([1]);
        expect(j('a[1]'))[_mo_](['[', 'a', 1]);
        expect(j('[a[1]]'))[_mo_]([['[', 'a', 1]]);
        expect(j('a:[1]'))[_mo_]({ a: [1] });
        expect(j('a:b[1]'))[_mo_]({ a: ['[', 'b', 1] });
        expect(j('a:[b[1]]'))[_mo_]({ a: [['[', 'b', 1]] });
        expect(j('{a:[1]}'))[_mo_]({ a: [1] });
        expect(j('{a:b[1]}'))[_mo_]({ a: ['[', 'b', 1] });
        expect(j('{a:[b[1]]}'))[_mo_]({ a: [['[', 'b', 1]] });
        expect(j('-[1]+2'))[_mo_](['+', ['-', [1]], 2]);
        expect(j('-a[1]+2'))[_mo_](['+', ['-', ['[', 'a', 1]], 2]);
        expect(j('-[a[1]]+2'))[_mo_](['+', ['-', [['[', 'a', 1]]], 2]);
        expect(j('-a:[1]+2'))[_mo_](['-', { a: ['+', [1], 2] }]);
        expect(j('-a:b[1]+2'))[_mo_](['-', { a: ['+', ['[', 'b', 1], 2] }]);
        expect(j('-a:[b[1]]+2'))[_mo_](['-', { a: ['+', [['[', 'b', 1]], 2] }]);
        expect(j('-{a:[1]+2}'))[_mo_](['-', { a: ['+', [1], 2] }]);
        expect(j('-{a:b[1]+2}'))[_mo_](['-', { a: ['+', ['[', 'b', 1], 2] }]);
        expect(j('-{a:[b[1]]+2}'))[_mo_](['-', { a: ['+', [['[', 'b', 1]], 2] }]);
        expect(j('2+[1]'))[_mo_](['+', 2, [1]]);
        expect(j('2+a[1]'))[_mo_](['+', 2, ['[', 'a', 1]]);
        expect(j('2+[a[1]]'))[_mo_](['+', 2, [['[', 'a', 1]]]);
        expect(j('2+a:[1]'))[_mo_](['+', 2, { a: [1] }]);
        expect(j('2+a:b[1]'))[_mo_](['+', 2, { a: ['[', 'b', 1] }]);
        expect(j('2+a:[b[1]]'))[_mo_](['+', 2, { a: [['[', 'b', 1]] }]);
        expect(j('2+{a:[1]}'))[_mo_](['+', 2, { a: [1] }]);
        expect(j('2+{a:b[1]}'))[_mo_](['+', 2, { a: ['[', 'b', 1] }]);
        expect(j('2+{a:[b[1]]}'))[_mo_](['+', 2, { a: [['[', 'b', 1]] }]);
        expect(j('a[b[1]]'))[_mo_](['[', 'a', ['[', 'b', 1]]);
        expect(j('a[b[c[1]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', 1]]]);
        expect(j('a[b[c[d[1]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', 1]]]]);
        expect(j('a[b[[1]]]'))[_mo_](['[', 'a', ['[', 'b', [1]]]);
        expect(j('a[b[c[[1]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', [1]]]]);
        expect(j('a[b[c[d[[1]]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [1]]]]]);
        expect(j('a[b[[1,2]]]'))[_mo_](['[', 'a', ['[', 'b', [1, 2]]]);
        expect(j('a[b[c[[1,2]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', [1, 2]]]]);
        expect(j('a[b[c[d[[1,2]]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [1, 2]]]]]);
        expect(j('a[b[[x[1]]]]'))[_mo_](['[', 'a', ['[', 'b', [['[', 'x', 1]]]]);
        expect(j('a[b[c[[x[1]]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', [['[', 'x', 1]]]]]);
        expect(j('a[b[c[d[[x[1]]]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [['[', 'x', 1]]]]]]);
        expect(j('a{1}'))[_mo_](['{', 'a', 1]);
        expect(j('a{b{1}}'))[_mo_](['{', 'a', ['{', 'b', 1]]);
        expect(j('a{b{c{1}}}'))[_mo_](['{', 'a', ['{', 'b', ['{', 'c', 1]]]);
        expect(j('a{1+2}'))[_mo_](['{', 'a', ['+', 1, 2]]);
        expect(j('a{b{1+2}}'))[_mo_](['{', 'a', ['{', 'b', ['+', 1, 2]]]);
        expect(j('a{b{c{1+2}}}'))[_mo_](['{', 'a', ['{', 'b', ['{', 'c', ['+', 1, 2]]]]);
        expect(j('a{{x:1}}'))[_mo_](['{', 'a', { x: 1 }]);
        expect(j('a{{x:1,y:2}}'))[_mo_](['{', 'a', { x: 1, y: 2 }]);
    });
    test('paren-preval-implicit', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            op: {
                plain: {
                    preval: true
                }
            }
        });
        const j = mj(je);
        // But this is an implicit list.
        expect(j('foo,(1,a)'))[_mo_](['foo', ['(', [1, 'a']]]);
        expect(j('foo,(1+2,a)'))[_mo_](['foo', ['(', [['+', 1, 2], 'a']]]);
        expect(j('foo,(1+2+3,a)'))[_mo_](['foo', ['(', [['+', ['+', 1, 2], 3], 'a']]]);
    });
    test('add-infix', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            op: {
                foo: {
                    infix: true, left: 180, right: 190, src: 'foo'
                }
            }
        });
        const j = mj(je);
        expect(j('1 foo 2'))[_mo_](['foo', 1, 2]);
    });
    // TODO: provide as external tests for other plugins
    test('json-base', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('1')).toEqual(1);
        expect(j('"a"')).toEqual('a');
        expect(j('true')).toEqual(true);
        expect(j('[1,"a",false,[],{},[2],{a:3}]'))[_mo_]([1, "a", false, [], {}, [2], { a: 3 }]);
        expect(j('{ "a": 1, "b": "B", "c": null, "d": [1, 2]' +
            ', "e": { "f": [{}], "g": { "h": [] } } }'))[_mo_]({
            "a": 1, "b": "B", "c": null, "d": [1, 2],
            "e": { "f": [{}], "g": { "h": [] } }
        });
    });
    test('jsonic-base', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('1 "a" true # foo'))[_mo_]([1, 'a', true]);
        expect(j('x:1 y:"a" z:true // bar'))[_mo_]({ x: 1, y: 'a', z: true });
        expect(j('a:b:1 \n /* zed */ a:c:{\nd:e:[1 2]}'))[_mo_]({
            a: {
                b: 1,
                c: { d: { e: [1, 2] } }
            }
        });
    });
    test('example-dotpath', () => {
        let opts = {
            op: {
                'dot-infix': {
                    src: '.',
                    infix: true,
                    left: 15000000,
                    // left: 13_000_000,
                    right: 14000000,
                },
                'dot-prefix': {
                    src: '.',
                    prefix: true,
                    right: 14000000,
                }
            }
        };
        const je0 = jsonic_1.Jsonic.make().use(expr_1.Expr, opts);
        const j0 = mj(je0);
        expect(j0('a.b'))[_mo_](['.', 'a', 'b']);
        expect(j0('a.b.c'))[_mo_](['.', 'a', ['.', 'b', 'c']]);
        expect(j0('a.b+c.d'))[_mo_](['+', ['.', 'a', 'b'], ['.', 'c', 'd']]);
        expect(j0('.a'))[_mo_](['.', 'a']);
        expect(j0('.a.b'))[_mo_](['.', ['.', 'a', 'b']]);
        expect(j0('.a.b.c'))[_mo_](['.', ['.', 'a', ['.', 'b', 'c']]]);
        expect(j0('a..b'))[_mo_](['.', 'a', ['.', 'b']]);
        expect(j0('a..b.c'))[_mo_](['.', 'a', ['.', ['.', 'b', 'c']]]);
        expect(j0('a..b..c'))[_mo_](['.', 'a', ['.', ['.', 'b', ['.', 'c']]]]);
        expect(j0('..a'))[_mo_](['.', ['.', 'a']]);
        expect(j0('...a'))[_mo_](['.', ['.', ['.', 'a']]]);
        expect(j0('....a'))[_mo_](['.', ['.', ['.', ['.', 'a']]]]);
        expect(j0('..a.b'))[_mo_](['.', ['.', ['.', 'a', 'b']]]);
        expect(j0('...a.b'))[_mo_](['.', ['.', ['.', ['.', 'a', 'b']]]]);
        expect(j0('....a.b'))[_mo_](['.', ['.', ['.', ['.', ['.', 'a', 'b']]]]]);
        expect(j0('..a.b.c'))[_mo_](['.', ['.', ['.', 'a', ['.', 'b', 'c']]]]);
        expect(j0('...a.b.c'))[_mo_](['.', ['.', ['.', ['.', 'a', ['.', 'b', 'c']]]]]);
        expect(j0('....a.b.c'))[_mo_](['.', ['.', ['.', ['.', ['.', 'a', ['.', 'b', 'c']]]]]]);
        expect(j0('$.a.b'))[_mo_](['.', '$', ['.', 'a', 'b']]);
        expect(j0('$.a.b.c'))[_mo_](['.', '$', ['.', 'a', ['.', 'b', 'c']]]);
        let resolve = (_rule, _ctx, op, terms) => {
            // console.log('R', op, terms)
            if ('dot-infix' === op.name) {
                return terms.join('/');
            }
            else if ('dot-prefix' === op.name) {
                return '/' + terms[0];
            }
        };
        let r = null;
        let c = null;
        expect((0, expr_1.evaluation)(r, c, je0('a.b'), resolve)).toEqual('a/b');
        expect((0, expr_1.evaluation)(r, c, je0('a.b.c'), resolve)).toEqual('a/b/c');
        expect((0, expr_1.evaluation)(r, c, je0('a.b.c.d'), resolve)).toEqual('a/b/c/d');
        expect((0, expr_1.evaluation)(r, c, je0('.a'), resolve)).toEqual('/a');
        expect((0, expr_1.evaluation)(r, c, je0('.a.b'), resolve)).toEqual('/a/b');
        const je1 = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(expr_1.Expr, {
            ...opts,
            evaluate: resolve
        });
        expect(je1('a.b')).toEqual('a/b');
        expect(je1('a.b.c')).toEqual('a/b/c');
        expect(je1('a.b.c.d')).toEqual('a/b/c/d');
        expect(je1('{x:a.b}')).toEqual({ x: 'a/b' });
        expect(je1('{x:a.b.c}')).toEqual({ x: 'a/b/c' });
        expect(je1('{x:a.b.c.d}')).toEqual({ x: 'a/b/c/d' });
        expect(je1('x:a.b')).toEqual({ x: 'a/b' });
        expect(je1('x:a.b.c')).toEqual({ x: 'a/b/c' });
        expect(je1('x:a.b.c.d')).toEqual({ x: 'a/b/c/d' });
        expect(je1('a.b')).toEqual('a/b');
        expect(je1('a.b.c')).toEqual('a/b/c');
        expect(je1('a.b.c.d')).toEqual('a/b/c/d');
    });
    test('evaluate-math', () => {
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
        const j = jsonic_1.Jsonic.make().use(expr_1.Expr);
        let r = null;
        let c = null;
        expect((0, expr_1.evaluation)(r, c, ME(PLUS, 1, 2), mr)).toEqual(3);
        expect((0, expr_1.evaluation)(r, c, j('1+2'), mr)).toEqual(3);
        expect((0, expr_1.evaluation)(r, c, ME(PLUS, ME(PLUS, 1, 2), 3), mr)).toEqual(6);
        expect((0, expr_1.evaluation)(r, c, j('1+2+3'), mr)).toEqual(6);
        expect((0, expr_1.evaluation)(r, c, j('1*2+3'), mr)).toEqual(5);
        expect((0, expr_1.evaluation)(r, c, j('1+2*3'), mr)).toEqual(7);
        expect((0, expr_1.evaluation)(r, c, j('(1)'), mr)).toEqual(1);
        expect((0, expr_1.evaluation)(r, c, j('(1+2)'), mr)).toEqual(3);
        expect((0, expr_1.evaluation)(r, c, j('3+(1+2)'), mr)).toEqual(6);
        expect((0, expr_1.evaluation)(r, c, j('(1+2)+3'), mr)).toEqual(6);
        expect((0, expr_1.evaluation)(r, c, j('(1+2)*3'), mr)).toEqual(9);
        expect((0, expr_1.evaluation)(r, c, j('3*(1+2)'), mr)).toEqual(9);
        const je = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(expr_1.Expr, {
            evaluate: mr
        });
        expect(je('11+22')).toEqual(33);
        expect(je('a:11+22')).toEqual({ a: 33 });
        expect(je('[11+22]')).toEqual([33]);
        expect(je('112')).toEqual(112);
        expect(je('+112')).toEqual(112);
        expect(je('a:(113)')).toEqual({ a: 113 });
        expect(je('(113)')).toEqual(113);
        expect(je('((114))')).toEqual(114);
        expect(je('(((115)))')).toEqual(115);
        expect(je('111+(222)')).toEqual(333);
        expect(je('(111)+222')).toEqual(333);
        expect(je('(111)+(222)')).toEqual(333);
        expect(je('111+222')).toEqual(333);
        expect(je('(111+222)')).toEqual(333);
        expect(je('(111+222)')).toEqual(333);
        expect(je('(1+2)*4')).toEqual(12);
        expect(je('1+(2*4)')).toEqual(9);
        expect(je('((1+2)*4)')).toEqual(12);
        expect(je('(1+(2*4))')).toEqual(9);
        expect(je('1-3')).toEqual(-2);
        expect(je('-1')).toEqual(-1);
        expect(je('+1')).toEqual(1);
        expect(je('1+(-3)')).toEqual(-2);
    });
    test('evaluate-sets', () => {
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
        const j = jsonic_1.Jsonic.make().use(expr_1.Expr, {
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
        expect((0, expr_1.evaluation)(r, c, j('[1]U[2]'), mr)).toEqual([1, 2]);
        expect((0, expr_1.evaluation)(r, c, j('[1,3]U[1,2]'), mr)).toEqual([1, 2, 3]);
        expect((0, expr_1.evaluation)(r, c, j('[1,3]N[1,2]'), mr)).toEqual([1]);
        expect((0, expr_1.evaluation)(r, c, j('[1,3]N[2]'), mr)).toEqual([]);
        expect((0, expr_1.evaluation)(r, c, j('[1,3]N[2,1]'), mr)).toEqual([1]);
        expect((0, expr_1.evaluation)(r, c, j('[1,3]N[2]U[1,2]'), mr)).toEqual([1, 2]);
        expect((0, expr_1.evaluation)(r, c, j('[1,3]N([2]U[1,2])'), mr)).toEqual([1]);
    });
    test('mini-config', () => {
        const funcMap = {
            floor: (v) => isNaN(v) ? undefined : Math.floor(v)
        };
        let MF = {
            'addition-infix': (a, b) => {
                console.log('ADD', a, b);
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
                console.log('FUNC', fname, a, '->', out);
                return out;
            }
        };
        const j0 = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(expr_1.Expr, {
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
                var _a, _b;
                let mf = MF[op.name];
                console.log('EVAL-j0', op.name, terms, 'R', r.i, r.u, r.k, r.n, 'P', r.parent.i, r.parent.u, 'mf', mf);
                // r.parent.prev?.u?.paren_preval, op.name, terms, mf)
                // if (r.parent.prev?.u?.paren_preval) {
                if (
                // r.n.expr_paren
                'func-paren' === op.name
                    && !((_b = (_a = r.parent.parent) === null || _a === void 0 ? void 0 : _a.u) === null || _b === void 0 ? void 0 : _b.paren_preval)
                // && !r.parent.prev?.u?.paren_preval
                // && !r.parent.u?.paren_preval
                ) {
                    terms = ['', ...terms];
                }
                // console.log('EVAL-j0-terms', terms)
                return mf ? mf(...terms) : undefined;
            }
        });
        // expect(j0('11+22')).toEqual(33)
        // expect(j0('44-33')).toEqual(11)
        // expect(j0('(44-33)+11')).toEqual(22)
        // expect(j0('44-(33+11)')).toEqual(0)
        // expect(j0('44-33+11')).toEqual(22)
        // expect(j0('(1.1)')).toEqual(1.1)
        // expect(j0('[0,(1)]')).toEqual([0, 1])
        // expect(j0('[0 (1)]')).toEqual([0, 1])
        // expect(j0('floor<1.5>')).toEqual(1)
        // expect(j0('a:floor<2.5>')).toEqual({ a: 2 })
        // expect(j0('{b:floor<3.5>}')).toEqual({ b: 3 })
        // expect(j0('[floor<4.5>]')).toEqual([4])
        // expect(j0('[0 floor<5.5>]')).toEqual([0, 5])
        // expect(j0('1+floor<1.5>')).toEqual(2)
        // expect(j0('1+floor<1.5>+3')).toEqual(5)
        // expect(j0('floor<1.5>+4')).toEqual(5)
        // expect(j0('a:floor<1.5>+4')).toEqual({ a: 5 })
        // expect(j0('a:(1+2) b:floor<1.9>')).toEqual({ a: 3, b: 1 })
        // expect(j0('()')).toEqual(undefined)
        // expect(j0('<>')).toEqual(undefined)
        // expect(j0('<1>')).toEqual(1)
        // expect(j0('c:<2>')).toEqual({ c: 2 })
        // TODO: jsonic update
        // expect(j0('a:floor<>')).toEqual({ a: undefined })
        // expect(j0('floor<>')).toEqual(undefined)
        // expect(j0('[floor<>]')).toEqual([])
        // expect(j0('floor<"a">')).toEqual(undefined)
        // expect(j0('a:floor<"a">')).toEqual({ a: undefined })
        // expect(j0('[1 (2) (2+1) floor<4.5>]')).toEqual([1, 2, 3, 4])
        // expect(j0('1 (2) (2+1) floor<4.5>')).toEqual([1, 2, 3, 4])
        // expect(j0('bad<9>')).toEqual(undefined)
        return;
        console.log('===========');
        const j1 = jsonic_1.Jsonic.make()
            // .use(Debug, { trace: true })
            .use(expr_1.Expr, {
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
                var _a, _b;
                let mf = MF[op.name];
                // console.log('EVAL-j1', op.name, terms, 'R', r.i, r.u, r.k, r.n, 'P', r.parent.i, r.parent.u, 'mf', mf)
                // r.parent.prev?.u?.paren_preval, op.name, terms, mf)
                // if (r.parent.prev?.u?.paren_preval) {
                if (
                // r.n.expr_paren
                'func-paren' === op.name
                    && !((_b = (_a = r.parent.parent) === null || _a === void 0 ? void 0 : _a.u) === null || _b === void 0 ? void 0 : _b.paren_preval)
                // && !r.parent.prev?.u?.paren_preval
                // && !r.parent?.u.paren_preval
                ) {
                    terms = ['', ...terms];
                }
                const out = mf ? mf(...terms) : NaN;
                // console.log('EVAL', op.name, terms, '->', out)
                return out;
            }
        });
        // expect(j1('()')).toEqual(undefined)
        // expect(j1('(0)')).toEqual(0)
        // expect(j1('(0+1)')).toEqual(1)
        // expect(j1('[(0) 1]')).toEqual([0, 1])
        // expect(() => j1('[0 (1) 2]')).toThrow('Invalid operation: 0')
        // expect(j1('[0,(1),2]')).toEqual([0, 1, 2])
        // expect(j1('[0,(1)]')).toEqual([0, 1])
        // expect(() => j1('[0 (1)]')).toThrow('Invalid operation: 0')
        // expect(j1('[(1)]')).toEqual([1])
        // expect(j1('[0,(1)]')).toEqual([0, 1])
        // expect(j1('[(0),(1)]')).toEqual([0, 1])
        // expect(j1('(0),(1)')).toEqual([0, 1])
        // expect(() => j1('[(0) (1)]')).toThrow('Invalid operation: (')
        // expect(() => j1('(0) (1)')).toThrow('Invalid operation: (')
        // expect(j1('floor(1.1)')).toEqual(1)
        // expect(j1('floor (1.1)')).toEqual(1)
        // expect(j1('(floor) (1.1)')).toEqual(1)
        // expect(() => j1('(0+1) (1+1)')).toThrow('Invalid operation: (')
        // expect(j1('floor(0.5)')).toEqual(0)
        // expect(j1('a:floor(2.5)')).toEqual({ a: 2 })
        // expect(j1('{b:floor(3.5)}')).toEqual({ b: 3 })
        // expect(j1('[floor(4.5)]')).toEqual([4])
        // expect(j1('[0 floor(5.5)]')).toEqual([0, 5])
        // expect(j1('[(0) 1 floor(5.5)]')).toEqual([0, 1, 5])
        // expect(j1('[(0) floor(5.5)]')).toEqual([0, 5])
        // expect(j1('[0,(1),floor(5.5)]')).toEqual([0, 1, 5])
        // expect(j1('[1,(2),(2+1)]')).toEqual([1, 2, 3])
        // expect(j1('[1,(2),(2+1),floor(4.5)]')).toEqual([1, 2, 3, 4])
        // expect(j1('a:floor(1.5)')).toEqual({ a: 1 })
        // expect(() => j1('b:bad(2.5)')).toThrow('Invalid operation: bad')
        // expect(j1('[3+2]')).toEqual([5])
        // expect(j1('[3+(2)]')).toEqual([5])
        // expect(j1('[(3)+2]')).toEqual([5])
        // expect(j1('[(3)+(2)]')).toEqual([5])
        // expect(j1('[(3+2)]')).toEqual([5])
        // expect(j1('[(3+(2))]')).toEqual([5])
        // expect(j1('[((3)+2)]')).toEqual([5])
        // expect(j1('[((3)+(2))]')).toEqual([5])
        // expect(j1('[1,3+2]')).toEqual([1, 5])
        // expect(j1('[1,3+(2)]')).toEqual([1, 5])
        // expect(j1('[1,(3)+2]')).toEqual([1, 5])
        // expect(j1('[1,(3)+(2)]')).toEqual([1, 5])
        // expect(j1('[1,(3+2)]')).toEqual([1, 5])
        // expect(j1('[1,(3+(2))]')).toEqual([1, 5])
        // expect(j1('[1,((3)+2)]')).toEqual([1, 5])
        // expect(j1('[1,((3)+(2))]')).toEqual([1, 5])
        // expect(j1('[3+2,4]')).toEqual([5, 4])
        // expect(j1('[3+(2),4]')).toEqual([5, 4])
        // expect(j1('[(3)+2,4]')).toEqual([5, 4])
        // expect(j1('[(3)+(2),4]')).toEqual([5, 4])
        // expect(j1('[(3+2),4]')).toEqual([5, 4])
        // expect(j1('[(3+(2)),4]')).toEqual([5, 4])
        // expect(j1('[((3)+2),4]')).toEqual([5, 4])
        // expect(j1('[((3)+(2)),4]')).toEqual([5, 4])
        // expect(j1('[1,3+2,4]')).toEqual([1, 5, 4])
        // expect(j1('[1,3+(2),4]')).toEqual([1, 5, 4])
        // expect(j1('[1,(3)+2,4]')).toEqual([1, 5, 4])
        // expect(j1('[1,(3)+(2),4]')).toEqual([1, 5, 4])
        // expect(j1('[1,(3+2),4]')).toEqual([1, 5, 4])
        // expect(j1('[1,(3+(2)),4]')).toEqual([1, 5, 4])
        // expect(j1('[1,((3)+2),4]')).toEqual([1, 5, 4])
        // expect(j1('[1,((3)+(2)),4]')).toEqual([1, 5, 4])
        // expect(j1('1+floor(1.1)')).toEqual(2)
        // expect(j1('floor(1.1)+1')).toEqual(2)
        // expect(j1('1+floor(1.1)+1')).toEqual(3)
        // expect(j1('a:(2)+1')).toEqual({ a: 3 })
        // expect(j1('a:1+floor(1.1)')).toEqual({ a: 2 })
        // expect(j1('a:(1.1)+1')).toEqual({ a: 2.1 })
        // expect(j1('a:floor(1.1)+1')).toEqual({ a: 2 })
        // expect(j1('a:1+floor(1.1)+1')).toEqual({ a: 3 })
        // expect(j1('[1+floor(1.1)]')).toEqual([2])
        // expect(j1('[floor(1.1)+2]')).toEqual([3])
        // expect(j1('[3+floor(1.1)+2]')).toEqual([6])
        // expect(j1('b:1.1+1,c:C0')).toEqual({ b: 2.1, c: 'C0' })
        // expect(j1('b:(1.1+1),c:C0a')).toEqual({ b: 2.1, c: 'C0a' })
        // expect(j1('b:(1.1)+1,c:C1')).toEqual({ b: 2.1, c: 'C1' })
        // expect(j1('b:((1.1)+1),c:C1a')).toEqual({ b: 2.1, c: 'C1a' })
        // expect(j1('b:1+floor(1.1),c:C2c')).toEqual({ b: 2, c: 'C2c' })
        // expect(j1('b:floor(1.1)+1,c:C2d')).toEqual({ b: 2, c: 'C2d' })
        // expect(j1('b:(floor(1.1)),c:C2a')).toEqual({ b: 1, c: 'C2a' })
        // expect(j1('b:(1+floor(1.1)),c:C2b')).toEqual({ b: 2, c: 'C2b' })
        // expect(j1('1+(floor(1.1))')).toEqual(2)
        // expect(j1('(11,22)')).toEqual([11, 22])
        // expect(j1('21+31')).toEqual(52)
        // expect(j1('(21)+31')).toEqual(52)
        // expect(j1('(21+31)')).toEqual(52)
        // expect(j1('(floor(2.2))')).toEqual(2)
        // expect(j1('((floor(2.2)))')).toEqual(2)
        // expect(j1('(floor(2.2))+1')).toEqual(3)
        // expect(j1('floor(2.2)+3')).toEqual(5)
        // expect(j1('(floor(1.1)+2)')).toEqual(3)
        // expect(j1('b:(floor(1.1)+2),c:C2c')).toEqual({ b: 3, c: 'C2c' })
    });
});
//# sourceMappingURL=expr.test.js.map