/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */


import { Jsonic } from 'jsonic'
import { Expr, term, OpFullDef } from '../expr'



const C =
  (x: any) => JSON.parse(JSON.stringify(x))

const mj =
  (je: Jsonic) => (s: string, m?: any) => C(je(s, m))


const _mo_ = 'toMatchObject'


function makeOp(opspec: any): OpFullDef {
  const op = (opspec as OpFullDef)
  return op
}

function makeExpr(opspec: any, term0?: any, term1?: any): any[] {
  const op = makeOp(opspec)
  const expr: any = [opspec.src]
  expr.op$ = op
  if (term0) {
    expr.push(term0)
  }
  if (term1) {
    expr.push(term1)
  }
  return expr
}



describe('expr', () => {

  test('happy', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('1+2')).toMatchObject(['+', 1, 2])
    expect(j('-1+2')).toMatchObject(['+', ['-', 1], 2])
  })


  test('term', () => {
    let T = (expr: any[], opdef?: OpFullDef) => C(term(expr, opdef))
    let ME = makeExpr
    let MO = makeOp

    let BLANK = { infix: false, prefix: false, suffix: false, left: 0, right: 0 }
    let INFIX = { ...BLANK, terms: 2, infix: true }
    let PREFIX = { ...BLANK, terms: 1, prefix: true }
    let SUFFIX = { ...BLANK, terms: 1, suffix: true }

    let PLUS_LA = MO({ ...INFIX, src: '+', left: 140, right: 150 })
    let PLUS_RA = MO({ ...INFIX, src: '+', left: 150, right: 140 })

    let MUL_LA = MO({ ...INFIX, src: '*', left: 160, right: 170 })
    let PIPE_LA = MO({ ...INFIX, src: '|', left: 18000, right: 17000 })

    let AT_P = MO({ ...PREFIX, src: '@', right: 1500 })
    let PER_P = MO({ ...PREFIX, src: '%', right: 1300 })

    let BANG_S = MO({ ...SUFFIX, src: '!', left: 1600 })
    let QUEST_S = MO({ ...SUFFIX, src: '?', left: 1400 })

    let E: any


    // 1+2+N => (1+2)+N
    expect(T(E = ME(PLUS_LA, 1, 2), PLUS_LA))[_mo_](['+', ['+', 1, 2]])
    expect(C(E))[_mo_](['+', ['+', 1, 2]])

    // 1+2+N => 1+(2+N)
    expect(T(E = ME(PLUS_RA, 1, 2), PLUS_RA))[_mo_](['+', 2])
    expect(C(E))[_mo_](['+', 1, ['+', 2]])

    // 1+2*N => 1+(2*N)
    expect(T(E = ME(PLUS_LA, 1, 2), MUL_LA))[_mo_](['*', 2])
    expect(C(E))[_mo_](['+', 1, ['*', 2]])

    // 1*2+N => (1+2)+N
    expect(T(E = ME(MUL_LA, 1, 2), PLUS_LA))[_mo_](['+', ['*', 1, 2]])
    expect(C(E))[_mo_](['+', ['*', 1, 2]])


    // @1+N => (@1)+N
    expect(T(E = ME(AT_P, 1), PLUS_LA))[_mo_](['+', ['@', 1]])
    expect(C(E))[_mo_](['+', ['@', 1]])

    // 1!+N => (!1)+N
    expect(T(E = ME(BANG_S, 1), PLUS_LA))[_mo_](['+', ['!', 1]])
    expect(C(E))[_mo_](['+', ['!', 1]])


    // @1|N => @(1|N)
    expect(T(E = ME(AT_P, 1), PIPE_LA))[_mo_](['|', 1])
    expect(C(E))[_mo_](['@', ['|', 1]])

    // 1|@N => 1|(@N)
    expect(T(E = ME(PIPE_LA, 1), AT_P))[_mo_](['@'])
    expect(C(E))[_mo_](['|', 1, ['@']])


    // 1!|N => (!1)|N
    expect(T(E = ME(BANG_S, 1), PIPE_LA))[_mo_](['|', ['!', 1]])
    expect(C(E))[_mo_](['|', ['!', 1]])



    // 1+@N => 1+(@N)
    expect(T(E = ME(PLUS_LA, 1), AT_P))[_mo_](['@'])
    expect(C(E))[_mo_](['+', 1, ['@']])

    // @@N => @(@N)
    expect(T(E = ME(AT_P), AT_P))[_mo_](['@'])
    expect(C(E))[_mo_](['@', ['@']])


    // %@N => %(@N)
    expect(T(E = ME(PER_P), AT_P))[_mo_](['@'])
    expect(C(E))[_mo_](['%', ['@']])

    // @%N => @(%N)
    expect(T(E = ME(AT_P), PER_P))[_mo_](['%'])
    expect(C(E))[_mo_](['@', ['%']])



    // 1+2! => 1+(2!)
    // expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['!', 2])
    expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['+', 1, ['!', 2]])
    expect(C(E))[_mo_](['+', 1, ['!', 2]])

    // 1|2! => (1|2)!
    expect(T(E = ME(PIPE_LA, 1, 2), BANG_S))[_mo_](['!', ['|', 1, 2]])
    expect(C(E))[_mo_](['!', ['|', 1, 2]])


    // 1!! => !(!1)
    expect(T(E = ME(BANG_S, 1), BANG_S))[_mo_](['!', ['!', 1]])
    expect(C(E))[_mo_](['!', ['!', 1]])


    // 1!? => ?(!1)
    expect(T(E = ME(BANG_S, 1), QUEST_S))[_mo_](['?', ['!', 1]])
    expect(C(E))[_mo_](['?', ['!', 1]])

    // 1?! => !(?1)
    expect(T(E = ME(QUEST_S, 1), BANG_S))[_mo_](['!', ['?', 1]])
    expect(C(E))[_mo_](['!', ['?', 1]])


    // @1! => @(1!)
    // expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['!', 1])
    expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['@', ['!', 1]])
    expect(C(E))[_mo_](['@', ['!', 1]])

    // @1? => (@1)?
    expect(T(E = ME(AT_P, 1), QUEST_S))[_mo_](['?', ['@', 1]])
    expect(C(E))[_mo_](['?', ['@', 1]])


    // @@1! => @(@(1!))
    // expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['!', 1])
    expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['@', ['@', ['!', 1]]])
    expect(C(E))[_mo_](['@', ['@', ['!', 1]]])

    // @@1? => (@(@1))?
    expect(T(E = ME(AT_P, ME(AT_P, 1)), QUEST_S))[_mo_](['?', ['@', ['@', 1]]])
    expect(C(E))[_mo_](['?', ['@', ['@', 1]]])

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


  test('implicit-list-top-none', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('1,2'))[_mo_]([1, 2])
    expect(j('1+2,3'))[_mo_]([['+', 1, 2], 3])
    expect(j('1+2+3,4'))[_mo_]([['+', ['+', 1, 2], 3], 4])
    expect(j('1+2+3+4,5'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5])

    expect(j('1 2'))[_mo_]([1, 2])
    expect(j('1+2 3'))[_mo_]([['+', 1, 2], 3])
    expect(j('1+2+3 4'))[_mo_]([['+', ['+', 1, 2], 3], 4])
    expect(j('1+2+3+4 5'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5])

    expect(j('1,2,11'))[_mo_]([1, 2, 11])
    expect(j('1+2,3,11'))[_mo_]([['+', 1, 2], 3, 11])
    expect(j('1+2+3,4,11'))[_mo_]([['+', ['+', 1, 2], 3], 4, 11])
    expect(j('1+2+3+4,5,11'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

    expect(j('1 2 11'))[_mo_]([1, 2, 11])
    expect(j('1+2 3 11'))[_mo_]([['+', 1, 2], 3, 11])
    expect(j('1+2+3 4 11'))[_mo_]([['+', ['+', 1, 2], 3], 4, 11])
    expect(j('1+2+3+4 5 11'))[_mo_]([['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

    expect(j('22,1,2,11'))[_mo_]([22, 1, 2, 11])
    expect(j('22,1+2,3,11'))[_mo_]([22, ['+', 1, 2], 3, 11])
    expect(j('22,1+2+3,4,11'))[_mo_]([22, ['+', ['+', 1, 2], 3], 4, 11])
    expect(j('22,1+2+3+4,5,11'))[_mo_]([22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

    expect(j('22 1 2 11'))[_mo_]([22, 1, 2, 11])
    expect(j('22 1+2 3 11'))[_mo_]([22, ['+', 1, 2], 3, 11])
    expect(j('22 1+2+3 4 11'))[_mo_]([22, ['+', ['+', 1, 2], 3], 4, 11])
    expect(j('22 1+2+3+4 5 11'))[_mo_]([22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

    expect(j('[true,false],1,2,11'))[_mo_]([[true, false], 1, 2, 11])
    expect(j('[true,false],1+2,3,11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11])
    expect(j('[true,false],1+2+3,4,11'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11])
    expect(j('[true,false],1+2+3+4,5,11'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

    expect(j('[true,false] 1 2 11'))[_mo_]([[true, false], 1, 2, 11])
    expect(j('[true,false] 1+2 3 11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11])
    expect(j('[true,false] 1+2+3 4 11'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11])
    expect(j('[true,false] 1+2+3+4 5 11'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

    expect(j('[true,false],1,2,{x:11,y:22}'))[_mo_]([[true, false], 1, 2, { x: 11, y: 22 }])
    expect(j('[true,false],1+2,3,{x:11,y:22}'))[_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }])
    expect(j('[true,false],1+2+3,4,{x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }])
    expect(j('[true,false],1+2+3+4,5,{x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }])

    expect(j('[true,false] 1 2 {x:11,y:22}'))[_mo_]([[true, false], 1, 2, { x: 11, y: 22 }])
    expect(j('[true,false] 1+2 3 {x:11,y:22}'))[_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }])
    expect(j('[true,false] 1+2+3 4 {x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }])
    expect(j('[true,false] 1+2+3+4 5 {x:11,y:22}'))[_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }])


    expect(j('1+2,3+4'))[_mo_]([['+', 1, 2], ['+', 3, 4]])
    expect(j('1+2,3+4,5+6'))[_mo_]([['+', 1, 2], ['+', 3, 4], ['+', 5, 6]])
  })


  test('implicit-list-top-paren', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('(1,2)'))[_mo_](['(', [1, 2]])
    expect(j('(1+2,3)'))[_mo_](['(', [['+', 1, 2], 3]])
    expect(j('(1+2+3,4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]])
    expect(j('(1+2+3+4,5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]])

    expect(j('(1 2)'))[_mo_](['(', [1, 2]])
    expect(j('(1+2 3)'))[_mo_](['(', [['+', 1, 2], 3]])
    expect(j('(1+2+3 4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]])
    expect(j('(1+2+3+4 5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]])

    expect(j('(1,2,11)'))[_mo_](['(', [1, 2, 11]])
    expect(j('(1+2,3,11)'))[_mo_](['(', [['+', 1, 2], 3, 11]])
    expect(j('(1+2+3,4,11)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('(1+2+3+4,5,11)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('(1 2 11)'))[_mo_](['(', [1, 2, 11]])
    expect(j('(1+2 3 11)'))[_mo_](['(', [['+', 1, 2], 3, 11]])
    expect(j('(1+2+3 4 11)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('(1+2+3+4 5 11)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('(22,1,2,11)'))[_mo_](['(', [22, 1, 2, 11]])
    expect(j('(22,1+2,3,11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]])
    expect(j('(22,1+2+3,4,11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('(22,1+2+3+4,5,11)'))[_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('(22 1 2 11)'))[_mo_](['(', [22, 1, 2, 11]])
    expect(j('(22 1+2 3 11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]])
    expect(j('(22 1+2+3 4 11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('(22 1+2+3+4 5 11)'))[_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('([true,false],1,2,11)'))[_mo_](['(', [[true, false], 1, 2, 11]])
    expect(j('([true,false],1+2,3,11)'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]])
    expect(j('([true,false],1+2+3,4,11)'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('([true,false],1+2+3+4,5,11)'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('([true,false] 1 2 11)'))[_mo_](['(', [[true, false], 1, 2, 11]])
    expect(j('([true,false] 1+2 3 11)'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]])
    expect(j('([true,false] 1+2+3 4 11)'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('([true,false] 1+2+3+4 5 11)'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('([true,false],1,2,{x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2,3,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2+3,4,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2+3+4,5,{x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]])

    expect(j('([true,false] 1 2 {x:11,y:22})'))[_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]])
    expect(j('([true,false] 1+2 3 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]])
    expect(j('([true,false] 1+2+3 4 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]])
    expect(j('([true,false] 1+2+3+4 5 {x:11,y:22})'))[_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]])


    expect(j('(1+2,3+4)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4]]])
    expect(j('(1+2,3+4,5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]])

    expect(j('(1+2 3+4)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4]]])
    expect(j('(1+2 3+4 5+6)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]])

  })


  test('map-implicit-list-paren', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('a:(1,2),b:0'))[_mo_]({ a: ['(', [1, 2]], b: 0 })
    expect(j('a:(1+2,3),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 })
    expect(j('a:(1+2+3,4),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 })
    expect(j('a:(1+2+3+4,5),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 })

    expect(j('a:(1 2),b:0'))[_mo_]({ a: ['(', [1, 2]], b: 0 })
    expect(j('a:(1+2 3),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 })
    expect(j('a:(1+2+3 4),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 })
    expect(j('a:(1+2+3+4 5),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 })

    expect(j('a:(1,2,11),b:0'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 })
    expect(j('a:(1+2,3,11),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 })
    expect(j('a:(1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('a:(1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('a:(1 2 11),b:0'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 })
    expect(j('a:(1+2 3 11),b:0'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 })
    expect(j('a:(1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('a:(1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('a:(22,1,2,11),b:0'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 })
    expect(j('a:(22,1+2,3,11),b:0'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 })
    expect(j('a:(22,1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('a:(22,1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('a:(22 1 2 11),b:0'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 })
    expect(j('a:(22 1+2 3 11),b:0'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 })
    expect(j('a:(22 1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('a:(22 1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('a:([true,false],1,2,11),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 })
    expect(j('a:([true,false],1+2,3,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 })
    expect(j('a:([true,false],1+2+3,4,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('a:([true,false],1+2+3+4,5,11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('a:([true,false] 1 2 11),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 })
    expect(j('a:([true,false] 1+2 3 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 })
    expect(j('a:([true,false] 1+2+3 4 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('a:([true,false] 1+2+3+4 5 11),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('a:([true,false],1,2,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 })
    expect(j('a:([true,false],1+2,3,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 })
    expect(j('a:([true,false],1+2+3,4,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 })
    expect(j('a:([true,false],1+2+3+4,5,{x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 })

    expect(j('a:([true,false] 1 2 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 })
    expect(j('a:([true,false] 1+2 3 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 })
    expect(j('a:([true,false] 1+2+3 4 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 })
    expect(j('a:([true,false] 1+2+3+4 5 {x:11,y:22}),b:0'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 })


    expect(j('{a:(1,2),b:0}'))[_mo_]({ a: ['(', [1, 2]], b: 0 })
    expect(j('{a:(1+2,3),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 })
    expect(j('{a:(1+2+3,4),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 })
    expect(j('{a:(1+2+3+4,5),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 })

    expect(j('{a:(1 2),b:0}'))[_mo_]({ a: ['(', [1, 2]], b: 0 })
    expect(j('{a:(1+2 3),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3]], b: 0 })
    expect(j('{a:(1+2+3 4),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4]], b: 0 })
    expect(j('{a:(1+2+3+4 5),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]], b: 0 })

    expect(j('{a:(1,2,11),b:0}'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 })
    expect(j('{a:(1+2,3,11),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 })
    expect(j('{a:(1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('{a:(1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('{a:(1 2 11),b:0}'))[_mo_]({ a: ['(', [1, 2, 11]], b: 0 })
    expect(j('{a:(1+2 3 11),b:0}'))[_mo_]({ a: ['(', [['+', 1, 2], 3, 11]], b: 0 })
    expect(j('{a:(1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('{a:(1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('{a:(22,1,2,11),b:0}'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 })
    expect(j('{a:(22,1+2,3,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 })
    expect(j('{a:(22,1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('{a:(22,1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('{a:(22 1 2 11),b:0}'))[_mo_]({ a: ['(', [22, 1, 2, 11]], b: 0 })
    expect(j('{a:(22 1+2 3 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', 1, 2], 3, 11]], b: 0 })
    expect(j('{a:(22 1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('{a:(22 1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('{a:([true,false],1,2,11),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 })
    expect(j('{a:([true,false],1+2,3,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 })
    expect(j('{a:([true,false],1+2+3,4,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('{a:([true,false],1+2+3+4,5,11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('{a:([true,false] 1 2 11),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, 11]], b: 0 })
    expect(j('{a:([true,false] 1+2 3 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, 11]], b: 0 })
    expect(j('{a:([true,false] 1+2+3 4 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]], b: 0 })
    expect(j('{a:([true,false] 1+2+3+4 5 11),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]], b: 0 })

    expect(j('{a:([true,false],1,2,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 })
    expect(j('{a:([true,false],1+2,3,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 })
    expect(j('{a:([true,false],1+2+3,4,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 })
    expect(j('{a:([true,false],1+2+3+4,5,{x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 })

    expect(j('{a:([true,false] 1 2 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], 1, 2, { x: 11, y: 22 }]], b: 0 })
    expect(j('{a:([true,false] 1+2 3 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]], b: 0 })
    expect(j('{a:([true,false] 1+2+3 4 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]], b: 0 })
    expect(j('{a:([true,false] 1+2+3+4 5 {x:11,y:22}),b:0}'))[_mo_]({ a: ['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]], b: 0 })


    expect(j('{a:(1+2,3+4)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4]]] })
    expect(j('{a:(1+2,3+4,5+6)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]] })

    expect(j('{a:(1+2 3+4)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4]]] })
    expect(j('{a:(1+2 3+4 5+6)}'))[_mo_]({ a: ['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]] })


  })


  test('unary-prefix-basic', () => {
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


  test('unary-prefix-edge', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        at: {
          prefix: true, right: 15000, src: '@'
        },
        tight: {
          infix: true, left: 120_000, right: 130_000, src: '~'
        },
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))


    expect(j('@1')).toEqual(['@', 1])
    expect(j('@@1')).toEqual(['@', ['@', 1]])
    expect(j('@@@1')).toEqual(['@', ['@', ['@', 1]]])


    // Precedence does not matter within prefix sequences.
    expect(j('-@1')).toEqual(['-', ['@', 1]])
    expect(j('@-1')).toEqual(['@', ['-', 1]])

    expect(j('--@1')).toEqual(['-', ['-', ['@', 1]]])
    expect(j('@--1')).toEqual(['@', ['-', ['-', 1]]])

    expect(j('@@-1')).toEqual(['@', ['@', ['-', 1]]])
    expect(j('-@@1')).toEqual(['-', ['@', ['@', 1]]])

    expect(j('-@-1')).toEqual(['-', ['@', ['-', 1]]])
    expect(j('@-@1')).toEqual(['@', ['-', ['@', 1]]])


    expect(j('@1+2')).toEqual(['+', ['@', 1], 2])
    expect(j('1+@2')).toEqual(['+', 1, ['@', 2]])
    expect(j('@1+@2')).toEqual(['+', ['@', 1], ['@', 2]])

    expect(j('@1+2+3')).toEqual(['+', ['+', ['@', 1], 2], 3])
    expect(j('1+@2+3')).toEqual(['+', ['+', 1, ['@', 2]], 3])
    expect(j('@1+@2+3')).toEqual(['+', ['+', ['@', 1], ['@', 2]], 3])

    expect(j('@1+2+@3')).toEqual(['+', ['+', ['@', 1], 2], ['@', 3]])
    expect(j('1+@2+@3')).toEqual(['+', ['+', 1, ['@', 2]], ['@', 3]])
    expect(j('@1+@2+@3')).toEqual(['+', ['+', ['@', 1], ['@', 2]], ['@', 3]])


    // Tighter!

    expect(j('@1~2')).toEqual(['@', ['~', 1, 2]])
    expect(j('1~@2')).toEqual(['~', 1, ['@', 2]])
    expect(j('@1~@2')).toEqual(['@', ['~', 1, ['@', 2]]])

    expect(j('@1~2+3')).toEqual(['+', ['@', ['~', 1, 2]], 3])
    expect(j('1~@2+3')).toEqual(['+', ['~', 1, ['@', 2]], 3])
    expect(j('@1~@2+3')).toEqual(['+', ['@', ['~', 1, ['@', 2]]], 3])

    expect(j('@1~2~3')).toEqual(['@', ['~', ['~', 1, 2], 3]])
    expect(j('1~@2~3')).toEqual(['~', ['~', 1, ['@', 2]], 3])
    expect(j('@1~@2~3')).toEqual(['@', ['~', ['~', 1, ['@', 2]], 3]])
  })


  test('unary-suffix-basic', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: {
          suffix: true, left: 15000, src: '!'
        },
        question: {
          suffix: true, left: 13000, src: '?'
        },
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('1')).toEqual(1)
    expect(j('z')).toEqual('z')

    expect(j('1!')).toMatchObject(['!', 1])
    expect(j('1 !')).toMatchObject(['!', 1])

    expect(j('1!!')).toMatchObject(['!', ['!', 1]])
    expect(j('1!!!')).toMatchObject(['!', ['!', ['!', 1]]])

    expect(j('z!')).toMatchObject(['!', 'z'])
    expect(j('z !')).toMatchObject(['!', 'z'])


    expect(j('1?')).toMatchObject(['?', 1])
    expect(j('1 ?')).toMatchObject(['?', 1])

    expect(j('1??')).toMatchObject(['?', ['?', 1]])
    expect(j('1???')).toMatchObject(['?', ['?', ['?', 1]]])



    expect(j('1+2!')).toMatchObject(['+', 1, ['!', 2]])
    expect(j('1!+2')).toMatchObject(['+', ['!', 1], 2])
    expect(j('1!+2!')).toMatchObject(['+', ['!', 1], ['!', 2]])

    expect(j('1+2!!')).toMatchObject(['+', 1, ['!', ['!', 2]]])
    expect(j('1!!+2')).toMatchObject(['+', ['!', ['!', 1]], 2])
    expect(j('1!!+2!!')).toMatchObject(['+', ['!', ['!', 1]], ['!', ['!', 2]]])


    expect(j('1+2?')).toMatchObject(['+', 1, ['?', 2]])
    expect(j('1?+2')).toMatchObject(['+', ['?', 1], 2])
    expect(j('1?+2?')).toMatchObject(['+', ['?', 1], ['?', 2]])

    expect(j('1+2??')).toMatchObject(['+', 1, ['?', ['?', 2]]])
    expect(j('1??+2')).toMatchObject(['+', ['?', ['?', 1]], 2])
    expect(j('1??+2??')).toMatchObject(['+', ['?', ['?', 1]], ['?', ['?', 2]]])


    expect(j('0+1+2!')).toMatchObject(['+', ['+', 0, 1], ['!', 2]])
    expect(j('0+1!+2')).toMatchObject(['+', ['+', 0, ['!', 1]], 2])
    expect(j('0+1!+2!')).toMatchObject(['+', ['+', 0, ['!', 1]], ['!', 2]])
    expect(j('0!+1!+2!')).toMatchObject(['+', ['+', ['!', 0], ['!', 1]], ['!', 2]])
    expect(j('0!+1!+2')).toMatchObject(['+', ['+', ['!', 0], ['!', 1]], 2])
    expect(j('0!+1+2!')).toMatchObject(['+', ['+', ['!', 0], 1], ['!', 2]])
    expect(j('0!+1+2')).toMatchObject(['+', ['+', ['!', 0], 1], 2])
  })


  test('unary-suffix-edge', () => {
    const je = Jsonic.make().use(Expr, {
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
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))


    expect(j('1!')).toEqual(['!', 1])
    expect(j('1!!')).toEqual(['!', ['!', 1]])
    expect(j('1!!!')).toEqual(['!', ['!', ['!', 1]]])


    // Precedence does not matter within prefix sequences.
    expect(j('1!?')).toEqual(['?', ['!', 1]])
    expect(j('1?!')).toEqual(['!', ['?', 1]])

    expect(j('1!??')).toEqual(['?', ['?', ['!', 1]]])
    expect(j('1??!')).toEqual(['!', ['?', ['?', 1]]])

    expect(j('1?!!')).toEqual(['!', ['!', ['?', 1]]])
    expect(j('1!!?')).toEqual(['?', ['!', ['!', 1]]])

    expect(j('1?!?')).toEqual(['?', ['!', ['?', 1]]])
    expect(j('1!?!')).toEqual(['!', ['?', ['!', 1]]])


    expect(j('1!+2')).toEqual(['+', ['!', 1], 2])
    expect(j('1+2!')).toEqual(['+', 1, ['!', 2]])
    expect(j('1!+2!')).toEqual(['+', ['!', 1], ['!', 2]])

    expect(j('1!+2+3')).toEqual(['+', ['+', ['!', 1], 2], 3])
    expect(j('1+2!+3')).toEqual(['+', ['+', 1, ['!', 2]], 3])
    expect(j('1!+2!+3')).toEqual(['+', ['+', ['!', 1], ['!', 2]], 3])

    expect(j('1!+2+3!')).toEqual(['+', ['+', ['!', 1], 2], ['!', 3]])
    expect(j('1+2!+3!')).toEqual(['+', ['+', 1, ['!', 2]], ['!', 3]])
    expect(j('1!+2!+3!')).toEqual(['+', ['+', ['!', 1], ['!', 2]], ['!', 3]])


    // Tighter!

    expect(j('1!~2')).toEqual(['~', ['!', 1], 2])
    expect(j('1~2!')).toEqual(['!', ['~', 1, 2]])
    expect(j('1!~2!')).toEqual(['!', ['~', ['!', 1], 2]])

    expect(j('1!~2+3')).toEqual(['+', ['~', ['!', 1], 2], 3])
    expect(j('1~2!+3')).toEqual(['+', ['!', ['~', 1, 2]], 3])
    expect(j('1!~2!+3')).toEqual(['+', ['!', ['~', ['!', 1], 2]], 3])

    expect(j('1!~2~3')).toEqual(['~', ['~', ['!', 1], 2], 3])
    expect(j('1~2!~3')).toEqual(['~', ['!', ['~', 1, 2]], 3])
    expect(j('1!~2!~3')).toEqual(['~', ['!', ['~', ['!', 1], 2]], 3])
  })


  test('unary-suffix-structure', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: {
          suffix: true, left: 15000, src: '!'
        },
        question: {
          suffix: true, left: 13000, src: '?'
        },
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))
    expect(j('1!,2!')).toMatchObject([['!', 1], ['!', 2]])
    expect(j('1!,2!,3!')).toMatchObject([['!', 1], ['!', 2], ['!', 3]])
    expect(j('1!,2!,3!,4!')).toMatchObject([['!', 1], ['!', 2], ['!', 3], ['!', 4]])

    expect(j('1! 2!')).toMatchObject([['!', 1], ['!', 2]])
    expect(j('1! 2! 3!')).toMatchObject([['!', 1], ['!', 2], ['!', 3]])
    expect(j('1! 2! 3! 4!')).toMatchObject([['!', 1], ['!', 2], ['!', 3], ['!', 4]])

    expect(j('[1!,2!]')).toMatchObject([['!', 1], ['!', 2]])
    expect(j('[1!,2!,3!]')).toMatchObject([['!', 1], ['!', 2], ['!', 3]])
    expect(j('[1!,2!,3!,4!]')).toMatchObject([['!', 1], ['!', 2], ['!', 3], ['!', 4]])

    expect(j('[1! 2!]')).toMatchObject([['!', 1], ['!', 2]])
    expect(j('[1! 2! 3!]')).toMatchObject([['!', 1], ['!', 2], ['!', 3]])
    expect(j('[1! 2! 3! 4!]')).toMatchObject([['!', 1], ['!', 2], ['!', 3], ['!', 4]])


    expect(j('a:1!')).toMatchObject({ a: ['!', 1] })
    expect(j('a:1!,b:2!')).toMatchObject({ a: ['!', 1], b: ['!', 2] })
    expect(j('a:1!,b:2!,c:3!')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3] })
    expect(j('a:1!,b:2!,c:3!,d:4!')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] })

    expect(j('a:1! b:2!')).toMatchObject({ a: ['!', 1], b: ['!', 2] })
    expect(j('a:1! b:2! c:3!')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3] })
    expect(j('a:1! b:2! c:3!,d:4!')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] })

    expect(j('{a:1!}')).toMatchObject({ a: ['!', 1] })
    expect(j('{a:1!,b:2!}')).toMatchObject({ a: ['!', 1], b: ['!', 2] })
    expect(j('{a:1!,b:2!,c:3!}')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3] })
    expect(j('{a:1!,b:2!,c:3!,d:4!}')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] })

    expect(j('{a:1! b:2!}')).toMatchObject({ a: ['!', 1], b: ['!', 2] })
    expect(j('{a:1! b:2! c:3!}')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3] })
    expect(j('{a:1! b:2! c:3! d:4!}')).toMatchObject({ a: ['!', 1], b: ['!', 2], c: ['!', 3], d: ['!', 4] })

  })


  test('unary-suffix-prefix', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: {
          suffix: true, left: 15000, src: '!'
        },
        question: {
          suffix: true, left: 13000, src: '?'
        },
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('-1!')).toEqual(['-', ['!', 1]])
    expect(j('--1!')).toEqual(['-', ['-', ['!', 1]]])
    expect(j('-1!!')).toEqual(['-', ['!', ['!', 1]]])
    expect(j('--1!!')).toEqual(['-', ['-', ['!', ['!', 1]]]])

    expect(j('-1!+2')).toEqual(['+', ['-', ['!', 1]], 2])
    expect(j('--1!+2')).toEqual(['+', ['-', ['-', ['!', 1]]], 2])
    expect(j('---1!+2')).toEqual(['+', ['-', ['-', ['-', ['!', 1]]]], 2])


    expect(j('-1?')).toEqual(['?', ['-', 1]])
    expect(j('--1?')).toEqual(['?', ['-', ['-', 1]]])
    expect(j('-1??')).toEqual(['?', ['?', ['-', 1]]])
    expect(j('--1??')).toEqual(['?', ['?', ['-', ['-', 1]]]])


    expect(j('-1!?')).toEqual(['?', ['-', ['!', 1]]])
    expect(j('-1!?!')).toEqual(['!', ['?', ['-', ['!', 1]]]])


    expect(j('-1?+2')).toEqual(['+', ['?', ['-', 1]], 2])
    expect(j('--1?+2')).toEqual(['+', ['?', ['-', ['-', 1]]], 2])
    expect(j('-1??+2')).toEqual(['+', ['?', ['?', ['-', 1]]], 2])
    expect(j('--1??+2')).toEqual(['+', ['?', ['?', ['-', ['-', 1]]]], 2])

  })



  test('unary-suffix-paren', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: {
          suffix: true, left: 15000, src: '!'
        },
        question: {
          suffix: true, left: 13000, src: '?'
        },
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))
    expect(j('(1)')).toEqual(['(', 1])
    expect(j('(z)')).toEqual(['(', 'z'])

    expect(j('(1!)')).toMatchObject(['(', ['!', 1]])
    expect(j('(1 !)')).toMatchObject(['(', ['!', 1]])

    expect(j('(z!)')).toMatchObject(['(', ['!', 'z']])
    expect(j('(z !)')).toMatchObject(['(', ['!', 'z']])

    expect(j('(1+2!)')).toMatchObject(['(', ['+', 1, ['!', 2]]])
    expect(j('(1!+2)')).toMatchObject(['(', ['+', ['!', 1], 2]])
    expect(j('(1!+2!)')).toMatchObject(['(', ['+', ['!', 1], ['!', 2]]])

    expect(j('(0+1+2!)')).toMatchObject(['(', ['+', ['+', 0, 1], ['!', 2]]])
    expect(j('(0+1!+2)')).toMatchObject(['(', ['+', ['+', 0, ['!', 1]], 2]])
    expect(j('(0+1!+2!)')).toMatchObject(['(', ['+', ['+', 0, ['!', 1]], ['!', 2]]])
    expect(j('(0!+1!+2!)')).toMatchObject(['(', ['+', ['+', ['!', 0], ['!', 1]], ['!', 2]]])
    expect(j('(0!+1!+2)')).toMatchObject(['(', ['+', ['+', ['!', 0], ['!', 1]], 2]])
    expect(j('(0!+1+2!)')).toMatchObject(['(', ['+', ['+', ['!', 0], 1], ['!', 2]]])
    expect(j('(0!+1+2)')).toMatchObject(['(', ['+', ['+', ['!', 0], 1], 2]])
  })



  test('paren-basic', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('()')).toMatchObject(['('])
    expect(j('(),()')).toMatchObject([['('], ['(']])
    expect(j('(),(),()')).toMatchObject([['('], ['('], ['(']])
    expect(j('() ()')).toMatchObject([['('], ['(']])
    expect(j('() () ()')).toMatchObject([['('], ['('], ['(']])

    expect(j('[()]')).toMatchObject([['(']])
    expect(j('[(),()]')).toMatchObject([['('], ['(']])
    expect(j('[(),(),()]')).toMatchObject([['('], ['('], ['(']])
    expect(j('[() ()]')).toMatchObject([['('], ['(']])
    expect(j('[() () ()]')).toMatchObject([['('], ['('], ['(']])

    expect(j('{a:()}')).toMatchObject({ a: ['('] })
    expect(j('{a:(),b:()}')).toMatchObject({ a: ['('], b: ['('] })
    expect(j('{a:(),b:(),c:()}')).toMatchObject({ a: ['('], b: ['('], c: ['('] })
    expect(j('{a:() b:()}')).toMatchObject({ a: ['('], b: ['('] })
    expect(j('{a:() b:() c:()}')).toMatchObject({ a: ['('], b: ['('], c: ['('] })


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


  test('paren-map-implicit-structure-comma', () => {
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


  test('paren-map-implicit-structure-space', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('{a:(1)}')).toMatchObject({ a: ['(', 1] })
    expect(j('{a:(1 2)}')).toMatchObject({ a: ['(', [1, 2]] })
    expect(j('{a:(1 2 3)}')).toMatchObject({ a: ['(', [1, 2, 3]] })


    expect(j('{a:(1) b:9}')).toMatchObject({ a: ['(', 1], b: 9 })
    expect(j('{a:(1 2) b:9}')).toMatchObject({ a: ['(', [1, 2]], b: 9 })
    expect(j('{a:(1 2 3) b:9}')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9 })

    expect(j('{a:(1) b:9 c:8}')).toMatchObject({ a: ['(', 1], b: 9, c: 8 })
    expect(j('{a:(1 2) b:9 c:8}')).toMatchObject({ a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('{a:(1 2 3) b:9 c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('{a:(1) b:(9)}')).toMatchObject({ a: ['(', 1], b: ['(', 9] })
    expect(j('{a:(1 2) b:(9)}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('{a:(1 2 3) b:(9)}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('{a:(1) b:(9) c:8}')).toMatchObject({ a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('{a:(1 2) b:(9) c:8}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('{a:(1 2 3) b:(9) c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('{a:(1) b:(8 9)}')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('{a:(1 2) b:(8 9)}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('{a:(1 2 3) b:(8 9)}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('{a:(1) b:(8 9) c:8}')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('{a:(1 2) b:(8 9) c:8}')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('{a:(1 2 3) b:(8 9) c:8}')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })


    expect(j('{d:0,a:(1)}')).toMatchObject({ d: 0, a: ['(', 1] })
    expect(j('{d:0,a:(1 2)}')).toMatchObject({ d: 0, a: ['(', [1, 2]] })
    expect(j('{d:0,a:(1 2 3)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]] })


    expect(j('{d:0,a:(1) b:9}')).toMatchObject({ d: 0, a: ['(', 1], b: 9 })
    expect(j('{d:0,a:(1 2) b:9}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9 })
    expect(j('{d:0,a:(1 2 3) b:9}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9 })

    expect(j('{d:0,a:(1) b:9 c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: 9, c: 8 })
    expect(j('{d:0,a:(1 2) b:9 c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('{d:0,a:(1 2 3) b:9 c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('{d:0,a:(1) b:(9)}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9] })
    expect(j('{d:0,a:(1 2) b:(9)}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('{d:0,a:(1 2 3) b:(9)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('{d:0,a:(1) b:(9) c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('{d:0,a:(1 2) b:(9) c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('{d:0,a:(1 2 3) b:(9) c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('{d:0,a:(1) b:(8 9)}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('{d:0,a:(1 2) b:(8 9)}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('{d:0,a:(1 2 3) b:(8 9)}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('{d:0,a:(1) b:(8 9) c:8}')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('{d:0,a:(1 2) b:(8 9) c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('{d:0,a:(1 2 3) b:(8 9) c:8}')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })



    expect(j('a:(1)')).toMatchObject({ a: ['(', 1] })
    expect(j('a:(1 2)')).toMatchObject({ a: ['(', [1, 2]] })
    expect(j('a:(1 2 3)')).toMatchObject({ a: ['(', [1, 2, 3]] })


    expect(j('a:(1) b:9')).toMatchObject({ a: ['(', 1], b: 9 })
    expect(j('a:(1 2) b:9')).toMatchObject({ a: ['(', [1, 2]], b: 9 })
    expect(j('a:(1 2 3) b:9')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9 })

    expect(j('a:(1) b:9 c:8')).toMatchObject({ a: ['(', 1], b: 9, c: 8 })
    expect(j('a:(1 2) b:9 c:8')).toMatchObject({ a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('a:(1 2 3) b:9 c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('a:(1) b:(9)')).toMatchObject({ a: ['(', 1], b: ['(', 9] })
    expect(j('a:(1 2) b:(9)')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('a:(1 2 3) b:(9)')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('a:(1) b:(9) c:8')).toMatchObject({ a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('a:(1 2) b:(9) c:8')).toMatchObject({ a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('a:(1 2 3) b:(9) c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('a:(1) b:(8 9)')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('a:(1 2) b:(8 9)')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('a:(1 2 3) b:(8 9)')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('a:(1) b:(8 9) c:8')).toMatchObject({ a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('a:(1 2) b:(8 9) c:8')).toMatchObject({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('a:(1 2 3) b:(8 9) c:8')).toMatchObject({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })


    expect(j('d:0,a:(1)')).toMatchObject({ d: 0, a: ['(', 1] })
    expect(j('d:0,a:(1 2)')).toMatchObject({ d: 0, a: ['(', [1, 2]] })
    expect(j('d:0,a:(1 2 3)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]] })


    expect(j('d:0,a:(1) b:9')).toMatchObject({ d: 0, a: ['(', 1], b: 9 })
    expect(j('d:0,a:(1 2) b:9')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9 })
    expect(j('d:0,a:(1 2 3) b:9')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9 })

    expect(j('d:0,a:(1) b:9 c:8')).toMatchObject({ d: 0, a: ['(', 1], b: 9, c: 8 })
    expect(j('d:0,a:(1 2) b:9 c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('d:0,a:(1 2 3) b:9 c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('d:0,a:(1) b:(9)')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9] })
    expect(j('d:0,a:(1 2) b:(9)')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('d:0,a:(1 2 3) b:(9)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('d:0,a:(1) b:(9) c:8')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('d:0,a:(1 2) b:(9) c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('d:0,a:(1 2 3) b:(9) c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('d:0,a:(1) b:(8 9)')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('d:0,a:(1 2) b:(8 9)')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('d:0,a:(1 2 3) b:(8 9)')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('d:0,a:(1) b:(8 9) c:8')).toMatchObject({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('d:0,a:(1 2) b:(8 9) c:8')).toMatchObject({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('d:0,a:(1 2 3) b:(8 9) c:8')).toMatchObject({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })

  })


  test('paren-list-implicit-structure-comma', () => {
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

    expect(j('[(1),(9),(8)]')).toMatchObject([['(', 1], ['(', 9], ['(', 8]])

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

    expect(j('(1),(9),(8)')).toMatchObject([['(', 1], ['(', 9], ['(', 8]])

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


  test('paren-list-implicit-structure-space', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('[(1)]')).toMatchObject([['(', 1]])
    expect(j('[(1 2)]')).toMatchObject([['(', [1, 2]]])
    expect(j('[(1 2 3)]')).toMatchObject([['(', [1, 2, 3]]])


    expect(j('[(1) 9]')).toMatchObject([['(', 1], 9])
    expect(j('[(1 2) 9]')).toMatchObject([['(', [1, 2]], 9])
    expect(j('[(1 2 3) 9]')).toMatchObject([['(', [1, 2, 3]], 9])

    expect(j('[(1) 9 8]')).toMatchObject([['(', 1], 9, 8])
    expect(j('[(1 2) 9 8]')).toMatchObject([['(', [1, 2]], 9, 8])
    expect(j('[(1 2 3) 9 8]')).toMatchObject([['(', [1, 2, 3]], 9, 8])


    expect(j('[(1) (9)]')).toMatchObject([['(', 1], ['(', 9]])
    expect(j('[(1 2) (9)]')).toMatchObject([['(', [1, 2]], ['(', 9]])
    expect(j('[(1 2 3) (9)]')).toMatchObject([['(', [1, 2, 3]], ['(', 9]])

    expect(j('[(1) (9) (8)]')).toMatchObject([['(', 1], ['(', 9], ['(', 8]])

    expect(j('[(1) (9) 8]')).toMatchObject([['(', 1], ['(', 9], 8])
    expect(j('[(1 2) (9) 8]')).toMatchObject([['(', [1, 2]], ['(', 9], 8])
    expect(j('[(1 2 3) (9) 8]')).toMatchObject([['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('[(1) (8,9)]')).toMatchObject([['(', 1], ['(', [8, 9]]])
    expect(j('[(1 2) (8,9)]')).toMatchObject([['(', [1, 2]], ['(', [8, 9]]])
    expect(j('[(1 2 3) (8,9)]')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('[(1) (8,9),8]')).toMatchObject([['(', 1], ['(', [8, 9]], 8])
    expect(j('[(1 2) (8,9),8]')).toMatchObject([['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('[(1 2 3) (8,9),8]')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]], 8])


    expect(j('[0 (1)]')).toMatchObject([0, ['(', 1]])
    expect(j('[0 (1 2)]')).toMatchObject([0, ['(', [1, 2]]])
    expect(j('[0 (1 2 3)]')).toMatchObject([0, ['(', [1, 2, 3]]])


    expect(j('[0 (1) 9]')).toMatchObject([0, ['(', 1], 9])
    expect(j('[0 (1 2) 9]')).toMatchObject([0, ['(', [1, 2]], 9])
    expect(j('[0 (1 2 3) 9]')).toMatchObject([0, ['(', [1, 2, 3]], 9])

    expect(j('[0 (1) 9 8]')).toMatchObject([0, ['(', 1], 9, 8])
    expect(j('[0 (1 2) 9 8]')).toMatchObject([0, ['(', [1, 2]], 9, 8])
    expect(j('[0 (1 2 3) 9 8]')).toMatchObject([0, ['(', [1, 2, 3]], 9, 8])


    expect(j('[0 (1) (9)]')).toMatchObject([0, ['(', 1], ['(', 9]])
    expect(j('[0 (1 2) (9)]')).toMatchObject([0, ['(', [1, 2]], ['(', 9]])
    expect(j('[0 (1 2 3) (9)]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9]])

    expect(j('[0 (1) (9) 8]')).toMatchObject([0, ['(', 1], ['(', 9], 8])
    expect(j('[0 (1 2) (9) 8]')).toMatchObject([0, ['(', [1, 2]], ['(', 9], 8])
    expect(j('[0 (1 2 3) (9) 8]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('[0 (1) (8 9)]')).toMatchObject([0, ['(', 1], ['(', [8, 9]]])
    expect(j('[0 (1 2) (8 9)]')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]]])
    expect(j('[0 (1 2 3) (8 9)]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('[0 (1) (8 9) 8]')).toMatchObject([0, ['(', 1], ['(', [8, 9]], 8])
    expect(j('[0 (1 2) (8 9) 8]')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('[0 (1 2 3) (8 9) 8]')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8])



    expect(j('(1)')).toMatchObject(['(', 1])
    expect(j('(1 2)')).toMatchObject(['(', [1, 2]])
    expect(j('(1 2 3)')).toMatchObject(['(', [1, 2, 3]])


    expect(j('(1) 9')).toMatchObject([['(', 1], 9])
    expect(j('(1 2) 9')).toMatchObject([['(', [1, 2]], 9])
    expect(j('(1 2 3) 9')).toMatchObject([['(', [1, 2, 3]], 9])

    expect(j('(1) 9 8')).toMatchObject([['(', 1], 9, 8])
    expect(j('(1 2) 9 8')).toMatchObject([['(', [1, 2]], 9, 8])
    expect(j('(1 2 3) 9 8')).toMatchObject([['(', [1, 2, 3]], 9, 8])


    expect(j('(1) (9)')).toMatchObject([['(', 1], ['(', 9]])
    expect(j('(1 2) (9)')).toMatchObject([['(', [1, 2]], ['(', 9]])
    expect(j('(1 2 3) (9)')).toMatchObject([['(', [1, 2, 3]], ['(', 9]])

    expect(j('(1) (9) 8')).toMatchObject([['(', 1], ['(', 9], 8])
    expect(j('(1 2) (9) 8')).toMatchObject([['(', [1, 2]], ['(', 9], 8])
    expect(j('(1 2 3) (9) 8')).toMatchObject([['(', [1, 2, 3]], ['(', 9], 8])

    expect(j('(1) (9) (8)')).toMatchObject([['(', 1], ['(', 9], ['(', 8]])

    expect(j('(1) (8 9)')).toMatchObject([['(', 1], ['(', [8, 9]]])
    expect(j('(1 2) (8 9)')).toMatchObject([['(', [1, 2]], ['(', [8, 9]]])
    expect(j('(1 2 3) (8 9)')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('(1) (8 9) 8')).toMatchObject([['(', 1], ['(', [8, 9]], 8])
    expect(j('(1 2) (8 9) 8')).toMatchObject([['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('(1 2 3) (8 9) 8')).toMatchObject([['(', [1, 2, 3]], ['(', [8, 9]], 8])


    expect(j('0 (1)')).toMatchObject([0, ['(', 1]])
    expect(j('0 (1 2)')).toMatchObject([0, ['(', [1, 2]]])
    expect(j('0 (1 2 3)')).toMatchObject([0, ['(', [1, 2, 3]]])


    expect(j('0 (1) 9')).toMatchObject([0, ['(', 1], 9])
    expect(j('0 (1 2) 9')).toMatchObject([0, ['(', [1, 2]], 9])
    expect(j('0 (1 2 3) 9')).toMatchObject([0, ['(', [1, 2, 3]], 9])

    expect(j('0 (1) 9 8')).toMatchObject([0, ['(', 1], 9, 8])
    expect(j('0 (1 2) 9 8')).toMatchObject([0, ['(', [1, 2]], 9, 8])
    expect(j('0 (1 2 3) 9 8')).toMatchObject([0, ['(', [1, 2, 3]], 9, 8])


    expect(j('0 (1) (9)')).toMatchObject([0, ['(', 1], ['(', 9]])
    expect(j('0 (1 2) (9)')).toMatchObject([0, ['(', [1, 2]], ['(', 9]])
    expect(j('0 (1 2 3) (9)')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9]])

    expect(j('0 (1) (9) 8')).toMatchObject([0, ['(', 1], ['(', 9], 8])
    expect(j('0 (1 2) (9) 8')).toMatchObject([0, ['(', [1, 2]], ['(', 9], 8])
    expect(j('0 (1 2 3) (9) 8')).toMatchObject([0, ['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('0 (1) (8 9)')).toMatchObject([0, ['(', 1], ['(', [8, 9]]])
    expect(j('0 (1 2) (8 9)')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]]])
    expect(j('0 (1 2 3) (8 9)')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('0 (1) (8 9) 8')).toMatchObject([0, ['(', 1], ['(', [8, 9]], 8])
    expect(j('0 (1 2) (8 9) 8')).toMatchObject([0, ['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('0 (1 2 3) (8 9) 8')).toMatchObject([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8])

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

    expect(j('(a b)')).toMatchObject(['(', ['a', 'b']])
    expect(j('(a b c)')).toMatchObject(['(', ['a', 'b', 'c']])

    expect(j('(1+2 3)')).toMatchObject(['(', [['+', 1, 2], 3]])
    expect(j('(1+2 3 4)')).toMatchObject(['(', [['+', 1, 2], 3, 4]])
    expect(j('(1+2 3+4 5)')).toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], 5]])
    expect(j('(1+2 3+4 5+6)'))
      .toMatchObject(['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]])

    // Default pure paren does not have a prefix, so this is an implicit list.
    expect(j('foo(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]])
    expect(j('foo,(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]])
    expect(j('foo (1,a)')).toMatchObject(['foo', ['(', [1, 'a']]])

  })


  test('paren-implicit-map', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    expect(j('(a:1,b:2)')).toMatchObject(['(', { a: 1, b: 2 }])
    expect(j('(a:1 b:2)')).toMatchObject(['(', { a: 1, b: 2 }])
    expect(j('(a:1,b:2,c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }])
    expect(j('(a:1 b:2 c:3)')).toMatchObject(['(', { a: 1, b: 2, c: 3 }])

    expect(j('(a:1+2,b:3)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3 }])
    expect(j('(a:1+2,b:3,c:4)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3, c: 4 }])
    expect(j('(a:1+2,b:3+4,c:5)'))
      .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }])
    expect(j('(a:1+2,b:3+4,c:5+6)'))
      .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }])

    expect(j('(a:1+2 b:3)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3 }])
    expect(j('(a:1+2 b:3 c:4)')).toMatchObject(['(', { a: ['+', 1, 2], b: 3, c: 4 }])
    expect(j('(a:1+2 b:3+4 c:5)'))
      .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }])
    expect(j('(a:1+2 b:3+4 c:5+6)'))
      .toMatchObject(['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }])
  })



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


  test('paren-preval-basic', () => {
    const je = Jsonic.make().use(Expr, {
      paren: {
        pure: {
          preval: true
        }
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    // This has a paren preval.
    expect(j('foo(1,a)')).toMatchObject(['(', 'foo', [1, 'a']])
    expect(j('foo (1,a)')).toMatchObject(['(', 'foo', [1, 'a']])

    expect(j('foo(a:1,b:2)')).toMatchObject(['(', 'foo', { a: 1, b: 2 }])
    expect(j('foo(a:b:1,c:2)')).toMatchObject(['(', 'foo', { a: { b: 1 }, c: 2 }])
  })


  test('paren-preval-implicit', () => {
    const je = Jsonic.make().use(Expr, {
      paren: {
        pure: {
          preval: true
        }
      }
    })
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    // But this is an implicit list.
    expect(j('foo,(1,a)')).toMatchObject(['foo', ['(', [1, 'a']]])
    expect(j('foo,(1+2,a)')).toMatchObject(['foo', ['(', [['+', 1, 2], 'a']]])
    expect(j('foo,(1+2+3,a)'))
      .toMatchObject(['foo', ['(', [['+', ['+', 1, 2], 3], 'a']]])
  })


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


