/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */


import { Jsonic } from 'jsonic'
import { Expr } from '../expr'




describe('expr', () => {

  test('happy', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('1+2')).toMatchObject(['+', 1, 2])
    expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2])
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

    // console.log(je.rule('val').def.close[0])

    // TODO: fix
    console.log(j('[1 ] 2]'))
    console.log(j('{a:1 ] 2}'))

    expect(j('1 ] 2')).toMatchObject([']', 1, 2])
    // expect(j('[1 ] 2]')).toMatchObject([[']', 1, 2]])
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

    // console.log(je.rule('val').def.close[0])

    // TODO: fix
    console.log(j('[1 [ 2]'))
    console.log(j('{a:1 [ 2}'))

    expect(j('1 [ 2')).toMatchObject(['[', 1, 2])
    // expect(j('[1 ] 2]')).toMatchObject([[']', 1, 2]])
  })



})


