/* Copyright (c) 2021 Richard Rodger, MIT License */

// FAQ: p in close does not really work as child rule only runs later

// TODO: minus, divide, modulo, parens

import { Jsonic, Plugin, Rule, RuleSpec, Context, Alt } from 'jsonic'


let Expr: Plugin = function expr(jsonic: Jsonic) {
  jsonic.options({
    token: {
      '#E+': { c: '+' },
      '#E*': { c: '*' }
    }
  })


  let NR = jsonic.token.NR
  //let AA = jsonic.token.AA
  let ADD = jsonic.token['#E+']
  let MUL = jsonic.token['#E*']

  // TODO: move Alt param rightward for consistency?
  //let one = (_: Alt, r: Rule) => r.node = null == r.node ? 1 : r.node
  //let zero = (_: Alt, r: Rule) => r.node = null == r.node ? 0 : r.node


  let addop = (a: number, b: number) => a + b
  let mulop = (a: number, b: number) => a * b
  addop.toString = () => '+'
  mulop.toString = () => '*'


  function evaluate(n: any): number {
    let a = 'number' === typeof n.a ? n.a : evaluate(n.a)
    let b = 'number' === typeof n.b ? n.b : evaluate(n.b)
    return ('+' === n.o ? addop : mulop)(a, b)
  }


  let i = 0

  jsonic.rule('expr', () => {
    return new RuleSpec({
      open: [
        { s: [NR, MUL], b: 2, p: 'mul' },
        { s: [NR, ADD], b: 2, p: 'add' },
      ],
      before_open: (rule: Rule) => {
        rule.node = { i: i++ }
      },
      after_close: (rule: Rule) => {
        console.dir(rule.node, { depth: null })
        rule.node = evaluate(rule.node)
      },
    })
  })

  jsonic.rule('add', () => {
    return new RuleSpec({
      open: [
        // open paren -> p:'expr'


        // TODO: h sig should have Rule first
        // TODO: handler for matched alts!
        { s: [NR, ADD] },
        { s: [NR], b: 1 },
      ],
      close: [
        { s: [NR, MUL], b: 2, r: 'mul' },
        { s: [NR, ADD], b: 2, r: 'add' },
        { s: [NR] },
      ],
      after_open: (rule: Rule) => {
        // TODO: how to move this to alts?
        if (1 < rule.open.length) {
          rule.node.a = rule.open[0].val
        }

        rule.node.o = '+'
      },
      after_close: (rule: Rule, _: Context, next: Rule) => {
        if (1 === rule.close.length) {
          rule.node.b = rule.close[0].val
        }
        else {
          rule.node.b = { i: i++ }
          next.node = rule.node.b
        }
      }
    })
  })

  jsonic.rule('mul', () => {
    return new RuleSpec({
      open: [
        { s: [NR, MUL], },
      ],
      close: [
        { s: [NR, ADD], r: 'add' },
        { s: [NR, MUL], b: 2, r: 'mul' },
        { s: [NR] },
      ],
      after_open: (rule: Rule) => {
        rule.node.a = rule.open[0].val
        rule.node.o = '*'
      },
      after_close: (rule: Rule, _: Context, next: Rule) => {
        if (1 === rule.close.length) {
          rule.node.b = rule.close[0].val
        }

        // TODO: generalize
        else if (ADD === rule.close[1].tin) {
          rule.node.a = { i: i++, a: rule.node.a, b: rule.close[0].val }
        }
        else {
          rule.node.b = { i: i++ }
          next.node = rule.node.b
        }
      }
    })
  })


  jsonic.rule('val', (rs: RuleSpec) => {
    rs.def.open.unshift({ s: [NR, ADD], b: 2, p: 'expr' })
    rs.def.open.unshift({ s: [NR, MUL], b: 2, p: 'expr' })
    return rs
  })
}


export {
  Expr
}
