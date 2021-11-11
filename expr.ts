/* Copyright (c) 2021 Richard Rodger, MIT License */

// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html



// TODO: error on incomplete expr: 1+2+
// TODO: fix a(-b,c) - prefix unary should not apply to implicits
// TODO: fix 1+2,3+4 - implicit should be [1+2, 3+4] not 1+[2,3+4]
// TODO: fix top level: 1+2,3 === (1+2,3)
// TODO: separate paren rule?
// TODO: disambiguate infix and suffix by val.close r.o1 lookahead

import {
  Jsonic,
  Plugin,
  Rule,
  RuleSpec,
  AltSpec,
  Tin,
  Context,
  util,
} from 'jsonic'

import type {
  AltMatch,
} from 'jsonic'


const { omap, entries } = util


type OpDef = {
  left?: number
  right?: number
  src: string
  prefix?: boolean
  suffix?: boolean
  infix?: boolean
}

type OpFullDef = OpDef & {
  left: number
  right: number
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
  preval?: boolean
}

type ParenFullDef = ParenDef & {
  name: string
  otkn: string
  otin: number
  ctkn: string
  ctin: number
  preval: boolean
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

  // Build token maps (TM).
  const prefixTM: OpDefMap = makeOpMap(tokenize, options.op || {}, 'prefix')
  const suffixTM: OpDefMap = makeOpMap(tokenize, options.op || {}, 'suffix')
  const infixTM: OpDefMap = makeOpMap(tokenize, options.op || {}, 'infix')

  const parenOTM: ParenDefMap = makeParenMap(tokenize, options.paren || {})
  const parenCTM: ParenDefMap = omap(parenOTM, ([_, pdef]: [Tin, ParenFullDef]) =>
    [undefined, undefined, pdef.ctin, pdef])


  console.log('prefixTM', prefixTM)
  console.log('suffixTM', suffixTM)


  const PREFIX = Object.values(prefixTM).map(opdef => opdef.tin)
  const INFIX = Object.values(infixTM).map(opdef => opdef.tin)
  const SUFFIX = Object.values(suffixTM).map(opdef => opdef.tin)

  const hasPrefix = 0 < PREFIX.length
  const hasInfix = 0 < INFIX.length
  const hasSuffix = 0 < SUFFIX.length

  const OP = Object.values(parenOTM).map(pdef => pdef.otin)
  const CP = Object.values(parenCTM).map(pdef => pdef.ctin)

  const hasParen = 0 < OP.length && 0 < CP.length

  const CA = jsonic.token.CA
  const TX = jsonic.token.TX
  const NR = jsonic.token.NR
  const ST = jsonic.token.ST
  const VL = jsonic.token.VL
  const VAL = [TX, NR, ST, VL]

  // An AltSpec === null is ignored.
  const NONE = (null as unknown as AltSpec)


  jsonic
    .rule('val', (rs: RuleSpec) => {
      rs
        .open([

          // The prefix operator of the first term of an expression.
          hasPrefix ? {
            s: [PREFIX],
            b: 1,
            n: { expr_prefix: 1, expr_suffix: 0 },
            p: 'expr',
            g: 'expr,expr-prefix',
          } : NONE,

          // An opening parenthesis of an expression.
          hasParen ? {
            s: [OP],
            b: 1,
            p: 'paren',
            g: 'expr,expr-paren',
          } : NONE,
        ])

        .close([

          // The infix operator following the first term of an expression.
          hasInfix ? {
            s: [INFIX],
            b: 1,
            n: { expr_prefix: 0, expr_suffix: 0 },
            r: (r: Rule) => !r.n.expr ? 'expr' : '',
            g: 'expr,expr-infix',
          } : NONE,

          // The suffix operator following the first term of an expression.
          hasSuffix ? {
            s: [SUFFIX],
            b: 1,
            n: { expr_prefix: 0, expr_suffix: 1 },
            r: (r: Rule) => !r.n.expr ? 'expr' : '',
            g: 'expr,expr-suffix',
          } : NONE,

          // The closing parenthesis of an expression.
          // TODO: use n.expr to validate actually in an expression?
          hasParen ? {
            s: [CP],
            b: 1,
            g: 'expr,expr-paren',
          } : NONE,

          // The opening parenthesis of an expression with a prefix value.
          hasParen ? {
            s: [OP],
            b: 1,
            r: 'paren',
            c: (r: Rule) => parenOTM[r.c0.tin].preval,
            u: { paren_preval: true },
            g: 'expr,expr-paren,expr-paren-prefix',
          } : NONE,
        ])
    })

  jsonic
    .rule('elem', (rs: RuleSpec) => {
      rs

        .close([

          // Close implicit list within parens.
          hasParen ? {
            s: [CP],
            b: 1,
            g: 'expr,expr-paren,imp,close,list',
          } : NONE,

          // Following elem is a paren expression.
          hasParen ? {
            s: [OP],
            b: 1,
            r: 'elem',
            g: 'expr,expr-paren,imp,open,list',
          } : NONE,
        ])
    })

  jsonic
    .rule('pair', (rs: RuleSpec) => {
      rs
        .close([

          // Close implicit map within parens.
          hasParen ? {
            s: [CP],
            b: 1,
            g: 'expr,paren,imp,map',
          } : NONE,
        ])
    })

  jsonic
    .rule('expr', (rs: RuleSpec) => {
      rs
        .open([
          hasPrefix ? {
            s: [PREFIX],
            c: (r: Rule) => !!r.n.expr_prefix,
            n: { expr: 1 },
            p: 'val',
            g: 'expr,expr-prefix',
            a: (r: Rule) => {
              const parent = r.parent
              const op = prefixTM[r.o0.tin]

              // console.log('EXPR PREFIX P OP', parent.node?.op$)
              if (parent.node?.op$) {
                r.node = term(parent.node, op)
              }
              else {
                parent.node = [op.src]
                parent.node.op$ = op
                r.node = parent.node
              }
            }
          } : NONE,

          hasInfix ? {
            s: [INFIX],
            p: 'val',
            n: { expr: 1, expr_prefix: 0 },
            a: (r: Rule) => {
              const prev = r.prev
              const parent = r.parent
              const op = infixTM[r.o0.tin]

              // console.log('INFIX OPEN PARENT', parent.node, prev.node)

              if (parent.node?.op$) {
                r.node = term(parent.node, op)
              }

              else if (prev.node?.op$) {
                r.node = term(prev.node, op)
                r.parent = prev
              }

              // Left value was plain, so replace with an incomplete expression.
              // Then get the right value with a child node (p=val).
              else {
                prev.node = [op.src, prev.node]
                prev.node.op$ = op
                r.node = prev.node
                r.parent = prev
              }
            },
            g: 'expr,expr-infix',
          } : NONE,

          hasSuffix ? {
            s: [SUFFIX],
            n: { expr: 1, expr_prefix: 0 },
            a: (r: Rule) => {
              const prev = r.prev
              // const parent = r.parent
              const op = suffixTM[r.o0.tin]

              // console.log('SUFFIX OPEN', op, parent.node, prev.node)

              if (prev.node?.op$) {
                // console.log('SUFFIX OPEN PREV')
                r.node = term(prev.node, op)
              }

              else {
                prev.node = [op.src, prev.node]
                prev.node.op$ = op
                r.node = prev.node
                r.parent = prev
              }
            },
            g: 'expr,expr-suffix',
          } : NONE,
        ])
        .bc((r: Rule) => {
          if (r.node?.length - 1 < r.node?.op$.terms) {
            r.node.push(r.child.node)
          }
        })
        .close([
          hasInfix ? {
            s: [INFIX],
            c: (r: Rule) => !r.n.expr_prefix,
            b: 1,
            r: 'expr',
            g: 'expr,expr-infix',
          } : NONE,

          hasSuffix ? {
            s: [SUFFIX],
            c: (r: Rule) => !r.n.expr_prefix,
            b: 1,
            r: 'expr',
            g: 'expr,expr-suffix',
          } : NONE,

          hasParen ? {
            s: [CP],
            b: 1,
          } : NONE,

          {
            g: 'expr,expr-close',
          }
        ])
    })

  jsonic
    .rule('paren', (rs: RuleSpec) => {
      rs
        .open([
          hasParen ? {
            s: [OP, CP],
            b: 1,
            g: 'expr,expr-paren,empty',
            c: (r: Rule) => parenOTM[r.o0.tin].name === parenCTM[r.o1.tin].name,
            a: (r: Rule) => {
              const pdef = parenOTM[r.o0.tin]
              let pd = 'expr_paren_depth_' + pdef.name
              r.use[pd] = r.n[pd] = 1
              r.node = undefined
            },
          } : NONE,

          hasParen ? {
            s: [OP],
            p: 'val',
            n: {
              expr: 0, expr_prefix: 0, expr_suffix: 0,
            },
            g: 'expr,expr-paren,open',
            a: (r: Rule) => {
              const pdef = parenOTM[r.o0.tin]
              let pd = 'expr_paren_depth_' + pdef.name
              r.use[pd] = r.n[pd] = 1
              r.node = undefined
            },
          } : NONE,
        ])

        .close([
          hasParen ? {
            s: [CP],
            c: (r: Rule) => {
              const pdef = parenCTM[r.c0.tin]
              let pd = 'expr_paren_depth_' + pdef.name
              return !!r.n[pd]
            },
            a: (r: Rule) => {
              if (r.child.node?.op$) {
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

                if (r.prev.use.paren_preval) {
                  r.node.prefix$ = true
                  r.node[2] = r.node[1]
                  r.node[1] = r.prev.node
                  r.prev.node = r.node
                }
              }
            },
            g: 'expr,paren',
          } : NONE,
        ])
    })







  // jsonic
  //   .rule('val', (rs: RuleSpec) => {
  //     rs
  //       .open([
  //         // !hasPrefix ? NONE : {
  //         {
  //           // Prefix operators occur before a value.
  //           s: [PREFIX],
  //           b: 1,
  //           p: 'expr',
  //           u: { expr_val: false },
  //           a: (r: Rule) => {
  //             let opdef = prefixTM[r.o0.tin]
  //             if (opdef && opdef.prefix) {
  //               r.n.expr_prefix = (r.n.expr_prefix || 0) + 1
  //             }
  //           },
  //           g: 'expr,expr-op,expr-open',
  //         },

  //         // !hasOP ? NONE : {
  //         {
  //           s: [OP],
  //           b: 1,
  //           p: 'paren',
  //           g: 'expr,paren,open',
  //         },
  //       ])
  //       .close([
  //         // !hasInfix ? NONE : {
  //         {
  //           // Infix and suffix operators occur after a value.
  //           s: [INFIX],
  //           b: 1,

  //           // QQQ
  //           c: (r: Rule) => !r.n.expr_prefix,

  //           h: (r: Rule, _, a: any) => {
  //             let opdef = infixTM[r.c0.tin]
  //             let pass = !r.n.expr_prefix ||
  //               1 === r.n.expr_prefix ||
  //               opdef?.left > r.n.expr_bind

  //             if (pass) {
  //               r.n.expr_prefix = 0
  //             }

  //             // The value node will be replaced by an expression node.
  //             a.r = pass ? 'expr' : ''

  //             return a
  //           },
  //           u: { expr_val: true },
  //           g: 'expr,expr-infix',
  //         },

  //         // !hasSuffix ? NONE : {
  //         {
  //           // Infix and suffix operators occur after a value.
  //           s: [SUFFIX],
  //           b: 1,
  //           h: (r: Rule, _, a: any) => {
  //             let opdef = suffixTM[r.c0.tin]
  //             let pass = !r.n.expr_prefix ||
  //               1 === r.n.expr_prefix ||
  //               opdef?.left > r.n.expr_bind

  //             // if (pass) {
  //             //   r.n.expr_prefix = 0
  //             // }

  //             r.n.expr_suffix = 1

  //             // The value node will be replaced by an expression node.
  //             a.r = pass ? 'expr' : ''

  //             return a
  //           },
  //           u: { expr_val: true },
  //           g: 'expr,expr-op,expr-open',
  //         },

  //         // !hasCP ? NONE : {
  //         {
  //           s: [CP],
  //           b: 1,
  //         },

  //         // !hasOP ? NONE : {
  //         {
  //           s: [OP],
  //           b: 1,
  //           // r: 'expr',
  //           r: 'paren',
  //           c: (r: Rule) => {
  //             const pdef = parenOTM[r.c0.tin]
  //             return pdef.prefix
  //           },
  //           u: { paren_preval: true },
  //           g: 'expr,expr-paren,expr-open',
  //         },

  //         {
  //           s: [CA],
  //           c: (r: Rule) => 1 === r.d && 1 <= r.n.expr_term,
  //           b: 1,
  //           g: 'list,val,imp,comma,top',
  //         },

  //         {
  //           s: [VAL],
  //           c: (r: Rule) => 1 === r.d && 1 <= r.n.expr_term,
  //           b: 1,
  //           g: 'list,val,imp,space,top',
  //         },
  //       ])
  //   })

  // jsonic
  //   .rule('elem', (rs: RuleSpec) => {
  //     rs

  //       .close([

  //         // Close implicit list within parens.
  //         // !hasCP ? NONE : {
  //         {
  //           s: [CP],
  //           b: 1,
  //           g: 'expr,paren,imp,list',
  //         },

  //         // Following elem is a paren expression.
  //         // !hasOP ? NONE : {
  //         {
  //           s: [OP],
  //           b: 1,
  //           r: 'elem',
  //         },
  //       ])
  //   })

  // jsonic
  //   .rule('pair', (rs: RuleSpec) => {
  //     rs
  //       .close([

  //         // Close implicit map within parens.
  //         // !hasCP ? NONE : {
  //         {
  //           s: [CP],
  //           b: 1,
  //           g: 'expr,paren,imp,map',
  //         },
  //       ])
  //   })



  // jsonic
  //   .rule('expr', (rs: RuleSpec) => {
  //     rs
  //       .bo((r: Rule) => {
  //         r.n.expr_bind = r.n.expr_bind || 0
  //         r.n.expr_term = r.n.expr_term || 0

  //         // ###
  //         // if (r.n.expr_prefix) {
  //         //   r.n.expr_prefix++
  //         // }
  //       })

  //       .open([

  //         // !hasPrefix ? NONE : {
  //         {
  //           s: [PREFIX],
  //           c: (r: Rule) => !r.prev.use.expr_val,

  //           p: 'val',
  //           g: 'expr,expr-prefix',

  //           // No implicit lists or maps inside expressions.
  //           n: { il: 1, im: 1 },


  //           a: (r: Rule) => {
  //             const opdef = prefixTM[r.o0.tin]
  //             const opsrc = opdef.src
  //             r.node = [opsrc]
  //             r.node.terms$ = 1
  //             r.node.op$ = opdef
  //             r.n.expr_bind = opdef.right
  //           }
  //         },

  //         // !hasInfix ? NONE : {
  //         {
  //           s: [INFIX],
  //           c: (r: Rule) => r.prev.use.expr_val,

  //           g: 'expr,expr-infix',

  //           // No implicit lists or maps inside expressions.
  //           n: { il: 1, im: 1 },


  //           h: (r: Rule, ctx: Context, a: any) => {
  //             r.n.expr_term++

  //             const expr_val = r.prev.use.expr_val
  //             const prev = r.prev
  //             const parent = r.parent

  //             const tin = r.o0.tin

  //             const opdef = infixTM[tin]

  //             const opsrc = opdef.src

  //             const left = opdef.left
  //             const right = opdef.right

  //             let p: string | undefined = 'val'

  //             if (parent.node?.terms$) {
  //               // console.log('EXPR OPEN A', parent.node)

  //               if (r.n.expr_bind < left) {
  //                 r.node = [opsrc]

  //                 if (expr_val) {
  //                   r.node.push(prev.node)
  //                 }

  //                 parent.node.push(r.node)
  //                 r.node.terms$ = opdef.terms
  //               }
  //               else {
  //                 // console.log('EXPR OPEN A2', parent.node)
  //                 let infix = parent

  //                 if (expr_val && infix.node.length - 1 < infix.node.terms$) {
  //                   infix.node.push(prev.node)
  //                 }

  //                 let root = infix

  //                 // TODO: use node.op$.name not node[0]
  //                 for (let rI = ctx.rs.length - 1; -1 < rI; rI--) {
  //                   let rn = ctx.rs[rI].name
  //                   if ('expr' === rn) {
  //                     if (ctx.rs[rI].node[0] === opsrc) {
  //                       root = ctx.rs[rI]
  //                       break
  //                     }
  //                   }
  //                   else if ('val' !== rn && 'paren' !== rn) {
  //                     break
  //                   }
  //                 }

  //                 root.node[1] = [...root.node]
  //                 root.node[0] = opsrc

  //                 root.node.length = 2
  //                 root.node.terms$ = opdef.terms
  //                 r.node = root.node
  //               }

  //             }

  //             // Left value was plain, so replace with an incomplete expression.
  //             // Then get the right value with a child node (p=val).
  //             else if (expr_val) {
  //               prev.node = [opsrc, prev.node]
  //               r.node = prev.node

  //               let prevprev: Rule = prev
  //               while ((prevprev = prevprev.prev) && prevprev.node?.terms$) {
  //                 prevprev.node = r.node
  //               }

  //               r.node.terms$ = 2
  //             }

  //             // Pratt: track the right binding power to overcome with
  //             // following left binding power.
  //             r.n.expr_bind = right

  //             a.p = p
  //             return a
  //           }
  //         },

  //         // !hasSuffix ? NONE : {
  //         {
  //           // A infix or suffix expression, with the left value already parsed.
  //           // NOTE: infix and suffix are handled together so that the Pratt
  //           // precedence algorithm can be applied to both.
  //           s: [SUFFIX],
  //           c: (r: Rule) => r.prev.use.expr_val,

  //           g: 'expr,suffix',

  //           // No implicit lists or maps inside expressions.
  //           n: { il: 1, im: 1 },

  //           a: (r: Rule) => {
  //             r.n.expr_term++

  //             const prev = r.prev
  //             const parent = r.parent

  //             const tin = r.o0.tin

  //             const opdef = suffixTM[tin]

  //             const opsrc = opdef.src

  //             const left = opdef.left
  //             const right = opdef.right

  //             // console.log('EXPR SUFFIX OPEN', prev.node, parent.node)

  //             if (parent.node?.terms$) {
  //               //if (prev.node?.terms$) {
  //               if (r.n.expr_bind < left) {
  //                 r.node = [opsrc, prev.node]
  //                 // console.log('EXPR OPEN A1', r.n.expr_bind, left, r.node)

  //                 parent.node.push(r.node)
  //                 // prev.node.push(r.node)
  //               }
  //               else {
  //                 let ancestor = prev
  //                 do {
  //                   if (r.n.expr_bind <= prev.node?.op$?.right) {
  //                     break
  //                   }
  //                 } while (prev.prev.node?.terms$ && (ancestor = prev.prev))

  //                 console.log('EXPR SUFFIX ANC X', ancestor.node)

  //                 ancestor.node[1] = [...ancestor.node]
  //                 ancestor.node[0] = opsrc
  //                 ancestor.node.length = 2
  //                 r.node = ancestor.node

  //                 // console.log('EXPR SUFFIX ANC Z', r.node)
  //               }
  //             }
  //             else {
  //               // console.log('EXPR SUFFIX B')
  //               prev.node = [opsrc, prev.node]
  //               r.node = prev.node
  //             }

  //             let prevprev: Rule = prev
  //             while ((prevprev = prevprev.prev) && prevprev.node?.terms$) {
  //               prevprev.node = r.node
  //             }

  //             // Pratt: track the right binding power to overcome with
  //             // following left binding power.
  //             r.n.expr_bind = right

  //             // TODO: just op$
  //             r.node.terms$ = opdef.terms
  //             r.node.op$ = opdef

  //             // console.log('EXPR SUFFIX Z', r.node)
  //           }
  //         },


  //         { p: 'val', g: 'expr,val' },
  //       ])

  //       .bc((r: Rule) => {
  //         // console.log('EXPR BC', r.node)
  //         if (r.node?.length - 1 < r.node?.terms$) {
  //           r.node.push(r.child.node)
  //         }
  //         // if (r.n.expr_prefix) {
  //         //   r.n.expr_prefix--
  //         // }
  //         // if (r.n.expr_suffix) {
  //         //   r.n.expr_suffix--
  //         // }
  //       })

  //       .ac((r: Rule) => {
  //         if (r.n.expr_prefix) {
  //           r.n.expr_prefix--
  //         }
  //         if (r.n.expr_suffix) {
  //           r.n.expr_suffix--
  //         }
  //       })


  //       .close([
  //         // !hasInfix ? NONE : {
  //         {
  //           s: [INFIX],

  //           // QQQ
  //           c: (r: Rule) => {
  //             console.log('EXPR INFIX CLOSE', r.n)
  //             return !r.n.expr_prefix || 0 === r.n.expr_term
  //           },

  //           b: 1,
  //           g: 'expr,expr-infix',
  //           u: { expr_val: true },
  //           h: (r: Rule, _, a: any) => {
  //             // Proceed to next term, unless this is an incomplete
  //             // prefix or suffix expression.
  //             let pass =
  //               // !r.n.expr_prefix &&
  //               !r.n.expr_suffix
  //             // console.log('EXPR IFP', pass, r.n)

  //             if (pass) {
  //               r.n.expr_prefix = 0
  //             }

  //             a.r = pass ? 'expr' : ''
  //             return a
  //           },

  //         },

  //         // !hasSuffix ? NONE : {
  //         {
  //           s: [SUFFIX],
  //           b: 1,
  //           g: 'expr,suffix',
  //           u: { expr_val: true },
  //           h: (r: Rule, ctx: Context, a: any) => {
  //             // Proceed to next term, unless this is an incomplete
  //             // prefix or suffix expression.

  //             const opdef = suffixTM[r.c0.tin]

  //             let pass = true

  //             // let last: any = undefined

  //             // for (let i = ctx.rs.length - 1; -1 < i; i--) {
  //             //   if ('expr' === ctx.rs[i].name) {
  //             //     last = ctx.rs[i]
  //             //     break
  //             //   }
  //             // }

  //             // if (last && 'expr' === last.name &&
  //             //   last.node?.op$.left > opdef.left) {
  //             //   pass = false
  //             // }

  //             if (r.node?.op$?.left > opdef.left) {
  //               pass = false
  //             }

  //             console.log('EXPR SUFFIX',
  //               pass,
  //               r.node.op$,
  //               // last?.node?.op$,
  //               opdef)

  //             a.r = pass ? 'expr' : ''
  //             return a
  //           },

  //         },


  //         // !hasCP ? NONE : {
  //         {
  //           s: [CP],
  //           b: 1,
  //         },

  //         // Implicit list at the top level. 
  //         {
  //           s: [CA],
  //           c: { d: 0 },
  //           r: 'elem',
  //           a: (rule: Rule) => rule.prev.node = rule.node = [rule.node],
  //           g: 'expr,comma,top',
  //         },

  //         // Implicit list at the top level. 
  //         {
  //           s: [VAL],
  //           c: { d: 0 },
  //           b: 1,
  //           r: 'elem',
  //           a: (rule: Rule) => rule.prev.node = rule.node = [rule.node],
  //           g: 'expr,space,top',
  //         },

  //         // Implicit list indicated by comma.
  //         {
  //           s: [CA],
  //           c: { n: { pk: 0 } },
  //           b: 1,
  //           h: (rule: Rule, ctx: Context, a: any) => {
  //             let paren: Rule | null = null

  //             // Find the paren rule that contains this implicit list.
  //             for (let rI = ctx.rs.length - 1; -1 < rI; rI--) {
  //               if ('paren' === ctx.rs[rI].name) {
  //                 paren = ctx.rs[rI]
  //                 break
  //               }
  //             }

  //             if (paren) {
  //               // Create a list value for the paren rule.
  //               if (null == paren.child.node) {
  //                 paren.child.node = [rule.node]
  //                 a.r = 'elem'
  //                 a.b = 0
  //               }

  //               // Convert paren value into a list value.
  //               else if (paren.child.node.terms$) {
  //                 paren.child.node = [paren.child.node]
  //                 a.r = 'elem'
  //                 a.b = 0
  //               }

  //               rule.node = paren.child.node
  //             }
  //             return a
  //           },
  //           g: 'expr,list,val,imp,comma',
  //         },

  //         // Implicit list indicated by space separated value.
  //         {
  //           c: { n: { pk: 0, expr_suffix: 0 } },
  //           h: (rule: Rule, ctx: Context, a: any) => {
  //             let paren: Rule | null = null

  //             // Find the paren rule that contains this implicit list.
  //             for (let rI = ctx.rs.length - 1; -1 < rI; rI--) {
  //               if ('paren' === ctx.rs[rI].name) {
  //                 paren = ctx.rs[rI]
  //                 break
  //               }
  //             }

  //             if (paren) {
  //               // Create a list value for the paren rule.
  //               if (null == paren.child.node) {
  //                 paren.child.node = [rule.node]
  //                 a.r = 'elem'
  //               }

  //               // Convert paren value into a list value.
  //               else if (paren.child.node.terms$) {
  //                 paren.child.node = [paren.child.node]
  //                 a.r = 'elem'
  //               }

  //               rule.node = paren.child.node
  //             }
  //             return a
  //           },
  //           g: 'expr,list,val,imp,space',
  //         },

  //         { g: 'expr,end' }
  //       ])
  //   })


  // jsonic
  //   .rule('paren', (rs: RuleSpec) => {
  //     rs
  //       .bo((r: Rule) => {
  //         // Allow implicits inside parens
  //         r.n.im = 0
  //         r.n.il = 0
  //         r.n.pk = 0
  //       })
  //       .open([
  //         // (!hasOP || !hasCP) ? NONE : {
  //         // !hasOP ? NONE : {
  //         {
  //           s: [OP, CP],
  //           b: 1,
  //           g: 'expr,paren,empty',
  //           c: (r: Rule) => parenOTM[r.o0.tin].name === parenCTM[r.o1.tin].name,
  //           a: (r: Rule) => {
  //             const pdef = parenOTM[r.o0.tin]
  //             let pd = 'expr_paren_depth_' + pdef.name
  //             r.use[pd] = r.n[pd] = 1
  //             r.node = undefined
  //             // r.node = [pdef.osrc]
  //             // r.node.paren$ = true
  //           },
  //         },
  //         // !hasOP ? NONE : {
  //         {
  //           s: [OP],
  //           // p: 'expr',
  //           p: 'val',
  //           n: {
  //             expr_bind: 0, expr_term: 0,
  //           },
  //           g: 'expr,paren',
  //           a: (r: Rule) => {
  //             const pdef = parenOTM[r.o0.tin]
  //             let pd = 'expr_paren_depth_' + pdef.name
  //             r.use[pd] = r.n[pd] = 1
  //             r.node = undefined
  //           },
  //         },
  //       ])

  //       .close([
  //         // !hasCP ? NONE : {
  //         {
  //           s: [CP],
  //           c: (r: Rule) => {
  //             const pdef = parenCTM[r.c0.tin]
  //             let pd = 'expr_paren_depth_' + pdef.name
  //             return !!r.n[pd]
  //           },
  //           a: (r: Rule) => {
  //             if (r.child.node?.terms$) {
  //               r.node = r.child.node
  //             }
  //             else if (undefined === r.node) {
  //               r.node = r.child.node
  //             }

  //             const pdef = parenCTM[r.c0.tin]
  //             let pd = 'expr_paren_depth_' + pdef.name

  //             if (r.use[pd] === r.n[pd]) {
  //               const pdef = parenCTM[r.c0.tin]

  //               const val = r.node
  //               r.node = [pdef.osrc]
  //               if (undefined !== val) {
  //                 r.node[1] = val
  //               }
  //               r.node.paren$ = true

  //               if (r.prev.use.paren_preval) {
  //                 r.node.prefix$ = true
  //                 r.node[2] = r.node[1]
  //                 r.node[1] = r.prev.node
  //                 r.prev.node = r.node
  //               }
  //             }
  //           },
  //           g: 'expr,paren',
  //         },
  //       ])
  //   })

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
          left: opdef.left || 0,
          right: opdef.right || 0,
          name: name + '-' + anyfix,
          infix: 'infix' === anyfix,
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
          preval: !!pdef.preval
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
      prefix: true, right: 14000, src: '+'
    },

    negative: {
      prefix: true, right: 14000, src: '-'
    },


    // test_at_p: {
    //   prefix: true, right: 15000, src: '@'
    // },

    // test_per_p: {
    //   prefix: true, right: 13000, src: '%'
    // },


    // test_bang_p: {
    //   suffix: true, left: 16000, src: '!'
    // },

    // test_quest_p: {
    //   suffix: true, left: 14000, src: '?'
    // },


    // test_tilde: {
    //   infix: true, left: 140_000, right: 150_000, src: '~'
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
      // preval: {}
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


