/* Copyright (c) 2021 Richard Rodger, MIT License */

// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html


// TODO: use op$=opdef (replaces terms$)
// TODO: fix a(-b,c) - prefix unary should not apply to implicits
// TODO: fix 1+2,3+4 - implicit should be [1+2, 3+4] not 1+[2,3+4]
// TODO: fix top level: 1+2,3 === (1+2,3)
// TODO: separate paren rule?


import { Jsonic, Plugin, Rule, RuleSpec, Tin, Context, util } from 'jsonic'


const { omap, entries } = util


type OpDef = {
  left: number
  right: number
  src: string
  prefix?: boolean
  suffix?: boolean
  infix?: boolean
}

type OpFullDef = OpDef & {
  terms: number
  name: string
  tkn: string
  tin: number
  prefix: boolean
  suffix: boolean
}

type OpDefMap = { [tin: number]: OpFullDef }


type ParenDef = {
  osrc: string
  csrc: string
  prefix?: boolean
}

type ParenFullDef = ParenDef & {
  name: string
  otkn: string
  otin: number
  ctkn: string
  ctin: number
  prefix: boolean
}


type ParenDefMap = { [tin: number]: ParenFullDef }



type ExprOptions = {
  op?: { [name: string]: OpDef },
  paren?: { [name: string]: ParenDef },
}


