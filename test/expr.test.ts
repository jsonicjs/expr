/* Copyright (c) 2021-2025 Richard Rodger and other contributors, MIT License */


import { Jsonic, Rule, Context, util } from 'jsonic'
import { Debug } from 'jsonic/debug'

import {
  Expr,
  evaluation,
  testing,
} from '../expr'

import type {
  Op,
  Evaluate,
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
  const op = testing.opify({
    ...base,
    name: '' + opspec.src,
    terms: opspec.infix ? 2 : 1,
    ...opspec,
  })
  return (op as unknown as Op)
}

function makeExpr(opspec: any, term0?: any, term1?: any): any[] {
  const op = makeOp(opspec)
  const expr: any = [opspec]
  if (term0) {
    expr.push(term0)
  }
  if (term1) {
    expr.push(term1)
  }
  return expr
}



describe('expr', () => {

  beforeEach(() => {
    global.console = require('console')
  })


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


  test('example-dotpath', () => {
    let opts: any = {
      op: {
        'dot-infix': {
          src: '.',
          infix: true,
          left: 15_000_000,
          right: 14_000_000,
        },
        'dot-prefix': {
          src: '.',
          prefix: true,
          right: 14_000_000,
        }
      }
    }

    const je0 = Jsonic.make().use(Expr, opts)
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


    let resolve: Evaluate = (_rule: Rule, _ctx: Context, op: Op, terms: any[]) => {
      if ('dot-infix' === op.name) {
        return terms.join('/')
      }
      else if ('dot-prefix' === op.name) {
        return '/' + terms[0]
      }
    }

    let r = (null as unknown as Rule)
    let c = (null as unknown as Context)

    expect(evaluation(r, c, je0('a.b'), resolve)).toEqual('a/b')
    expect(evaluation(r, c, je0('a.b.c'), resolve)).toEqual('a/b/c')
    expect(evaluation(r, c, je0('a.b.c.d'), resolve)).toEqual('a/b/c/d')

    expect(evaluation(r, c, je0('.a'), resolve)).toEqual('/a')
    expect(evaluation(r, c, je0('.a.b'), resolve)).toEqual('/a/b')

    const je1 = Jsonic.make().use(Expr, { ...opts, evaluate: resolve })
    // expect(je1('{x:a.b}', { log: -1 })).toEqual({ x: 'a/b' })
    // expect(je1('x:a.b', { log: -1 })).toEqual({ x: 'a/b' })


    expect(je1('{x:a.b}')).toEqual({ x: 'a/b' })
    expect(je1('{x:a.b.c}')).toEqual({ x: 'a/b/c' })
    expect(je1('{x:a.b.c.d}')).toEqual({ x: 'a/b/c/d' })

    expect(je1('x:a.b')).toEqual({ x: 'a/b' })
    expect(je1('x:a.b.c')).toEqual({ x: 'a/b/c' })
    expect(je1('x:a.b.c.d')).toEqual({ x: 'a/b/c/d' })

    expect(je1('a.b')).toEqual('a/b')
    expect(je1('a.b.c')).toEqual('a/b/c')
    expect(je1('a.b.c.d')).toEqual('a/b/c/d')

  })


  test('evaluate-math', () => {
    let ME = makeExpr
    let MO = makeOp
    let PLUS = MO({ name: 'addition-infix', infix: true, src: '+' })

    let MF: any = {
      'addition-infix': (a: any, b: any) => a + b,
      'subtraction-infix': (a: any, b: any) => a - b,
      'multiplication-infix': (a: any, b: any) => a * b,
      'negative-prefix': (a: any) => -1 * a,
      'positive-prefix': (a: any) => a,
      'plain-paren': (a: any) => a,
    }

    let mr = (_r: Rule, _ctx: Context, op: Op, terms: any) => {
      // console.log('MR', op, terms)
      let mf = MF[op.name]
      return mf ? mf(...terms) : NaN
    }

    const j = Jsonic.make().use(Expr)

    let r = (null as unknown as Rule)
    let c = (null as unknown as Context)

    expect(evaluation(r, c, ME(PLUS, 1, 2), mr)).toEqual(3)
    expect(evaluation(r, c, j('1+2'), mr)).toEqual(3)

    expect(evaluation(r, c, ME(PLUS, ME(PLUS, 1, 2), 3), mr)).toEqual(6)
    expect(evaluation(r, c, j('1+2+3'), mr)).toEqual(6)

    expect(evaluation(r, c, j('1*2+3'), mr)).toEqual(5)
    expect(evaluation(r, c, j('1+2*3'), mr)).toEqual(7)


    expect(evaluation(r, c, j('(1)'), mr)).toEqual(1)

    expect(evaluation(r, c, j('(1+2)'), mr)).toEqual(3)

    expect(evaluation(r, c, j('3+(1+2)'), mr)).toEqual(6)
    expect(evaluation(r, c, j('(1+2)+3'), mr)).toEqual(6)

    expect(evaluation(r, c, j('(1+2)*3'), mr)).toEqual(9)
    expect(evaluation(r, c, j('3*(1+2)'), mr)).toEqual(9)


    const je = Jsonic.make()
      // .use(Debug, { trace: true })
      .use(Expr, {
        evaluate: mr
      })

    expect(je('11+22')).toEqual(33)
    expect(je('a:11+22')).toEqual({ a: 33 })
    expect(je('[11+22]')).toEqual([33])

    expect(je('111+(222)')).toEqual(333)
    expect(je('(111)+222')).toEqual(333)
    expect(je('(111)+(222)')).toEqual(333)
    expect(je('(111+222)')).toEqual(333)

    expect(je('(1+2)*4')).toEqual(12)
    expect(je('1+(2*4)')).toEqual(9)

    expect(je('((1+2)*4)')).toEqual(12)
    expect(je('(1+(2*4))')).toEqual(9)

    expect(je('1-3')).toEqual(-2)
    expect(je('-1')).toEqual(-1)
    expect(je('+1')).toEqual(1)
    expect(je('1+(-3)')).toEqual(-2)

  })


  test('evaluate-sets', () => {
    let MF: any = {
      'plain-paren': (a: any) => a,
      'union-infix': (a: any, b: any) => [...new Set([...a, ...b])].sort(),
      'intersection-infix': (a: any, b: any) =>
        Object
          .entries(
            b.reduce((s: any, e: any) => (s[e] = 1 + (s[e] || 0), s),
              a.reduce((s: any, e: any) => (s[e] = 1 + (s[e] || 0), s), {})))
          .filter((en: any) => 1 < en[1])
          .map(en => parseInt(en[0]))
          .sort()
      ,
    }

    let mr = (_r: Rule, _ctx: Context, op: Op, terms: any) => {
      let mf = MF[op.name]
      return mf ? mf(...terms) : []
    }

    const j = Jsonic.make().use(Expr, {
      op: {
        union: {
          infix: true, src: 'U', left: 140, right: 150,
        },
        intersection: {
          infix: true, src: 'N', left: 140, right: 150,
        },
      }
    })


    let r = (null as unknown as Rule)
    let c = (null as unknown as Context)

    expect(evaluation(r, c, j('[1]U[2]'), mr)).toEqual([1, 2])
    expect(evaluation(r, c, j('[1,3]U[1,2]'), mr)).toEqual([1, 2, 3])

    expect(evaluation(r, c, j('[1,3]N[1,2]'), mr)).toEqual([1])
    expect(evaluation(r, c, j('[1,3]N[2]'), mr)).toEqual([])
    expect(evaluation(r, c, j('[1,3]N[2,1]'), mr)).toEqual([1])

    expect(evaluation(r, c, j('[1,3]N[2]U[1,2]'), mr)).toEqual([1, 2])
    expect(evaluation(r, c, j('[1,3]N([2]U[1,2])'), mr)).toEqual([1])
  })



})


