/* Copyright (c) 2021 Richard Rodger, MIT License */

// FAQ: p in close does not really work as child rule only runs later

// TODO: minus, divide, modulo, parens

import { Jsonic, Plugin, Rule, RuleSpec, Context, Alt } from 'jsonic'



let addop = (a: number, b: number) => a + b
let mulop = (a: number, b: number) => a * b
addop.toString = () => '+'
mulop.toString = () => '*'


function evaluate(n: any): number {
  let a = 'number' === typeof n.a ? n.a : evaluate(n.a)
  let b = 'number' === typeof n.b ? n.b : evaluate(n.b)
  return ('+' === n.o ? addop : mulop)(a, b)
}


let Expr: Plugin = function expr(jsonic: Jsonic) {
  jsonic.options({
    token: {
      '#E+': { c: '+' },
      '#E*': { c: '*' },
      '#E(': { c: '(' },
      '#E)': { c: ')' },
    }
  })


  let NR = jsonic.token.NR
  //let AA = jsonic.token.AA
  let ADD = jsonic.token['#E+']
  let MUL = jsonic.token['#E*']
  let OP = jsonic.token['#E(']
  let CP = jsonic.token['#E)']

  // TODO: move Alt param rightward for consistency?
  //let one = (_: Alt, r: Rule) => r.node = null == r.node ? 1 : r.node
  //let zero = (_: Alt, r: Rule) => r.node = null == r.node ? 0 : r.node




  jsonic.rule('expr', () => {
    return new RuleSpec({
      open: [
        {
          s: [NR, MUL], p: 'mul',
          a: (r: Rule) => r.node = { a: r.open[0].val, o: '*' }
        },
        {
          s: [NR, ADD], p: 'add',
          a: (r: Rule) => r.node = { a: r.open[0].val, o: '+' }
        },
        //{ s: [OP], p: 'expr' },
      ],
      after_close: (rule: Rule) => {
        console.log('EXPR CLOSE')
        console.dir(rule.node, { depth: null })
        rule.node = evaluate(rule.node)
      },
    })
  })

  jsonic.rule('add', () => {
    return new RuleSpec({
      open: [
        { s: [NR], a: (r: Rule) => r.node.b = r.open[0].val },
        { s: [OP], p: 'expr' }
      ],
      close: [
        {
          s: [ADD], p: 'add',
          a: (r: Rule) =>
            r.node = r.node.b = { a: r.node.b, o: '+' }
        },
        {
          s: [MUL], p: 'mul',
          a: (r: Rule) =>
            r.node = r.node.b = { a: r.node.b, o: '*' }
        },
        { s: [CP], a: (r: Rule) => r.node.b = r.child.node },
      ]
    })
  })

  jsonic.rule('mul', () => {
    return new RuleSpec({
      open: [
        { s: [NR], a: (r: Rule) => r.node.b = r.open[0].val },
      ],
      close: [
        {
          s: [MUL], p: 'mul',
          a: (r: Rule) =>
            r.node = r.node.b = { a: r.node.b, o: '*' }
        },
        {
          s: [ADD], p: 'add',
          a: (r: Rule) => {
            r.node.a = { a: r.node.a, o: '*', b: r.node.b }
            r.node.o = '+'
            delete r.node.b
          }
        }
      ]
    })
  })


  jsonic.rule('val', (rs: RuleSpec) => {
    rs.def.open.unshift({ s: [NR, ADD], b: 2, p: 'expr' })
    rs.def.open.unshift({ s: [NR, MUL], b: 2, p: 'expr' })
    return rs
  })
}


export {
  Expr,
  evaluate,
}
