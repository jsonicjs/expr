/* Copyright (c) 2021 Richard Rodger, MIT License */

// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html


import { Jsonic, Plugin, Rule, RuleSpec, Tin } from 'jsonic'



type OpDef = {
  order: number
  left: number
  right: number
  src: string
  suffix?: boolean
}

type OpFullDef = OpDef & {
  name: string
  tkn: string
  tin: number
  suffix: boolean
}


type ExprOptions = {
  op?: { [name: string]: OpDef },
}


let Expr: Plugin = function expr(jsonic: Jsonic, options: ExprOptions) {

  const operators = {
    '#E+': '+',
    '#E-': '-',
    '#E*': '*',
    // '#E%': '%',
    '#E**': '**',
    '#E!': '!',
  }


  jsonic.options({
    fixed: {
      token: operators
    }
  })

  jsonic.options({
    fixed: {
      token: {
        '#E(': '(',
        '#E)': ')',
      }
    }
  })

  const OPERATORS: Tin[] = Object.keys(operators).map(tn => jsonic.token(tn))
  // console.log(OPERATORS)

  const novalopm: { [tin: number]: OpFullDef } = {
    [jsonic.token('#E-')]: {
      order: 1,
      src: '-',
      name: 'negative-prefix',
      left: 14000,
      right: 14000,
      tin: jsonic.token('#E-'),
      tkn: '#E-',
      suffix: false,
    },
  }

  const valopm: { [tin: number]: OpFullDef } = {
    [jsonic.token('#E+')]: {
      order: 2,
      src: '+',
      name: 'addition',
      left: 140,
      right: 150,
      tin: jsonic.token('#E+'),
      tkn: '#E+',
      suffix: false,
    },
    [jsonic.token('#E*')]: {
      order: 2,
      src: '*',
      name: 'multiplication',
      left: 160,
      right: 170,
      tin: jsonic.token('#E*'),
      tkn: '#E*',
      suffix: false,
    },
    [jsonic.token('#E**')]: {
      order: 2,
      src: '**',
      name: 'exponentiation',
      left: 1700,
      right: 1600,
      tin: jsonic.token('#E**'),
      tkn: '#E**',
      suffix: false,
    },
    [jsonic.token('#E!')]: {
      order: 1,
      src: '!',
      name: 'factorial-suffix',
      // left: 15000,
      // right: 15000,
      left: 13000,
      right: 13000,
      tin: jsonic.token('#E!'),
      tkn: '#E!',
      suffix: true,
    },

  }

  const OP = jsonic.token['#E(']
  const CP = jsonic.token['#E)']

  console.log('fixed', jsonic.fixed)

  // console.log('novalopm', novalopm)
  // console.log('valopm', valopm)


  jsonic
    .rule('val', (rs: RuleSpec) => {
      rs
        .open([
          {
            s: [OPERATORS],
            b: 1,
            p: 'expr',
            u: { expr_val: false },
            g: 'expr',
          },

          {
            s: [OP],
            b: 1,
            p: 'expr',
            g: 'expr,paren',
          },
        ])
        .close([
          {
            s: [OPERATORS],
            b: 1,
            r: 'expr',
            u: { expr_val: true },
            g: 'expr',
          },
          {
            s: [CP],
            b: 1,
            g: 'expr,paren',
            c: (r: Rule) => !!r.n.pd
          },

          {
            s: [OP],
            b: 1,
            r: 'expr',
            u: { paren_prefix: true },
            g: 'expr,paren',
          },

        ])
    })

  jsonic
    .rule('elem', (rs: RuleSpec) => {
      rs
        .close([
          {
            s: [CP], b: 1, g: 'expr,paren',
            c: (r: Rule) => !!r.n.pd
          },
        ])
    })

  jsonic
    .rule('pair', (rs: RuleSpec) => {
      rs
        .close([
          {
            s: [CP], b: 1, g: 'expr,paren',
            c: (r: Rule) => !!r.n.pd
          },
        ])
    })



  jsonic
    .rule('expr', (rs: RuleSpec) => {
      rs
        .bo(function box(r: Rule) {
          r.n.expr_bind = r.n.expr_bind || 0
          r.n.expr_term = r.n.expr_term || 0
        })

        .open([
          {
            s: [OPERATORS],
            g: 'expr',
            h: (r: Rule, _, a: any) => {
              r.n.expr_term++

              const expr_val = !!r.prev.use.expr_val
              const prev = r.prev
              const parent = r.parent

              const tin = r.o0.tin

              const opdef = expr_val ? valopm[tin] : novalopm[tin]
              if (!opdef) {
                a.e = r.o0
                return a
              }

              const opsrc = opdef.src

              const left = opdef.left
              const right = opdef.right

              let p: string | undefined = 'val'


              if (parent.node?.expr$) {
                console.log('EXPR OPEN parent A', r.node, parent.node, r.n, left, prev.node, expr_val)

                if (r.n.expr_bind < left) {
                  console.log('EXPR OPEN UP')

                  r.node = [opsrc]

                  if (expr_val) {
                    r.node.push(prev.node)
                  }

                  parent.node.push(r.node)
                  r.node.expr$ = 2
                }
                else {
                  console.log('EXPR OPEN DOWN A', parent.node, expr_val, prev.node)
                  if (expr_val) {
                    parent.node.push(prev.node)
                  }
                  console.log('EXPR OPEN DOWN B', parent.node, expr_val, prev.node)

                  // console.log('EXPR OPEN DOWN C', r.n.expr_term,
                  //   parent.parent.node,
                  //   parent.parent.parent.node,
                  // )

                  let root = parent

                  // TODO: make this more robust using node.op$ marker
                  if (root.node[0] !== opsrc) {
                    for (let pI = 0; pI < r.n.expr_term - 2; pI++) {
                      console.log('EXPR OPEN DOWN C', r.n.expr_term, pI, root.node)
                      root = root.parent
                    }
                  }
                  console.log('EXPR OPEN DOWN D', root.node)


                  // parent.node[1] = [...parent.node]
                  // parent.node[0] = opsrc
                  // parent.node.length = parent.node.length - 1
                  // r.node = parent.node

                  root.node[1] = [...root.node]
                  root.node[0] = opsrc
                  // root.node.length = root.node.length - 1
                  root.node.length = 2
                  root.node.expr$ = opdef.order
                  r.node = root.node

                }

                console.log('EXPR OPEN parent Z', r.node, parent.node, prev.node)
              }
              else if (expr_val) {
                console.log('EXPR OPEN prev A', r.node, prev.node, parent.node)

                prev.node = [opsrc, prev.node]
                r.node = prev.node
                r.node.expr$ = 2

                console.log('EXPR OPEN prev Z', r.node, prev.node, parent.node)
              }
              else {
                console.log('EXPR OPEN prefix A', r.node)
                r.node = [opsrc]
                r.node.expr$ = 1
                console.log('EXPR OPEN prefix Z', r.node)
              }

              if (opdef.suffix) {
                r.node.expr$ = 1
                p = ''
                console.log('EXPR OPEN suffix', r.node)
              }

              r.n.expr_bind = right

              a.p = p
              return a
            }
          },

          {
            s: [OP],
            p: 'expr',
            n: {
              expr_bind: 0, expr_term: 0, pd: 1,
            },
            g: 'expr,paren',
            a: (r: Rule) => {
              r.use.pd = r.n.pd

              if (r.prev.use.paren_prefix) {
                r.node = ['((', r.prev.node]
                r.node.expr$ = 2
                console.log('EXPR OP PREFIX', r.node)
              }
            },
          },

          { p: 'val', g: 'expr,val' },
        ])

        .bc(function bc(r: Rule) {
          console.log('EXPR BC A', r.node, r.child.node)
          if (r.node?.length - 1 < r.node?.expr$) {
            r.node.push(r.child.node)
          }
          console.log('EXPR BC Z', r.node, r.node?.expr$)
        })

        .close([
          {
            s: [OPERATORS],
            b: 1,
            r: 'expr',
            g: 'expr',
            u: { expr_val: true },
          },

          {
            s: [CP],
            b: 1,
            c: (r: Rule) => !!r.n.pd,
            h: (r: Rule, _, a: any) => {

              if (r.child.node?.expr$) {
                r.node = r.child.node
              }
              else if (undefined === r.node) {
                r.node = r.child.node
              }

              if (r.use.pd === r.n.pd) {
                a.b = 0
                r.node = ['(', r.node]
                r.node.paren$ = true

                console.log('EXPR CP', r.prev.use)
                if (r.prev.use.paren_prefix) {
                  r.prev.node = r.node
                }
              }


              return a
            },
            g: 'expr,paren',
          },


          { g: 'expr,expr-end' }
        ])
    })
}