const jj = (x: any) => JSON.parse(JSON.stringify(x))


// Build next term using Pratt algorithm.
// NOTE: preserves referential integrity of root expression.
function term(expr: any, op?: OpFullDef): any[] {
  let out = expr
  let log = ''
  let in_expr = jj(expr)
  // let in_expr_op = expr.op$
  // let in_op = op

  if (op) {
    log += 'O'

    if (op.infix) {
      log += 'I'

      // op is lower
      if (expr.op$.suffix || op.left <= expr.op$.right) {
        log += 'L'

        expr[1] = [...expr]
        expr[1].op$ = expr.op$

        expr[0] = op.src
        expr.op$ = op
        expr.length = 2
      }

      // op is higher
      else {
        log += 'R'
        const end = expr.op$.terms
        expr[end] = [op.src, expr[end]]
        expr[end].op$ = op
        out = expr[end]
      }
    }

    else if (op.prefix) {
      log += 'P'

      // expr.op$ MUST be infix or prefix
      const end = expr.op$.terms
      expr[end] = [op.src]
      expr[end].op$ = op
      out = expr[end]

    }
    else if (op.suffix) {
      log += 'S'

      if (!expr.op$.suffix && expr.op$.right <= op.left) {
        log += 'R'
        const end = expr.op$.terms

        // NOTE: special case: higher precedence suffix "drills" into
        // lower precedence prefixes - @@1! => @(@(1!)), not @(!(@1))
        if (expr[end].op$ &&
          expr[end].op$.prefix &&
          expr[end].op$.right < op.left) {
          log += 'T'

          term(expr[end], op)
        }
        else {
          log += 'E'
          expr[end] = [op.src, expr[end]]
          expr[end].op$ = op
        }
      }

      else {
        log += 'L'
        expr[1] = [...expr]
        expr[1].op$ = expr.op$

        expr[0] = op.src
        expr.op$ = op
        expr.length = 2
      }
    }
  }
  else {
    log += 'N'
  }

  console.log('TERM', log,
    // in_expr_op,
    in_expr,
    // in_op,
    '/', jj(out), '/', jj(expr))
  return out
}



export {
  Expr,
  term,
}

export type {
  OpFullDef
}
