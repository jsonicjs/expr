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
    test('unary-prefix', () => {
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
        // Default pure paren does not have a prefix, so this is an implicit list.
        expect(j('foo(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]]);
        expect(j('foo,(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]]);
        expect(j('foo (1,a)')).toMatchObject(['foo', ['(', [1, 'a']]]);
        expect(j('(a:1,b:2)')).toMatchObject(['(', { a: 1, b: 2 }]);
        expect(j('(a:1 b:2)')).toMatchObject(['(', { a: 1, b: 2 }]);
        expect(j('(a:1,b:2,c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }]);
        expect(j('(a:1 b:2 c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }]);
        // Implict lists inside parens
        expect(j('(1+2,3)')).toMatchObject(['(', [['+', 1, 2], 3]]);
        expect(j('(1+2,3,4)')).toMatchObject(['(', [['+', 1, 2], 3, 4]]);
        expect(j('(1+2,3+4,5)')).toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], 5]]);
        expect(j('(1+2,3+4,5+6)'))
            .toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        expect(j('(1+2 3)')).toMatchObject(['(', [['+', 1, 2], 3]]);
        expect(j('(1+2 3 4)')).toMatchObject(['(', [['+', 1, 2], 3, 4]]);
        expect(j('(1+2 3+4 5)')).toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], 5]]);
        expect(j('(1+2 3+4 5+6)'))
            .toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]]);
        // Implict maps inside parens
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
    test('paren-prefix', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            paren: {
                pure: {
                    prefix: true
                }
            }
        });
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        // This has a paren prefix.
        expect(j('foo(1,a)')).toMatchObject(['(', 'foo', [1, 'a']]);
        expect(j('foo (1,a)')).toMatchObject(['(', 'foo', [1, 'a']]);
        // But this is an implicit list.
        expect(j('foo,(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]]);
        expect(j('foo,(1+2,a)')).toMatchObject(['foo', ['(', [['+', 1, 2], 'a']]]);
        expect(j('foo,(1+2+3,a)'))
            .toMatchObject(['foo', ['(', [['+', ['+', 1, 2], 3], 'a']]]);
        expect(j('foo(a:1,b:2)')).toMatchObject(['(', 'foo', { a: 1, b: 2 }]);
        expect(j('foo(a:b:1,c:2)')).toMatchObject(['(', 'foo', { a: { b: 1 }, c: 2 }]);
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