/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */


import { Jsonic } from 'jsonic'
import { Expr } from '../expr'



const mj =
  (je: Jsonic) => (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))


const _mo_ = 'toMatchObject'

describe('expr', () => {

  test('happy', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('1+2')).toMatchObject(['+', 1, 2])
    // expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2])
  })


  test('binary', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('1+2'))[_mo_](['+', 1, 2])
    expect(j('1*2'))[_mo_](['*', 1, 2])


    expect(j('1+2+3'))[_mo_](['+', ['+', 1, 2], 3])

    expect(j('1*2+3'))[_mo_](['+', ['*', 1, 2], 3])
    expect(j('1+2*3'))[_mo_](['+', 1, ['*', 2, 3]])

    expect(j('1*2*3'))[_mo_](['*', ['*', 1, 2], 3])


    expect(j('1+2+3+4'))[_mo_](['+', ['+', ['+', 1, 2], 3], 4])

    expect(j('1*2+3+4'))[_mo_](['+', ['+', ['*', 1, 2], 3], 4])
    expect(j('1+2*3+4'))[_mo_](['+', 1, ['+', ['*', 2, 3], 4]])
    expect(j('1+2+3*4'))[_mo_](['+', ['+', 1, 2], ['*', 3, 4]])

    expect(j('1+2*3*4'))[_mo_](['+', 1, ['*', ['*', 2, 3], 4]])
    expect(j('1*2+3*4'))[_mo_](['+', ['*', 1, 2], ['*', 3, 4]])
    expect(j('1*2*3+4'))[_mo_](['+', ['*', ['*', 1, 2], 3], 4])

    expect(j('1*2*3*4'))[_mo_](['*', ['*', ['*', 1, 2], 3], 4])


    expect(j('1+2+3+4+5'))[_mo_](['+', ['+', ['+', ['+', 1, 2], 3], 4], 5])

    expect(j('1*2+3+4+5'))[_mo_](['+', ['+', ['+', ['*', 1, 2], 3], 4], 5])
    expect(j('1+2*3+4+5'))[_mo_](['+', 1, ['+', ['+', ['*', 2, 3], 4], 5]])
    expect(j('1+2+3*4+5'))[_mo_](['+', ['+', 1, 2], ['+', ['*', 3, 4], 5]])
    expect(j('1+2+3+4*5'))[_mo_](['+', ['+', ['+', 1, 2], 3], ['*', 4, 5]])

    expect(j('1*2*3+4+5'))[_mo_](['+', ['+', ['*', ['*', 1, 2], 3], 4], 5])
    expect(j('1+2*3*4+5'))[_mo_](['+', 1, ['+', ['*', ['*', 2, 3], 4], 5]])
    expect(j('1+2+3*4*5'))[_mo_](['+', ['+', 1, 2], ['*', ['*', 3, 4], 5]])
    expect(j('1*2+3+4*5'))[_mo_](['+', ['+', ['*', 1, 2], 3], ['*', 4, 5]])
    expect(j('1*2+3*4+5'))[_mo_](['+', ['*', 1, 2], ['+', ['*', 3, 4], 5]])
    expect(j('1+2*3+4*5'))[_mo_](['+', 1, ['+', ['*', 2, 3], ['*', 4, 5]]])

    expect(j('1+2*3*4*5'))[_mo_](['+', 1, ['*', ['*', ['*', 2, 3], 4], 5]])
    expect(j('1*2+3*4*5'))[_mo_](['+', ['*', 1, 2], ['*', ['*', 3, 4], 5]])
    expect(j('1*2*3+4*5'))[_mo_](['+', ['*', ['*', 1, 2], 3], ['*', 4, 5]])
    expect(j('1*2*3*4+5'))[_mo_](['+', ['*', ['*', ['*', 1, 2], 3], 4], 5])


    expect(j('1*2*3*4*5'))[_mo_](['*', ['*', ['*', ['*', 1, 2], 3], 4], 5])
  })


  test('structure', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('a:1+2'))[_mo_]({ a: ['+', 1, 2] })
    expect(j('a:1+2,b:3+4'))[_mo_]({ a: ['+', 1, 2], b: ['+', 3, 4] })

    expect(j('[1+2]'))[_mo_]([['+', 1, 2]])
    expect(j('[1+2,3+4]'))[_mo_]([['+', 1, 2], ['+', 3, 4]])

    expect(j('{a:[1+2]}'))[_mo_]({ a: [['+', 1, 2]] })

  })


  test('unary-prefix', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    // expect(j('-1')).toMatchObject(['-', 1])
    expect(j('-1')).toMatchObject(['', ['-', 1]])
    expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2])
    expect(j('-1+-2')).toMatchObject(['+', ['-', 1], ['-', 2]])
    expect(j('1+-2')).toMatchObject(['+', 1, ['-', 2]])
    expect(j('-2')).toMatchObject(['', ['-', 2]])

    expect(j('-1+3')).toMatchObject(['+', ['-', 1], 3])
    expect(j('-1+2+3')).toMatchObject(['+', ['+', ['-', 1], 2], 3])
    expect(j('-1+-2+3')).toMatchObject(['+', ['+', ['-', 1], ['-', 2]], 3])
    expect(j('1+-2+3')).toMatchObject(['+', ['+', 1, ['-', 2]], 3])
    expect(j('-2+3')).toMatchObject(['+', ['-', 2], 3])
  })


  test('paren', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    // expect(j('()')).toEqual(undefined)
    // expect(j('(1)')).toEqual(1)
    expect(j('(1)')).toMatchObject(['', 1])
    expect(j('(1+2)')).toMatchObject(['+', 1, 2])
    expect(j('(1+2+3)')).toMatchObject(['+', ['+', 1, 2], 3])
    expect(j('(1+2+3+4)')).toMatchObject(['+', ['+', ['+', 1, 2], 3], 4])

    expect(j('(1+2)+3')).toMatchObject(['+', ['+', 1, 2], 3])
    expect(j('1+(2+3)')).toMatchObject(['+', 1, ['+', 2, 3]])

    expect(j('(1)+2+3')).toMatchObject(['+', ['+', ['', 1], 2], 3])
    expect(j('1+(2)+3')).toMatchObject(['+', ['+', 1, 2], 3])
    expect(j('1+2+(3)')).toMatchObject(['+', ['+', 1, 2], 3])
    expect(j('1+(2)+(3)')).toMatchObject(['+', ['+', 1, 2], 3])
    expect(j('(1)+2+(3)')).toMatchObject(['+', ['+', 1, 2], 3])
    expect(j('(1)+(2)+3')).toMatchObject(['+', ['+', 1, 2], 3])
    expect(j('(1)+(2)+(3)')).toMatchObject(['+', ['+', 1, 2], 3])

    expect(j('(1+2)*3')).toMatchObject(['*', ['+', 1, 2], 3])
    expect(j('1*(2+3)')).toMatchObject(['*', 1, ['+', 2, 3]])

  })


  test('new-binary', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        foo: {
          order: 2, bp: [160, 170], src: 'foo'
        }
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('1 foo 2')).toMatchObject(['foo', 1, 2])
  })


  test('new-existing-token-cs', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        cs: {
          order: 2, bp: [160, 170], src: ']'
        }
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('1 ] 2')).toMatchObject([']', 1, 2])
    expect(j('a: 1 ] 2')).toMatchObject({ "a": ["]", 1, 2] })
  })


  test('new-existing-token-os', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        cs: {
          order: 2, bp: [160, 170], src: '['
        }
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('1 [ 2')).toMatchObject(['[', 1, 2])
    expect(j('a: 1 [ 2')).toMatchObject({ "a": ["[", 1, 2] })
  })



})