let Expr: Plugin = function expr(jsonic: Jsonic, options: ExprOptions) {

  // NOTE: operators with same src will generate same token - this is correct.
  const operatorFixed =
    omap(options.op, ([_, od]: [string, OpDef]) => ['#E' + od.src, od.src])

  // NOTE: parens with same src will generate same token - this is correct.
  const parenFixed =
    omap(options.paren, ([_, od]: [string, ParenDef]) =>
      ['#E' + od.osrc, od.osrc, '#E' + od.csrc, od.csrc])

  // Add the operator tokens to the set of fixed tokens.
  jsonic.options({
    fixed: {
      token: operatorFixed
    }
  })

  // Add the paren tokens to the set of fixed tokens.
  jsonic.options({
    fixed: {
      token: parenFixed
    }
  })

  let tokenize = jsonic.token.bind(jsonic)
  const prefixTM: OpDefMap = makeOpMap(tokenize, options.op || {}, 'prefix')
  const suffixTM: OpDefMap = makeOpMap(tokenize, options.op || {}, 'suffix')
  const infixTM: OpDefMap = makeOpMap(tokenize, options.op || {}, 'infix')

  const parenOTM: ParenDefMap = makeParenMap(tokenize, options.paren || {})
  const parenCTM: ParenDefMap = omap(parenOTM, ([_, pdef]: [Tin, ParenFullDef]) =>
    [undefined, undefined, pdef.ctin, pdef])


  const PREFIX = Object.values(prefixTM).map(opdef => opdef.tin)
  const INFIX = Object.values(infixTM).map(opdef => opdef.tin)
  const SUFFIX = Object.values(suffixTM).map(opdef => opdef.tin)

  const INFIX_SUFFIX = [...new Set([
    ...INFIX, // ...Object.values(infixTM).map(opdef => opdef.tin),
    ...SUFFIX, // ...Object.values(suffixTM).map(opdef => opdef.tin),
  ])]

  const OP = Object.values(parenOTM).map(pdef => pdef.otin)
  const CP = Object.values(parenCTM).map(pdef => pdef.ctin)

  const CA = jsonic.token.CA
  const TX = jsonic.token.TX
  const NR = jsonic.token.NR
  const ST = jsonic.token.ST
  const VL = jsonic.token.VL
  const VAL = [TX, NR, ST, VL]

  jsonic
    .rule('val', (rs: RuleSpec) => {
      rs
        .open([
          {
            // Prefix operators occur before a value.
            s: [PREFIX],
            b: 1,
            p: 'expr',
            u: { expr_val: false },
            a: (r: Rule) => {
              let opdef = prefixTM[r.o0.tin]
              if (opdef && opdef.prefix) {
                r.n.expr_prefix = (r.n.expr_prefix || 0) + 1
              }
            },
            g: 'expr,expr-op,expr-open',
          },

          {
            s: [OP],
            b: 1,
            p: 'paren',
            g: 'expr,paren,open',
          },
        ])
        .close([
          {
            // Infix and suffix operators occur after a value.
            s: [INFIX],
            b: 1,
            h: (r: Rule, _, a: any) => {
              let opdef = infixTM[r.c0.tin]
              let pass = !r.n.expr_prefix ||
                1 === r.n.expr_prefix ||
                opdef?.left > r.n.expr_bind

              if (pass) {
                r.n.expr_prefix = 0
              }

              // The value node will be replaced by an expression node.
              a.r = pass ? 'expr' : ''

              return a
            },
            u: { expr_val: true },
            g: 'expr,expr-infix',
          },

          {
            // Infix and suffix operators occur after a value.
            s: [SUFFIX],
            b: 1,
            h: (r: Rule, _, a: any) => {
              let opdef = suffixTM[r.c0.tin]
              let pass = !r.n.expr_prefix ||
                1 === r.n.expr_prefix ||
                opdef?.left > r.n.expr_bind

              // if (pass) {
              //   r.n.expr_prefix = 0
              // }

              r.n.expr_suffix = 1

              // The value node will be replaced by an expression node.
              a.r = pass ? 'expr' : ''

              return a
            },
            u: { expr_val: true },
            g: 'expr,expr-op,expr-open',
          },


          {
            s: [CP],
            b: 1,
          },

          {
            s: [OP],
            b: 1,
            // r: 'expr',
            r: 'paren',
            c: (r: Rule) => {
              const pdef = parenOTM[r.c0.tin]
              return pdef.prefix
            },
            u: { paren_prefix: true },
            g: 'expr,expr-paren,expr-open',
          },

          {
            s: [CA],
            c: (r: Rule) => 1 === r.d && 1 <= r.n.expr_term,
            b: 1,
            g: 'list,val,imp,comma,top',
          },

          {
            s: [VAL],
            c: (r: Rule) => 1 === r.d && 1 <= r.n.expr_term,
            b: 1,
            g: 'list,val,imp,space,top',
          },
        ])
    })

  jsonic
    .rule('elem', (rs: RuleSpec) => {
      rs

        .close([

          // Close implicit list within parens.
          {
            s: [CP],
            b: 1,
            g: 'expr,paren,imp,list',
          },

          // Following elem is a paren expression.
          {
            s: [OP],
            b: 1,
            r: 'elem',
          },
        ])
    })

  jsonic
    .rule('pair', (rs: RuleSpec) => {
      rs
        .close([

          // Close implicit map within parens.
          {
            s: [CP],
            b: 1,
            g: 'expr,paren,imp,map',
          },
        ])
    })



  jsonic
    .rule('expr', (rs: RuleSpec) => {
      rs
        .bo((r: Rule) => {
          r.n.expr_bind = r.n.expr_bind || 0
          r.n.expr_term = r.n.expr_term || 0
          if (r.n.expr_prefix) {
            r.n.expr_prefix++
          }
        })

        .open([

          {
            s: [PREFIX],
            c: (r: Rule) => !r.prev.use.expr_val,

            p: 'val',
            g: 'expr,expr-prefix',

            // No implicit lists or maps inside expressions.
            n: { il: 1, im: 1 },


            a: (r: Rule) => {
              const opdef = prefixTM[r.o0.tin]
              const opsrc = opdef.src
              r.node = [opsrc]
              r.node.terms$ = 1
              r.node.op$ = opdef
              r.n.expr_bind = opdef.right
            }
          },

          {
            s: [INFIX],
            c: (r: Rule) => r.prev.use.expr_val,

            g: 'expr,expr-infix',

            // No implicit lists or maps inside expressions.
            n: { il: 1, im: 1 },


            h: (r: Rule, ctx: Context, a: any) => {
              r.n.expr_term++

              const expr_val = r.prev.use.expr_val
              const prev = r.prev
              const parent = r.parent

              const tin = r.o0.tin

              const opdef = infixTM[tin]

              const opsrc = opdef.src

              const left = opdef.left
              const right = opdef.right

              let p: string | undefined = 'val'

              if (parent.node?.terms$) {
                // console.log('EXPR OPEN A', parent.node)

                if (r.n.expr_bind < left) {
                  r.node = [opsrc]

                  if (expr_val) {
                    r.node.push(prev.node)
                  }

                  parent.node.push(r.node)
                  r.node.terms$ = opdef.terms
                }
                else {
                  // console.log('EXPR OPEN A2', parent.node)
                  let infix = parent

                  if (expr_val && infix.node.length - 1 < infix.node.terms$) {
                    infix.node.push(prev.node)
                  }

                  let root = infix

                  // console.log('ROOT A', root.name, root.id, root.node, root.n)

                  // // TODO: make this more robust using node.op$ marker
                  // for (let pI = 0;
                  //   pI < r.n.expr_term - 2 && root.node[0] !== opsrc;

                  //   //    pI < (r.n.expr_term - 2) &&
                  //   // root.node[0] !== opsrc &&
                  //   // root.n.expr_root &&
                  //   // 1 < root.n.expr_root;

                  //   pI++) {
                  //   root = root.parent
                  //   // console.log('ROOT B', root.name, root.id, root.node, root.n)

                  //   if ('expr' !== root.name) { //  && undefined !== root.parent.node) {
                  //     root = root.parent
                  //   }

                  //   // console.log('ROOT C', root.name, root.node, root.n)
                  // }

                  // // if (undefined === root.node) {
                  // //   root = root.child
                  // // }

                  // console.log('ROOT A', root.name, root.id, root.state, root.node, root.n)

                  // TODO: use node.op$.name not node[0]
                  for (let rI = ctx.rs.length - 1; -1 < rI; rI--) {
                    let rn = ctx.rs[rI].name
                    if ('expr' === rn) {
                      let nn = ctx.rs[rI].node
                      // console.log('ROOT B', rn, ctx.rs[rI].id, nn.op$?.right, opdef.right)

                      if (ctx.rs[rI].node[0] === opsrc) {
                        root = ctx.rs[rI]
                        break
                      }
                      // else if (ctx.rs[rI].node?.op$.right >= opdef.right) {
                      //   // root = ctx.rs[rI]
                      // }
                    }
                    else if ('val' !== rn && 'paren' !== rn) {
                      break
                    }
                  }

                  // console.log('ROOT Z', root.name, root.id, root.state, root.node, root.n)

                  root.node[1] = [...root.node]
                  root.node[0] = opsrc

                  root.node.length = 2
                  root.node.terms$ = opdef.terms
                  r.node = root.node
                }

              }

              // Left value was plain, so replace with an incomplete expression.
              // Then get the right value with a child node (p=val).
              else if (expr_val) {
                // console.log('EXPR OPEN B', prev.node, prev.prev.node)

                prev.node = [opsrc, prev.node]
                r.node = prev.node

                let prevprev: Rule = prev
                while ((prevprev = prevprev.prev) && prevprev.node?.terms$) {
                  prevprev.node = r.node
                }

                r.node.terms$ = 2
              }

              // Pratt: track the right binding power to overcome with
              // following left binding power.
              r.n.expr_bind = right

              // console.log('EXPR Z', r.node)

              a.p = p
              return a
            }
          },

          {
            // A infix or suffix expression, with the left value already parsed.
            // NOTE: infix and suffix are handled together so that the Pratt
            // precedence algorithm can be applied to both.
            s: [SUFFIX],
            c: (r: Rule) => r.prev.use.expr_val,

            g: 'expr,suffix',

            // No implicit lists or maps inside expressions.
            n: { il: 1, im: 1 },

            a: (r: Rule) => {
              r.n.expr_term++

              const prev = r.prev
              const parent = r.parent

              const tin = r.o0.tin

              const opdef = suffixTM[tin]

              const opsrc = opdef.src

              const left = opdef.left
              const right = opdef.right

              // console.log('EXPR SUFFIX OPEN', prev.node, parent.node)

              if (parent.node?.terms$) {
                //if (prev.node?.terms$) {
                if (r.n.expr_bind < left) {
                  r.node = [opsrc, prev.node]
                  // console.log('EXPR OPEN A1', r.n.expr_bind, left, r.node)

                  parent.node.push(r.node)
                  // prev.node.push(r.node)
                }
                else {
                  // console.log('EXPR SUFFIX A2')

                  // TODO: -1!? fails - use stack walk?
                  let ancestor = prev
                  do {
                    // console.log('EXPR SUFFIX ANC', ancestor.node, r.n.expr_bind, ancestor.node?.op$.right)
                    if (r.n.expr_bind <= prev.node?.op$.right) {
                      break
                    }
                  } while (prev.prev.node?.terms$ && (ancestor = prev.prev))

                  // console.log('EXPR SUFFIX ANC X', ancestor.node)

                  ancestor.node[1] = [...ancestor.node]
                  ancestor.node[0] = opsrc
                  ancestor.node.length = 2
                  r.node = ancestor.node

                  // console.log('EXPR SUFFIX ANC Z', r.node)
                }
              }
              else {
                // console.log('EXPR SUFFIX B')
                prev.node = [opsrc, prev.node]
                r.node = prev.node
              }

              let prevprev: Rule = prev
              while ((prevprev = prevprev.prev) && prevprev.node?.terms$) {
                prevprev.node = r.node
              }

              // Pratt: track the right binding power to overcome with
              // following left binding power.
              r.n.expr_bind = right

              // TODO: just op$
              r.node.terms$ = opdef.terms
              r.node.op$ = opdef

              // console.log('EXPR SUFFIX Z', r.node)
            }
          },


          { p: 'val', g: 'expr,val' },
        ])

        .bc((r: Rule) => {
          // console.log('EXPR BC', r.node)
          if (r.node?.length - 1 < r.node?.terms$) {
            r.node.push(r.child.node)
          }
          if (r.n.expr_prefix) {
            r.n.expr_prefix--
          }
          if (r.n.expr_suffix) {
            r.n.expr_suffix--
          }
        })

        .close([
          {
            s: [INFIX],
            b: 1,
            g: 'expr,expr-infix',
            u: { expr_val: true },
            h: (r: Rule, _, a: any) => {
              // Proceed to next term, unless this is an incomplete
              // prefix or suffix expression.
              let pass = !r.n.expr_prefix && !r.n.expr_suffix
              // console.log('EXPR IFP', pass, r.n)
              a.r = pass ? 'expr' : ''
              return a
            },

          },

          {
            s: [SUFFIX],
            b: 1,
            g: 'expr,suffix',
            u: { expr_val: true },
            h: (r: Rule, ctx: Context, a: any) => {
              // Proceed to next term, unless this is an incomplete
              // prefix or suffix expression.

              const opdef = suffixTM[r.c0.tin]

              let pass = true

              let last: any = undefined

              for (let i = ctx.rs.length - 1; -1 < i; i--) {
                if ('expr' === ctx.rs[i].name) {
                  last = ctx.rs[i]
                  break
                }
              }

              if (last && 'expr' === last.name &&
                last.node?.op$.left > opdef.left) {
                pass = false
              }

              // console.log('EXPR SUFFIX', pass, last?.node?.op$.left)
              a.r = pass ? 'expr' : ''
              return a
            },

          },


          {
            s: [CP],
            b: 1,
          },

          // Implicit list at the top level. 
          {
            s: [CA],
            c: { d: 0 },
            r: 'elem',
            a: (rule: Rule) => rule.prev.node = rule.node = [rule.node],
            g: 'expr,comma,top',
          },

          // Implicit list at the top level. 
          {
            s: [VAL],
            c: { d: 0 },
            b: 1,
            r: 'elem',
            a: (rule: Rule) => rule.prev.node = rule.node = [rule.node],
            g: 'expr,space,top',
          },

          // Implicit list indicated by comma.
          {
            s: [CA],
            c: { n: { pk: 0 } },
            b: 1,
            h: (rule: Rule, ctx: Context, a: any) => {
              let paren: Rule | null = null

              // Find the paren rule that contains this implicit list.
              for (let rI = ctx.rs.length - 1; -1 < rI; rI--) {
                if ('paren' === ctx.rs[rI].name) {
                  paren = ctx.rs[rI]
                  break
                }
              }

              if (paren) {
                // Create a list value for the paren rule.
                if (null == paren.child.node) {
                  paren.child.node = [rule.node]
                  a.r = 'elem'
                  a.b = 0
                }

                // Convert paren value into a list value.
                else if (paren.child.node.terms$) {
                  paren.child.node = [paren.child.node]
                  a.r = 'elem'
                  a.b = 0
                }

                rule.node = paren.child.node
              }
              return a
            },
            g: 'expr,list,val,imp,comma',
          },

          // Implicit list indicated by space separated value.
          {
            c: { n: { pk: 0, expr_suffix: 0 } },
            h: (rule: Rule, ctx: Context, a: any) => {
              let paren: Rule | null = null

              // Find the paren rule that contains this implicit list.
              for (let rI = ctx.rs.length - 1; -1 < rI; rI--) {
                if ('paren' === ctx.rs[rI].name) {
                  paren = ctx.rs[rI]
                  break
                }
              }

              if (paren) {
                // Create a list value for the paren rule.
                if (null == paren.child.node) {
                  paren.child.node = [rule.node]
                  a.r = 'elem'
                }

                // Convert paren value into a list value.
                else if (paren.child.node.terms$) {
                  paren.child.node = [paren.child.node]
                  a.r = 'elem'
                }

                rule.node = paren.child.node
              }
              return a
            },
            g: 'expr,list,val,imp,space',
          },

          { g: 'expr,end' }
        ])
    })


  jsonic
    .rule('paren', (rs: RuleSpec) => {
      rs
        .bo((r: Rule) => {
          // Allow implicits inside parens
          r.n.im = 0
          r.n.il = 0
          r.n.pk = 0
        })
        .open([
          {
            s: [OP, CP],
            b: 1,
            g: 'expr,paren,empty',
            c: (r: Rule) => parenOTM[r.o0.tin].name === parenCTM[r.o1.tin].name,
            a: (r: Rule) => {
              const pdef = parenOTM[r.o0.tin]
              let pd = 'expr_paren_depth_' + pdef.name
              r.use[pd] = r.n[pd] = 1
              r.node = undefined
              // r.node = [pdef.osrc]
              // r.node.paren$ = true
            },
          },
          {
            s: [OP],
            // p: 'expr',
            p: 'val',
            n: {
              expr_bind: 0, expr_term: 0,
            },
            g: 'expr,paren',
            a: (r: Rule) => {
              const pdef = parenOTM[r.o0.tin]
              let pd = 'expr_paren_depth_' + pdef.name
              r.use[pd] = r.n[pd] = 1
              r.node = undefined
            },
          },
        ])

        .close([
          {
            s: [CP],
            c: (r: Rule) => {
              const pdef = parenCTM[r.c0.tin]
              let pd = 'expr_paren_depth_' + pdef.name
              return !!r.n[pd]
            },
            a: (r: Rule) => {
              if (r.child.node?.terms$) {
                r.node = r.child.node
              }
              else if (undefined === r.node) {
                r.node = r.child.node
              }

              const pdef = parenCTM[r.c0.tin]
              let pd = 'expr_paren_depth_' + pdef.name

              if (r.use[pd] === r.n[pd]) {
                const pdef = parenCTM[r.c0.tin]

                const val = r.node
                r.node = [pdef.osrc]
                if (undefined !== val) {
                  r.node[1] = val
                }
                r.node.paren$ = true

                if (r.prev.use.paren_prefix) {
                  r.node.prefix$ = true
                  r.node[2] = r.node[1]
                  r.node[1] = r.prev.node
                  r.prev.node = r.node
                }
              }
            },
            g: 'expr,paren',
          },
        ])
    })

}


