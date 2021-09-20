"use strict";
/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
const jsonic_1 = require("jsonic");
const expr_1 = require("../expr");
describe('expr', () => {
    test('happy', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('1+2')).toMatchObject(['+', 1, 2]);
        expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2]);
    });
    test('unary-prefix', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        expect(j('-1')).toMatchObject(['-', 1]);
        expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2]);
        expect(j('-1+-2')).toMatchObject(['+', ['-', 1], ['-', 2]]);
        expect(j('1+-2')).toMatchObject(['+', 1, ['-', 2]]);
        expect(j('-2')).toMatchObject(['-', 2]);
        expect(j('-1+3')).toMatchObject(['+', ['-', 1], 3]);
        expect(j('-1+2+3')).toMatchObject(['+', ['+', ['-', 1], 2], 3]);
        expect(j('-1+-2+3')).toMatchObject(['+', ['+', ['-', 1], ['-', 2]], 3]);
        expect(j('1+-2+3')).toMatchObject(['+', ['+', 1, ['-', 2]], 3]);
        expect(j('-2+3')).toMatchObject(['+', ['-', 2], 3]);
    });
    test('paren', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        // expect(j('()')).toEqual(undefined)
        expect(j('(1)')).toEqual(1);
        expect(j('(1+2)')).toMatchObject(['+', 1, 2]);
        expect(j('(1+2+3)')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('(1+2+3+4)')).toMatchObject(['+', ['+', ['+', 1, 2], 3], 4]);
        expect(j('(1+2)+3')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('1+(2+3)')).toMatchObject(['+', 1, ['+', 2, 3]]);
        expect(j('(1)+2+3')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('1+(2)+3')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('1+2+(3)')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('1+(2)+(3)')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('(1)+2+(3)')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('(1)+(2)+3')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('(1)+(2)+(3)')).toMatchObject(['+', ['+', 1, 2], 3]);
        expect(j('(1+2)*3')).toMatchObject(['*', ['+', 1, 2], 3]);
        expect(j('1*(2+3)')).toMatchObject(['*', 1, ['+', 2, 3]]);
    });
    test('new-binary', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr, {
            op: {
                foo: {
                    order: 2, bp: [160, 170], src: 'foo'
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
    //   // console.log(je.rule('val').def.close[0])
    //   // NOTE: this correctly uses ] as an op - the gammar is ambiguous!
    //   console.log(j('[1 ] 2]'))
    //   console.log(j('{a:1 ] 2}'))
    //   expect(j('1 ] 2')).toMatchObject([']', 1, 2])
    //   // expect(j('[1 ] 2]')).toMatchObject([[']', 1, 2]])
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
    //   // console.log(je.rule('val').def.close[0])
    //   // TODO: fix
    //   console.log(j('[1 [ 2]'))
    //   console.log(j('{a:1 [ 2}'))
    //   expect(j('1 [ 2')).toMatchObject(['[', 1, 2])
    //   // expect(j('[1 ] 2]')).toMatchObject([[']', 1, 2]])
    // })
});
//# sourceMappingURL=expr.test.js.map