// Expr.defaults = {

//   // TODO: this should not be a list, use a map for easier overrides
//   op: {
//     positive: {
//       order: 1, bp: [-1, 10400], src: '+'
//     },
//     negative: {
//       order: 1, bp: [-1, 10400], src: '-'
//     },

//     // TODO: move to test
//     factorial: {
//       order: 1, bp: [10300, -1], src: '!'
//     },

//     // // TODO: move to test
//     // indexation: {
//     //   order: 2, bp: [2700, 2600], src: '[', csrc: ']'
//     // },




//     // NOTE: right-associative as lbp > rbp
//     // Example: 2**3**4 === 2**(3**4)
//     exponentiation: {
//       order: 2, bp: [1700, 1600], src: '**'
//     },

//     // NOTE: all these are left-associative as lbp < rbp
//     // Example: 2+3+4 === (2+3)+4
//     addition: {
//       order: 2, bp: [140, 150], src: '+'
//     },
//     subtraction: {
//       order: 2, bp: [140, 150], src: '-'
//     },
//     multiplication: {
//       order: 2, bp: [160, 170], src: '*'
//     },
//     division: {
//       order: 2, bp: [160, 170], src: '/'
//     },
//     remainder: {
//       order: 2, bp: [160, 170], src: '%'
//     },
//   },

//   paren: {
//     pure: {
//       osrc: '(', csrc: ')',
//       prefix: {}
//     },

//     // func: {
//     //   osrc: '<', csrc: '>',
//     //   prefix: {
//     //     // required: false
//     //   }
//     // },

//     // TODO: move to test
//     // index: {
//     //   osrc: '[', csrc: ']', prefix: {
//     //     required: true
//     //   }
//     // },
//     // ternary: { osrc: '?', csrc: ':', prefix: {}, suffix: {} },
//     // ternary: { osrc: '<', csrc: '>', prefix: true, suffix: true },
//     quote: { osrc: '<<', csrc: '>>', prefix: {}, suffix: {} },
//   }

// } as ExprOptions


export {
  Expr,
}
