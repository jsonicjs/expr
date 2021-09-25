"use strict";
/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
const jsonic_1 = require("jsonic");
const expr_1 = require("../expr");
const mj = (je) => (s, m) => JSON.parse(JSON.stringify(je(s, m)));
const _mo_ = 'toMatchObject';
describe('expr', () => {
    test('happy', () => {
        const j = mj(jsonic_1.Jsonic.make().use(expr_1.Expr));
        expect(j('1+2')).toMatchObject(['+', 1, 2]);
        // expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2])
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
    // test('unary-prefix', () => {
    //   const je = Jsonic.make().use(Expr)
    //   const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))
    //   expect(j('-1')).toMatchObject(['-', 1])
    //   expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2])
    //   expect(j('-1+-2')).toMatchObject(['+', ['-', 1], ['-', 2]])
    //   expect(j('1+-2')).toMatchObject(['+', 1, ['-', 2]])
    //   expect(j('-2')).toMatchObject(['-', 2])
    //   expect(j('-1+3')).toMatchObject(['+', ['-', 1], 3])
    //   expect(j('-1+2+3')).toMatchObject(['+', ['+', ['-', 1], 2], 3])
    //   // expect(j('-1+-2+3')).toMatchObject(['+', ['+', ['-', 1], ['-', 2]], 3])
    //   // expect(j('1+-2+3')).toMatchObject(['+', ['+', 1, ['-', 2]], 3])
    //   // expect(j('-2+3')).toMatchObject(['+', ['-', 2], 3])
    // })
    test('paren', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        // TODO
        // expect(j('()')).toMatchObject(['('])
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
        expect(j('(a,b)')).toMatchObject(['(', ['a', 'b']]);
        expect(j('(a b)')).toMatchObject(['(', ['a', 'b']]);
        expect(j('(a,b,c)')).toMatchObject(['(', ['a', 'b', 'c']]);
        expect(j('(a b c)')).toMatchObject(['(', ['a', 'b', 'c']]);
        expect(j('({})')).toMatchObject(['(', {}]);
        expect(j('({a:1})')).toMatchObject(['(', { a: 1 }]);
        expect(j('({a:1,b:2})')).toMatchObject(['(', { a: 1, b: 2 }]);
        expect(j('({a:1 b:2})')).toMatchObject(['(', { a: 1, b: 2 }]);
        expect(j('({a:1,b:2,c:3})')).toMatchObject(['(', { a: 1, b: 2, c: 3 }]);
        expect(j('({a:1 b:2 c:3})')).toMatchObject(['(', { a: 1, b: 2, c: 3 }]);
        expect(j('(a:1)')).toMatchObject(['(', { a: 1 }]);
        // TODO: fix jsonic grammar
        // expect(j('(a:1,b:2)')).toMatchObject(['(', { a: 1, b: 2 }])
        // expect(j('(a:1 b:2)')).toMatchObject(['(', { a: 1, b: 2 }])
        // expect(j('(a:1,b:2,c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }])
        // expect(j('(a:1 b:2 c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }])
    });
    // test('new-binary', () => {
    //   const je = Jsonic.make().use(Expr, {
    //     op: {
    //       foo: {
    //         order: 2, bp: [160, 170], src: 'foo'
    //       }
    //     }
    //   })
    //   const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))
    //   expect(j('1 foo 2')).toMatchObject(['foo', 1, 2])
    // })
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