/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */


import { Jsonic, util } from 'jsonic'

import {
  Expr,
  evaluate,
  testing,
} from '../expr'

import type {
  Op,
} from '../expr'


const { omap } = util

const C = (x: any) => JSON.parse(JSON.stringify(x))

// Walk expr tree into simplified form where first element is the op src.
const S = (x: any): any =>
  (x && Array.isArray(x)) ?
    (0 === x.length ? x : [
      x[0].src || S(x[0]),
      ...(1 < x.length ? (x.slice(1).map((t: any) => S(t))) : [])]
      .filter(t => undefined !== t)) :
    (null != x && 'object' === typeof (x) ? omap(x, ([n, v]) => [n, S(v)]) : x)

const mj =
  (je: Jsonic) => (s: string, m?: any) => C(S(je(s, m)))


const _mo_ = 'toMatchObject'


function makeOp(opspec: any): Op {
  const base = { infix: false, prefix: false, suffix: false, left: 0, right: 0 }
  const op = {
    ...base,
    name: '' + opspec.src,
    terms: opspec.infix ? 2 : 1,
    ...opspec
  }
  return (op as unknown as Op)
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


  test('prattify-basic', () => {
    let prattify = testing.prattify

    let T = (expr: any[], opdef?: Op) => C(S(prattify(expr, opdef)))
    let ME = makeExpr
    let MO = makeOp

    let PLUS_LA = MO({ infix: true, src: '+', left: 140, right: 150 })
    let PLUS_RA = MO({ infix: true, src: '+', left: 150, right: 140 })

    let MUL_LA = MO({ infix: true, src: '*', left: 160, right: 170 })
    let PIPE_LA = MO({ infix: true, src: '|', left: 18000, right: 17000 })

    let AT_P = MO({ prefix: true, src: '@', right: 1500 })
    let PER_P = MO({ prefix: true, src: '%', right: 1300 })

    let BANG_S = MO({ suffix: true, src: '!', left: 1600 })
    let QUEST_S = MO({ suffix: true, src: '?', left: 1400 })


    let E: any

    // console.log(S(['+', 1, 2]))
    // console.log(S([{ src: '+' }, 1, 2]))
    // console.log(S([{ src: '+' }, [{ src: '+' }, 1, 2], 3]))


    // 1+2+N => (1+2)+N
    expect(T(E = ME(PLUS_LA, 1, 2), PLUS_LA))[_mo_](['+', ['+', 1, 2]])
    expect(C(S(E)))[_mo_](['+', ['+', 1, 2]])

    // 1+2+N => 1+(2+N)
    expect(T(E = ME(PLUS_RA, 1, 2), PLUS_RA))[_mo_](['+', 2])
    expect(C(S(E)))[_mo_](['+', 1, ['+', 2]])

    // 1+2*N => 1+(2*N)
    expect(T(E = ME(PLUS_LA, 1, 2), MUL_LA))[_mo_](['*', 2])
    expect(C(S(E)))[_mo_](['+', 1, ['*', 2]])

    // 1*2+N => (1+2)+N
    expect(T(E = ME(MUL_LA, 1, 2), PLUS_LA))[_mo_](['+', ['*', 1, 2]])
    expect(C(S(E)))[_mo_](['+', ['*', 1, 2]])


    // @1+N => (@1)+N
    expect(T(E = ME(AT_P, 1), PLUS_LA))[_mo_](['+', ['@', 1]])
    expect(C(S(E)))[_mo_](['+', ['@', 1]])

    // 1!+N => (!1)+N
    expect(T(E = ME(BANG_S, 1), PLUS_LA))[_mo_](['+', ['!', 1]])
    expect(C(S(E)))[_mo_](['+', ['!', 1]])


    // @1|N => @(1|N)
    expect(T(E = ME(AT_P, 1), PIPE_LA))[_mo_](['|', 1])
    expect(C(S(E)))[_mo_](['@', ['|', 1]])

    // 1|@N => 1|(@N)
    expect(T(E = ME(PIPE_LA, 1), AT_P))[_mo_](['@'])
    expect(C(S(E)))[_mo_](['|', 1, ['@']])


    // 1!|N => (!1)|N
    expect(T(E = ME(BANG_S, 1), PIPE_LA))[_mo_](['|', ['!', 1]])
    expect(C(S(E)))[_mo_](['|', ['!', 1]])



    // 1+@N => 1+(@N)
    expect(T(E = ME(PLUS_LA, 1), AT_P))[_mo_](['@'])
    expect(C(S(E)))[_mo_](['+', 1, ['@']])

    // @@N => @(@N)
    expect(T(E = ME(AT_P), AT_P))[_mo_](['@'])
    expect(C(S(E)))[_mo_](['@', ['@']])


    // %@N => %(@N)
    expect(T(E = ME(PER_P), AT_P))[_mo_](['@'])
    expect(C(S(E)))[_mo_](['%', ['@']])

    // @%N => @(%N)
    expect(T(E = ME(AT_P), PER_P))[_mo_](['%'])
    expect(C(S(E)))[_mo_](['@', ['%']])



    // 1+2! => 1+(2!)
    // expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['!', 2])
    expect(T(E = ME(PLUS_LA, 1, 2), BANG_S))[_mo_](['+', 1, ['!', 2]])
    expect(C(S(E)))[_mo_](['+', 1, ['!', 2]])

    // 1|2! => (1|2)!
    expect(T(E = ME(PIPE_LA, 1, 2), BANG_S))[_mo_](['!', ['|', 1, 2]])
    expect(C(S(E)))[_mo_](['!', ['|', 1, 2]])


    // 1!! => !(!1)
    expect(T(E = ME(BANG_S, 1), BANG_S))[_mo_](['!', ['!', 1]])
    expect(C(S(E)))[_mo_](['!', ['!', 1]])


    // 1!? => ?(!1)
    expect(T(E = ME(BANG_S, 1), QUEST_S))[_mo_](['?', ['!', 1]])
    expect(C(S(E)))[_mo_](['?', ['!', 1]])

    // 1?! => !(?1)
    expect(T(E = ME(QUEST_S, 1), BANG_S))[_mo_](['!', ['?', 1]])
    expect(C(S(E)))[_mo_](['!', ['?', 1]])


    // @1! => @(1!)
    // expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['!', 1])
    expect(T(E = ME(AT_P, 1), BANG_S))[_mo_](['@', ['!', 1]])
    expect(C(S(E)))[_mo_](['@', ['!', 1]])

    // @1? => (@1)?
    expect(T(E = ME(AT_P, 1), QUEST_S))[_mo_](['?', ['@', 1]])
    expect(C(S(E)))[_mo_](['?', ['@', 1]])


    // @@1! => @(@(1!))
    // expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['!', 1])
    expect(T(E = ME(AT_P, ME(AT_P, 1)), BANG_S))[_mo_](['@', ['@', ['!', 1]]])
    expect(C(S(E)))[_mo_](['@', ['@', ['!', 1]]])

    // @@1? => (@(@1))?
    expect(T(E = ME(AT_P, ME(AT_P, 1)), QUEST_S))[_mo_](['?', ['@', ['@', 1]]])
    expect(C(S(E)))[_mo_](['?', ['@', ['@', 1]]])

  })


  test('prattify-assoc', () => {
    let prattify = testing.prattify

    let T = (expr: any[], opdef?: Op) => C(S(prattify(expr, opdef)))
    let ME = makeExpr
    let MO = makeOp

    let AT_LA = MO({ infix: true, src: '@', left: 14, right: 15 })
    let PER_RA = MO({ infix: true, src: '%', left: 17, right: 16 })

    let E: any


    // 1@2@N
    expect(T(E = ME(AT_LA, 1, 2), AT_LA))[_mo_](['@', ['@', 1, 2]])
    expect(C(S(E)))[_mo_](['@', ['@', 1, 2]])

    // 1@2@3@N
    expect(T(E = ME(AT_LA, ME(AT_LA, 1, 2), 3), AT_LA))
    [_mo_](['@', ['@', ['@', 1, 2], 3]])
    expect(C(S(E)))[_mo_](['@', ['@', ['@', 1, 2], 3]])

    // 1@2@3@4@N
    expect(T(E = ME(AT_LA, ME(AT_LA, ME(AT_LA, 1, 2), 3), 4), AT_LA))
    [_mo_](['@', ['@', ['@', ['@', 1, 2], 3], 4]])
    expect(C(S(E)))[_mo_](['@', ['@', ['@', ['@', 1, 2], 3], 4]])

    // 1@2@3@4@5@N
    expect(T(E = ME(AT_LA, ME(AT_LA, ME(AT_LA, ME(AT_LA, 1, 2), 3), 4), 5), AT_LA))
    [_mo_](['@', ['@', ['@', ['@', ['@', 1, 2], 3], 4], 5]])
    expect(C(S(E)))[_mo_](['@', ['@', ['@', ['@', ['@', 1, 2], 3], 4], 5]])


    // 1%2%N
    expect(T(E = ME(PER_RA, 1, 2), PER_RA))[_mo_](['%', 2])
    expect(C(S(E)))[_mo_](['%', 1, ['%', 2]])

    // 1%2%3%N
    expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, 3)), PER_RA))[_mo_](['%', 3])
    expect(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3]]])

    // 1%2%3%4%N
    expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, ME(PER_RA, 3, 4))), PER_RA))
    [_mo_](['%', 4])
    expect(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3, ['%', 4]]]])

    // 1%2%3%4%5%N
    expect(T(E = ME(PER_RA, 1, ME(PER_RA, 2, ME(PER_RA, 3, ME(PER_RA, 4, 5)))),
      PER_RA))[_mo_](['%', 5])
    expect(C(S(E)))[_mo_](['%', 1, ['%', 2, ['%', 3, ['%', 4, ['%', 5]]]]])


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


  test('implicit-list-top-basic', () => {
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
    expect(j('[true,false],1+2+3,4,11'))
    [_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11])
    expect(j('[true,false],1+2+3+4,5,11'))
    [_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

    expect(j('[true,false] 1 2 11'))[_mo_]([[true, false], 1, 2, 11])
    expect(j('[true,false] 1+2 3 11'))[_mo_]([[true, false], ['+', 1, 2], 3, 11])
    expect(j('[true,false] 1+2+3 4 11'))
    [_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, 11])
    expect(j('[true,false] 1+2+3+4 5 11'))
    [_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11])

    expect(j('[true,false],1,2,{x:11,y:22}'))
    [_mo_]([[true, false], 1, 2, { x: 11, y: 22 }])
    expect(j('[true,false],1+2,3,{x:11,y:22}'))
    [_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }])
    expect(j('[true,false],1+2+3,4,{x:11,y:22}'))
    [_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }])
    expect(j('[true,false],1+2+3+4,5,{x:11,y:22}'))
    [_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }])

    expect(j('[true,false] 1 2 {x:11,y:22}'))
    [_mo_]([[true, false], 1, 2, { x: 11, y: 22 }])
    expect(j('[true,false] 1+2 3 {x:11,y:22}'))
    [_mo_]([[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }])
    expect(j('[true,false] 1+2+3 4 {x:11,y:22}'))
    [_mo_]([[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }])
    expect(j('[true,false] 1+2+3+4 5 {x:11,y:22}'))
    [_mo_]([[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }])

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
    expect(j('(22,1+2+3+4,5,11)'))
    [_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('(22 1 2 11)'))[_mo_](['(', [22, 1, 2, 11]])
    expect(j('(22 1+2 3 11)'))[_mo_](['(', [22, ['+', 1, 2], 3, 11]])
    expect(j('(22 1+2+3 4 11)'))[_mo_](['(', [22, ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('(22 1+2+3+4 5 11)'))
    [_mo_](['(', [22, ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('([true,false],1,2,11)'))[_mo_](['(', [[true, false], 1, 2, 11]])
    expect(j('([true,false],1+2,3,11)'))
    [_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]])
    expect(j('([true,false],1+2+3,4,11)'))
    [_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('([true,false],1+2+3+4,5,11)'))
    [_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('([true,false] 1 2 11)'))[_mo_](['(', [[true, false], 1, 2, 11]])
    expect(j('([true,false] 1+2 3 11)'))
    [_mo_](['(', [[true, false], ['+', 1, 2], 3, 11]])
    expect(j('([true,false] 1+2+3 4 11)'))
    [_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, 11]])
    expect(j('([true,false] 1+2+3+4 5 11)'))
    [_mo_](['(', [[true, false], ['+', ['+', ['+', 1, 2], 3], 4], 5, 11]])

    expect(j('([true,false],1,2,{x:11,y:22})'))
    [_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2,3,{x:11,y:22})'))
    [_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2+3,4,{x:11,y:22})'))
    [_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]])
    expect(j('([true,false],1+2+3+4,5,{x:11,y:22})'))
    [_mo_](['(', [[true, false],
    ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]])

    expect(j('([true,false] 1 2 {x:11,y:22})'))
    [_mo_](['(', [[true, false], 1, 2, { x: 11, y: 22 }]])
    expect(j('([true,false] 1+2 3 {x:11,y:22})'))
    [_mo_](['(', [[true, false], ['+', 1, 2], 3, { x: 11, y: 22 }]])
    expect(j('([true,false] 1+2+3 4 {x:11,y:22})'))
    [_mo_](['(', [[true, false], ['+', ['+', 1, 2], 3], 4, { x: 11, y: 22 }]])
    expect(j('([true,false] 1+2+3+4 5 {x:11,y:22})'))
    [_mo_](['(', [[true, false],
    ['+', ['+', ['+', 1, 2], 3], 4], 5, { x: 11, y: 22 }]])


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
    const j = mj(Jsonic.make().use(Expr))

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

    expect(j('-{z:1,y:2}')).toMatchObject(['-', { z: 1, y: 2 }])
    expect(j('- {z:1,y:2}')).toMatchObject(['-', { z: 1, y: 2 }])
    expect(j('+{z:1,y:2}')).toMatchObject(['+', { z: 1, y: 2 }])
    expect(j('+ {z:1,y:2}')).toMatchObject(['+', { z: 1, y: 2 }])

    expect(j('-{z:1 y:2}')).toMatchObject(['-', { z: 1, y: 2 }])
    expect(j('- {z:1 y:2}')).toMatchObject(['-', { z: 1, y: 2 }])
    expect(j('+{z:1 y:2}')).toMatchObject(['+', { z: 1, y: 2 }])
    expect(j('+ {z:1 y:2}')).toMatchObject(['+', { z: 1, y: 2 }])

    expect(j('-{z:1,y:2,x:3}')).toMatchObject(['-', { z: 1, y: 2, x: 3 }])
    expect(j('- {z:1,y:2,x:3}')).toMatchObject(['-', { z: 1, y: 2, x: 3 }])
    expect(j('+{z:1,y:2,x:3}')).toMatchObject(['+', { z: 1, y: 2, x: 3 }])
    expect(j('+ {z:1,y:2,x:3}')).toMatchObject(['+', { z: 1, y: 2, x: 3 }])

    expect(j('-{z:1 y:2 x:3}')).toMatchObject(['-', { z: 1, y: 2, x: 3 }])
    expect(j('- {z:1 y:2 x:3}')).toMatchObject(['-', { z: 1, y: 2, x: 3 }])
    expect(j('+{z:1 y:2 x:3}')).toMatchObject(['+', { z: 1, y: 2, x: 3 }])
    expect(j('+ {z:1 y:2 x:3}')).toMatchObject(['+', { z: 1, y: 2, x: 3 }])


    expect(j('-{z:-1}')).toMatchObject(['-', { z: ['-', 1] }])
    expect(j('- {z:-1}')).toMatchObject(['-', { z: ['-', 1] }])
    expect(j('+{z:+1}')).toMatchObject(['+', { z: ['+', 1] }])
    expect(j('+ {z:+1}')).toMatchObject(['+', { z: ['+', 1] }])

    expect(j('-{z:2-1}')).toMatchObject(['-', { z: ['-', 2, 1] }])
    expect(j('- {z:2-1}')).toMatchObject(['-', { z: ['-', 2, 1] }])
    expect(j('+{z:2+1}')).toMatchObject(['+', { z: ['+', 2, 1] }])
    expect(j('+ {z:2+1}')).toMatchObject(['+', { z: ['+', 2, 1] }])


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
    const j = mj(je)

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
    const j = mj(je)

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
    const j = mj(je)

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
    const j = mj(je)

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
    const j = mj(je)


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
    const j = mj(je)


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
    const j = mj(Jsonic.make().use(Expr))

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
    const j = mj(Jsonic.make().use(Expr))

    expect(j('{a:(1)}'))[_mo_]({ a: ['(', 1] })
    expect(j('{a:(1,2)}'))[_mo_]({ a: ['(', [1, 2]] })
    expect(j('{a:(1,2,3)}'))[_mo_]({ a: ['(', [1, 2, 3]] })


    expect(j('{a:(1),b:9}'))[_mo_]({ a: ['(', 1], b: 9 })
    expect(j('{a:(1,2),b:9}'))[_mo_]({ a: ['(', [1, 2]], b: 9 })
    expect(j('{a:(1,2,3),b:9}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 })

    expect(j('{a:(1),b:9,c:8}'))[_mo_]({ a: ['(', 1], b: 9, c: 8 })
    expect(j('{a:(1,2),b:9,c:8}'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('{a:(1,2,3),b:9,c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('{a:(1),b:(9)}'))[_mo_]({ a: ['(', 1], b: ['(', 9] })
    expect(j('{a:(1,2),b:(9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('{a:(1,2,3),b:(9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('{a:(1),b:(9),c:8}'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('{a:(1,2),b:(9),c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('{a:(1,2,3),b:(9),c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('{a:(1),b:(8,9)}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('{a:(1,2),b:(8,9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('{a:(1,2,3),b:(8,9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('{a:(1),b:(8,9),c:8}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('{a:(1,2),b:(8,9),c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('{a:(1,2,3),b:(8,9),c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })


    expect(j('{d:0,a:(1)}'))[_mo_]({ d: 0, a: ['(', 1] })
    expect(j('{d:0,a:(1,2)}'))[_mo_]({ d: 0, a: ['(', [1, 2]] })
    expect(j('{d:0,a:(1,2,3)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] })


    expect(j('{d:0,a:(1),b:9}'))[_mo_]({ d: 0, a: ['(', 1], b: 9 })
    expect(j('{d:0,a:(1,2),b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 })
    expect(j('{d:0,a:(1,2,3),b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 })

    expect(j('{d:0,a:(1),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 })
    expect(j('{d:0,a:(1,2),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('{d:0,a:(1,2,3),b:9,c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('{d:0,a:(1),b:(9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] })
    expect(j('{d:0,a:(1,2),b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('{d:0,a:(1,2,3),b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('{d:0,a:(1),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('{d:0,a:(1,2),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('{d:0,a:(1,2,3),b:(9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('{d:0,a:(1),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('{d:0,a:(1,2),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('{d:0,a:(1,2,3),b:(8,9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('{d:0,a:(1),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('{d:0,a:(1,2),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('{d:0,a:(1,2,3),b:(8,9),c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })



    expect(j('a:(1)'))[_mo_]({ a: ['(', 1] })
    expect(j('a:(1,2)'))[_mo_]({ a: ['(', [1, 2]] })
    expect(j('a:(1,2,3)'))[_mo_]({ a: ['(', [1, 2, 3]] })


    expect(j('a:(1),b:9'))[_mo_]({ a: ['(', 1], b: 9 })
    expect(j('a:(1,2),b:9'))[_mo_]({ a: ['(', [1, 2]], b: 9 })
    expect(j('a:(1,2,3),b:9'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 })

    expect(j('a:(1),b:9,c:8'))[_mo_]({ a: ['(', 1], b: 9, c: 8 })
    expect(j('a:(1,2),b:9,c:8'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('a:(1,2,3),b:9,c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('a:(1),b:(9)'))[_mo_]({ a: ['(', 1], b: ['(', 9] })
    expect(j('a:(1,2),b:(9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('a:(1,2,3),b:(9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('a:(1),b:(9),c:8'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('a:(1,2),b:(9),c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('a:(1,2,3),b:(9),c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('a:(1),b:(8,9)'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('a:(1,2),b:(8,9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('a:(1,2,3),b:(8,9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('a:(1),b:(8,9),c:8'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('a:(1,2),b:(8,9),c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('a:(1,2,3),b:(8,9),c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })


    expect(j('d:0,a:(1)'))[_mo_]({ d: 0, a: ['(', 1] })
    expect(j('d:0,a:(1,2)'))[_mo_]({ d: 0, a: ['(', [1, 2]] })
    expect(j('d:0,a:(1,2,3)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] })


    expect(j('d:0,a:(1),b:9'))[_mo_]({ d: 0, a: ['(', 1], b: 9 })
    expect(j('d:0,a:(1,2),b:9'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 })
    expect(j('d:0,a:(1,2,3),b:9'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 })

    expect(j('d:0,a:(1),b:9,c:8'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 })
    expect(j('d:0,a:(1,2),b:9,c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('d:0,a:(1,2,3),b:9,c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('d:0,a:(1),b:(9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] })
    expect(j('d:0,a:(1,2),b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('d:0,a:(1,2,3),b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('d:0,a:(1),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('d:0,a:(1,2),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('d:0,a:(1,2,3),b:(9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('d:0,a:(1),b:(8,9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('d:0,a:(1,2),b:(8,9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('d:0,a:(1,2,3),b:(8,9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('d:0,a:(1),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('d:0,a:(1,2),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('d:0,a:(1,2,3),b:(8,9),c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })

  })


  test('paren-map-implicit-structure-space', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('{a:(1)}'))[_mo_]({ a: ['(', 1] })
    expect(j('{a:(1 2)}'))[_mo_]({ a: ['(', [1, 2]] })
    expect(j('{a:(1 2 3)}'))[_mo_]({ a: ['(', [1, 2, 3]] })


    expect(j('{a:(1) b:9}'))[_mo_]({ a: ['(', 1], b: 9 })
    expect(j('{a:(1 2) b:9}'))[_mo_]({ a: ['(', [1, 2]], b: 9 })
    expect(j('{a:(1 2 3) b:9}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 })

    expect(j('{a:(1) b:9 c:8}'))[_mo_]({ a: ['(', 1], b: 9, c: 8 })
    expect(j('{a:(1 2) b:9 c:8}'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('{a:(1 2 3) b:9 c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('{a:(1) b:(9)}'))[_mo_]({ a: ['(', 1], b: ['(', 9] })
    expect(j('{a:(1 2) b:(9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('{a:(1 2 3) b:(9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('{a:(1) b:(9) c:8}'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('{a:(1 2) b:(9) c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('{a:(1 2 3) b:(9) c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('{a:(1) b:(8 9)}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('{a:(1 2) b:(8 9)}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('{a:(1 2 3) b:(8 9)}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('{a:(1) b:(8 9) c:8}'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('{a:(1 2) b:(8 9) c:8}'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('{a:(1 2 3) b:(8 9) c:8}'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })


    expect(j('{d:0,a:(1)}'))[_mo_]({ d: 0, a: ['(', 1] })
    expect(j('{d:0,a:(1 2)}'))[_mo_]({ d: 0, a: ['(', [1, 2]] })
    expect(j('{d:0,a:(1 2 3)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] })


    expect(j('{d:0,a:(1) b:9}'))[_mo_]({ d: 0, a: ['(', 1], b: 9 })
    expect(j('{d:0,a:(1 2) b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 })
    expect(j('{d:0,a:(1 2 3) b:9}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 })

    expect(j('{d:0,a:(1) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 })
    expect(j('{d:0,a:(1 2) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('{d:0,a:(1 2 3) b:9 c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('{d:0,a:(1) b:(9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] })
    expect(j('{d:0,a:(1 2) b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('{d:0,a:(1 2 3) b:(9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('{d:0,a:(1) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('{d:0,a:(1 2) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('{d:0,a:(1 2 3) b:(9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('{d:0,a:(1) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('{d:0,a:(1 2) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('{d:0,a:(1 2 3) b:(8 9)}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('{d:0,a:(1) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('{d:0,a:(1 2) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('{d:0,a:(1 2 3) b:(8 9) c:8}'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })



    expect(j('a:(1)'))[_mo_]({ a: ['(', 1] })
    expect(j('a:(1 2)'))[_mo_]({ a: ['(', [1, 2]] })
    expect(j('a:(1 2 3)'))[_mo_]({ a: ['(', [1, 2, 3]] })


    expect(j('a:(1) b:9'))[_mo_]({ a: ['(', 1], b: 9 })
    expect(j('a:(1 2) b:9'))[_mo_]({ a: ['(', [1, 2]], b: 9 })
    expect(j('a:(1 2 3) b:9'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9 })

    expect(j('a:(1) b:9 c:8'))[_mo_]({ a: ['(', 1], b: 9, c: 8 })
    expect(j('a:(1 2) b:9 c:8'))[_mo_]({ a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('a:(1 2 3) b:9 c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('a:(1) b:(9)'))[_mo_]({ a: ['(', 1], b: ['(', 9] })
    expect(j('a:(1 2) b:(9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('a:(1 2 3) b:(9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('a:(1) b:(9) c:8'))[_mo_]({ a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('a:(1 2) b:(9) c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('a:(1 2 3) b:(9) c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('a:(1) b:(8 9)'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('a:(1 2) b:(8 9)'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('a:(1 2 3) b:(8 9)'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('a:(1) b:(8 9) c:8'))[_mo_]({ a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('a:(1 2) b:(8 9) c:8'))[_mo_]({ a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('a:(1 2 3) b:(8 9) c:8'))[_mo_]({ a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })


    expect(j('d:0,a:(1)'))[_mo_]({ d: 0, a: ['(', 1] })
    expect(j('d:0,a:(1 2)'))[_mo_]({ d: 0, a: ['(', [1, 2]] })
    expect(j('d:0,a:(1 2 3)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]] })


    expect(j('d:0,a:(1) b:9'))[_mo_]({ d: 0, a: ['(', 1], b: 9 })
    expect(j('d:0,a:(1 2) b:9'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9 })
    expect(j('d:0,a:(1 2 3) b:9'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9 })

    expect(j('d:0,a:(1) b:9 c:8'))[_mo_]({ d: 0, a: ['(', 1], b: 9, c: 8 })
    expect(j('d:0,a:(1 2) b:9 c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: 9, c: 8 })
    expect(j('d:0,a:(1 2 3) b:9 c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: 9, c: 8 })


    expect(j('d:0,a:(1) b:(9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9] })
    expect(j('d:0,a:(1 2) b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9] })
    expect(j('d:0,a:(1 2 3) b:(9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9] })

    expect(j('d:0,a:(1) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', 9], c: 8 })
    expect(j('d:0,a:(1 2) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', 9], c: 8 })
    expect(j('d:0,a:(1 2 3) b:(9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', 9], c: 8 })


    expect(j('d:0,a:(1) b:(8 9)'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]] })
    expect(j('d:0,a:(1 2) b:(8 9)'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]] })
    expect(j('d:0,a:(1 2 3) b:(8 9)'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]] })

    expect(j('d:0,a:(1) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', 1], b: ['(', [8, 9]], c: 8 })
    expect(j('d:0,a:(1 2) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2]], b: ['(', [8, 9]], c: 8 })
    expect(j('d:0,a:(1 2 3) b:(8 9) c:8'))[_mo_]({ d: 0, a: ['(', [1, 2, 3]], b: ['(', [8, 9]], c: 8 })

  })


  test('paren-list-implicit-structure-comma', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('[(1)]'))[_mo_]([['(', 1]])
    expect(j('[(1,2)]'))[_mo_]([['(', [1, 2]]])
    expect(j('[(1,2,3)]'))[_mo_]([['(', [1, 2, 3]]])


    expect(j('[(1),9]'))[_mo_]([['(', 1], 9])
    expect(j('[(1,2),9]'))[_mo_]([['(', [1, 2]], 9])
    expect(j('[(1,2,3),9]'))[_mo_]([['(', [1, 2, 3]], 9])

    expect(j('[(1),9,8]'))[_mo_]([['(', 1], 9, 8])
    expect(j('[(1,2),9,8]'))[_mo_]([['(', [1, 2]], 9, 8])
    expect(j('[(1,2,3),9,8]'))[_mo_]([['(', [1, 2, 3]], 9, 8])


    expect(j('[(1),(9)]'))[_mo_]([['(', 1], ['(', 9]])
    expect(j('[(1,2),(9)]'))[_mo_]([['(', [1, 2]], ['(', 9]])
    expect(j('[(1,2,3),(9)]'))[_mo_]([['(', [1, 2, 3]], ['(', 9]])

    expect(j('[(1),(9),8]'))[_mo_]([['(', 1], ['(', 9], 8])
    expect(j('[(1,2),(9),8]'))[_mo_]([['(', [1, 2]], ['(', 9], 8])
    expect(j('[(1,2,3),(9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8])

    expect(j('[(1),(9),(8)]'))[_mo_]([['(', 1], ['(', 9], ['(', 8]])

    expect(j('[(1),(8,9)]'))[_mo_]([['(', 1], ['(', [8, 9]]])
    expect(j('[(1,2),(8,9)]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]])
    expect(j('[(1,2,3),(8,9)]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('[(1),(8,9),8]'))[_mo_]([['(', 1], ['(', [8, 9]], 8])
    expect(j('[(1,2),(8,9),8]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('[(1,2,3),(8,9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8])


    expect(j('[0,(1)]'))[_mo_]([0, ['(', 1]])
    expect(j('[0,(1,2)]'))[_mo_]([0, ['(', [1, 2]]])
    expect(j('[0,(1,2,3)]'))[_mo_]([0, ['(', [1, 2, 3]]])


    expect(j('[0,(1),9]'))[_mo_]([0, ['(', 1], 9])
    expect(j('[0,(1,2),9]'))[_mo_]([0, ['(', [1, 2]], 9])
    expect(j('[0,(1,2,3),9]'))[_mo_]([0, ['(', [1, 2, 3]], 9])

    expect(j('[0,(1),9,8]'))[_mo_]([0, ['(', 1], 9, 8])
    expect(j('[0,(1,2),9,8]'))[_mo_]([0, ['(', [1, 2]], 9, 8])
    expect(j('[0,(1,2,3),9,8]'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8])


    expect(j('[0,(1),(9)]'))[_mo_]([0, ['(', 1], ['(', 9]])
    expect(j('[0,(1,2),(9)]'))[_mo_]([0, ['(', [1, 2]], ['(', 9]])
    expect(j('[0,(1,2,3),(9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]])

    expect(j('[0,(1),(9),8]'))[_mo_]([0, ['(', 1], ['(', 9], 8])
    expect(j('[0,(1,2),(9),8]'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8])
    expect(j('[0,(1,2,3),(9),8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('[0,(1),(8,9)]'))[_mo_]([0, ['(', 1], ['(', [8, 9]]])
    expect(j('[0,(1,2),(8,9)]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]])
    expect(j('[0,(1,2,3),(8,9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('[0,(1),(8,9),8]'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8])
    expect(j('[0,(1,2),(8,9),8]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('[0,(1,2,3),(8,9),8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8])



    expect(j('(1)'))[_mo_](['(', 1])
    expect(j('(1,2)'))[_mo_](['(', [1, 2]])
    expect(j('(1,2,3)'))[_mo_](['(', [1, 2, 3]])


    expect(j('(1),9'))[_mo_]([['(', 1], 9])
    expect(j('(1,2),9'))[_mo_]([['(', [1, 2]], 9])
    expect(j('(1,2,3),9'))[_mo_]([['(', [1, 2, 3]], 9])

    expect(j('(1),9,8'))[_mo_]([['(', 1], 9, 8])
    expect(j('(1,2),9,8'))[_mo_]([['(', [1, 2]], 9, 8])
    expect(j('(1,2,3),9,8'))[_mo_]([['(', [1, 2, 3]], 9, 8])


    expect(j('(1),(9)'))[_mo_]([['(', 1], ['(', 9]])
    expect(j('(1,2),(9)'))[_mo_]([['(', [1, 2]], ['(', 9]])
    expect(j('(1,2,3),(9)'))[_mo_]([['(', [1, 2, 3]], ['(', 9]])

    expect(j('(1),(9),(8)'))[_mo_]([['(', 1], ['(', 9], ['(', 8]])

    expect(j('(1),(9),8'))[_mo_]([['(', 1], ['(', 9], 8])
    expect(j('(1,2),(9),8'))[_mo_]([['(', [1, 2]], ['(', 9], 8])
    expect(j('(1,2,3),(9),8'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('(1),(8,9)'))[_mo_]([['(', 1], ['(', [8, 9]]])
    expect(j('(1,2),(8,9)'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]])
    expect(j('(1,2,3),(8,9)'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('(1),(8,9),8'))[_mo_]([['(', 1], ['(', [8, 9]], 8])
    expect(j('(1,2),(8,9),8'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('(1,2,3),(8,9),8'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8])


    expect(j('0,(1)'))[_mo_]([0, ['(', 1]])
    expect(j('0,(1,2)'))[_mo_]([0, ['(', [1, 2]]])
    expect(j('0,(1,2,3)'))[_mo_]([0, ['(', [1, 2, 3]]])


    expect(j('0,(1),9'))[_mo_]([0, ['(', 1], 9])
    expect(j('0,(1,2),9'))[_mo_]([0, ['(', [1, 2]], 9])
    expect(j('0,(1,2,3),9'))[_mo_]([0, ['(', [1, 2, 3]], 9])

    expect(j('0,(1),9,8'))[_mo_]([0, ['(', 1], 9, 8])
    expect(j('0,(1,2),9,8'))[_mo_]([0, ['(', [1, 2]], 9, 8])
    expect(j('0,(1,2,3),9,8'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8])


    expect(j('0,(1),(9)'))[_mo_]([0, ['(', 1], ['(', 9]])
    expect(j('0,(1,2),(9)'))[_mo_]([0, ['(', [1, 2]], ['(', 9]])
    expect(j('0,(1,2,3),(9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]])

    expect(j('0,(1),(9),8'))[_mo_]([0, ['(', 1], ['(', 9], 8])
    expect(j('0,(1,2),(9),8'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8])
    expect(j('0,(1,2,3),(9),8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('0,(1),(8,9)'))[_mo_]([0, ['(', 1], ['(', [8, 9]]])
    expect(j('0,(1,2),(8,9)'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]])
    expect(j('0,(1,2,3),(8,9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('0,(1),(8,9),8'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8])
    expect(j('0,(1,2),(8,9),8'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('0,(1,2,3),(8,9),8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8])

  })


  test('paren-list-implicit-structure-space', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('[(1)]'))[_mo_]([['(', 1]])
    expect(j('[(1 2)]'))[_mo_]([['(', [1, 2]]])
    expect(j('[(1 2 3)]'))[_mo_]([['(', [1, 2, 3]]])


    expect(j('[(1) 9]'))[_mo_]([['(', 1], 9])
    expect(j('[(1 2) 9]'))[_mo_]([['(', [1, 2]], 9])
    expect(j('[(1 2 3) 9]'))[_mo_]([['(', [1, 2, 3]], 9])

    expect(j('[(1) 9 8]'))[_mo_]([['(', 1], 9, 8])
    expect(j('[(1 2) 9 8]'))[_mo_]([['(', [1, 2]], 9, 8])
    expect(j('[(1 2 3) 9 8]'))[_mo_]([['(', [1, 2, 3]], 9, 8])


    expect(j('[(1) (9)]'))[_mo_]([['(', 1], ['(', 9]])
    expect(j('[(1 2) (9)]'))[_mo_]([['(', [1, 2]], ['(', 9]])
    expect(j('[(1 2 3) (9)]'))[_mo_]([['(', [1, 2, 3]], ['(', 9]])

    expect(j('[(1) (9) (8)]'))[_mo_]([['(', 1], ['(', 9], ['(', 8]])

    expect(j('[(1) (9) 8]'))[_mo_]([['(', 1], ['(', 9], 8])
    expect(j('[(1 2) (9) 8]'))[_mo_]([['(', [1, 2]], ['(', 9], 8])
    expect(j('[(1 2 3) (9) 8]'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('[(1) (8,9)]'))[_mo_]([['(', 1], ['(', [8, 9]]])
    expect(j('[(1 2) (8,9)]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]])
    expect(j('[(1 2 3) (8,9)]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('[(1) (8,9),8]'))[_mo_]([['(', 1], ['(', [8, 9]], 8])
    expect(j('[(1 2) (8,9),8]'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('[(1 2 3) (8,9),8]'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8])


    expect(j('[0 (1)]'))[_mo_]([0, ['(', 1]])
    expect(j('[0 (1 2)]'))[_mo_]([0, ['(', [1, 2]]])
    expect(j('[0 (1 2 3)]'))[_mo_]([0, ['(', [1, 2, 3]]])


    expect(j('[0 (1) 9]'))[_mo_]([0, ['(', 1], 9])
    expect(j('[0 (1 2) 9]'))[_mo_]([0, ['(', [1, 2]], 9])
    expect(j('[0 (1 2 3) 9]'))[_mo_]([0, ['(', [1, 2, 3]], 9])

    expect(j('[0 (1) 9 8]'))[_mo_]([0, ['(', 1], 9, 8])
    expect(j('[0 (1 2) 9 8]'))[_mo_]([0, ['(', [1, 2]], 9, 8])
    expect(j('[0 (1 2 3) 9 8]'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8])


    expect(j('[0 (1) (9)]'))[_mo_]([0, ['(', 1], ['(', 9]])
    expect(j('[0 (1 2) (9)]'))[_mo_]([0, ['(', [1, 2]], ['(', 9]])
    expect(j('[0 (1 2 3) (9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]])

    expect(j('[0 (1) (9) 8]'))[_mo_]([0, ['(', 1], ['(', 9], 8])
    expect(j('[0 (1 2) (9) 8]'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8])
    expect(j('[0 (1 2 3) (9) 8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('[0 (1) (8 9)]'))[_mo_]([0, ['(', 1], ['(', [8, 9]]])
    expect(j('[0 (1 2) (8 9)]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]])
    expect(j('[0 (1 2 3) (8 9)]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('[0 (1) (8 9) 8]'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8])
    expect(j('[0 (1 2) (8 9) 8]'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('[0 (1 2 3) (8 9) 8]'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8])



    expect(j('(1)'))[_mo_](['(', 1])
    expect(j('(1 2)'))[_mo_](['(', [1, 2]])
    expect(j('(1 2 3)'))[_mo_](['(', [1, 2, 3]])


    expect(j('(1) 9'))[_mo_]([['(', 1], 9])
    expect(j('(1 2) 9'))[_mo_]([['(', [1, 2]], 9])
    expect(j('(1 2 3) 9'))[_mo_]([['(', [1, 2, 3]], 9])

    expect(j('(1) 9 8'))[_mo_]([['(', 1], 9, 8])
    expect(j('(1 2) 9 8'))[_mo_]([['(', [1, 2]], 9, 8])
    expect(j('(1 2 3) 9 8'))[_mo_]([['(', [1, 2, 3]], 9, 8])


    expect(j('(1) (9)'))[_mo_]([['(', 1], ['(', 9]])
    expect(j('(1 2) (9)'))[_mo_]([['(', [1, 2]], ['(', 9]])
    expect(j('(1 2 3) (9)'))[_mo_]([['(', [1, 2, 3]], ['(', 9]])

    expect(j('(1) (9) 8'))[_mo_]([['(', 1], ['(', 9], 8])
    expect(j('(1 2) (9) 8'))[_mo_]([['(', [1, 2]], ['(', 9], 8])
    expect(j('(1 2 3) (9) 8'))[_mo_]([['(', [1, 2, 3]], ['(', 9], 8])

    expect(j('(1) (9) (8)'))[_mo_]([['(', 1], ['(', 9], ['(', 8]])

    expect(j('(1) (8 9)'))[_mo_]([['(', 1], ['(', [8, 9]]])
    expect(j('(1 2) (8 9)'))[_mo_]([['(', [1, 2]], ['(', [8, 9]]])
    expect(j('(1 2 3) (8 9)'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('(1) (8 9) 8'))[_mo_]([['(', 1], ['(', [8, 9]], 8])
    expect(j('(1 2) (8 9) 8'))[_mo_]([['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('(1 2 3) (8 9) 8'))[_mo_]([['(', [1, 2, 3]], ['(', [8, 9]], 8])


    expect(j('0 (1)'))[_mo_]([0, ['(', 1]])
    expect(j('0 (1 2)'))[_mo_]([0, ['(', [1, 2]]])
    expect(j('0 (1 2 3)'))[_mo_]([0, ['(', [1, 2, 3]]])


    expect(j('0 (1) 9'))[_mo_]([0, ['(', 1], 9])
    expect(j('0 (1 2) 9'))[_mo_]([0, ['(', [1, 2]], 9])
    expect(j('0 (1 2 3) 9'))[_mo_]([0, ['(', [1, 2, 3]], 9])

    expect(j('0 (1) 9 8'))[_mo_]([0, ['(', 1], 9, 8])
    expect(j('0 (1 2) 9 8'))[_mo_]([0, ['(', [1, 2]], 9, 8])
    expect(j('0 (1 2 3) 9 8'))[_mo_]([0, ['(', [1, 2, 3]], 9, 8])


    expect(j('0 (1) (9)'))[_mo_]([0, ['(', 1], ['(', 9]])
    expect(j('0 (1 2) (9)'))[_mo_]([0, ['(', [1, 2]], ['(', 9]])
    expect(j('0 (1 2 3) (9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9]])

    expect(j('0 (1) (9) 8'))[_mo_]([0, ['(', 1], ['(', 9], 8])
    expect(j('0 (1 2) (9) 8'))[_mo_]([0, ['(', [1, 2]], ['(', 9], 8])
    expect(j('0 (1 2 3) (9) 8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', 9], 8])


    expect(j('0 (1) (8 9)'))[_mo_]([0, ['(', 1], ['(', [8, 9]]])
    expect(j('0 (1 2) (8 9)'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]]])
    expect(j('0 (1 2 3) (8 9)'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]]])

    expect(j('0 (1) (8 9) 8'))[_mo_]([0, ['(', 1], ['(', [8, 9]], 8])
    expect(j('0 (1 2) (8 9) 8'))[_mo_]([0, ['(', [1, 2]], ['(', [8, 9]], 8])
    expect(j('0 (1 2 3) (8 9) 8'))[_mo_]([0, ['(', [1, 2, 3]], ['(', [8, 9]], 8])

  })



  test('paren-implicit-list', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('(a)'))[_mo_](['(', 'a'])
    expect(j('(a,b)'))[_mo_](['(', ['a', 'b']])
    expect(j('(a,b,c)'))[_mo_](['(', ['a', 'b', 'c']])
    expect(j('(a,b,c,d)'))[_mo_](['(', ['a', 'b', 'c', 'd']])

    expect(j('(1,2)'))[_mo_](['(', [1, 2]])
    expect(j('(1+2,3)'))[_mo_](['(', [['+', 1, 2], 3]])
    expect(j('(1+2+3,4)'))[_mo_](['(', [['+', ['+', 1, 2], 3], 4]])
    expect(j('(1+2+3+4,5)'))[_mo_](['(', [['+', ['+', ['+', 1, 2], 3], 4], 5]])

    expect(j('(1+2,3,4)'))[_mo_](['(', [['+', 1, 2], 3, 4]])
    expect(j('(1+2,3+4,5)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], 5]])
    expect(j('(1+2,3+4,5+6)'))
    [_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]])

    expect(j('(a b)'))[_mo_](['(', ['a', 'b']])
    expect(j('(a b c)'))[_mo_](['(', ['a', 'b', 'c']])

    expect(j('(1+2 3)'))[_mo_](['(', [['+', 1, 2], 3]])
    expect(j('(1+2 3 4)'))[_mo_](['(', [['+', 1, 2], 3, 4]])
    expect(j('(1+2 3+4 5)'))[_mo_](['(', [['+', 1, 2], ['+', 3, 4], 5]])
    expect(j('(1+2 3+4 5+6)'))
    [_mo_](['(', [['+', 1, 2], ['+', 3, 4], ['+', 5, 6]]])

    // Default plain paren does not have a prefix, so this is an implicit list.
    expect(j('foo(1,a)'))[_mo_](['foo', ['(', [1, 'a']]])
    expect(j('foo,(1,a)'))[_mo_](['foo', ['(', [1, 'a']]])
    expect(j('foo (1,a)'))[_mo_](['foo', ['(', [1, 'a']]])

  })


  test('paren-implicit-map', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('(a:1,b:2)'))[_mo_](['(', { a: 1, b: 2 }])
    expect(j('(a:1 b:2)'))[_mo_](['(', { a: 1, b: 2 }])
    expect(j('(a:1,b:2,c:3)'))[_mo_](['(', { a: 1, b: 2, c: 3 }])
    expect(j('(a:1 b:2 c:3)'))[_mo_](['(', { a: 1, b: 2, c: 3 }])

    expect(j('(a:1+2,b:3)'))[_mo_](['(', { a: ['+', 1, 2], b: 3 }])
    expect(j('(a:1+2,b:3,c:4)'))[_mo_](['(', { a: ['+', 1, 2], b: 3, c: 4 }])
    expect(j('(a:1+2,b:3+4,c:5)'))
    [_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }])
    expect(j('(a:1+2,b:3+4,c:5+6)'))
    [_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }])

    expect(j('(a:1+2 b:3)'))[_mo_](['(', { a: ['+', 1, 2], b: 3 }])
    expect(j('(a:1+2 b:3 c:4)'))[_mo_](['(', { a: ['+', 1, 2], b: 3, c: 4 }])
    expect(j('(a:1+2 b:3+4 c:5)'))
    [_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: 5 }])
    expect(j('(a:1+2 b:3+4 c:5+6)'))
    [_mo_](['(', { a: ['+', 1, 2], b: ['+', 3, 4], c: ['+', 5, 6] }])
  })


  test('add-paren', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        angle: {
          paren: true, osrc: '<', csrc: '>'
        }
      }
    })
    const j = mj(je)


    expect(j('<1>'))[_mo_](['<', 1])
    expect(j('<<1>>'))[_mo_](['<', ['<', 1]])
    expect(j('(<1>)'))[_mo_](['(', ['<', 1]])
    expect(j('<(1)>'))[_mo_](['<', ['(', 1]])

    expect(() => j('<1)')).toThrow('unexpected')

    expect(j('1*(2+3)'))[_mo_](['*', 1, ['(', ['+', 2, 3]]])
    expect(j('1*<2+3>'))[_mo_](['*', 1, ['<', ['+', 2, 3]]])
  })


  test('paren-preval-basic', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        plain: {
          preval: {},
        },
        angle: {
          osrc: '<',
          csrc: '>',
          paren: true,
          preval: { active: true },
        }
      }
    })
    const j = mj(je)

    expect(j('(1)'))[_mo_](['(', 1])
    expect(j('(1),2'))[_mo_]([['(', 1], 2])
    expect(j('3(1),2'))[_mo_]([['(', 3, 1], 2])

    // This has a paren preval.
    expect(j('foo(1,a)'))[_mo_](['(', 'foo', [1, 'a']])
    expect(j('foo (1,a)'))[_mo_](['(', 'foo', [1, 'a']])

    expect(j('foo(a:1,b:2)'))[_mo_](['(', 'foo', { a: 1, b: 2 }])
    expect(j('foo(a:b:1,c:2)'))[_mo_](['(', 'foo', { a: { b: 1 }, c: 2 }])


    expect(j('a:b<c>'))[_mo_]({ a: ['<', 'b', 'c'] })
    expect(j('a:b<c,d>'))[_mo_]({ a: ['<', 'b', ['c', 'd']] })
    expect(j('a:b<1+2,3+4>'))
    [_mo_]({ a: ['<', 'b', [['+', 1, 2], ['+', 3, 4]]] })


    expect(j('<1>'))[_mo_](['<', 1])
    expect(j('1<2>'))[_mo_](['<', 1, 2])
    expect(j('<1><2>'))[_mo_](['<', ['<', 1], 2])
    expect(j('1<2><3>'))[_mo_](['<', ['<', 1, 2], 3])
    expect(j('<1><2><3>'))[_mo_](['<', ['<', ['<', 1], 2], 3])
    expect(j('1<2><3><4>'))[_mo_](['<', ['<', ['<', 1, 2], 3], 4])
    expect(j('<1><2><3><4>'))[_mo_](['<', ['<', ['<', ['<', 1], 2], 3], 4])
    expect(j('1<2><3><4><5>'))[_mo_](['<', ['<', ['<', ['<', 1, 2], 3], 4], 5])

    expect(j('a:<1>'))[_mo_]({ a: ['<', 1] })
    expect(j('a:1<2>'))[_mo_]({ a: ['<', 1, 2] })
    expect(j('a:<1><2>'))[_mo_]({ a: ['<', ['<', 1], 2] })
    expect(j('a:1<2><3>'))[_mo_]({ a: ['<', ['<', 1, 2], 3] })
    expect(j('a:<1><2><3>'))[_mo_]({ a: ['<', ['<', ['<', 1], 2], 3] })
    expect(j('a:1<2><3><4>'))[_mo_]({ a: ['<', ['<', ['<', 1, 2], 3], 4] })
    expect(j('a:<1><2><3><4>'))[_mo_]({ a: ['<', ['<', ['<', ['<', 1], 2], 3], 4] })
    expect(j('a:1<2><3><4><5>'))
    [_mo_]({ a: ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5] })

    expect(j('9+<1>'))[_mo_](['+', 9, ['<', 1]])
    expect(j('9+1<2>'))[_mo_](['+', 9, ['<', 1, 2]])
    expect(j('9+<1><2>'))[_mo_](['+', 9, ['<', ['<', 1], 2]])
    expect(j('9+1<2><3>'))[_mo_](['+', 9, ['<', ['<', 1, 2], 3]])
    expect(j('9+<1><2><3>'))[_mo_](['+', 9, ['<', ['<', ['<', 1], 2], 3]])
    expect(j('9+1<2><3><4>'))[_mo_](['+', 9, ['<', ['<', ['<', 1, 2], 3], 4]])
    expect(j('9+<1><2><3><4>'))
    [_mo_](['+', 9, ['<', ['<', ['<', ['<', 1], 2], 3], 4]])
    expect(j('9+1<2><3><4><5>'))
    [_mo_](['+', 9, ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5]])

    expect(j('<1>+9'))[_mo_](['+', ['<', 1], 9])
    expect(j('1<2>+9'))[_mo_](['+', ['<', 1, 2], 9])
    expect(j('<1><2>+9'))[_mo_](['+', ['<', ['<', 1], 2], 9])
    expect(j('1<2><3>+9'))[_mo_](['+', ['<', ['<', 1, 2], 3], 9])
    expect(j('<1><2><3>+9'))[_mo_](['+', ['<', ['<', ['<', 1], 2], 3], 9])
    expect(j('1<2><3><4>+9'))[_mo_](['+', ['<', ['<', ['<', 1, 2], 3], 4], 9])
    expect(j('<1><2><3><4>+9'))
    [_mo_](['+', ['<', ['<', ['<', ['<', 1], 2], 3], 4], 9])
    expect(j('1<2><3><4><5>+9'))
    [_mo_](['+', ['<', ['<', ['<', ['<', 1, 2], 3], 4], 5], 9])

  })


  test('paren-preval-overload', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: {
          suffix: true, left: 15000, src: '!'
        },
        // },
        // paren: {
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
    })
    const j = mj(je)

    expect(j('[1]'))[_mo_]([1])
    expect(j('a[1]'))[_mo_](['[', 'a', 1])
    expect(j('[a[1]]'))[_mo_]([['[', 'a', 1]])
    expect(j('a:[1]'))[_mo_]({ a: [1] })
    expect(j('a:b[1]'))[_mo_]({ a: ['[', 'b', 1] })
    expect(j('a:[b[1]]'))[_mo_]({ a: [['[', 'b', 1]] })
    expect(j('{a:[1]}'))[_mo_]({ a: [1] })
    expect(j('{a:b[1]}'))[_mo_]({ a: ['[', 'b', 1] })
    expect(j('{a:[b[1]]}'))[_mo_]({ a: [['[', 'b', 1]] })

    expect(j('-[1]+2'))[_mo_](['+', ['-', [1]], 2])
    expect(j('-a[1]+2'))[_mo_](['+', ['-', ['[', 'a', 1]], 2])
    expect(j('-[a[1]]+2'))[_mo_](['+', ['-', [['[', 'a', 1]]], 2])
    expect(j('-a:[1]+2'))[_mo_](['-', { a: ['+', [1], 2] }])
    expect(j('-a:b[1]+2'))[_mo_](['-', { a: ['+', ['[', 'b', 1], 2] }])
    expect(j('-a:[b[1]]+2'))[_mo_](['-', { a: ['+', [['[', 'b', 1]], 2] }])
    expect(j('-{a:[1]+2}'))[_mo_](['-', { a: ['+', [1], 2] }])
    expect(j('-{a:b[1]+2}'))[_mo_](['-', { a: ['+', ['[', 'b', 1], 2] }])
    expect(j('-{a:[b[1]]+2}'))[_mo_](['-', { a: ['+', [['[', 'b', 1]], 2] }])

    expect(j('2+[1]'))[_mo_](['+', 2, [1]])
    expect(j('2+a[1]'))[_mo_](['+', 2, ['[', 'a', 1]])
    expect(j('2+[a[1]]'))[_mo_](['+', 2, [['[', 'a', 1]]])
    expect(j('2+a:[1]'))[_mo_](['+', 2, { a: [1] }])
    expect(j('2+a:b[1]'))[_mo_](['+', 2, { a: ['[', 'b', 1] }])
    expect(j('2+a:[b[1]]'))[_mo_](['+', 2, { a: [['[', 'b', 1]] }])
    expect(j('2+{a:[1]}'))[_mo_](['+', 2, { a: [1] }])
    expect(j('2+{a:b[1]}'))[_mo_](['+', 2, { a: ['[', 'b', 1] }])
    expect(j('2+{a:[b[1]]}'))[_mo_](['+', 2, { a: [['[', 'b', 1]] }])

    expect(j('a[b[1]]'))[_mo_](['[', 'a', ['[', 'b', 1]])
    expect(j('a[b[c[1]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', 1]]])
    expect(j('a[b[c[d[1]]]]'))
    [_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', 1]]]])

    expect(j('a[b[[1]]]'))[_mo_](['[', 'a', ['[', 'b', [1]]])
    expect(j('a[b[c[[1]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', [1]]]])
    expect(j('a[b[c[d[[1]]]]]'))
    [_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [1]]]]])

    expect(j('a[b[[1,2]]]'))[_mo_](['[', 'a', ['[', 'b', [1, 2]]])
    expect(j('a[b[c[[1,2]]]]'))[_mo_](['[', 'a', ['[', 'b', ['[', 'c', [1, 2]]]])
    expect(j('a[b[c[d[[1,2]]]]]'))
    [_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [1, 2]]]]])

    expect(j('a[b[[x[1]]]]'))[_mo_](['[', 'a', ['[', 'b', [['[', 'x', 1]]]])
    expect(j('a[b[c[[x[1]]]]]'))
    [_mo_](['[', 'a', ['[', 'b', ['[', 'c', [['[', 'x', 1]]]]])
    expect(j('a[b[c[d[[x[1]]]]]]'))
    [_mo_](['[', 'a', ['[', 'b', ['[', 'c', ['[', 'd', [['[', 'x', 1]]]]]])


    expect(j('a{1}'))[_mo_](['{', 'a', 1])
    expect(j('a{b{1}}'))[_mo_](['{', 'a', ['{', 'b', 1]])
    expect(j('a{b{c{1}}}'))[_mo_](['{', 'a', ['{', 'b', ['{', 'c', 1]]])

    expect(j('a{1+2}'))[_mo_](['{', 'a', ['+', 1, 2]])
    expect(j('a{b{1+2}}'))[_mo_](['{', 'a', ['{', 'b', ['+', 1, 2]]])
    expect(j('a{b{c{1+2}}}'))[_mo_](['{', 'a', ['{', 'b', ['{', 'c', ['+', 1, 2]]]])

    expect(j('a{{x:1}}'))[_mo_](['{', 'a', { x: 1 }])
    expect(j('a{{x:1,y:2}}'))[_mo_](['{', 'a', { x: 1, y: 2 }])
  })



  test('paren-preval-implicit', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        plain: {
          preval: true
        }
      }
    })
    const j = mj(je)

    // But this is an implicit list.
    expect(j('foo,(1,a)'))[_mo_](['foo', ['(', [1, 'a']]])
    expect(j('foo,(1+2,a)'))[_mo_](['foo', ['(', [['+', 1, 2], 'a']]])
    expect(j('foo,(1+2+3,a)'))
    [_mo_](['foo', ['(', [['+', ['+', 1, 2], 3], 'a']]])
  })


  test('add-infix', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        foo: {
          infix: true, left: 180, right: 190, src: 'foo'
        }
      }
    })
    const j = mj(je)

    expect(j('1 foo 2'))[_mo_](['foo', 1, 2])
  })


  // TODO: provide as external tests for other plugins

  test('json-base', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('1')).toEqual(1)
    expect(j('"a"')).toEqual('a')
    expect(j('true')).toEqual(true)
    expect(j('[1,"a",false,[],{},[2],{a:3}]'))
    [_mo_]([1, "a", false, [], {}, [2], { a: 3 }])
    expect(j('{ "a": 1, "b": "B", "c": null, "d": [1, 2]' +
      ', "e": { "f": [{}], "g": { "h": [] } } }'))
    [_mo_]({
      "a": 1, "b": "B", "c": null, "d": [1, 2],
      "e": { "f": [{}], "g": { "h": [] } }
    })
  })

  test('jsonic-base', () => {
    const j = mj(Jsonic.make().use(Expr))

    expect(j('1 "a" true # foo'))[_mo_]([1, 'a', true])
    expect(j('x:1 y:"a" z:true // bar'))[_mo_]({ x: 1, y: 'a', z: true })
    expect(j('a:b:1 \n /* zed */ a:c:{\nd:e:[1 2]}'))
    [_mo_]({
      a: {
        b: 1,
        c: { d: { e: [1, 2] } }
      }
    })
  })


  test('ternary-basic', () => {
    const je = Jsonic.make().use(Expr, {
      // TODO: make this work
      op: {
        factorial: {
          suffix: true,
          src: '!',
          left: 15000,
        },
        ternary: {
          ternary: true,
          src: ['?', ':'],
        }
      }
    })
    const j = mj(je)

    expect(j('a:1'))[_mo_]({ a: 1 })


    expect(j('1?2:3'))[_mo_](['?', 1, 2, 3])

    // Ternary is right associative.
    expect(j('1?2: 3?4:5'))[_mo_](['?', 1, 2, ['?', 3, 4, 5]])
    expect(j('1?4:5 ?2:3'))[_mo_](['?', 1, 4, ['?', 5, 2, 3]])

    expect(j('1? 2?4:5 :3'))[_mo_](['?', 1, ['?', 2, 4, 5], 3])
    expect(j('1? 2? 4?6:7 :5 :3'))[_mo_](['?', 1, ['?', 2, ['?', 4, 6, 7], 5], 3])
    expect(j('1? 2? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', 1, ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('1? 2?4:5 :3?6:7'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', 3, 6, 7]])
    expect(j('1? 2?4:5 :3?6: 7?8:9'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('0+1?2:3'))[_mo_](['?', ['+', 0, 1], 2, 3])

    expect(j('0+1?2: 3?4:5'))[_mo_](['?', ['+', 0, 1], 2, ['?', 3, 4, 5]])
    expect(j('0+1?4:5 ?2:3'))[_mo_](['?', ['+', 0, 1], 4, ['?', 5, 2, 3]])

    expect(j('0+1? 2?4:5 :3'))[_mo_](['?', ['+', 0, 1], ['?', 2, 4, 5], 3])
    expect(j('0+1? 2? 4?6:7 :5 :3'))[_mo_](['?', ['+', 0, 1], ['?', 2, ['?', 4, 6, 7], 5], 3])
    expect(j('0+1? 2? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', ['+', 0, 1], ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('0+1? 2?4:5 :3?6:7'))[_mo_](['?', ['+', 0, 1], ['?', 2, 4, 5], ['?', 3, 6, 7]])
    expect(j('0+1? 2?4:5 :3?6: 7?8:9'))[_mo_](['?', ['+', 0, 1], ['?', 2, 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('1?0+2:3'))[_mo_](['?', 1, ['+', 0, 2], 3])

    expect(j('1?0+2: 3?4:5'))[_mo_](['?', 1, ['+', 0, 2], ['?', 3, 4, 5]])
    expect(j('1?4:5 ?0+2:3'))[_mo_](['?', 1, 4, ['?', 5, ['+', 0, 2], 3]])

    expect(j('1? 0+2?4:5 :3'))[_mo_](['?', 1, ['?', ['+', 0, 2], 4, 5], 3])
    expect(j('1? 0+2? 4?6:7 :5 :3'))[_mo_](['?', 1, ['?', ['+', 0, 2], ['?', 4, 6, 7], 5], 3])
    expect(j('1? 0+2? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', 1, ['?', ['+', 0, 2], ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('1? 0+2?4:5 :3?6:7'))[_mo_](['?', 1, ['?', ['+', 0, 2], 4, 5], ['?', 3, 6, 7]])
    expect(j('1? 0+2?4:5 :3?6: 7?8:9'))[_mo_](['?', 1, ['?', ['+', 0, 2], 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('1?2:0+3'))[_mo_](['?', 1, 2, ['+', 0, 3]])

    expect(j('1?2: 0+3?4:5'))[_mo_](['?', 1, 2, ['?', ['+', 0, 3], 4, 5]])
    expect(j('1?4:5 ?2:0+3'))[_mo_](['?', 1, 4, ['?', 5, 2, ['+', 0, 3]]])

    expect(j('1? 2?4:5 :0+3'))[_mo_](['?', 1, ['?', 2, 4, 5], ['+', 0, 3]])
    expect(j('1? 2? 4?6:7 :5 :0+3'))[_mo_](['?', 1, ['?', 2, ['?', 4, 6, 7], 5], ['+', 0, 3]])
    expect(j('1? 2? 4? 6?8:9 :7 :5 :0+3'))[_mo_](['?', 1, ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], ['+', 0, 3]])

    expect(j('1? 2?4:5 :0+3?6:7'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', ['+', 0, 3], 6, 7]])
    expect(j('1? 2?4:5 :0+3?6: 7?8:9'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', ['+', 0, 3], 6, ['?', 7, 8, 9]]])


    expect(j('0+1?0+2:3'))[_mo_](['?', ['+', 0, 1], ['+', 0, 2], 3])

    expect(j('0+1?0+2: 3?4:5'))[_mo_](['?', ['+', 0, 1], ['+', 0, 2], ['?', 3, 4, 5]])
    expect(j('0+1?4:5 ?0+2:3'))[_mo_](['?', ['+', 0, 1], 4, ['?', 5, ['+', 0, 2], 3]])

    expect(j('0+1? 0+2?4:5 :3'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], 4, 5], 3])
    expect(j('0+1? 0+2? 4?6:7 :5 :3'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], ['?', 4, 6, 7], 5], 3])
    expect(j('0+1? 0+2? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('0+1? 0+2?4:5 :3?6:7'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], 4, 5], ['?', 3, 6, 7]])
    expect(j('0+1? 0+2?4:5 :3?6: 7?8:9'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('0+1?2:0+3'))[_mo_](['?', ['+', 0, 1], 2, ['+', 0, 3]])

    expect(j('0+1?2: 0+3?4:5'))[_mo_](['?', ['+', 0, 1], 2, ['?', ['+', 0, 3], 4, 5]])
    expect(j('0+1?4:5 ?2:0+3'))[_mo_](['?', ['+', 0, 1], 4, ['?', 5, 2, ['+', 0, 3]]])

    expect(j('0+1? 2?4:5 :0+3'))[_mo_](['?', ['+', 0, 1], ['?', 2, 4, 5], ['+', 0, 3]])
    expect(j('0+1? 2? 4?6:7 :5 :0+3'))[_mo_](['?', ['+', 0, 1], ['?', 2, ['?', 4, 6, 7], 5], ['+', 0, 3]])
    expect(j('0+1? 2? 4? 6?8:9 :7 :5 :0+3'))[_mo_](['?', ['+', 0, 1], ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], ['+', 0, 3]])

    expect(j('0+1? 2?4:5 :0+3?6:7'))[_mo_](['?', ['+', 0, 1], ['?', 2, 4, 5], ['?', ['+', 0, 3], 6, 7]])
    expect(j('0+1? 2?4:5 :0+3?6: 7?8:9'))[_mo_](['?', ['+', 0, 1], ['?', 2, 4, 5], ['?', ['+', 0, 3], 6, ['?', 7, 8, 9]]])


    expect(j('0+1?0+2:0+3'))[_mo_](['?', ['+', 0, 1], ['+', 0, 2], ['+', 0, 3]])

    expect(j('0+1?0+2: 0+3?4:5'))[_mo_](['?', ['+', 0, 1], ['+', 0, 2], ['?', ['+', 0, 3], 4, 5]])
    expect(j('0+1?4:5 ?0+2:0+3'))[_mo_](['?', ['+', 0, 1], 4, ['?', 5, ['+', 0, 2], ['+', 0, 3]]])

    expect(j('0+1? 0+2?4:5 :0+3'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], 4, 5], ['+', 0, 3]])
    expect(j('0+1? 0+2? 4?6:7 :5 :0+3'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], ['?', 4, 6, 7], 5], ['+', 0, 3]])
    expect(j('0+1? 0+2? 4? 6?8:9 :7 :5 :0+3'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], ['?', 4, ['?', 6, 8, 9], 7], 5], ['+', 0, 3]])

    expect(j('0+1? 0+2?4:5 :0+3?6:7'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], 4, 5], ['?', ['+', 0, 3], 6, 7]])
    expect(j('0+1? 0+2?4:5 :0+3?6: 7?8:9'))[_mo_](['?', ['+', 0, 1], ['?', ['+', 0, 2], 4, 5], ['?', ['+', 0, 3], 6, ['?', 7, 8, 9]]])


    expect(j('-1?2:3'))[_mo_](['?', ['-', 1], 2, 3])

    expect(j('-1?2: 3?4:5'))[_mo_](['?', ['-', 1], 2, ['?', 3, 4, 5]])
    expect(j('-1?4:5 ?2:3'))[_mo_](['?', ['-', 1], 4, ['?', 5, 2, 3]])

    expect(j('-1? 2?4:5 :3'))[_mo_](['?', ['-', 1], ['?', 2, 4, 5], 3])
    expect(j('-1? 2? 4?6:7 :5 :3'))[_mo_](['?', ['-', 1], ['?', 2, ['?', 4, 6, 7], 5], 3])
    expect(j('-1? 2? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', ['-', 1], ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('-1? 2?4:5 :3?6:7'))[_mo_](['?', ['-', 1], ['?', 2, 4, 5], ['?', 3, 6, 7]])
    expect(j('-1? 2?4:5 :3?6: 7?8:9'))[_mo_](['?', ['-', 1], ['?', 2, 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('1!?2:3'))[_mo_](['?', ['!', 1], 2, 3])

    expect(j('1!?2: 3?4:5'))[_mo_](['?', ['!', 1], 2, ['?', 3, 4, 5]])
    expect(j('1!?4:5 ?2:3'))[_mo_](['?', ['!', 1], 4, ['?', 5, 2, 3]])

    expect(j('1!? 2?4:5 :3'))[_mo_](['?', ['!', 1], ['?', 2, 4, 5], 3])
    expect(j('1!? 2? 4?6:7 :5 :3'))[_mo_](['?', ['!', 1], ['?', 2, ['?', 4, 6, 7], 5], 3])
    expect(j('1!? 2? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', ['!', 1], ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('1!? 2?4:5 :3?6:7'))[_mo_](['?', ['!', 1], ['?', 2, 4, 5], ['?', 3, 6, 7]])
    expect(j('1!? 2?4:5 :3?6: 7?8:9'))[_mo_](['?', ['!', 1], ['?', 2, 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('-1!?2:3'))[_mo_](['?', ['-', ['!', 1]], 2, 3])

    expect(j('-1!?2: 3?4:5'))[_mo_](['?', ['-', ['!', 1]], 2, ['?', 3, 4, 5]])
    expect(j('-1!?4:5 ?2:3'))[_mo_](['?', ['-', ['!', 1]], 4, ['?', 5, 2, 3]])

    expect(j('-1!? 2?4:5 :3'))[_mo_](['?', ['-', ['!', 1]], ['?', 2, 4, 5], 3])
    expect(j('-1!? 2? 4?6:7 :5 :3'))[_mo_](['?', ['-', ['!', 1]], ['?', 2, ['?', 4, 6, 7], 5], 3])
    expect(j('-1!? 2? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', ['-', ['!', 1]], ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('-1!? 2?4:5 :3?6:7'))[_mo_](['?', ['-', ['!', 1]], ['?', 2, 4, 5], ['?', 3, 6, 7]])
    expect(j('-1!? 2?4:5 :3?6: 7?8:9'))[_mo_](['?', ['-', ['!', 1]], ['?', 2, 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('1?-2:3'))[_mo_](['?', 1, ['-', 2], 3])

    expect(j('1?-2: 3?4:5'))[_mo_](['?', 1, ['-', 2], ['?', 3, 4, 5]])
    expect(j('1?4:5 ?-2:3'))[_mo_](['?', 1, 4, ['?', 5, ['-', 2], 3]])

    expect(j('1? -2?4:5 :3'))[_mo_](['?', 1, ['?', ['-', 2], 4, 5], 3])
    expect(j('1? -2? 4?6:7 :5 :3'))[_mo_](['?', 1, ['?', ['-', 2], ['?', 4, 6, 7], 5], 3])
    expect(j('1? -2? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', 1, ['?', ['-', 2], ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('1? -2?4:5 :3?6:7'))[_mo_](['?', 1, ['?', ['-', 2], 4, 5], ['?', 3, 6, 7]])
    expect(j('1? -2?4:5 :3?6: 7?8:9'))[_mo_](['?', 1, ['?', ['-', 2], 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('1?2!:3'))[_mo_](['?', 1, ['!', 2], 3])

    expect(j('1?2!: 3?4:5'))[_mo_](['?', 1, ['!', 2], ['?', 3, 4, 5]])
    expect(j('1?4:5 ?2!:3'))[_mo_](['?', 1, 4, ['?', 5, ['!', 2], 3]])

    expect(j('1? 2!?4:5 :3'))[_mo_](['?', 1, ['?', ['!', 2], 4, 5], 3])
    expect(j('1? 2!? 4?6:7 :5 :3'))[_mo_](['?', 1, ['?', ['!', 2], ['?', 4, 6, 7], 5], 3])
    expect(j('1? 2!? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', 1, ['?', ['!', 2], ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('1? 2!?4:5 :3?6:7'))[_mo_](['?', 1, ['?', ['!', 2], 4, 5], ['?', 3, 6, 7]])
    expect(j('1? 2!?4:5 :3?6: 7?8:9'))[_mo_](['?', 1, ['?', ['!', 2], 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('1?-2!:3'))[_mo_](['?', 1, ['-', ['!', 2]], 3])

    expect(j('1?-2!: 3?4:5'))[_mo_](['?', 1, ['-', ['!', 2]], ['?', 3, 4, 5]])
    expect(j('1?4:5 ?-2!:3'))[_mo_](['?', 1, 4, ['?', 5, ['-', ['!', 2]], 3]])

    expect(j('1? -2!?4:5 :3'))[_mo_](['?', 1, ['?', ['-', ['!', 2]], 4, 5], 3])
    expect(j('1? -2!? 4?6:7 :5 :3'))[_mo_](['?', 1, ['?', ['-', ['!', 2]], ['?', 4, 6, 7], 5], 3])
    expect(j('1? -2!? 4? 6?8:9 :7 :5 :3'))[_mo_](['?', 1, ['?', ['-', ['!', 2]], ['?', 4, ['?', 6, 8, 9], 7], 5], 3])

    expect(j('1? -2!?4:5 :3?6:7'))[_mo_](['?', 1, ['?', ['-', ['!', 2]], 4, 5], ['?', 3, 6, 7]])
    expect(j('1? -2!?4:5 :3?6: 7?8:9'))[_mo_](['?', 1, ['?', ['-', ['!', 2]], 4, 5], ['?', 3, 6, ['?', 7, 8, 9]]])


    expect(j('1?2:-3'))[_mo_](['?', 1, 2, ['-', 3]])

    expect(j('1?2: -3?4:5'))[_mo_](['?', 1, 2, ['?', ['-', 3], 4, 5]])
    expect(j('1?4:5 ?2:-3'))[_mo_](['?', 1, 4, ['?', 5, 2, ['-', 3]]])

    expect(j('1? 2?4:5 :-3'))[_mo_](['?', 1, ['?', 2, 4, 5], ['-', 3]])
    expect(j('1? 2? 4?6:7 :5 :-3'))[_mo_](['?', 1, ['?', 2, ['?', 4, 6, 7], 5], ['-', 3]])
    expect(j('1? 2? 4? 6?8:9 :7 :5 :-3'))[_mo_](['?', 1, ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], ['-', 3]])

    expect(j('1? 2?4:5 :-3?6:7'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', ['-', 3], 6, 7]])
    expect(j('1? 2?4:5 :-3?6: 7?8:9'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', ['-', 3], 6, ['?', 7, 8, 9]]])


    expect(j('1?2:3!'))[_mo_](['?', 1, 2, ['!', 3]])

    expect(j('1?2: 3!?4:5'))[_mo_](['?', 1, 2, ['?', ['!', 3], 4, 5]])
    expect(j('1?4:5 ?2:3!'))[_mo_](['?', 1, 4, ['?', 5, 2, ['!', 3]]])

    expect(j('1? 2?4:5 :3!'))[_mo_](['?', 1, ['?', 2, 4, 5], ['!', 3]])
    expect(j('1? 2? 4?6:7 :5 :3!'))[_mo_](['?', 1, ['?', 2, ['?', 4, 6, 7], 5], ['!', 3]])
    expect(j('1? 2? 4? 6?8:9 :7 :5 :3!'))[_mo_](['?', 1, ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], ['!', 3]])

    expect(j('1? 2?4:5 :3!?6:7'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', ['!', 3], 6, 7]])
    expect(j('1? 2?4:5 :3!?6: 7?8:9'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', ['!', 3], 6, ['?', 7, 8, 9]]])


    expect(j('1?2:-3!'))[_mo_](['?', 1, 2, ['-', ['!', 3]]])

    expect(j('1?2: -3!?4:5'))[_mo_](['?', 1, 2, ['?', ['-', ['!', 3]], 4, 5]])
    expect(j('1?4:5 ?2:-3!'))[_mo_](['?', 1, 4, ['?', 5, 2, ['-', ['!', 3]]]])

    expect(j('1? 2?4:5 :-3!'))[_mo_](['?', 1, ['?', 2, 4, 5], ['-', ['!', 3]]])
    expect(j('1? 2? 4?6:7 :5 :-3!'))[_mo_](['?', 1, ['?', 2, ['?', 4, 6, 7], 5], ['-', ['!', 3]]])
    expect(j('1? 2? 4? 6?8:9 :7 :5 :-3!'))[_mo_](['?', 1, ['?', 2, ['?', 4, ['?', 6, 8, 9], 7], 5], ['-', ['!', 3]]])

    expect(j('1? 2?4:5 :-3!?6:7'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', ['-', ['!', 3]], 6, 7]])
    expect(j('1? 2?4:5 :-3!?6: 7?8:9'))[_mo_](['?', 1, ['?', 2, 4, 5], ['?', ['-', ['!', 3]], 6, ['?', 7, 8, 9]]])

    expect(j('a 1?2:3'))[_mo_](['a', ['?', 1, 2, 3]])
    expect(j('1?2:3 b'))[_mo_]([['?', 1, 2, 3], 'b'])
    expect(j('a 1?2:3 b'))[_mo_](['a', ['?', 1, 2, 3], 'b'])

    expect(j('a,1?2:3'))[_mo_](['a', ['?', 1, 2, 3]])
    expect(j('1?2:3,b'))[_mo_]([['?', 1, 2, 3], 'b'])
    expect(j('a,1?2:3,b'))[_mo_](['a', ['?', 1, 2, 3], 'b'])

    expect(j('(a 1?2:3)'))[_mo_](['(', ['a', ['?', 1, 2, 3]]])
    expect(j('(1?2:3 b)'))[_mo_](['(', [['?', 1, 2, 3], 'b']])
    expect(j('(a 1?2:3 b)'))[_mo_](['(', ['a', ['?', 1, 2, 3], 'b']])

    expect(j('(a,1?2:3)'))[_mo_](['(', ['a', ['?', 1, 2, 3]]])
    expect(j('(1?2:3,b)'))[_mo_](['(', [['?', 1, 2, 3], 'b']])
    expect(j('(a,1?2:3,b)'))[_mo_](['(', ['a', ['?', 1, 2, 3], 'b']])
  })


  test('ternary-paren-preval', () => {
    const je = Jsonic.make().use(Expr, {
      // TODO: make this work
      op: {
        ternary: {
          ternary: true,
          src: ['?', ':'],
        },
        // },

        // paren: {
        plain: {
          preval: {}
        }
      }
    })
    const j = mj(je)

    expect(j('a:1'))[_mo_]({ a: 1 })

    expect(j('1?2:3'))[_mo_](['?', 1, 2, 3])

    expect(j('a 1?2:3'))[_mo_](['a', ['?', 1, 2, 3]])
    expect(j('1?2:3 b'))[_mo_]([['?', 1, 2, 3], 'b'])
    expect(j('a 1?2:3 b'))[_mo_](['a', ['?', 1, 2, 3], 'b'])

    expect(j('a,1?2:3'))[_mo_](['a', ['?', 1, 2, 3]])
    expect(j('1?2:3,b'))[_mo_]([['?', 1, 2, 3], 'b'])
    expect(j('a,1?2:3,b'))[_mo_](['a', ['?', 1, 2, 3], 'b'])

    expect(j('(a 1?2:3)'))[_mo_](['(', ['a', ['?', 1, 2, 3]]])
    expect(j('(1?2:3 b)'))[_mo_](['(', [['?', 1, 2, 3], 'b']])
    expect(j('(a 1?2:3 b)'))[_mo_](['(', ['a', ['?', 1, 2, 3], 'b']])

    expect(j('(a,1?2:3)'))[_mo_](['(', ['a', ['?', 1, 2, 3]]])
    expect(j('(1?2:3,b)'))[_mo_](['(', [['?', 1, 2, 3], 'b']])
    expect(j('(a,1?2:3,b)'))[_mo_](['(', ['a', ['?', 1, 2, 3], 'b']])

    expect(j('foo(a 1?2:3)'))[_mo_](['(', 'foo', ['a', ['?', 1, 2, 3]]])
    expect(j('foo(1?2:3 b)'))[_mo_](['(', 'foo', [['?', 1, 2, 3], 'b']])
    expect(j('foo(a 1?2:3 b)'))[_mo_](['(', 'foo', ['a', ['?', 1, 2, 3], 'b']])

    expect(j('foo(a,1?2:3)'))[_mo_](['(', 'foo', ['a', ['?', 1, 2, 3]]])
    expect(j('foo(1?2:3,b)'))[_mo_](['(', 'foo', [['?', 1, 2, 3], 'b']])
    expect(j('foo(a,1?2:3,b)'))[_mo_](['(', 'foo', ['a', ['?', 1, 2, 3], 'b']])


  })


  test('ternary-many', () => {
    const je0 = Jsonic.make().use(Expr, {
      // TODO: make this work
      op: {
        foo: {
          ternary: true,
          src: ['?', ':'],
        },
        bar: {
          ternary: true,
          src: ['QQ', 'CC'],
        },
      }
    })
    const j0 = mj(je0)

    expect(j0('a:1'))[_mo_]({ a: 1 })

    expect(j0('1?2:3'))[_mo_](['?', 1, 2, 3])
    expect(j0('1QQ2CC3'))[_mo_](['QQ', 1, 2, 3])

    expect(j0('1QQ2?4:5CC3'))[_mo_](['QQ', 1, ['?', 2, 4, 5], 3])
    expect(j0('1?2QQ4CC5:3'))[_mo_](['?', 1, ['QQ', 2, 4, 5], 3])

    const je1 = Jsonic.make().use(Expr, {
      // TODO: make this work
      op: {
        foo: {
          ternary: true,
          src: ['?', ':'],
        },
        bar: {
          ternary: true,
          src: ['QQ', 'CC'],
        },
        zed: {
          ternary: true,
          src: ['%%', '@@'],
        },
      }
    })
    const j1 = mj(je1)

    expect(j1('a:1'))[_mo_]({ a: 1 })

    expect(j1('1?2:3'))[_mo_](['?', 1, 2, 3])
    expect(j1('1QQ2CC3'))[_mo_](['QQ', 1, 2, 3])
    expect(j1('1%%2@@3'))[_mo_](['%%', 1, 2, 3])

    expect(j1('1QQ2?4:5CC3'))[_mo_](['QQ', 1, ['?', 2, 4, 5], 3])
    expect(j1('1?2QQ4CC5:3'))[_mo_](['?', 1, ['QQ', 2, 4, 5], 3])

    expect(j1('1QQ2%%4@@5CC3'))[_mo_](['QQ', 1, ['%%', 2, 4, 5], 3])
    expect(j1('1?2%%4@@5:3'))[_mo_](['?', 1, ['%%', 2, 4, 5], 3])

    expect(j1('1%%2?4:5@@3'))[_mo_](['%%', 1, ['?', 2, 4, 5], 3])
    expect(j1('1%%2QQ4CC5@@3'))[_mo_](['%%', 1, ['QQ', 2, 4, 5], 3])
  })



  test('example-dotpath', () => {
    const je0 = Jsonic.make().use(Expr, {
      op: {
        indot: {
          src: '.',
          infix: true,
          left: 15_000_000,
          right: 14_000_000,
        },
        predot: {
          src: '.',
          prefix: true,
          right: 14_000_000,
        }
      }
    })
    const j0 = mj(je0)

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

  })


  test('evaluate-math', () => {
    let ME = makeExpr
    let MO = makeOp
    let PLUS = MO({ name: 'addition-infix', infix: true, src: '+' })

    let MF: any = {
      'addition-infix': (a: any, b: any) => a + b,
      'multiplication-infix': (a: any, b: any) => a * b,
      'plain-paren': (a: any) => a,
    }

    let mr = (op: Op, ...terms: any) => {
      let mf = MF[op.name]
      return mf ? mf(...terms) : NaN
    }

    const j = Jsonic.make().use(Expr)


    expect(evaluate(ME(PLUS, 1, 2), mr)).toEqual(3)
    expect(evaluate(j('1+2'), mr)).toEqual(3)

    expect(evaluate(ME(PLUS, ME(PLUS, 1, 2), 3), mr)).toEqual(6)
    expect(evaluate(j('1+2+3'), mr)).toEqual(6)

    expect(evaluate(j('1*2+3'), mr)).toEqual(5)
    expect(evaluate(j('1+2*3'), mr)).toEqual(7)


    expect(evaluate(j('(1)'), mr)).toEqual(1)

    expect(evaluate(j('(1+2)'), mr)).toEqual(3)

    expect(evaluate(j('3+(1+2)'), mr)).toEqual(6)
    expect(evaluate(j('(1+2)+3'), mr)).toEqual(6)

    expect(evaluate(j('(1+2)*3'), mr)).toEqual(9)
    expect(evaluate(j('3*(1+2)'), mr)).toEqual(9)
  })


})


