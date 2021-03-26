/* Copyright (c) 2021 Richard Rodger, MIT License */

// FAQ: p in close does not really work as child rule only runs later
// TODO: OP-CP match using counters


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

  let t2op = {
    [ADD]: '+',
    [MIN]: '-',
    [MUL]: '*',
    [DIV]: '/',
    [MOD]: '%',
    [POW]: '^',
  }

  let binop_ac = (r: Rule) => {
    if (null == r.node) {
      r.node = r.child.node
    }
    else {
      if (null != r.child.node && r.node != r.child.node) {
        r.node.push(r.child.node)
      }
    }
  }

  let endop = [
    {
      s: [NR],
      a: (r: Rule) => r.node.push(r.open[0].val)
    },
    { s: [OP], p: 'expr' }
  ]

  let startop = (r: Rule) => { r.node = [t2op[r.open[1].tin], r.open[0].val] }
  let followop = (r: Rule) => { r.node = [t2op[r.close[0].tin]] }


  jsonic.rule('expr-evaluate', () => {
    return new RuleSpec({
      open: [{ s: [], p: 'expr' }],
      close: [{ s: [] }],
      ac: (rule: Rule) => {
        console.dir(rule.child.node, { depth: null })
        rule.node = evaluate(rule.child.node)
      },
    })
  })

  jsonic.rule('expr', () => {
    return new RuleSpec({
      open: [
        { s: [NR, [ADD, MIN, MUL, DIV, MOD, POW]], p: 'add', b: 2 },
        { s: [OP], p: 'add', b: 1 },
        { s: [NR], a: (r: Rule) => r.node = r.open[0].val },
      ],
      close: [
        { s: [CP] },
        { s: [] }
      ],
      bo: (rule: Rule) => rule.node = null,
      ac: (rule: Rule) => {
        rule.node = null == rule.node ? rule.child.node : rule.node
      },
    })
  })

  jsonic.rule('add', () => {
    return new RuleSpec({
      open: [
        { s: [NR, [ADD, MIN]], p: 'add', a: startop, },
        { s: [NR, [MUL, DIV, MOD, POW]], p: 'mul', b: 2, },
        ...endop
      ],
      close: [
        { s: [[ADD, MIN]], r: 'add', a: followop, },
        { s: [[MUL, DIV, MOD, POW]], r: 'mul', a: followop, },
        {}
      ],
      ac: binop_ac,
    })
  })

  jsonic.rule('mul', () => {
    return new RuleSpec({
      open: [
        { s: [NR, [MUL, DIV, MOD]], p: 'mul', a: startop, },
        { s: [NR, POW], p: 'pow', b: 2, },
        ...endop
      ],
      close: [
        { s: [[MUL, DIV, MOD]], r: 'mul', a: followop, },
        { s: [POW], r: 'pow', a: followop, },
        {}
      ],
      ac: binop_ac,
    })
  })

  jsonic.rule('pow', () => {
    return new RuleSpec({
      open: [
        { s: [NR, POW], p: 'pow', a: startop, },
        ...endop
      ],
      close: [
        { s: [POW], r: 'pow', a: followop },
        {}
      ],
      ac: binop_ac,
    })
  })


  let expr_rule = eval_expr ? 'expr-evaluate' : 'expr'

  jsonic.rule('val', (rs: RuleSpec) => {
    rs.def.open.unshift({
      s: [NR, [ADD, MIN, MUL, DIV, MOD, POW]], b: 2, p: expr_rule,
    })
    rs.def.open.unshift({ s: [OP], b: 1, p: expr_rule })
    return rs
  })
}


export {
  Expr,
  evaluate,
}
