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
    expect(j('1+2*3+4'))[_mo_](['+', ['+', 1, ['*', 2, 3]], 4])
    expect(j('1+2+3*4'))[_mo_](['+', ['+', 1, 2], ['*', 3, 4]])

    expect(j('1+2*3*4'))[_mo_](['+', 1, ['*', ['*', 2, 3], 4]])
    expect(j('1*2+3*4'))[_mo_](['+', ['*', 1, 2], ['*', 3, 4]])
    expect(j('1*2*3+4'))[_mo_](['+', ['*', ['*', 1, 2], 3], 4])

    expect(j('1*2*3*4'))[_mo_](['*', ['*', ['*', 1, 2], 3], 4])


    expect(j('1+2+3+4+5'))[_mo_](['+', ['+', ['+', ['+', 1, 2], 3], 4], 5])

    expect(j('1*2+3+4+5'))[_mo_](['+', ['+', ['+', ['*', 1, 2], 3], 4], 5])
    expect(j('1+2*3+4+5'))[_mo_](['+', ['+', ['+', 1, ['*', 2, 3]], 4], 5])
    expect(j('1+2+3*4+5'))[_mo_](['+', ['+', ['+', 1, 2], ['*', 3, 4]], 5])
    expect(j('1+2+3+4*5'))[_mo_](['+', ['+', ['+', 1, 2], 3], ['*', 4, 5]])

    expect(j('1*2*3+4+5'))[_mo_](['+', ['+', ['*', ['*', 1, 2], 3], 4], 5])
    expect(j('1+2*3*4+5'))[_mo_](['+', ['+', 1, ['*', ['*', 2, 3], 4]], 5])
    expect(j('1+2+3*4*5'))[_mo_](['+', ['+', 1, 2], ['*', ['*', 3, 4], 5]])
    expect(j('1*2+3+4*5'))[_mo_](['+', ['+', ['*', 1, 2], 3], ['*', 4, 5]])
    expect(j('1*2+3*4+5'))[_mo_](['+', ['+', ['*', 1, 2], ['*', 3, 4]], 5])
    expect(j('1+2*3+4*5'))[_mo_](['+', ['+', 1, ['*', 2, 3]], ['*', 4, 5]])

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


  // test('implicit-list-top-none', () => {
  //   const j = mj(Jsonic.make().use(Expr))

  //   expect(j('1,2'))[_mo_]([1, 2])
  //   expect(j('1+2,3'))[_mo_]([['+', 1, 2], 3])
  //   expect(j('1+2+3,4'))[_mo_]([['+', ['+', 1, 2], 3], 4])
  //   expect(j('1+2+3+4,5'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5])

  //   expect(j('1 2'))[_mo_]([1, 2])
  //   expect(j('1+2 3'))[_mo_]([['+', 1, 2], 3])
  //   expect(j('1+2+3 4'))[_mo_]([['+', ['+', 1, 2], 3], 4])
  //   expect(j('1+2+3+4 5'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5])

  //   expect(j('1,2,11'))[_mo_]([1, 2, 11])
  //   expect(j('1+2,3,11'))[_mo_]([['+', 1, 2], 3, 11])
  //   expect(j('1+2+3,4,11'))[_mo_]([['+', ['+', 1, 2], 3], 4, 11])
  //   expect(j('1+2+3+4,5,11'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

  //   expect(j('1 2 11'))[_mo_]([1, 2, 11])
  //   expect(j('1+2 3 11'))[_mo_]([['+', 1, 2], 3, 11])
  //   expect(j('1+2+3 4 11'))[_mo_]([['+', ['+', 1, 2], 3], 4, 11])
  //   expect(j('1+2+3+4 5 11'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

  //   expect(j('22,1,2,11'))[_mo_]([22, 1, 2, 11])
  //   expect(j('22,1+2,3,11'))[_mo_]([22, ['+', 1, 2], 3, 11])
  //   expect(j('22,1+2+3,4,11'))[_mo_]([22, ['+', ['+', 1, 2], 3], 4, 11])
  //   expect(j('22,1+2+3+4,5,11'))[_mo_]([22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

  //   expect(j('22 1 2 11'))[_mo_]([22, 1, 2, 11])
  //   expect(j('22 1+2 3 11'))[_mo_]([22, ['+', 1, 2], 3, 11])
  //   expect(j('22 1+2+3 4 11'))[_mo_]([22, ['+', ['+', 1, 2], 3], 4, 11])
  //   expect(j('22 1+2+3+4 5 11'))[_mo_]([22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

  //   expect(j('[true,false],1,2,11'))[_mo_]([[true, false], 1, 2, 11])
  //   expect(j('[true,false],1+2,3,11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11])
  //   expect(j('[true,false],1+2+3,4,11'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11])
  //   expect(j('[true,false],1+2+3+4,5,11'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

  //   expect(j('[true,false] 1 2 11'))[_mo_]([[true, false], 1, 2, 11])
  //   expect(j('[true,false] 1+2 3 11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11])
  //   expect(j('[true,false] 1+2+3 4 11'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11])
  //   expect(j('[true,false] 1+2+3+4 5 11'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

  //   expect(j('[true,false],1,2,{x:11,y:22}'))[_mo_]([[true, false], 1, 2, { x: 11, y: 22 }])
  //   expect(j('[true,false],1+2,3,{x:11,y:22}'))[_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }])
  //   expect(j('[true,false],1+2+3,4,{x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }])
  //   expect(j('[true,false],1+2+3+4,5,{x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }])

  //   expect(j('[true,false] 1 2 {x:11,y:22}'))[_mo_]([[true, false], 1, 2, { x: 11, y: 22 }])
  //   expect(j('[true,false] 1+2 3 {x:11,y:22}'))[_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }])
  //   expect(j('[true,false] 1+2+3 4 {x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }])
  //   expect(j('[true,false] 1+2+3+4 5 {x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }])


  //   expect(j('1+2,3+4'))[_mo_]([['+', 1, 2], ['+', 3, 4]])
  //   expect(j('1+2,3+4,5+6'))[_mo_]([['+', 1, 2], ['+', 3, 4], ['+', 5, 6]])
  // })


  test('implicit-list-top-paren', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('(1,2)'))[_mo_](['(', [1, 2]])
    expect(j('(1+2,3)'))[_mo_](['(', [['+', 1, 2], 3]])
    expect(j('(1+2+3,4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]])
    expect(j('(1+2+3+4,5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]])

    // expect(j('(1 2)'))[_mo_](['(', [1, 2]])
    // expect(j('(1+2 3)'))[_mo_](['(', [['+', 1, 2], 3]])
    // expect(j('(1+2+3 4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]])
    // expect(j('(1+2+3+4 5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]])

    expect(j('(1,2,11)'))[_mo_](['(', [1, 2, 11]])
    expect(j('(1+2,3,11)'))[_mo_](['(', [['+', 1, 2], 3, 11]])
    expect(j('(1+2+3,4,11)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('(1+2+3+4,5,11)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    // expect(j('(1 2 11)'))[_mo_](['(', [1, 2, 11]])
    // expect(j('(1+2 3 11)'))[_mo_](['(', [['+', 1, 2], 3, 11]])
    // expect(j('(1+2+3 4 11)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4, 11]])
    // expect(j('(1+2+3+4 5 11)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('(22,1,2,11)'))[_mo_](['(', [22, 1, 2, 11]])
    expect(j('(22,1+2,3,11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]])
    expect(j('(22,1+2+3,4,11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('(22,1+2+3+4,5,11)'))[_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    // expect(j('(22 1 2 11)'))[_mo_](['(', [22, 1, 2, 11]])
    // expect(j('(22 1+2 3 11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]])
    // expect(j('(22 1+2+3 4 11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]])
    // expect(j('(22 1+2+3+4 5 11)'))[_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('([true,false],1,2,11)'))[_mo_](['(', [[true, false], 1, 2, 11]])
    expect(j('([true,false],1+2,3,11)'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]])
    expect(j('([true,false],1+2+3,4,11)'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('([true,false],1+2+3+4,5,11)'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    // expect(j('([true,false] 1 2 11)'))[_mo_](['(', [[true, false], 1, 2, 11]])
    // expect(j('([true,false] 1+2 3 11)'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]])
    // expect(j('([true,false] 1+2+3 4 11)'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]])
    // expect(j('([true,false] 1+2+3+4 5 11)'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('([true,false],1,2,{x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2,3,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2+3,4,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2+3+4,5,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]])

    // expect(j('([true,false] 1 2 {x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]])
    // expect(j('([true,false] 1+2 3 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]])
    // expect(j('([true,false] 1+2+3 4 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]])
    // expect(j('([true,false] 1+2+3+4 5 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]])


    expect(j('(1+2,3+4)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4]]])
    expect(j('(1+2,3+4,5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]])
  })


  test('map-implicit-list-paren', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('a:(1,2),b:0'))[_mo_]({ a: ['(', [1, 2]], b: 0 })
    expect(j('a:(1+2,3),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 })
    expect(j('a:(1+2+3,4),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 })
    expect(j('a:(1+2+3+4,5),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 })
  })

  // //   expect(j('a:(1 2),b:0'))[_mo_]({ a: ['(', [1, 2]], b: 0 })
  // //   expect(j('a:(1+2 3),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 })
  // //   expect(j('a:(1+2+3 4),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 })
  // //   expect(j('a:(1+2+3+4 5),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 })

  // //   expect(j('a:(1,2,11),b:0'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 })
  // //   expect(j('a:(1+2,3,11),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('a:(1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('a:(1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('a:(1 2 11),b:0'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 })
  // //   expect(j('a:(1+2 3 11),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('a:(1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('a:(1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('a:(22,1,2,11),b:0'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 })
  // //   expect(j('a:(22,1+2,3,11),b:0'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('a:(22,1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('a:(22,1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('a:(22 1 2 11),b:0'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 })
  // //   expect(j('a:(22 1+2 3 11),b:0'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('a:(22 1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('a:(22 1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('a:([true,false],1,2,11),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 })
  // //   expect(j('a:([true,false],1+2,3,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('a:([true,false],1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('a:([true,false],1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('a:([true,false] 1 2 11),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 })
  // //   expect(j('a:([true,false] 1+2 3 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('a:([true,false] 1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('a:([true,false] 1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('a:([true,false],1,2,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('a:([true,false],1+2,3,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('a:([true,false],1+2+3,4,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('a:([true,false],1+2+3+4,5,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 })

  // //   expect(j('a:([true,false] 1 2 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('a:([true,false] 1+2 3 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('a:([true,false] 1+2+3 4 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('a:([true,false] 1+2+3+4 5 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 })


  // //   expect(j('{a:(1,2),b:0}'))[_mo_]({ a: ['(', [1, 2]], b: 0 })
  // //   expect(j('{a:(1+2,3),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 })
  // //   expect(j('{a:(1+2+3,4),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 })
  // //   expect(j('{a:(1+2+3+4,5),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 })

  // //   expect(j('{a:(1 2),b:0}'))[_mo_]({ a: ['(', [1, 2]], b: 0 })
  // //   expect(j('{a:(1+2 3),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 })
  // //   expect(j('{a:(1+2+3 4),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 })
  // //   expect(j('{a:(1+2+3+4 5),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 })

  // //   expect(j('{a:(1,2,11),b:0}'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 })
  // //   expect(j('{a:(1+2,3,11),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('{a:(1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('{a:(1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('{a:(1 2 11),b:0}'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 })
  // //   expect(j('{a:(1+2 3 11),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('{a:(1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('{a:(1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('{a:(22,1,2,11),b:0}'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 })
  // //   expect(j('{a:(22,1+2,3,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('{a:(22,1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('{a:(22,1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('{a:(22 1 2 11),b:0}'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 })
  // //   expect(j('{a:(22 1+2 3 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('{a:(22 1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('{a:(22 1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('{a:([true,false],1,2,11),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 })
  // //   expect(j('{a:([true,false],1+2,3,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('{a:([true,false],1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('{a:([true,false],1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('{a:([true,false] 1 2 11),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 })
  // //   expect(j('{a:([true,false] 1+2 3 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 })
  // //   expect(j('{a:([true,false] 1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
  // //   expect(j('{a:([true,false] 1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

  // //   expect(j('{a:([true,false],1,2,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('{a:([true,false],1+2,3,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('{a:([true,false],1+2+3,4,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('{a:([true,false],1+2+3+4,5,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 })

  // //   expect(j('{a:([true,false] 1 2 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('{a:([true,false] 1+2 3 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('{a:([true,false] 1+2+3 4 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 })
  // //   expect(j('{a:([true,false] 1+2+3+4 5 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 })

  // // })


  test('unary-prefix', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('1')).toEqual(1)
    expect(j('z')).toEqual('z')

    expect(j('-1')).toMatchObject(['-', 1])
    expect(j('- 1')).toMatchObject(['-', 1])
    expect(j('+1')).toMatchObject(['+', 1])
    expect(j('+ 1')).toMatchObject(['+', 1])

    expect(j('--1')).toMatchObject(['-', ['-', 1]])
    expect(j('---1')).toMatchObject(['-', ['-', ['-', 1]]])
    expect(j('++1')).toMatchObject(['+', ['+', 1]])
    expect(j('+++1')).toMatchObject(['+', ['+', ['+', 1]]])

    expect(j('-+1')).toMatchObject(['-', ['+', 1]])
    expect(j('+-1')).toMatchObject(['+', ['-', 1]])

    expect(j('--+1')).toMatchObject(['-', ['-', ['+', 1]]])
    expect(j('-+-1')).toMatchObject(['-', ['+', ['-', 1]]])
    expect(j('+--1')).toMatchObject(['+', ['-', ['-', 1]]])

    expect(j('-++1')).toMatchObject(['-', ['+', ['+', 1]]])
    expect(j('++-1')).toMatchObject(['+', ['+', ['-', 1]]])


    expect(j('-z')).toMatchObject(['-', 'z'])
    expect(j('- z')).toMatchObject(['-', 'z'])
    expect(j('+z')).toMatchObject(['+', 'z'])
    expect(j('+ z')).toMatchObject(['+', 'z'])

    expect(j('--z')).toMatchObject(['-', ['-', 'z']])
    expect(j('---z')).toMatchObject(['-', ['-', ['-', 'z']]])
    expect(j('++z')).toMatchObject(['+', ['+', 'z']])
    expect(j('+++z')).toMatchObject(['+', ['+', ['+', 'z']]])

    expect(j('-+z')).toMatchObject(['-', ['+', 'z']])
    expect(j('+-z')).toMatchObject(['+', ['-', 'z']])

    expect(j('--+z')).toMatchObject(['-', ['-', ['+', 'z']]])
    expect(j('-+-z')).toMatchObject(['-', ['+', ['-', 'z']]])
    expect(j('+--z')).toMatchObject(['+', ['-', ['-', 'z']]])

    expect(j('-++z')).toMatchObject(['-', ['+', ['+', 'z']]])
    expect(j('++-z')).toMatchObject(['+', ['+', ['-', 'z']]])


    expect(j('-{z:1}')).toMatchObject(['-', { z: 1 }])
    expect(j('- {z:1}')).toMatchObject(['-', { z: 1 }])
    expect(j('+{z:1}')).toMatchObject(['+', { z: 1 }])
    expect(j('+ {z:1}')).toMatchObject(['+', { z: 1 }])

    expect(j('--{z:1}')).toMatchObject(['-', ['-', { z: 1 }]])
    expect(j('---{z:1}')).toMatchObject(['-', ['-', ['-', { z: 1 }]]])
    expect(j('++{z:1}')).toMatchObject(['+', ['+', { z: 1 }]])
    expect(j('+++{z:1}')).toMatchObject(['+', ['+', ['+', { z: 1 }]]])

    expect(j('-+{z:1}')).toMatchObject(['-', ['+', { z: 1 }]])
    expect(j('+-{z:1}')).toMatchObject(['+', ['-', { z: 1 }]])

    expect(j('--+{z:1}')).toMatchObject(['-', ['-', ['+', { z: 1 }]]])
    expect(j('-+-{z:1}')).toMatchObject(['-', ['+', ['-', { z: 1 }]]])
    expect(j('+--{z:1}')).toMatchObject(['+', ['-', ['-', { z: 1 }]]])

    expect(j('-++{z:1}')).toMatchObject(['-', ['+', ['+', { z: 1 }]]])
    expect(j('++-{z:1}')).toMatchObject(['+', ['+', ['-', { z: 1 }]]])


    expect(j('-[11,22]')).toMatchObject(['-', [11, 22]])
    expect(j('- [11,22]')).toMatchObject(['-', [11, 22]])
    expect(j('+[11,22]')).toMatchObject(['+', [11, 22]])
    expect(j('+ [11,22]')).toMatchObject(['+', [11, 22]])

    expect(j('--[11,22]')).toMatchObject(['-', ['-', [11, 22]]])
    expect(j('---[11,22]')).toMatchObject(['-', ['-', ['-', [11, 22]]]])
    expect(j('++[11,22]')).toMatchObject(['+', ['+', [11, 22]]])
    expect(j('+++[11,22]')).toMatchObject(['+', ['+', ['+', [11, 22]]]])

    expect(j('-+[11,22]')).toMatchObject(['-', ['+', [11, 22]]])
    expect(j('+-[11,22]')).toMatchObject(['+', ['-', [11, 22]]])

    expect(j('--+[11,22]')).toMatchObject(['-', ['-', ['+', [11, 22]]]])
    expect(j('-+-[11,22]')).toMatchObject(['-', ['+', ['-', [11, 22]]]])
    expect(j('+--[11,22]')).toMatchObject(['+', ['-', ['-', [11, 22]]]])

    expect(j('-++[11,22]')).toMatchObject(['-', ['+', ['+', [11, 22]]]])
    expect(j('++-[11,22]')).toMatchObject(['+', ['+', ['-', [11, 22]]]])



    expect(j('1+2')).toMatchObject(['+', 1, 2])
    expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2])
    expect(j('--1+2')).toMatchObject(['+', ['-', ['-', 1]], 2])

    expect(j('-1+-2')).toMatchObject(['+', ['-', 1], ['-', 2]])
    expect(j('1+-2')).toMatchObject(['+', 1, ['-', 2]])
    expect(j('1++2')).toMatchObject(['+', 1, ['+', 2]])
    expect(j('-1++2')).toMatchObject(['+', ['-', 1], ['+', 2]])


    expect(j('-1+2+3')).toMatchObject(['+', ['+', ['-', 1], 2], 3])
    expect(j('-1+-2+3')).toMatchObject(['+', ['+', ['-', 1], ['-', 2]], 3])
    expect(j('-1+-2+-3')).toMatchObject(['+', ['+', ['-', 1], ['-', 2]], ['-', 3]])
    expect(j('-1+2+-3')).toMatchObject(['+', ['+', ['-', 1], 2], ['-', 3]])
    expect(j('1+2+3')).toMatchObject(['+', ['+', 1, 2], 3])
    expect(j('1+-2+3')).toMatchObject(['+', ['+', 1, ['-', 2]], 3])
    expect(j('1+-2+-3')).toMatchObject(['+', ['+', 1, ['-', 2]], ['-', 3]])
    expect(j('1+2+-3')).toMatchObject(['+', ['+', 1, 2], ['-', 3]])

  })


  test('paren', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    // TODO
    // expect(j('()')).toMatchObject(['('])

    expect(j('(1)')).toMatchObject(['(', 1])
    expect(j('(1+2)')).toMatchObject(['(', ['+', 1, 2]])
    expect(j('(1+2+3)')).toMatchObject(['(', ['+', ['+', 1, 2], 3]])
    expect(j('(1+2+3+4)')).toMatchObject(['(', ['+', ['+', ['+', 1, 2], 3], 4]])

    expect(j('((1))')).toMatchObject(['(', ['(', 1]])
    expect(j('(((1)))')).toMatchObject(['(', ['(', ['(', 1]]])
    expect(j('((((1))))')).toMatchObject(['(', ['(', ['(', ['(', 1]]]])

    expect(j('(1+2)+3')).toMatchObject(['+', ['(', ['+', 1, 2]], 3])
    expect(j('1+(2+3)')).toMatchObject(['+', 1, ['(', ['+', 2, 3]]])

    expect(j('((1+2))+3')).toMatchObject(['+', ['(', ['(', ['+', 1, 2]]], 3])
    expect(j('1+((2+3))')).toMatchObject(['+', 1, ['(', ['(', ['+', 2, 3]]]])


    expect(j('(1)+2+3')).toMatchObject(['+', ['+', ['(', 1], 2], 3])
    expect(j('1+(2)+3')).toMatchObject(['+', ['+', 1, ['(', 2]], 3])
    expect(j('1+2+(3)')).toMatchObject(['+', ['+', 1, 2], ['(', 3]])
    expect(j('1+(2)+(3)')).toMatchObject(['+', ['+', 1, ['(', 2]], ['(', 3]])
    expect(j('(1)+2+(3)')).toMatchObject(['+', ['+', ['(', 1], 2], ['(', 3]])
    expect(j('(1)+(2)+3')).toMatchObject(['+', ['+', ['(', 1], ['(', 2]], 3])
    expect(j('(1)+(2)+(3)')).toMatchObject(['+', ['+', ['(', 1], ['(', 2]], ['(', 3]])

    expect(j('(1+2)*3')).toMatchObject(['*', ['(', ['+', 1, 2]], 3])
    expect(j('1*(2+3)')).toMatchObject(['*', 1, ['(', ['+', 2, 3]]])

    expect(j('(a)')).toMatchObject(['(', 'a'])
    expect(j('("a")')).toMatchObject(['(', 'a'])
    expect(j('([])')).toMatchObject(['(', []])
    expect(j('([a])')).toMatchObject(['(', ['a']])
    expect(j('([a,b])')).toMatchObject(['(', ['a', 'b']])
    expect(j('([a b])')).toMatchObject(['(', ['a', 'b']])
    expect(j('([a,b,c])')).toMatchObject(['(', ['a', 'b', 'c']])
    expect(j('([a b c])')).toMatchObject(['(', ['a', 'b', 'c']])

    expect(j('({})')).toMatchObject(['(', {}])
    expect(j('({a:1})')).toMatchObject(['(', { a: 1 }])
    expect(j('({a:1,b:2})')).toMatchObject(['(', { a: 1, b: 2 }])
    expect(j('({a:1 b:2})')).toMatchObject(['(', { a: 1, b: 2 }])
    expect(j('({a:1,b:2,c:3})')).toMatchObject(['(', { a: 1, b: 2, c: 3 }])
    expect(j('({a:1 b:2 c:3})')).toMatchObject(['(', { a: 1, b: 2, c: 3 }])
    expect(j('(a:1)')).toMatchObject(['(', { a: 1 }])
  })


  test('paren-map-implicit-structure', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('{a:(1)}')).toMatchObject({ a: ['(', 1] })
    expect(j('{a:(1,2)}')).toMatchObject({ a: ['(', [1, 2]] })
    expect(j('{a:(1,2,3)}')).toMatchObject({ a: ['(', [1, 2, 3]] })


    expect(j('{a:(1),b:9}')).toMatchObject({ a: ['(', 1], b: 9 })
    expect(j('{a:(1,2),b:9}')).toMatchObject({ a: ['(', [1, 2]], b: 9 })
    expect(j('{a:(1,2,3),b:9}')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9 })

    expect(j('{a:(1),b:9,c:8}')).toMatchObject({ a: ['(', 1], b: 9, c: 8 })
    expect(j('{a:(1,2),b:9,c:8}')).toMatchObject({ a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('{a:(1,2,3),b:9,c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('{a:(1),b:(9)}')).toMatchObject({ a: ['(', 1], b: ['(', 9] })
    expect(j('{a:(1,2),b:(9)}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('{a:(1,2,3),b:(9)}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('{a:(1),b:(9),c:8}')).toMatchObject({ a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('{a:(1,2),b:(9),c:8}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('{a:(1,2,3),b:(9),c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('{a:(1),b:(8,9)}')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('{a:(1,2),b:(8,9)}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('{a:(1,2,3),b:(8,9)}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('{a:(1),b:(8,9),c:8}')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('{a:(1,2),b:(8,9),c:8}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('{a:(1,2,3),b:(8,9),c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })


    expect(j('{d:0,a:(1)}')).toMatchObject({ d: 0, a: ['(', 1] })
    expect(j('{d:0,a:(1,2)}')).toMatchObject({ d: 0, a: ['(', [1, 2]] })
    expect(j('{d:0,a:(1,2,3)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]] })


    expect(j('{d:0,a:(1),b:9}')).toMatchObject({ d: 0, a: ['(', 1], b: 9 })
    expect(j('{d:0,a:(1,2),b:9}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9 })
    expect(j('{d:0,a:(1,2,3),b:9}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9 })

    expect(j('{d:0,a:(1),b:9,c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: 9, c: 8 })
    expect(j('{d:0,a:(1,2),b:9,c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('{d:0,a:(1,2,3),b:9,c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('{d:0,a:(1),b:(9)}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9] })
    expect(j('{d:0,a:(1,2),b:(9)}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('{d:0,a:(1,2,3),b:(9)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('{d:0,a:(1),b:(9),c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('{d:0,a:(1,2),b:(9),c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('{d:0,a:(1,2,3),b:(9),c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('{d:0,a:(1),b:(8,9)}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('{d:0,a:(1,2),b:(8,9)}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('{d:0,a:(1,2,3),b:(8,9)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('{d:0,a:(1),b:(8,9),c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('{d:0,a:(1,2),b:(8,9),c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('{d:0,a:(1,2,3),b:(8,9),c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })



    expect(j('a:(1)')).toMatchObject({ a: ['(', 1] })
    expect(j('a:(1,2)')).toMatchObject({ a: ['(', [1, 2]] })
    expect(j('a:(1,2,3)')).toMatchObject({ a: ['(', [1, 2, 3]] })


    expect(j('a:(1),b:9')).toMatchObject({ a: ['(', 1], b: 9 })
    expect(j('a:(1,2),b:9')).toMatchObject({ a: ['(', [1, 2]], b: 9 })
    expect(j('a:(1,2,3),b:9')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9 })

    expect(j('a:(1),b:9,c:8')).toMatchObject({ a: ['(', 1], b: 9, c: 8 })
    expect(j('a:(1,2),b:9,c:8')).toMatchObject({ a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('a:(1,2,3),b:9,c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('a:(1),b:(9)')).toMatchObject({ a: ['(', 1], b: ['(', 9] })
    expect(j('a:(1,2),b:(9)')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('a:(1,2,3),b:(9)')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('a:(1),b:(9),c:8')).toMatchObject({ a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('a:(1,2),b:(9),c:8')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('a:(1,2,3),b:(9),c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('a:(1),b:(8,9)')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('a:(1,2),b:(8,9)')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('a:(1,2,3),b:(8,9)')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('a:(1),b:(8,9),c:8')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('a:(1,2),b:(8,9),c:8')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('a:(1,2,3),b:(8,9),c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })


    expect(j('d:0,a:(1)')).toMatchObject({ d: 0, a: ['(', 1] })
    expect(j('d:0,a:(1,2)')).toMatchObject({ d: 0, a: ['(', [1, 2]] })
    expect(j('d:0,a:(1,2,3)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]] })


    expect(j('d:0,a:(1),b:9')).toMatchObject({ d: 0, a: ['(', 1], b: 9 })
    expect(j('d:0,a:(1,2),b:9')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9 })
    expect(j('d:0,a:(1,2,3),b:9')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9 })

    expect(j('d:0,a:(1),b:9,c:8')).toMatchObject({ d: 0, a: ['(', 1], b: 9, c: 8 })
    expect(j('d:0,a:(1,2),b:9,c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('d:0,a:(1,2,3),b:9,c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('d:0,a:(1),b:(9)')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9] })
    expect(j('d:0,a:(1,2),b:(9)')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('d:0,a:(1,2,3),b:(9)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('d:0,a:(1),b:(9),c:8')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('d:0,a:(1,2),b:(9),c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('d:0,a:(1,2,3),b:(9),c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('d:0,a:(1),b:(8,9)')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('d:0,a:(1,2),b:(8,9)')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('d:0,a:(1,2,3),b:(8,9)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('d:0,a:(1),b:(8,9),c:8')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('d:0,a:(1,2),b:(8,9),c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('d:0,a:(1,2,3),b:(8,9),c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })

  })


  test('paren-list-implicit-structure', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('[(1)]')).toMatchObject([['(', 1]])
    expect(j('[(1,2)]')).toMatchObject([['(', [1, 2]]])
    expect(j('[(1,2,3)]')).toMatchObject([['(', [1, 2, 3]]])


    expect(j('[(1),9]')).toMatchObject([['(', 1], 9])
    expect(j('[(1,2),9]')).toMatchObject([['(', [1, 2]], 9])
    expect(j('[(1,2,3),9]')).toMatchObject([['(', [1, 2, 3]], 9])

    expect(j('[(1),9,8]')).toMatchObject([['(', 1], 9, 8])
    expect(j('[(1,2),9,8]')).toMatchObject([['(', [1, 2]], 9, 8])
    expect(j('[(1,2,3),9,8]')).toMatchObject([['(', [1, 2, 3]], 9, 8])


    expect(j('[(1),(9)]')).toMatchObject([['(', 1], ['(', 9]])
    expect(j('[(1,2),(9)]')).toMatchObject([['(', [1, 2]], ['(', 9]])
    expect(j('[(1,2,3),(9)]')).toMatchObject([['(', [1, 2, 3]], ['(', 9]])

    expect(j('[(1),(9),8]')).toMatchObject([['(', 1], ['(', 9], 8])
    expect(j('[(1,2),(9),8]')).toMatchObject([['(', [1, 2]], ['(', 9], 8])
    expect(j('[(1,2,3),(9),8]')).toMatchObject([['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('[(1),(8,9)]')).toMatchObject([['(', 1], ['(', [8, 9]]])
    expect(j('[(1,2),(8,9)]')).toMatchObject([['(', [1, 2]], ['(', [8, 9]]])
    expect(j('[(1,2,3),(8,9)]')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('[(1),(8,9),8]')).toMatchObject([['(', 1], ['(', [8, 9]], 8])
    expect(j('[(1,2),(8,9),8]')).toMatchObject([['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('[(1,2,3),(8,9),8]')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]], 8])


    expect(j('[0,(1)]')).toMatchObject([0, ['(', 1]])
    expect(j('[0,(1,2)]')).toMatchObject([0, ['(', [1, 2]]])
    expect(j('[0,(1,2,3)]')).toMatchObject([0, ['(', [1, 2, 3]]])


    expect(j('[0,(1),9]')).toMatchObject([0, ['(', 1], 9])
    expect(j('[0,(1,2),9]')).toMatchObject([0, ['(', [1, 2]], 9])
    expect(j('[0,(1,2,3),9]')).toMatchObject([0, ['(', [1, 2, 3]], 9])

    expect(j('[0,(1),9,8]')).toMatchObject([0, ['(', 1], 9, 8])
    expect(j('[0,(1,2),9,8]')).toMatchObject([0, ['(', [1, 2]], 9, 8])
    expect(j('[0,(1,2,3),9,8]')).toMatchObject([0, ['(', [1, 2, 3]], 9, 8])


    expect(j('[0,(1),(9)]')).toMatchObject([0, ['(', 1], ['(', 9]])
    expect(j('[0,(1,2),(9)]')).toMatchObject([0, ['(', [1, 2]], ['(', 9]])
    expect(j('[0,(1,2,3),(9)]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9]])

    expect(j('[0,(1),(9),8]')).toMatchObject([0, ['(', 1], ['(', 9], 8])
    expect(j('[0,(1,2),(9),8]')).toMatchObject([0, ['(', [1, 2]], ['(', 9], 8])
    expect(j('[0,(1,2,3),(9),8]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('[0,(1),(8,9)]')).toMatchObject([0, ['(', 1], ['(', [8, 9]]])
    expect(j('[0,(1,2),(8,9)]')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]]])
    expect(j('[0,(1,2,3),(8,9)]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('[0,(1),(8,9),8]')).toMatchObject([0, ['(', 1], ['(', [8, 9]], 8])
    expect(j('[0,(1,2),(8,9),8]')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('[0,(1,2,3),(8,9),8]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8])



    expect(j('(1)')).toMatchObject(['(', 1])
    expect(j('(1,2)')).toMatchObject(['(', [1, 2]])
    expect(j('(1,2,3)')).toMatchObject(['(', [1, 2, 3]])


    expect(j('(1),9')).toMatchObject([['(', 1], 9])
    expect(j('(1,2),9')).toMatchObject([['(', [1, 2]], 9])
    expect(j('(1,2,3),9')).toMatchObject([['(', [1, 2, 3]], 9])

    expect(j('(1),9,8')).toMatchObject([['(', 1], 9, 8])
    expect(j('(1,2),9,8')).toMatchObject([['(', [1, 2]], 9, 8])
    expect(j('(1,2,3),9,8')).toMatchObject([['(', [1, 2, 3]], 9, 8])


    expect(j('(1),(9)')).toMatchObject([['(', 1], ['(', 9]])
    expect(j('(1,2),(9)')).toMatchObject([['(', [1, 2]], ['(', 9]])
    expect(j('(1,2,3),(9)')).toMatchObject([['(', [1, 2, 3]], ['(', 9]])

    expect(j('(1),(9),8')).toMatchObject([['(', 1], ['(', 9], 8])
    expect(j('(1,2),(9),8')).toMatchObject([['(', [1, 2]], ['(', 9], 8])
    expect(j('(1,2,3),(9),8')).toMatchObject([['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('(1),(8,9)')).toMatchObject([['(', 1], ['(', [8, 9]]])
    expect(j('(1,2),(8,9)')).toMatchObject([['(', [1, 2]], ['(', [8, 9]]])
    expect(j('(1,2,3),(8,9)')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('(1),(8,9),8')).toMatchObject([['(', 1], ['(', [8, 9]], 8])
    expect(j('(1,2),(8,9),8')).toMatchObject([['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('(1,2,3),(8,9),8')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]], 8])


    expect(j('0,(1)')).toMatchObject([0, ['(', 1]])
    expect(j('0,(1,2)')).toMatchObject([0, ['(', [1, 2]]])
    expect(j('0,(1,2,3)')).toMatchObject([0, ['(', [1, 2, 3]]])


    expect(j('0,(1),9')).toMatchObject([0, ['(', 1], 9])
    expect(j('0,(1,2),9')).toMatchObject([0, ['(', [1, 2]], 9])
    expect(j('0,(1,2,3),9')).toMatchObject([0, ['(', [1, 2, 3]], 9])

    expect(j('0,(1),9,8')).toMatchObject([0, ['(', 1], 9, 8])
    expect(j('0,(1,2),9,8')).toMatchObject([0, ['(', [1, 2]], 9, 8])
    expect(j('0,(1,2,3),9,8')).toMatchObject([0, ['(', [1, 2, 3]], 9, 8])


    expect(j('0,(1),(9)')).toMatchObject([0, ['(', 1], ['(', 9]])
    expect(j('0,(1,2),(9)')).toMatchObject([0, ['(', [1, 2]], ['(', 9]])
    expect(j('0,(1,2,3),(9)')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9]])

    expect(j('0,(1),(9),8')).toMatchObject([0, ['(', 1], ['(', 9], 8])
    expect(j('0,(1,2),(9),8')).toMatchObject([0, ['(', [1, 2]], ['(', 9], 8])
    expect(j('0,(1,2,3),(9),8')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('0,(1),(8,9)')).toMatchObject([0, ['(', 1], ['(', [8, 9]]])
    expect(j('0,(1,2),(8,9)')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]]])
    expect(j('0,(1,2,3),(8,9)')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('0,(1),(8,9),8')).toMatchObject([0, ['(', 1], ['(', [8, 9]], 8])
    expect(j('0,(1,2),(8,9),8')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('0,(1,2,3),(8,9),8')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8])

  })



  test('paren-implicit-list', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('(a)')).toMatchObject(['(', 'a'])
    expect(j('(a,b)')).toMatchObject(['(', ['a', 'b']])
    expect(j('(a,b,c)')).toMatchObject(['(', ['a', 'b', 'c']])
    expect(j('(a,b,c,d)')).toMatchObject(['(', ['a', 'b', 'c', 'd']])

    expect(j('(1,2)')).toMatchObject(['(', [1, 2]])
    expect(j('(1+2,3)')).toMatchObject(['(', [['+', 1, 2], 3]])
    expect(j('(1+2+3,4)')).toMatchObject(['(', [['+', ['+', 1, 2], 3], 4]])
    expect(j('(1+2+3+4,5)')).toMatchObject(['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]])

    expect(j('(1+2,3,4)')).toMatchObject(['(', [['+', 1, 2], 3, 4]])
    expect(j('(1+2,3+4,5)')).toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], 5]])
    expect(j('(1+2,3+4,5+6)'))
      .toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]])

    // expect(j('(a b)')).toMatchObject(['(', ['a', 'b']])
    // expect(j('(a b c)')).toMatchObject(['(', ['a', 'b', 'c']])

    //   expect(j('(1+2 3)')).toMatchObject(['(', [['+', 1, 2], 3]])
    //   expect(j('(1+2 3 4)')).toMatchObject(['(', [['+', 1, 2], 3, 4]])
    //   expect(j('(1+2 3+4 5)')).toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], 5]])
    //   expect(j('(1+2 3+4 5+6)'))
    //     .toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]])

    //   // Default pure paren does not have a prefix, so this is an implicit list.
    //   expect(j('foo(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]])
    //   expect(j('foo,(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]])
    //   expect(j('foo (1,a)')).toMatchObject(['foo', ['(', [1, 'a']]])

  })


  // test('paren-implicit-map', () => {
  //   const je = Jsonic.make().use(Expr)
  //   const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

  //   expect(j('(a:1,b:2)')).toMatchObject(['(', { a: 1, b: 2 }])
  //   expect(j('(a:1 b:2)')).toMatchObject(['(', { a: 1, b: 2 }])
  //   expect(j('(a:1,b:2,c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }])
  //   expect(j('(a:1 b:2 c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }])

  //   expect(j('(a:1+2,b:3)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3 }])
  //   expect(j('(a:1+2,b:3,c:4)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3, c: 4 }])
  //   expect(j('(a:1+2,b:3+4,c:5)'))
  //     .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }])
  //   expect(j('(a:1+2,b:3+4,c:5+6)'))
  //     .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }])

  //   expect(j('(a:1+2 b:3)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3 }])
  //   expect(j('(a:1+2 b:3 c:4)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3, c: 4 }])
  //   expect(j('(a:1+2 b:3+4 c:5)'))
  //     .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }])
  //   expect(j('(a:1+2 b:3+4 c:5+6)'))
  //     .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }])
  // })



  test('add-paren', () => {
    const je = Jsonic.make().use(Expr, {
      paren: {
        angle: {
          osrc: '<', csrc: '>'
        }
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('<1>')).toMatchObject(['<', 1])
    expect(j('<<1>>')).toMatchObject(['<', ['<', 1]])
    expect(j('(<1>)')).toMatchObject(['(', ['<', 1]])
    expect(j('<(1)>')).toMatchObject(['<', ['(', 1]])

    expect(() => j('<1)')).toThrow('unexpected')

    expect(j('1*(2+3)')).toMatchObject(['*', 1, ['(', ['+', 2, 3]]])
    expect(j('1*<2+3>')).toMatchObject(['*', 1, ['<', ['+', 2, 3]]])
  })


  // test('paren-prefix', () => {
  //   const je = Jsonic.make().use(Expr, {
  //     paren: {
  //       pure: {
  //         prefix: true
  //       }
  //     }
  //   })
  //   const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

  //   // This has a paren prefix.
  //   expect(j('foo(1,a)')).toMatchObject(['(', 'foo', [1, 'a']])
  //   expect(j('foo (1,a)')).toMatchObject(['(', 'foo', [1, 'a']])

  //   // But this is an implicit list.
  //   expect(j('foo,(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]])
  //   expect(j('foo,(1+2,a)')).toMatchObject(['foo', ['(', [['+', 1, 2], 'a']]])
  //   expect(j('foo,(1+2+3,a)'))
  //     .toMatchObject(['foo', ['(', [['+', ['+', 1, 2], 3], 'a']]])

  //   expect(j('foo(a:1,b:2)')).toMatchObject(['(', 'foo', { a: 1, b: 2 }])
  //   expect(j('foo(a:b:1,c:2)')).toMatchObject(['(', 'foo', { a: { b: 1 }, c: 2 }])
  // })


  test('add-infix', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        foo: {
          infix: true, left: 180, right: 190, src: 'foo'
        }
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('1 foo 2')).toMatchObject(['foo', 1, 2])
  })


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



})


