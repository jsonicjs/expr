/* Copyright (c) 2021 Richard Rodger, MIT License */

// FAQ: p in close does not really work as child rule only runs later

import { Jsonic, Plugin, Rule, RuleSpec } from 'jsonic'


const ops: any = {
  '+': function addop(a: number, b: number) { return a + b },
  '-': function minop(a: number, b: number) { return a - b },
  '*': function mulop(a: number, b: number) { return a * b },
  '/': function divop(a: number, b: number) { return a / b },
  '%': function modop(a: number, b: number) { return a % b },
  '^': function powop(a: number, b: number) { return a ** b },
}


function evaluate(n: any): number {
  let a = 'number' === typeof n[1] ? n[1] : evaluate(n[1])
  let b = 'number' === typeof n[2] ? n[2] : evaluate(n[2])
  let v = ops[n[0]](a, b)
  return v
}


let Expr: Plugin = function expr(jsonic: Jsonic) {
  let eval_expr = jsonic.options.plugin.expr.evaluate
  eval_expr = null == eval_expr ? true : eval_expr

  jsonic.options({
    token: {
      '#E^': { c: '^' },

      '#E*': { c: '*' },
      '#E/': { c: '/' },
      '#E%': { c: '%' },

      '#E+': { c: '+' },
      '#E-': { c: '-' },

      '#E(': { c: '(' },
      '#E)': { c: ')' },
    }
  })


  let NR = jsonic.token.NR
  let ADD = jsonic.token['#E+']
  let MIN = jsonic.token['#E-']
  let MUL = jsonic.token['#E*']
  let DIV = jsonic.token['#E/']
  let MOD = jsonic.token['#E%']
  let POW = jsonic.token['#E^']
  let OP = jsonic.token['#E(']
  let CP = jsonic.token['#E)']

  // TODO: move Alt param rightward for consistency?
  //let one = (_: Alt, r: Rule) => r.node = null == r.node ? 1 : r.node
  //let zero = (_: Alt, r: Rule) => r.node = null == r.node ? 0 : r.node



  jsonic.rule('expr-evaluate', () => {
    return new RuleSpec({
      open: [{ s: [], p: 'expr' }],
      close: [{ s: [] }],
      after_close: (rule: Rule) => {
        rule.node = evaluate(rule.child.node)
      },
    })
  })


  jsonic.rule('expr', () => {
    return new RuleSpec({
      open: [
        {
          s: [NR, ADD], b: 2, p: 'add'
        },
        {
          s: [NR, MIN], b: 2, p: 'add'
        },
        {
          s: [NR, MUL], b: 2, p: 'add'
        },
        {
          s: [NR, DIV], b: 2, p: 'add'
        },
        {
          s: [NR, MOD], b: 2, p: 'add'
        },
        {
          s: [NR, POW], b: 2, p: 'add'
        },
        {
          s: [OP], b: 1, p: 'add'
        },
        {
          s: [NR], a: (r: Rule) => r.node = r.open[0].val
        },
      ],
      close: [
        { s: [CP] },
        { s: [] }
      ],
      before_open: (rule: Rule) => rule.node = null,
      after_close: (rule: Rule) => {
        rule.node = null == rule.node ? rule.child.node : rule.node
        //console.log('EXPR CLOSE')
        //console.dir(rule.child.node, { depth: null })
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
          s: [NR, MIN],
          a: (r: Rule) => { r.node = ['-', r.open[0].val] },
          p: 'add'
        },
        {
          s: [NR, MUL], b: 2, p: 'mul'
        },
        {
          s: [NR, DIV], b: 2, p: 'mul'
        },
        {
          s: [NR, MOD], b: 2, p: 'mul'
        },
        {
          s: [NR, POW], b: 2, p: 'mul'
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
        {
          s: [MIN],
          r: 'add',
          a: (r: Rule) => { r.node = ['-'] }
        },
        {
          s: [MUL],
          r: 'mul',
          a: (r: Rule) => { r.node = ['*'] }
        },
        {
          s: [DIV],
          r: 'mul',
          a: (r: Rule) => { r.node = ['*'] }
        },
        {
          s: [MOD],
          r: 'mul',
          a: (r: Rule) => { r.node = ['*'] }
        },
        {
          s: [POW],
          r: 'mul',
          a: (r: Rule) => { r.node = ['^'] }
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
          s: [NR, DIV],
          a: (r: Rule) => { r.node = ['/', r.open[0].val] },
          p: 'mul'
        },
        {
          s: [NR, MOD],
          a: (r: Rule) => { r.node = ['%', r.open[0].val] },
          p: 'mul'
        },
        {
          s: [NR, POW], b: 2, p: 'pow'
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
        {
          s: [DIV],
          r: 'mul',
          a: (r: Rule) => { r.node = ['%'] }
        },
        {
          s: [MOD],
          r: 'mul',
          a: (r: Rule) => { r.node = ['%'] }
        },
        {
          s: [POW],
          r: 'pow',
          a: (r: Rule) => { r.node = ['^'] }
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


  jsonic.rule('pow', () => {
    return new RuleSpec({
      open: [
        {
          s: [NR, POW],
          a: (r: Rule) => { r.node = ['^', r.open[0].val] },
          p: 'pow'
        },
        {
          s: [NR],
          a: (r: Rule) => r.node.push(r.open[0].val)
        }
      ],
      close: [
        {
          s: [POW],
          r: 'pow',
          a: (r: Rule) => { r.node = ['^'] }
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


  let expr_rule = eval_expr ? 'expr-evaluate' : 'expr'

  jsonic.rule('val', (rs: RuleSpec) => {
    rs.def.open.unshift({ s: [NR, ADD], b: 2, p: expr_rule })
    rs.def.open.unshift({ s: [NR, MIN], b: 2, p: expr_rule })
    rs.def.open.unshift({ s: [NR, MUL], b: 2, p: expr_rule })
    rs.def.open.unshift({ s: [NR, DIV], b: 2, p: expr_rule })
    rs.def.open.unshift({ s: [NR, MOD], b: 2, p: expr_rule })
    rs.def.open.unshift({ s: [NR, POW], b: 2, p: expr_rule })
    rs.def.open.unshift({ s: [OP], b: 1, p: expr_rule })
    return rs
  })
}


export {
  Expr,
  evaluate,
}
