/* Copyright (c) 2021 Richard Rodger, MIT License */

// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html


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
  if ('number' === typeof n) return n
  let a = 'number' === typeof n[1] ? n[1] : evaluate(n[1])
  let b = 'number' === typeof n[2] ? n[2] : evaluate(n[2])
  let v = ops[n[0]](a, b)
  return v
}



let Expr: Plugin = function expr(jsonic: Jsonic) {
  let eval_expr = jsonic.options.plugin?.expr?.evaluate
  eval_expr = null == eval_expr ? true : eval_expr

  jsonic.options({
    fixed: {
      token: {
        // '#E^': { c: '^' },

        '#E*': '*',
        // '#E/': '/' ,
        // '#E%': '%' ,

        '#E+': '+',
        '#E-': '-',

        '#E(': '(',
        '#E)': ')',
      }
    }
  })


  // let NR = jsonic.token.NR
  let ADD = jsonic.token['#E+']
  let MIN = jsonic.token['#E-']
  let MUL = jsonic.token['#E*']
  // let DIV = jsonic.token['#E/']
  // let MOD = jsonic.token['#E%']
  // let POW = jsonic.token['#E^']
  let OP = jsonic.token['#E(']
  let CP = jsonic.token['#E)']

  let t2op = {
    [ADD]: '+',
    [MIN]: '-',
    [MUL]: '*',
    // [DIV]: '/',
    // [MOD]: '%',
    // [POW]: '^',
  }

  let obp = {
    [ADD]: [120, 130],
    [MUL]: [220, 230],
    [MIN]: [-1, 1120],
  }

  let op2tin = {
    '+': ADD,
    '*': MUL,
    '-': MIN,
  }


  jsonic
    .rule('val', (rs: RuleSpec) => {
      rs
        .open([
          {
            s: [OP], p: 'expr', n: { bp: 0 },
          },
          {
            s: [MIN], p: 'expr', a: (r: Rule) => {
              r.n.bp = obp[MIN][1]
              r.node = [t2op[MIN]]
              r.node.expr$ = 1
            }
          }
        ])
        .close([
          {
            s: [[ADD, MUL]], r: 'expr', b: 1
          },
          {
            s: [CP], b: 1
          }
        ])
    })


  let opact = (r: Rule) => {
    let optin = r.o0.tin
    let opsrc = r.o0.src
    let lbp = obp[optin][0]
    let rbp = obp[optin][1]
    let val = r.prev.node

    if (undefined === val) {
      val = r.parent.use.root
    }

    console.log('OP START', r.id, r.n, lbp, r.n.bp)
    if (lbp < r.n.bp) {
      console.log('UP A', opsrc, 'n', r.node, 'prev', r.prev.node, 'parent', r.parent.node)

      // r.parent.node[2] = val
      r.parent.node.push(val)

      r.node = [opsrc, r.parent.node]
      r.use.root = r.node

      console.log('UP B', opsrc, 'n', r.node, 'prev', r.prev.node, 'parent', r.parent.node)
    }
    else {
      console.log('DOWN A', opsrc, 'n', r.node, 'prev', r.prev.node, 'parent', r.parent.node)

      if ('expr' === r.parent.name && null != r.parent.node) {
        // r.parent.node[2] = r.node = [opsrc, val]
        r.parent.node.push(r.node = [opsrc, val])
        r.use.root = r.parent.node
      }
      else {
        r.node = [opsrc, val]
        r.use.root = r.node
      }

      console.log('DOWN B', opsrc, 'n', r.node, 'prev', r.prev.node, 'parent', r.parent.node)

    }
    r.n.bp = rbp
    r.node.expr$ = r.node.expr$ || 2
    // console.log('OP END', opsrc, r.n.bp, r.node, r.parent.node)
  }

  jsonic
    .rule('expr', (rs: RuleSpec) => {
      rs
        .bo(function box(r: Rule) {
          r.n.bp = r.n.bp || 0
          // console.log('EXP BO', r.node)
        })

        .open([
          {
            s: [[ADD, MUL]], p: 'val',
            a: opact
          },
          {
            p: 'val'
          }
        ])

        .ao(function aox(r: Rule) {
          // console.log('EXP AO', r.node)
        })

        .bc(function bcx(r: Rule) {
          if (null != r.node && 1 < r.node.expr$) {
            r.node.push(r.child.node)
            // if (undefined === r.node[1]) {
            //   r.node[1] = r.child.node
            // }
            // else if (undefined === r.node[2]) {
            //   r.node[2] = r.child.node
            // }
          }
        })

        .close([
          { s: [[ADD, MUL]], p: 'expr', b: 1 },
          { s: [CP] },
          { s: [] },
        ])

        .ac(function acx(r: Rule) {
          // console.log('EXP AC', r.node,
          //   'prev:', r.prev.name, r.prev.id, r.prev.node,
          //   'parent:', r.parent.name, r.parent.id, r.parent.node,
          // )

          // TODO: test for each cse below and commentary

          if (null == r.use.root) {
            r.node = r.child.node
          }
          else if ('expr' === r.parent.name) {
            r.parent.use.root = r.use.root
          }
          else if ('val' === r.prev.name) {
            r.prev.node = r.use.root
          }
          else if ('val' === r.parent.name) {
            r.parent.node = r.use.root
          }
        })
    })

  // console.dir(jsonic.rule('expr'))

}


export {
  Expr,
  evaluate,
}