function makeOpMap(
  tokenize: (tkn: string) => Tin,
  op: { [name: string]: OpDef },
  anyfix: 'prefix' | 'suffix' | 'infix',
): OpDefMap {
  return Object.entries(op)
    .filter(([_, opdef]: [string, OpDef]) => opdef[anyfix])
    .reduce(
      (odm: OpDefMap, [name, opdef]: [string, OpDef]) => {
        let tkn = '#E' + opdef.src
        let tin = tokenize(tkn)
        odm[tin] = {
          src: opdef.src,
          terms: 'infix' === anyfix ? 2 : 1,
          left: opdef.left,
          right: opdef.right,
          name: name + '-' + anyfix,
          prefix: 'prefix' === anyfix,
          suffix: 'suffix' === anyfix,
          tkn,
          tin,
        }
        return odm
      },
      {})
}


function makeParenMap(
  tokenize: (tkn: string) => Tin,
  paren: { [name: string]: ParenDef },
): ParenDefMap {
  return entries(paren)
    .reduce(
      (a: ParenDefMap, [name, pdef]: [string, any]) => {
        let otkn = '#E' + pdef.osrc
        let ctkn = '#E' + pdef.csrc
        let otin = tokenize(otkn)
        let ctin = tokenize(ctkn)
        a[otin] = {
          name,
          osrc: pdef.osrc,
          csrc: pdef.csrc,
          otkn,
          otin,
          ctkn,
          ctin,
          prefix: !!pdef.prefix
        }
        return a
      },
      {}
    )
}




