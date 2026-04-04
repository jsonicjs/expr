/* Copyright (c) 2021-2025 Richard Rodger and other contributors, MIT License */

import { describe, test, beforeEach } from 'node:test'
import { expect } from '@hapi/code'

import { Jsonic, util } from 'jsonic'

import {
  Expr,
} from '..'

import { loadSpec } from './spec-util'


const { omap } = util

const C = (x: any) => JSON.parse(JSON.stringify(x))

const S = (x: any, seen?: WeakSet<any>): any => (
  seen = seen ?? new WeakSet(),
  seen?.has(x) ? '[CIRCLE]' : (
    (x && 'object' === typeof x ? seen?.add(x) : null),
    (x && Array.isArray(x)) ?
      (0 === x.length ? x : [
        x[0].src || S(x[0], seen),
        ...(1 < x.length ? (x.slice(1).map((t: any) => S(t, seen))) : [])]
        .filter(t => undefined !== t)) :
      (null != x && 'object' === typeof (x) ? omap(x, ([n, v]) => [n, S(v, seen)]) : x)))

const mj =
  (je: Jsonic) => (s: string, m?: any) => C(S(je(s, m)))

const _mo_ = 'equal'


function runSpec(specName: string, j: (s: string) => any) {
  const entries = loadSpec(specName)
  for (const entry of entries) {
    expect(j(entry.input))[_mo_](entry.expected)
  }
}


describe('spec', () => {

  beforeEach(() => {
    global.console = require('console')
  })


  test('happy', () => {
    const j = mj(Jsonic.make().use(Expr))
    runSpec('happy.tsv', j)
  })


  test('binary', () => {
    const j = mj(Jsonic.make().use(Expr))
    runSpec('binary.tsv', j)
  })


  test('structure', () => {
    const j = mj(Jsonic.make().use(Expr))
    runSpec('structure.tsv', j)
  })


  test('unary-prefix-basic', () => {
    const j = mj(Jsonic.make().use(Expr))
    runSpec('unary-prefix-basic.tsv', j)
  })


  test('unary-prefix-edge', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        at: { prefix: true, right: 15000, src: '@' },
        tight: { infix: true, left: 120_000, right: 130_000, src: '~' },
      }
    })
    const j = mj(je)
    runSpec('unary-prefix-edge.tsv', j)
  })


  test('unary-suffix-basic', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: { suffix: true, left: 15000, src: '!' },
        question: { suffix: true, left: 13000, src: '?' },
      }
    })
    const j = mj(je)
    runSpec('unary-suffix-basic.tsv', j)
  })


  test('unary-suffix-edge', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: { suffix: true, left: 15000, src: '!' },
        question: { suffix: true, left: 13000, src: '?' },
        tight: { infix: true, left: 120_000, right: 130_000, src: '~' },
      }
    })
    const j = mj(je)
    runSpec('unary-suffix-edge.tsv', j)
  })


  test('unary-suffix-structure', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: { suffix: true, left: 15000, src: '!' },
        question: { suffix: true, left: 13000, src: '?' },
      }
    })
    const j = mj(je)
    runSpec('unary-suffix-structure.tsv', j)
  })


  test('unary-suffix-prefix', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: { suffix: true, left: 15000, src: '!' },
        question: { suffix: true, left: 13000, src: '?' },
      }
    })
    const j = mj(je)
    runSpec('unary-suffix-prefix.tsv', j)
  })


  test('unary-suffix-paren', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: { suffix: true, left: 15000, src: '!' },
        question: { suffix: true, left: 13000, src: '?' },
      }
    })
    const j = mj(je)
    runSpec('unary-suffix-paren.tsv', j)
  })


  test('paren-basic', () => {
    const j = mj(Jsonic.make().use(Expr))
    runSpec('paren-basic.tsv', j)
  })


  test('implicit-list-top-basic', () => {
    const j = mj(Jsonic.make().use(Expr))
    runSpec('implicit-list-top-basic.tsv', j)
  })


  test('ternary-basic', () => {
    const je = Jsonic.make().use(Expr, {
      op: {
        factorial: { suffix: true, src: '!', left: 15000 },
        ternary: { ternary: true, src: ['?', ':'] },
      }
    })
    const j = mj(je)
    runSpec('ternary-basic.tsv', j)
  })


  test('json-base', () => {
    const j = mj(Jsonic.make().use(Expr))
    runSpec('json-base.tsv', j)
  })

})
