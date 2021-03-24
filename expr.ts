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
          s: [NR, ADD], b: 2, p: 'add'
        },
        {
          s: [NR, MUL], b: 2, p: 'add'
        },
        {
          s: [OP], r: 'expr'
        }
      ],
      close: [
        { s: [CP] },
        { s: [] }
      ],
      before_open: (rule: Rule) => rule.node = null,
      after_close: (rule: Rule) => {
        rule.node = null == rule.node ? rule.child.node : rule.node
        console.log('EXPR CLOSE')
        console.dir(rule.child.node, { depth: null })
        //rule.node = evaluate(rule.node)

      },
    })
  })


  jsonic.rule('add', () => {
    return new RuleSpec({
      open: [
        {
          s: [NR, ADD],
          a: (r: Rule) => { r.node = ['+', r.open[0].val] },
          p: 'add'
        },
        {
          s: [NR, MUL], b: 2, p: 'mul'
        },
        {
          s: [NR],
          a: (r: Rule) => r.node.push(r.open[0].val)
        },
        {
          s: [OP], p: 'expr'
        }
      ],
      close: [
        {
          s: [ADD],
          r: 'add',
          a: (r: Rule) => { r.node = ['+'] }
        },
        {}
      ],
      after_close: (r: Rule) => {
        if (null == r.node) {
          r.node = r.child.node
        }
        else {
          if (null != r.child.node && r.node != r.child.node) {
            r.node.push(r.child.node)
          }
        }
      }
    })
  })



  jsonic.rule('mul', () => {
    return new RuleSpec({
      open: [
        {
          s: [NR, MUL],
          a: (r: Rule) => { r.node = ['*', r.open[0].val] },
          p: 'mul'
        },
        {
          s: [NR],
          a: (r: Rule) => r.node.push(r.open[0].val)
        }
      ],
      close: [
        {
          s: [MUL],
          r: 'mul',
          a: (r: Rule) => { r.node = ['*'] }
        },
        {}
      ],
      after_close: (r: Rule) => {
        if (null == r.node) {
          r.node = r.child.node
        }
        else {
          if (null != r.child.node && r.node != r.child.node) {
            r.node.push(r.child.node)
          }
        }
      }
    })
  })

  jsonic.rule('val', (rs: RuleSpec) => {
    rs.def.open.unshift({ s: [NR, ADD], b: 2, p: 'expr' })
    rs.def.open.unshift({ s: [NR, MUL], b: 2, p: 'expr' })
    rs.def.open.unshift({ s: [OP], p: 'expr' })
    return rs
  })
}


export {
  Expr,
  evaluate,
}