Expr.defaults = {

  // TODO: this should not be a list, use a map for easier overrides
  op: {
    positive: {
      prefix: true, left: 14000, right: 14000, src: '+'
    },

    negative: {
      prefix: true, left: 14000, right: 14000, src: '-'
    },

    // TODO: move to test
    // factorial: {
    //   suffix: true, left:15000, right:15000, src: '!'
    // },





    // NOTE: right-associative as lbp > rbp
    // Example: 2**3**4 === 2**(3**4)
    exponentiation: {
      infix: true, left: 1700, right: 1600, src: '**'
    },

    // NOTE: all these are left-associative as lbp < rbp
    // Example: 2+3+4 === (2+3)+4
    addition: {
      infix: true, left: 140, right: 150, src: '+'
    },
    subtraction: {
      infix: true, left: 140, right: 150, src: '-'
    },
    multiplication: {
      infix: true, left: 160, right: 170, src: '*'
    },
    division: {
      infix: true, left: 160, right: 170, src: '/'
    },
    remainder: {
      infix: true, left: 160, right: 170, src: '%'
    },
  },

  paren: {
    pure: {
      osrc: '(', csrc: ')',
      // prefix: {}
    },

    // TODO: move to test
    // index: {
    //   osrc: '[', csrc: ']', prefix: {
    //     required: true
    //   }
    // },

    // func: {
    //   osrc: '<', csrc: '>',
    //   prefix: {
    //     // required: false
    //   }
    // },

    // ternary: { osrc: '?', csrc: ':', prefix: {}, suffix: {} },
    // ternary: { osrc: '<', csrc: '>', prefix: true, suffix: true },
    // quote: { osrc: '<<', csrc: '>>', prefix: {}, suffix: {} },
  }

} as ExprOptions


export {
  Expr,
}
