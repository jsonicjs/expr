"use strict";
/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
const jsonic_1 = require("jsonic");
const expr_1 = require("../expr");
const C = (x) => JSON.parse(JSON.stringify(x));
const mj = (je) => (s, m) => C(je(s, m));
const _mo_ = 'toMatchObject';
function makeOp(opspec) {
    const base = { infix: false, prefix: false, suffix: false, left: 0, right: 0 };
    const op = {
        ...base,
        terms: opspec.infix ? 2 : 1,
        ...opspec
    };
    return op;
}
function makeExpr(opspec, term0, term1) {
    const op = makeOp(opspec);
    const expr = [opspec.src];
    expr.op$ = op;
    if (term0) {
        expr.push(term0);
    }
    if (term1) {
        expr.push(term1);
    }
    return expr;
}
describe('expr', () => {
    test('happy', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('1+2')).toMatchObject(['+', 1, 2]);
        expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2]);
    });
    test('prattify-basic', () => {
        let T = (expr, opdef) => C((0, expr_1.prattify)(expr, opdef));
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
        // 1+2+N => (1+2)+N
        expect(T(E = ME(PLUS_LA, 1, 2), PLUS_LA))[_mo_](['+', ['+', 1, 2]]);
        expect(C(E))[_mo_](['+', ['+', 1, 2]]);
        // 1+2+N => 1+(2+N)
        expect(T(E = ME(PLUS_RA, 1, 2), PLUS_RA))[_mo_](['+', 2]);
        expect(C(E))[_mo_](['+', 1, ['+', 2]]);
        // 1+2*N => 1+(2*N)
        expect(T(E = ME(PLUS_LA, 1, 2), MUL_LA))[_mo_](['*', 2]);
        expect(C(E))[_mo_](['+', 1, ['*', 2]]);
        // 1*2+N => (1+2)+N
        expect(T(E = ME(MUL_LA, 1, 2), PLUS_LA))[_mo_](['+', ['*', 1, 2]]);
        expect(C(E))[_mo_](['+', ['*', 1, 2]]);
        // @1+N => (@1)+N
        expect(T(E = ME(AT_P, 1), PLUS_LA))[_mo_](['+', ['@', 1]]);
        expect(C(E))[_mo_](['+', ['@', 1]]);
        // 1!+N => (!1)+N
        expect(T(E = ME(BANG_S, 1), PLUS_LA))[_mo_](['+', ['!', 1]]);
        expect(C(E))[_mo_](['+', ['!', 1]]);
        // @1|N => @(1|N)
        expect(T(E = ME(AT_P, 1), PIPE_LA))[_mo_](['|', 1]);
        expect(C(E))[_mo_](['@', ['|', 1]]);
        // 1|@N => 1|(@N)
        expect(T(E = ME(PIPE_LA, 1), AT_P))[_mo_](['@']);
        expect(C(E))[_mo_](['|', 1, ['@']]);
        // 1!|N => (!1)|N
        expect(T(E = ME(BANG_S, 1), PIPE_LA))[_mo_](['|', ['!', 1]]);
        expect(C(E))[_mo_](['|', ['!', 1]]);
        // 1+@N => 1+(@N)
        expect(T(E = ME(PLUS_LA, 1), AT_P))[_mo_](['@']);
        expect(C(E))[_mo_](['+', 1, ['@']]);
        // @@N => @(@N)
        expect(T(E = ME(AT_P), AT_P))[_mo_](['@']);
        expect(C(E))[_mo_](['@', ['@']]);
        // %@N => %(@N)
        expect(T(E = ME(PER_P), AT_P))[_mo_](['@']);
        expect(C(E))[_mo_](['%', ['@']]);
        // @%N => @(%N)
        expect(T(E = ME(AT_P), PER_P))[_mo_](['%']);
        expect(C(E))[_mo_](['@', ['%']]);
        // 1+2! => 1+(2!)
        // expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['!', 2])
        expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['+', 1, ['!', 2]]);
        expect(C(E))[_mo_](['+', 1, ['!', 2]]);
        // 1|2! => (1|2)!
        expect(T(E = ME(PIPE_LA, 1, 2), BANG_S))[_mo_](['!', ['|', 1, 2]]);
        expect(C(E))[_mo_](['!', ['|', 1, 2]]);
        // 1!! => !(!1)
        expect(T(E = ME(BANG_S, 1), BANG_S))[_mo_](['!', ['!', 1]]);
        expect(C(E))[_mo_](['!', ['!', 1]]);
        // 1!? => ?(!1)
        expect(T(E = ME(BANG_S, 1), QUEST_S))[_mo_](['?', ['!', 1]]);
        expect(C(E))[_mo_](['?', ['!', 1]]);
        // 1?! => !(?1)
        expect(T(E = ME(QUEST_S, 1), BANG_S))[_mo_](['!', ['?', 1]]);
        expect(C(E))[_mo_](['!', ['?', 1]]);
        // @1! => @(1!)
        // expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['!', 1])
        expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['@', ['!', 1]]);
        expect(C(E))[_mo_](['@', ['!', 1]]);
        // @1? => (@1)?
        expect(T(E = ME(AT_P, 1), QUEST_S))[_mo_](['?', ['@', 1]]);
        expect(C(E))[_mo_](['?', ['@', 1]]);
        // @@1! => @(@(1!))
        // expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['!', 1])
        expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['@', ['@', ['!', 1]]]);
        expect(C(E))[_mo_](['@', ['@', ['!', 1]]]);
        // @@1? => (@(@1))?
        expect(T(E = ME(AT_P, ME(AT_P, 1)), QUEST_S))[_mo_](['?', ['@', ['@', 1]]]);
        expect(C(E))[_mo_](['?', ['@', ['@', 1]]]);
    });
    test('prattify-assoc', () => {
        let T = (expr, opdef) => C((0, expr_1.prattify)(expr, opdef));
        let ME = makeExpr;
        let MO = makeOp;
        let AT_LA = MO({ infix: true, src: '@', left: 14, right: 15 });
        let PER_RA = MO({ infix: true, src: '%', left: 17, right: 16 });
        let E;
        // 1@2@N
        expect(T(E = ME(AT_LA, 1, 2), AT_LA))[_mo_](['@', ['@', 1, 2]]);
        expect(C(E))[_mo_](['@', ['@', 1, 2]]);
        // 1@2@3@N
        expect(T(E = ME(AT_LA, ME(AT_LA, 1, 2), 3), AT_LA))[_mo_](['@', ['@', ['@', 1, 2], 3]]);
        expect(C(E))[_mo_](['@', ['@', ['@', 1, 2], 3]]);
        // 1@2@3@4@N
        expect(T(E = ME(AT_LA, ME(AT_LA, ME(AT_LA, 1, 2), 3), 4), AT_LA))[_mo_](['@', ['@', ['@', ['@', 1, 2], 3], 4]]);
        expect(C(E))[_mo_](['@', ['@', ['@', ['@', 1, 2], 3], 4]]);
        // 1@2@3@4@5@N
        expect(T(E = ME(AT_LA, ME(AT_LA, ME(AT_LA, ME(AT_LA, 1, 2), 3), 4), 5), AT_LA))[_mo_](['@', ['@', ['@', ['@', ['@', 1, 2], 3], 4], 5]]);
        expect(C(E))[_mo_](['@', ['@', ['@', ['@', ['@', 1, 2], 3], 4], 5]]);
        // 1%2%N
        expect(T(E = ME(PER_RA, 1, 2), PER_RA))[_mo_](['%', 2]);
        expect(C(E))[_mo_](['%', 1, ['%', 2]]);
        // 1%2%3%N
        expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, 3)), PER_RA))[_mo_](['%', 3]);
        expect(C(E))[_mo_](['%', 1, ['%', 2, ['%', 3]]]);
        // 1%2%3%4%N
        expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, ME(PER_RA, 3, 4))), PER_RA))[_mo_](['%', 4]);
        expect(C(E))[_mo_](['%', 1, ['%', 2, ['%', 3, ['%', 4]]]]);
        // 1%2%3%4%5%N
        expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, ME(PER_RA, 3, ME(PER_RA, 4, 5)))), PER_RA))[_mo_](['%', 5]);
        expect(C(E))[_mo_](['%', 1, ['%', 2, ['%', 3, ['%', 4, ['%', 5]]]]]);
    });
    // TODO: reconsider
    // test('prattify-ternary', () => {
    //   let T = (expr: any[], opdef?: OpFullDef) => C(prattify(expr, opdef))
    //   let ME = makeExpr
    //   let MO = makeOp
    //   let QUEST_RA = MO({ infix: true, src: '?', left: 15, right: 14 })
    //   let COLON_LA = MO({ infix: true, src: ':', left: 16, right: 17 })
    //   let E: any
    //   // 1?2?N => 1?(2?N)
    //   expect(T(E = ME(QUEST_RA, 1, 2), QUEST_RA))[_mo_](['?', 2])
    //   expect(C(E))[_mo_](['?', 1, ['?', 2]])
    //   // 1:2:N => (1:2):N
    //   expect(T(E = ME(COLON_LA, 1, 2), COLON_LA))[_mo_]([':', [':', 1, 2]])
    //   expect(C(E))[_mo_]([':', [':', 1, 2]])
    //   // 1?2:N => 1?(2:N)
    //   expect(T(E = ME(QUEST_RA, 1, 2), COLON_LA))[_mo_]([':', 2])
    //   expect(C(E))[_mo_](['?', 1, [':', 2]])
    //   // 1:2?N => (1:2)?N
    //   expect(T(E = ME(COLON_LA, 1, 2), QUEST_RA))[_mo_](['?', [':', 1, 2]])
    //   expect(C(E))[_mo_](['?', [':', 1, 2]])
    // })
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
        expect(j('([true,false],1+2+3+4,5,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]]);
        expect(j('([true,false] 1 2 {x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]]);
        expect(j('([true,false] 1+2 3 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]]);
        expect(j('([true,false] 1+2+3 4 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]]);
        expect(j('([true,false] 1+2+3+4 5 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]]);
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
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
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
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
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
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
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
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
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
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
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
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
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
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
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
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
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
        expect(j('(1)')).toMatchObject(['(', 1]);
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
        expect(j('1+(2)+3')).toMatchObject(['+', ['+', 1, ['(', 2]], 3]);
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
    });
    test('paren-map-implicit-structure-comma', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('{a:(1)}')).toMatchObject({ a: ['(', 1] });
        expect(j('{a:(1,2)}')).toMatchObject({ a: ['(', [1, 2]] });
        expect(j('{a:(1,2,3)}')).toMatchObject({ a: ['(', [1, 2, 3]] });
        expect(j('{a:(1),b:9}')).toMatchObject({ a: ['(', 1], b: 9 });
        expect(j('{a:(1,2),b:9}')).toMatchObject({ a: ['(', [1, 2]], b: 9 });
        expect(j('{a:(1,2,3),b:9}')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9 });
        expect(j('{a:(1),b:9,c:8}')).toMatchObject({ a: ['(', 1], b: 9, c: 8 });
        expect(j('{a:(1,2),b:9,c:8}')).toMatchObject({ a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('{a:(1,2,3),b:9,c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('{a:(1),b:(9)}')).toMatchObject({ a: ['(', 1], b: ['(', 9] });
        expect(j('{a:(1,2),b:(9)}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('{a:(1,2,3),b:(9)}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('{a:(1),b:(9),c:8}')).toMatchObject({ a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('{a:(1,2),b:(9),c:8}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('{a:(1,2,3),b:(9),c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('{a:(1),b:(8,9)}')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('{a:(1,2),b:(8,9)}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('{a:(1,2,3),b:(8,9)}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('{a:(1),b:(8,9),c:8}')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('{a:(1,2),b:(8,9),c:8}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('{a:(1,2,3),b:(8,9),c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1)}')).toMatchObject({ d: 0, a: ['(', 1] });
        expect(j('{d:0,a:(1,2)}')).toMatchObject({ d: 0, a: ['(', [1, 2]] });
        expect(j('{d:0,a:(1,2,3)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]] });
        expect(j('{d:0,a:(1),b:9}')).toMatchObject({ d: 0, a: ['(', 1], b: 9 });
        expect(j('{d:0,a:(1,2),b:9}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9 });
        expect(j('{d:0,a:(1,2,3),b:9}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        expect(j('{d:0,a:(1),b:9,c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: 9, c: 8 });
        expect(j('{d:0,a:(1,2),b:9,c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('{d:0,a:(1,2,3),b:9,c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('{d:0,a:(1),b:(9)}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9] });
        expect(j('{d:0,a:(1,2),b:(9)}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('{d:0,a:(1,2,3),b:(9)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('{d:0,a:(1),b:(9),c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1,2),b:(9),c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1,2,3),b:(9),c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1),b:(8,9)}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1,2),b:(8,9)}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1,2,3),b:(8,9)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1),b:(8,9),c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1,2),b:(8,9),c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1,2,3),b:(8,9),c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1)')).toMatchObject({ a: ['(', 1] });
        expect(j('a:(1,2)')).toMatchObject({ a: ['(', [1, 2]] });
        expect(j('a:(1,2,3)')).toMatchObject({ a: ['(', [1, 2, 3]] });
        expect(j('a:(1),b:9')).toMatchObject({ a: ['(', 1], b: 9 });
        expect(j('a:(1,2),b:9')).toMatchObject({ a: ['(', [1, 2]], b: 9 });
        expect(j('a:(1,2,3),b:9')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9 });
        expect(j('a:(1),b:9,c:8')).toMatchObject({ a: ['(', 1], b: 9, c: 8 });
        expect(j('a:(1,2),b:9,c:8')).toMatchObject({ a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('a:(1,2,3),b:9,c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('a:(1),b:(9)')).toMatchObject({ a: ['(', 1], b: ['(', 9] });
        expect(j('a:(1,2),b:(9)')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('a:(1,2,3),b:(9)')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('a:(1),b:(9),c:8')).toMatchObject({ a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('a:(1,2),b:(9),c:8')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('a:(1,2,3),b:(9),c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('a:(1),b:(8,9)')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('a:(1,2),b:(8,9)')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('a:(1,2,3),b:(8,9)')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('a:(1),b:(8,9),c:8')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1,2),b:(8,9),c:8')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1,2,3),b:(8,9),c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1)')).toMatchObject({ d: 0, a: ['(', 1] });
        expect(j('d:0,a:(1,2)')).toMatchObject({ d: 0, a: ['(', [1, 2]] });
        expect(j('d:0,a:(1,2,3)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]] });
        expect(j('d:0,a:(1),b:9')).toMatchObject({ d: 0, a: ['(', 1], b: 9 });
        expect(j('d:0,a:(1,2),b:9')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9 });
        expect(j('d:0,a:(1,2,3),b:9')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        expect(j('d:0,a:(1),b:9,c:8')).toMatchObject({ d: 0, a: ['(', 1], b: 9, c: 8 });
        expect(j('d:0,a:(1,2),b:9,c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('d:0,a:(1,2,3),b:9,c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('d:0,a:(1),b:(9)')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9] });
        expect(j('d:0,a:(1,2),b:(9)')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('d:0,a:(1,2,3),b:(9)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('d:0,a:(1),b:(9),c:8')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1,2),b:(9),c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1,2,3),b:(9),c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1),b:(8,9)')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1,2),b:(8,9)')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1,2,3),b:(8,9)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1),b:(8,9),c:8')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1,2),b:(8,9),c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1,2,3),b:(8,9),c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
    });
    test('paren-map-implicit-structure-space', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('{a:(1)}')).toMatchObject({ a: ['(', 1] });
        expect(j('{a:(1 2)}')).toMatchObject({ a: ['(', [1, 2]] });
        expect(j('{a:(1 2 3)}')).toMatchObject({ a: ['(', [1, 2, 3]] });
        expect(j('{a:(1) b:9}')).toMatchObject({ a: ['(', 1], b: 9 });
        expect(j('{a:(1 2) b:9}')).toMatchObject({ a: ['(', [1, 2]], b: 9 });
        expect(j('{a:(1 2 3) b:9}')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9 });
        expect(j('{a:(1) b:9 c:8}')).toMatchObject({ a: ['(', 1], b: 9, c: 8 });
        expect(j('{a:(1 2) b:9 c:8}')).toMatchObject({ a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('{a:(1 2 3) b:9 c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('{a:(1) b:(9)}')).toMatchObject({ a: ['(', 1], b: ['(', 9] });
        expect(j('{a:(1 2) b:(9)}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('{a:(1 2 3) b:(9)}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('{a:(1) b:(9) c:8}')).toMatchObject({ a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('{a:(1 2) b:(9) c:8}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('{a:(1 2 3) b:(9) c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('{a:(1) b:(8 9)}')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('{a:(1 2) b:(8 9)}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('{a:(1 2 3) b:(8 9)}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('{a:(1) b:(8 9) c:8}')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('{a:(1 2) b:(8 9) c:8}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('{a:(1 2 3) b:(8 9) c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1)}')).toMatchObject({ d: 0, a: ['(', 1] });
        expect(j('{d:0,a:(1 2)}')).toMatchObject({ d: 0, a: ['(', [1, 2]] });
        expect(j('{d:0,a:(1 2 3)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]] });
        expect(j('{d:0,a:(1) b:9}')).toMatchObject({ d: 0, a: ['(', 1], b: 9 });
        expect(j('{d:0,a:(1 2) b:9}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9 });
        expect(j('{d:0,a:(1 2 3) b:9}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        expect(j('{d:0,a:(1) b:9 c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: 9, c: 8 });
        expect(j('{d:0,a:(1 2) b:9 c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('{d:0,a:(1 2 3) b:9 c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('{d:0,a:(1) b:(9)}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9] });
        expect(j('{d:0,a:(1 2) b:(9)}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('{d:0,a:(1 2 3) b:(9)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('{d:0,a:(1) b:(9) c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1 2) b:(9) c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1 2 3) b:(9) c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('{d:0,a:(1) b:(8 9)}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1 2) b:(8 9)}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1 2 3) b:(8 9)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('{d:0,a:(1) b:(8 9) c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1 2) b:(8 9) c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('{d:0,a:(1 2 3) b:(8 9) c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1)')).toMatchObject({ a: ['(', 1] });
        expect(j('a:(1 2)')).toMatchObject({ a: ['(', [1, 2]] });
        expect(j('a:(1 2 3)')).toMatchObject({ a: ['(', [1, 2, 3]] });
        expect(j('a:(1) b:9')).toMatchObject({ a: ['(', 1], b: 9 });
        expect(j('a:(1 2) b:9')).toMatchObject({ a: ['(', [1, 2]], b: 9 });
        expect(j('a:(1 2 3) b:9')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9 });
        expect(j('a:(1) b:9 c:8')).toMatchObject({ a: ['(', 1], b: 9, c: 8 });
        expect(j('a:(1 2) b:9 c:8')).toMatchObject({ a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('a:(1 2 3) b:9 c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('a:(1) b:(9)')).toMatchObject({ a: ['(', 1], b: ['(', 9] });
        expect(j('a:(1 2) b:(9)')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('a:(1 2 3) b:(9)')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('a:(1) b:(9) c:8')).toMatchObject({ a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('a:(1 2) b:(9) c:8')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('a:(1 2 3) b:(9) c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('a:(1) b:(8 9)')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('a:(1 2) b:(8 9)')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('a:(1 2 3) b:(8 9)')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('a:(1) b:(8 9) c:8')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1 2) b:(8 9) c:8')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('a:(1 2 3) b:(8 9) c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1)')).toMatchObject({ d: 0, a: ['(', 1] });
        expect(j('d:0,a:(1 2)')).toMatchObject({ d: 0, a: ['(', [1, 2]] });
        expect(j('d:0,a:(1 2 3)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]] });
        expect(j('d:0,a:(1) b:9')).toMatchObject({ d: 0, a: ['(', 1], b: 9 });
        expect(j('d:0,a:(1 2) b:9')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9 });
        expect(j('d:0,a:(1 2 3) b:9')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9 });
        expect(j('d:0,a:(1) b:9 c:8')).toMatchObject({ d: 0, a: ['(', 1], b: 9, c: 8 });
        expect(j('d:0,a:(1 2) b:9 c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 });
        expect(j('d:0,a:(1 2 3) b:9 c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 });
        expect(j('d:0,a:(1) b:(9)')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9] });
        expect(j('d:0,a:(1 2) b:(9)')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9] });
        expect(j('d:0,a:(1 2 3) b:(9)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] });
        expect(j('d:0,a:(1) b:(9) c:8')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1 2) b:(9) c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1 2 3) b:(9) c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 });
        expect(j('d:0,a:(1) b:(8 9)')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1 2) b:(8 9)')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1 2 3) b:(8 9)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] });
        expect(j('d:0,a:(1) b:(8 9) c:8')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1 2) b:(8 9) c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 });
        expect(j('d:0,a:(1 2 3) b:(8 9) c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 });
    });
    test('paren-list-implicit-structure-comma', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('[(1)]')).toMatchObject([['(', 1]]);
        expect(j('[(1,2)]')).toMatchObject([['(', [1, 2]]]);
        expect(j('[(1,2,3)]')).toMatchObject([['(', [1, 2, 3]]]);
        expect(j('[(1),9]')).toMatchObject([['(', 1], 9]);
        expect(j('[(1,2),9]')).toMatchObject([['(', [1, 2]], 9]);
        expect(j('[(1,2,3),9]')).toMatchObject([['(', [1, 2, 3]], 9]);
        expect(j('[(1),9,8]')).toMatchObject([['(', 1], 9, 8]);
        expect(j('[(1,2),9,8]')).toMatchObject([['(', [1, 2]], 9, 8]);
        expect(j('[(1,2,3),9,8]')).toMatchObject([['(', [1, 2, 3]], 9, 8]);
        expect(j('[(1),(9)]')).toMatchObject([['(', 1], ['(', 9]]);
        expect(j('[(1,2),(9)]')).toMatchObject([['(', [1, 2]], ['(', 9]]);
        expect(j('[(1,2,3),(9)]')).toMatchObject([['(', [1, 2, 3]], ['(', 9]]);
        expect(j('[(1),(9),8]')).toMatchObject([['(', 1], ['(', 9], 8]);
        expect(j('[(1,2),(9),8]')).toMatchObject([['(', [1, 2]], ['(', 9], 8]);
        expect(j('[(1,2,3),(9),8]')).toMatchObject([['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('[(1),(9),(8)]')).toMatchObject([['(', 1], ['(', 9], ['(', 8]]);
        expect(j('[(1),(8,9)]')).toMatchObject([['(', 1], ['(', [8, 9]]]);
        expect(j('[(1,2),(8,9)]')).toMatchObject([['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('[(1,2,3),(8,9)]')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('[(1),(8,9),8]')).toMatchObject([['(', 1], ['(', [8, 9]], 8]);
        expect(j('[(1,2),(8,9),8]')).toMatchObject([['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('[(1,2,3),(8,9),8]')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('[0,(1)]')).toMatchObject([0, ['(', 1]]);
        expect(j('[0,(1,2)]')).toMatchObject([0, ['(', [1, 2]]]);
        expect(j('[0,(1,2,3)]')).toMatchObject([0, ['(', [1, 2, 3]]]);
        expect(j('[0,(1),9]')).toMatchObject([0, ['(', 1], 9]);
        expect(j('[0,(1,2),9]')).toMatchObject([0, ['(', [1, 2]], 9]);
        expect(j('[0,(1,2,3),9]')).toMatchObject([0, ['(', [1, 2, 3]], 9]);
        expect(j('[0,(1),9,8]')).toMatchObject([0, ['(', 1], 9, 8]);
        expect(j('[0,(1,2),9,8]')).toMatchObject([0, ['(', [1, 2]], 9, 8]);
        expect(j('[0,(1,2,3),9,8]')).toMatchObject([0, ['(', [1, 2, 3]], 9, 8]);
        expect(j('[0,(1),(9)]')).toMatchObject([0, ['(', 1], ['(', 9]]);
        expect(j('[0,(1,2),(9)]')).toMatchObject([0, ['(', [1, 2]], ['(', 9]]);
        expect(j('[0,(1,2,3),(9)]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9]]);
        expect(j('[0,(1),(9),8]')).toMatchObject([0, ['(', 1], ['(', 9], 8]);
        expect(j('[0,(1,2),(9),8]')).toMatchObject([0, ['(', [1, 2]], ['(', 9], 8]);
        expect(j('[0,(1,2,3),(9),8]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('[0,(1),(8,9)]')).toMatchObject([0, ['(', 1], ['(', [8, 9]]]);
        expect(j('[0,(1,2),(8,9)]')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('[0,(1,2,3),(8,9)]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('[0,(1),(8,9),8]')).toMatchObject([0, ['(', 1], ['(', [8, 9]], 8]);
        expect(j('[0,(1,2),(8,9),8]')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('[0,(1,2,3),(8,9),8]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('(1)')).toMatchObject(['(', 1]);
        expect(j('(1,2)')).toMatchObject(['(', [1, 2]]);
        expect(j('(1,2,3)')).toMatchObject(['(', [1, 2, 3]]);
        expect(j('(1),9')).toMatchObject([['(', 1], 9]);
        expect(j('(1,2),9')).toMatchObject([['(', [1, 2]], 9]);
        expect(j('(1,2,3),9')).toMatchObject([['(', [1, 2, 3]], 9]);
        expect(j('(1),9,8')).toMatchObject([['(', 1], 9, 8]);
        expect(j('(1,2),9,8')).toMatchObject([['(', [1, 2]], 9, 8]);
        expect(j('(1,2,3),9,8')).toMatchObject([['(', [1, 2, 3]], 9, 8]);
        expect(j('(1),(9)')).toMatchObject([['(', 1], ['(', 9]]);
        expect(j('(1,2),(9)')).toMatchObject([['(', [1, 2]], ['(', 9]]);
        expect(j('(1,2,3),(9)')).toMatchObject([['(', [1, 2, 3]], ['(', 9]]);
        expect(j('(1),(9),(8)')).toMatchObject([['(', 1], ['(', 9], ['(', 8]]);
        expect(j('(1),(9),8')).toMatchObject([['(', 1], ['(', 9], 8]);
        expect(j('(1,2),(9),8')).toMatchObject([['(', [1, 2]], ['(', 9], 8]);
        expect(j('(1,2,3),(9),8')).toMatchObject([['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('(1),(8,9)')).toMatchObject([['(', 1], ['(', [8, 9]]]);
        expect(j('(1,2),(8,9)')).toMatchObject([['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('(1,2,3),(8,9)')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('(1),(8,9),8')).toMatchObject([['(', 1], ['(', [8, 9]], 8]);
        expect(j('(1,2),(8,9),8')).toMatchObject([['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('(1,2,3),(8,9),8')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('0,(1)')).toMatchObject([0, ['(', 1]]);
        expect(j('0,(1,2)')).toMatchObject([0, ['(', [1, 2]]]);
        expect(j('0,(1,2,3)')).toMatchObject([0, ['(', [1, 2, 3]]]);
        expect(j('0,(1),9')).toMatchObject([0, ['(', 1], 9]);
        expect(j('0,(1,2),9')).toMatchObject([0, ['(', [1, 2]], 9]);
        expect(j('0,(1,2,3),9')).toMatchObject([0, ['(', [1, 2, 3]], 9]);
        expect(j('0,(1),9,8')).toMatchObject([0, ['(', 1], 9, 8]);
        expect(j('0,(1,2),9,8')).toMatchObject([0, ['(', [1, 2]], 9, 8]);
        expect(j('0,(1,2,3),9,8')).toMatchObject([0, ['(', [1, 2, 3]], 9, 8]);
        expect(j('0,(1),(9)')).toMatchObject([0, ['(', 1], ['(', 9]]);
        expect(j('0,(1,2),(9)')).toMatchObject([0, ['(', [1, 2]], ['(', 9]]);
        expect(j('0,(1,2,3),(9)')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9]]);
        expect(j('0,(1),(9),8')).toMatchObject([0, ['(', 1], ['(', 9], 8]);
        expect(j('0,(1,2),(9),8')).toMatchObject([0, ['(', [1, 2]], ['(', 9], 8]);
        expect(j('0,(1,2,3),(9),8')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('0,(1),(8,9)')).toMatchObject([0, ['(', 1], ['(', [8, 9]]]);
        expect(j('0,(1,2),(8,9)')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('0,(1,2,3),(8,9)')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('0,(1),(8,9),8')).toMatchObject([0, ['(', 1], ['(', [8, 9]], 8]);
        expect(j('0,(1,2),(8,9),8')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('0,(1,2,3),(8,9),8')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
    });
    test('paren-list-implicit-structure-space', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('[(1)]')).toMatchObject([['(', 1]]);
        expect(j('[(1 2)]')).toMatchObject([['(', [1, 2]]]);
        expect(j('[(1 2 3)]')).toMatchObject([['(', [1, 2, 3]]]);
        expect(j('[(1) 9]')).toMatchObject([['(', 1], 9]);
        expect(j('[(1 2) 9]')).toMatchObject([['(', [1, 2]], 9]);
        expect(j('[(1 2 3) 9]')).toMatchObject([['(', [1, 2, 3]], 9]);
        expect(j('[(1) 9 8]')).toMatchObject([['(', 1], 9, 8]);
        expect(j('[(1 2) 9 8]')).toMatchObject([['(', [1, 2]], 9, 8]);
        expect(j('[(1 2 3) 9 8]')).toMatchObject([['(', [1, 2, 3]], 9, 8]);
        expect(j('[(1) (9)]')).toMatchObject([['(', 1], ['(', 9]]);
        expect(j('[(1 2) (9)]')).toMatchObject([['(', [1, 2]], ['(', 9]]);
        expect(j('[(1 2 3) (9)]')).toMatchObject([['(', [1, 2, 3]], ['(', 9]]);
        expect(j('[(1) (9) (8)]')).toMatchObject([['(', 1], ['(', 9], ['(', 8]]);
        expect(j('[(1) (9) 8]')).toMatchObject([['(', 1], ['(', 9], 8]);
        expect(j('[(1 2) (9) 8]')).toMatchObject([['(', [1, 2]], ['(', 9], 8]);
        expect(j('[(1 2 3) (9) 8]')).toMatchObject([['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('[(1) (8,9)]')).toMatchObject([['(', 1], ['(', [8, 9]]]);
        expect(j('[(1 2) (8,9)]')).toMatchObject([['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('[(1 2 3) (8,9)]')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('[(1) (8,9),8]')).toMatchObject([['(', 1], ['(', [8, 9]], 8]);
        expect(j('[(1 2) (8,9),8]')).toMatchObject([['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('[(1 2 3) (8,9),8]')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('[0 (1)]')).toMatchObject([0, ['(', 1]]);
        expect(j('[0 (1 2)]')).toMatchObject([0, ['(', [1, 2]]]);
        expect(j('[0 (1 2 3)]')).toMatchObject([0, ['(', [1, 2, 3]]]);
        expect(j('[0 (1) 9]')).toMatchObject([0, ['(', 1], 9]);
        expect(j('[0 (1 2) 9]')).toMatchObject([0, ['(', [1, 2]], 9]);
        expect(j('[0 (1 2 3) 9]')).toMatchObject([0, ['(', [1, 2, 3]], 9]);
        expect(j('[0 (1) 9 8]')).toMatchObject([0, ['(', 1], 9, 8]);
        expect(j('[0 (1 2) 9 8]')).toMatchObject([0, ['(', [1, 2]], 9, 8]);
        expect(j('[0 (1 2 3) 9 8]')).toMatchObject([0, ['(', [1, 2, 3]], 9, 8]);
        expect(j('[0 (1) (9)]')).toMatchObject([0, ['(', 1], ['(', 9]]);
        expect(j('[0 (1 2) (9)]')).toMatchObject([0, ['(', [1, 2]], ['(', 9]]);
        expect(j('[0 (1 2 3) (9)]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9]]);
        expect(j('[0 (1) (9) 8]')).toMatchObject([0, ['(', 1], ['(', 9], 8]);
        expect(j('[0 (1 2) (9) 8]')).toMatchObject([0, ['(', [1, 2]], ['(', 9], 8]);
        expect(j('[0 (1 2 3) (9) 8]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('[0 (1) (8 9)]')).toMatchObject([0, ['(', 1], ['(', [8, 9]]]);
        expect(j('[0 (1 2) (8 9)]')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('[0 (1 2 3) (8 9)]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('[0 (1) (8 9) 8]')).toMatchObject([0, ['(', 1], ['(', [8, 9]], 8]);
        expect(j('[0 (1 2) (8 9) 8]')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('[0 (1 2 3) (8 9) 8]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('(1)')).toMatchObject(['(', 1]);
        expect(j('(1 2)')).toMatchObject(['(', [1, 2]]);
        expect(j('(1 2 3)')).toMatchObject(['(', [1, 2, 3]]);
        expect(j('(1) 9')).toMatchObject([['(', 1], 9]);
        expect(j('(1 2) 9')).toMatchObject([['(', [1, 2]], 9]);
        expect(j('(1 2 3) 9')).toMatchObject([['(', [1, 2, 3]], 9]);
        expect(j('(1) 9 8')).toMatchObject([['(', 1], 9, 8]);
        expect(j('(1 2) 9 8')).toMatchObject([['(', [1, 2]], 9, 8]);
        expect(j('(1 2 3) 9 8')).toMatchObject([['(', [1, 2, 3]], 9, 8]);
        expect(j('(1) (9)')).toMatchObject([['(', 1], ['(', 9]]);
        expect(j('(1 2) (9)')).toMatchObject([['(', [1, 2]], ['(', 9]]);
        expect(j('(1 2 3) (9)')).toMatchObject([['(', [1, 2, 3]], ['(', 9]]);
        expect(j('(1) (9) 8')).toMatchObject([['(', 1], ['(', 9], 8]);
        expect(j('(1 2) (9) 8')).toMatchObject([['(', [1, 2]], ['(', 9], 8]);
        expect(j('(1 2 3) (9) 8')).toMatchObject([['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('(1) (9) (8)')).toMatchObject([['(', 1], ['(', 9], ['(', 8]]);
        expect(j('(1) (8 9)')).toMatchObject([['(', 1], ['(', [8, 9]]]);
        expect(j('(1 2) (8 9)')).toMatchObject([['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('(1 2 3) (8 9)')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('(1) (8 9) 8')).toMatchObject([['(', 1], ['(', [8, 9]], 8]);
        expect(j('(1 2) (8 9) 8')).toMatchObject([['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('(1 2 3) (8 9) 8')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]], 8]);
        expect(j('0 (1)')).toMatchObject([0, ['(', 1]]);
        expect(j('0 (1 2)')).toMatchObject([0, ['(', [1, 2]]]);
        expect(j('0 (1 2 3)')).toMatchObject([0, ['(', [1, 2, 3]]]);
        expect(j('0 (1) 9')).toMatchObject([0, ['(', 1], 9]);
        expect(j('0 (1 2) 9')).toMatchObject([0, ['(', [1, 2]], 9]);
        expect(j('0 (1 2 3) 9')).toMatchObject([0, ['(', [1, 2, 3]], 9]);
        expect(j('0 (1) 9 8')).toMatchObject([0, ['(', 1], 9, 8]);
        expect(j('0 (1 2) 9 8')).toMatchObject([0, ['(', [1, 2]], 9, 8]);
        expect(j('0 (1 2 3) 9 8')).toMatchObject([0, ['(', [1, 2, 3]], 9, 8]);
        expect(j('0 (1) (9)')).toMatchObject([0, ['(', 1], ['(', 9]]);
        expect(j('0 (1 2) (9)')).toMatchObject([0, ['(', [1, 2]], ['(', 9]]);
        expect(j('0 (1 2 3) (9)')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9]]);
        expect(j('0 (1) (9) 8')).toMatchObject([0, ['(', 1], ['(', 9], 8]);
        expect(j('0 (1 2) (9) 8')).toMatchObject([0, ['(', [1, 2]], ['(', 9], 8]);
        expect(j('0 (1 2 3) (9) 8')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9], 8]);
        expect(j('0 (1) (8 9)')).toMatchObject([0, ['(', 1], ['(', [8, 9]]]);
        expect(j('0 (1 2) (8 9)')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]]]);
        expect(j('0 (1 2 3) (8 9)')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]]]);
        expect(j('0 (1) (8 9) 8')).toMatchObject([0, ['(', 1], ['(', [8, 9]], 8]);
        expect(j('0 (1 2) (8 9) 8')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]], 8]);
        expect(j('0 (1 2 3) (8 9) 8')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8]);
    });
    test('paren-implicit-list', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('(a)')).toMatchObject(['(', 'a']);
        expect(j('(a,b)')).toMatchObject(['(', ['a', 'b']]);
        expect(j('(a,b,c)')).toMatchObject(['(', ['a', 'b', 'c']]);
        expect(j('(a,b,c,d)')).toMatchObject(['(', ['a', 'b', 'c', 'd']]);
        expect(j('(1,2)')).toMatchObject(['(', [1, 2]]);
        expect(j('(1+2,3)')).toMatchObject(['(', [['+', 1, 2], 3]]);
        expect(j('(1+2+3,4)')).toMatchObject(['(', [['+', ['+', 1, 2], 3], 4]]);
        expect(j('(1+2+3+4,5)')).toMatchObject(['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]]);
        expect(j('(1+2,3,4)')).toMatchObject(['(', [['+', 1, 2], 3, 4]]);
        expect(j('(1+2,3+4,5)')).toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], 5]]);
        expect(j('(1+2,3+4,5+6)'))
            .toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        expect(j('(a b)')).toMatchObject(['(', ['a', 'b']]);
        expect(j('(a b c)')).toMatchObject(['(', ['a', 'b', 'c']]);
        expect(j('(1+2 3)')).toMatchObject(['(', [['+', 1, 2], 3]]);
        expect(j('(1+2 3 4)')).toMatchObject(['(', [['+', 1, 2], 3, 4]]);
        expect(j('(1+2 3+4 5)')).toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], 5]]);
        expect(j('(1+2 3+4 5+6)'))
            .toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        // Default pure paren does not have a prefix, so this is an implicit list.
        expect(j('foo(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]]);
        expect(j('foo,(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]]);
        expect(j('foo (1,a)')).toMatchObject(['foo', ['(', [1, 'a']]]);
    });
    test('paren-implicit-map', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('(a:1,b:2)')).toMatchObject(['(', { a: 1, b: 2 }]);
        expect(j('(a:1 b:2)')).toMatchObject(['(', { a: 1, b: 2 }]);
        expect(j('(a:1,b:2,c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }]);
        expect(j('(a:1 b:2 c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }]);
        expect(j('(a:1+2,b:3)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3 }]);
        expect(j('(a:1+2,b:3,c:4)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3, c: 4 }]);
        expect(j('(a:1+2,b:3+4,c:5)'))
            .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }]);
        expect(j('(a:1+2,b:3+4,c:5+6)'))
            .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }]);
        expect(j('(a:1+2 b:3)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3 }]);
        expect(j('(a:1+2 b:3 c:4)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3, c: 4 }]);
        expect(j('(a:1+2 b:3+4 c:5)'))
            .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }]);
        expect(j('(a:1+2 b:3+4 c:5+6)'))
            .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }]);
    });
    test('add-paren', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            paren: {
                angle: {
                    osrc: '<', csrc: '>'
                }
            }
        });
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('<1>')).toMatchObject(['<', 1]);
        expect(j('<<1>>')).toMatchObject(['<', ['<', 1]]);
        expect(j('(<1>)')).toMatchObject(['(', ['<', 1]]);
        expect(j('<(1)>')).toMatchObject(['<', ['(', 1]]);
        expect(() => j('<1)')).toThrow('unexpected');
        expect(j('1*(2+3)')).toMatchObject(['*', 1, ['(', ['+', 2, 3]]]);
        expect(j('1*<2+3>')).toMatchObject(['*', 1, ['<', ['+', 2, 3]]]);
    });
    test('paren-preval-basic', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            paren: {
                pure: {
                    preval: true,
                },
                angle: {
                    osrc: '<',
                    csrc: '>',
                    preval: true,
                }
            }
        });
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('(1)')).toMatchObject(['(', 1]);
        // This has a paren preval.
        expect(j('foo(1,a)')).toMatchObject(['(', 'foo', [1, 'a']]);
        expect(j('foo (1,a)')).toMatchObject(['(', 'foo', [1, 'a']]);
        expect(j('foo(a:1,b:2)')).toMatchObject(['(', 'foo', { a: 1, b: 2 }]);
        expect(j('foo(a:b:1,c:2)')).toMatchObject(['(', 'foo', { a: { b: 1 }, c: 2 }]);
        expect(j('a:b<c>')).toMatchObject({ a: ['<', 'b', 'c'] });
        expect(j('a:b<c,d>')).toMatchObject({ a: ['<', 'b', ['c', 'd']] });
        expect(j('a:b<1+2,3+4>'))
            .toMatchObject({ a: ['<', 'b', [['+', 1, 2], ['+', 3, 4]]] });
    });
    test('paren-postval-basic', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            paren: {
                angle: {
                    osrc: '<',
                    csrc: '>',
                    postval: true,
                }
            }
        });
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('<1>2')).toMatchObject(['<', 1, 2]);
    });
    // test('paren-preval-square', () => {
    //   const je = Jsonic.make().use(Expr, {
    //     paren: {
    //       square: {
    //         osrc: '[',
    //         csrc: ']',
    //         preval: { require: true },
    //       }
    //     }
    //   })
    //   const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))
    //   expect(j('a[1]')).toMatchObject(['[', 'a', 1])
    //   expect(j('a:[1]')).toMatchObject({ a: [1] })
    // })
    test('paren-preval-implicit', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            paren: {
                pure: {
                    preval: true
                }
            }
        });
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        // But this is an implicit list.
        expect(j('foo,(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]]);
        expect(j('foo,(1+2,a)')).toMatchObject(['foo', ['(', [['+', 1, 2], 'a']]]);
        expect(j('foo,(1+2+3,a)'))
            .toMatchObject(['foo', ['(', [['+', ['+', 1, 2], 3], 'a']]]);
    });
    test('add-infix', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            op: {
                foo: {
                    infix: true, left: 180, right: 190, src: 'foo'
                }
            }
        });
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('1 foo 2')).toMatchObject(['foo', 1, 2]);
    });
    // test('new-existing-token-cs', () => {
    //   const je = Jsonic.make().use(Expr, {
    //     op: {
    //       cs: {
    //         order: 2, bp: [160, 170], src: ']'
    //       }
    //     }
    //   })
    //   const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))
    //   expect(j('1 ] 2')).toMatchObject([']', 1, 2])
    //   expect(j('a: 1 ] 2')).toMatchObject({ "a": ["]", 1, 2] })
    // })
    // test('new-existing-token-os', () => {
    //   const je = Jsonic.make().use(Expr, {
    //     op: {
    //       cs: {
    //         order: 2, bp: [160, 170], src: '['
    //       }
    //     }
    //   })
    //   const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))
    //   expect(j('1 [ 2')).toMatchObject(['[', 1, 2])
    //   expect(j('a: 1 [ 2')).toMatchObject({ "a": ["[", 1, 2] })
    // })
});
//# sourceMappingURL=expr.test.js.map