/* Copyright (c) 2021-2025 Richard Rodger, MIT License */

// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
// See the `prattify` function for the core implementation.
//
// Expressions are encoded as LISP-style S-expressions using
// arrays. The operation meta data is provided as the first array
// element.  To maintain the integrity of the overall JSON AST,
// expression rules cannot simply re-assign nodes. Instead the
// existing partial expression nodes are rewritten in-place.
//
// Parentheses can have preceeding values, which allows for the using function
// call ("foo(1)") and index ("a[1]") syntax. See the tests for examples and
// configuration options.
//
// Ternary expressions are implemented as special rule that is similar to
// the parenthesis rule. You can have multiple ternaries.
//
// Standard Jsonic allows for implicit lists and maps (e.g. a,b =>
// ['a','b']) at the top level. This expression grammar also allows
// for implicits within parentheses, so that "foo(1,2)" =>
// ['(','foo',[1,2]]. To support implicits additional counters and
// flags are needed, as well as context-sensitive edge-case
// handling. See the ternary rule for a glorious example.
//
// There is a specific recurring edge-case: when expressions are the
// first item of a list, special care is need not to embed the list
// inside the expression.

// TODO: custom ctx.F for Op - make this automatic in options
// TODO: increase infix base binding values
// TODO: error on incomplete expr: 1+2+

import {
  Jsonic,
  Plugin,
  Rule,
  RuleSpec,
  AltSpec,
  AltMatch,
  Tin,
  Context,
  Token,
  util,
} from 'jsonic'

const { omap, entries, values } = util

// Operator definition (value of options.op map entry).
type OpDef = {
  src?: string | string[]
  osrc?: string
  csrc?: string
  left?: number
  right?: number
  use?: any // custom op data
  prefix?: boolean
  suffix?: boolean
  infix?: boolean
  ternary?: boolean
  paren?: boolean
  preval?: {
    active?: boolean
    required?: boolean
  }
}

// Options for the plugin.
type ExprOptions = {
  op?: { [name: string]: OpDef }

  // TODO: define Evalute type
  evaluate?: typeof evaluation
}

// Full operator description (provided for evaluation).
type Op = {
  name: string
  src: string
  left: number
  right: number
  use: any
  prefix: boolean
  suffix: boolean
  infix: boolean
  ternary: boolean
  paren: boolean
  terms: number
  tkn: string
  tin: number
  osrc: string
  csrc: string
  otkn: string
  otin: number
  ctkn: string
  ctin: number
  preval: {
    active: boolean
    required: boolean
  }
  token: Token
  OP_MARK: typeof OP_MARK
}

// Lookup operators by token.
type OpMap = { [tin: number]: Op }

// Resolve the value of an operartion
type Evaluate = (rule: Rule, ctx: Context, op: Op, ...terms: any) => any

// Mark Operator objects as owned by this plugin.
const OP_MARK = {}

// The plugin itself.
let Expr: Plugin = function expr(jsonic: Jsonic, options: ExprOptions) {
  // Ensure comment matcher is first to avoid conflicts with
  // comment markers (//, /*, etc)
  // let lexm = jsonic.options.lex?.match || []
  // let cmI: number = lexm.map((m) => m.name).indexOf('makeCommentMatcher')
  // if (0 < cmI) {
  //   jsonic.options({
  //     lex: {
  //       match: [lexm[cmI], ...lexm.slice(0, cmI), ...lexm.slice(cmI + 1)],
  //     },
  //   })
  // }

  // console.log('EXPR', options)

  let token = jsonic.token.bind(jsonic) as any
  let fixed = jsonic.fixed.bind(jsonic) as any

  // Build token maps (TM).
  let optop = options.op || {}

  // Delete operations marked null.
  for (let opname in optop) {
    if (null === optop[opname]) {
      delete optop[opname]
    }
  }

  const prefixTM: OpMap = makeOpMap(token, fixed, optop, 'prefix')
  const suffixTM: OpMap = makeOpMap(token, fixed, optop, 'suffix')
  const infixTM: OpMap = makeOpMap(token, fixed, optop, 'infix')
  const ternaryTM: OpMap = makeOpMap(token, fixed, optop, 'ternary')

  const parenOTM: OpMap = makeParenMap(token, fixed, optop)
  const parenCTM: OpMap = omap(parenOTM, ([_, pdef]: [Tin, Op]) => [
    undefined,
    undefined,
    pdef.ctin,
    pdef,
  ])

  let parenFixed = Object.values({ ...parenOTM, ...parenCTM }).reduce(
    (a, p) => ((a[p.otkn] = p.osrc), (a[p.ctkn] = p.csrc), a),
    {} as any,
  )

  // NOTE: operators with same src will generate same token - this is correct.
  let operatorFixed = Object.values({
    ...prefixTM,
    ...suffixTM,
    ...infixTM,
    ...ternaryTM,
  }).reduce((a, op) => ((a[op.tkn] = op.src), a), {} as any)

  jsonic.options({
    fixed: {
      token: { ...operatorFixed, ...parenFixed },
    },

    lex: {
      match: {
        comment: { order: 1e5 },
      },
    },
  })

  const PREFIX = values(prefixTM).map((op: any) => op.tin)
  const INFIX = values(infixTM).map((op: any) => op.tin)
  const SUFFIX = values(suffixTM).map((op: any) => op.tin)

  const TERN0 = values(ternaryTM)
    .filter((op: any) => 0 === op.use.ternary.opI)
    .map((op: any) => op.tin)
  const TERN1 = values(ternaryTM)
    .filter((op: any) => 1 === op.use.ternary.opI)
    .map((op: any) => op.tin)

  const OP = values(parenOTM).map((pdef: any) => pdef.otin)
  const CP = values(parenCTM).map((pdef: any) => pdef.ctin)

  const hasPrefix = 0 < PREFIX.length
  const hasInfix = 0 < INFIX.length
  const hasSuffix = 0 < SUFFIX.length
  const hasTernary = 0 < TERN0.length && 0 < TERN1.length
  const hasParen = 0 < OP.length && 0 < CP.length

  const CA = jsonic.token.CA
  const CS = jsonic.token.CS
  const CB = jsonic.token.CB
  const TX = jsonic.token.TX
  const NR = jsonic.token.NR
  const ST = jsonic.token.ST
  const VL = jsonic.token.VL
  const ZZ = jsonic.token.ZZ

  const VAL = [TX, NR, ST, VL]

  const NONE = null as unknown as AltSpec

  jsonic.rule('val', (rs: RuleSpec) => {
    // TODO: jsonic - make it easier to handle this case
    // Implicit pair not allowed inside ternary
    if (hasTernary && TERN1.includes(jsonic.token.CL)) {
      // let pairkeyalt: any = rs.def.open.find((a: any) => a.g.includes('pair'))
      // pairkeyalt.c = (r: Rule) => !r.n.expr_ternary

      rs.def.open
        .filter((a: any) => a.g.includes('pair'))
        .map((alt: any) => {
          let origcond = alt.c
          let internary = (r: Rule) => !r.n.expr_ternary
          alt.c = origcond
            ? (r: Rule, ctx: Context) => origcond(r, ctx) && internary(r)
            : internary
        })
    }

    rs.open([
      // The prefix operator of the first term of an expression.
      hasPrefix
        ? {
            s: [PREFIX],
            b: 1,
            n: { expr_prefix: 1, expr_suffix: 0 },
            p: 'expr',
            g: 'expr,expr-prefix',
          }
        : NONE,

      // An opening parenthesis.
      // NOTE: this can happen outside an expression.
      hasParen
        ? {
            s: [OP],
            b: 1,
            p: 'paren',
            c: (r: Rule, ctx: Context) => {
              const pdef = parenOTM[r.o0.tin]
              let pass = true

              if (pdef.preval.required) {
                pass = 'val' === r.prev.name && r.prev.u.paren_preval
              }

              // Paren with preval as first term becomes root.
              if (pass) {
                if (1 === r.prev.i) {
                  ctx.root = () => r
                }
              }

              return pass
            },
            g: 'expr,expr-paren',
          }
        : NONE,
    ]).close([
      hasTernary
        ? {
            s: [TERN0],
            c: (r: Rule) => !r.n.expr,
            b: 1,
            r: 'ternary',
            g: 'expr,expr-ternary',
          }
        : NONE,

      // The infix operator following the first term of an expression.
      hasInfix
        ? {
            s: [INFIX],
            b: 1,
            n: { expr_prefix: 0, expr_suffix: 0 },
            r: (r: Rule) => (!r.n.expr ? 'expr' : ''),
            g: 'expr,expr-infix',
          }
        : NONE,

      // The suffix operator following the first term of an expression.
      hasSuffix
        ? {
            s: [SUFFIX],
            b: 1,
            n: { expr_prefix: 0, expr_suffix: 1 },
            r: (r: Rule) => (!r.n.expr ? 'expr' : ''),
            g: 'expr,expr-suffix',
          }
        : NONE,

      // The closing parenthesis of an expression.
      hasParen
        ? {
            s: [CP],
            c: (r: Rule) => !!r.n.expr_paren,
            b: 1,
            g: 'expr,expr-paren',
          }
        : NONE,

      // The opening parenthesis of an expression with a preceding value.
      // foo(1) => ['(','foo',1]
      hasParen
        ? {
            s: [OP],
            b: 1,
            r: 'val',
            c: (r: Rule) => parenOTM[r.c0.tin].preval.active,
            u: { paren_preval: true },
            g: 'expr,expr-paren,expr-paren-preval',
          }
        : NONE,

      hasTernary
        ? {
            s: [TERN1],
            c: (r: Rule) => !!r.n.expr_ternary,
            b: 1,
            g: 'expr,expr-ternary',
          }
        : NONE,

      // Don't create implicit list inside expression (comma separator).
      {
        s: [CA],
        c: (r: Rule) =>
          (1 === r.d && (1 <= r.n.expr || 1 <= r.n.expr_ternary)) ||
          (1 <= r.n.expr_ternary && 1 <= r.n.expr_paren),
        b: 1,
        g: 'expr,list,val,imp,comma,top',
      },

      // Don't create implicit list inside expression (space separator).
      {
        s: [VAL],
        c: (r: Rule) =>
          (1 === r.d && (1 <= r.n.expr || 1 <= r.n.expr_ternary)) ||
          (1 <= r.n.expr_ternary && 1 <= r.n.expr_paren),
        b: 1,
        g: 'expr,list,val,imp,space,top',
      },
    ])
  })

  jsonic.rule('list', (rs: RuleSpec) => {
    // rs.bo(false, (...rest: any) => {
    rs.bo(false, (r: Rule) => {
      // List elements are new expressions.
      // Unless this is an implicit list.
      if (!r.prev.u.implist) {
        r.n.expr = 0
        r.n.expr_prefix = 0
        r.n.expr_suffix = 0
        r.n.expr_paren = 0
        r.n.expr_ternary = 0
      }
    }).close([
      hasParen && {
        s: [CP],

        // If end of normal list, consume `]` - it's not a close paren.
        b: (r: Rule) => (CS === r.c0.tin && !r.n.expr_paren ? 0 : 1),
      },
    ])
  })

  jsonic.rule('map', (rs: RuleSpec) => {
    rs.bo(false, (...rest: any) => {
      // Map values are new expressions.
      rest[0].n.expr = 0
      rest[0].n.expr_prefix = 0
      rest[0].n.expr_suffix = 0
      rest[0].n.expr_paren = 0
      rest[0].n.expr_ternary = 0
    }).close([
      hasParen && {
        s: [CP],
        // If end of normal map, consume `}` - it's not a close paren.
        b: (r: Rule) => (CB === r.c0.tin && !r.n.expr_paren ? 0 : 1),
      },
    ])
  })

  jsonic.rule('elem', (rs: RuleSpec) => {
    rs.close([
      // Close implicit list within parens.
      hasParen
        ? {
            s: [CP],
            b: 1,
            c: (r: Rule) => !!r.n.expr_paren,
            g: 'expr,expr-paren,imp,close,list',
          }
        : NONE,

      // Following elem is a paren expression.
      hasParen
        ? {
            s: [OP],
            b: 1,
            r: 'elem',
            g: 'expr,expr-paren,imp,open,list',
          }
        : NONE,
    ])
  })

  jsonic.rule('pair', (rs: RuleSpec) => {
    rs.close([
      // Close implicit map within parens.
      hasParen
        ? {
            s: [CP],
            b: 1,
            c: (r: Rule) => !!r.n.expr_paren || 0 < r.n.pk,
            g: 'expr,expr-paren,imp,map',
          }
        : NONE,
    ])
  })

  jsonic.rule('expr', (rs: RuleSpec) => {
    rs.open([
      // An opening parenthesis of an expression.
      hasParen
        ? {
            s: [OP],
            p: 'val',
            g: 'expr,expr-paren,expr-start',
          }
        : NONE,

      hasPrefix
        ? {
            s: [PREFIX],
            c: (r: Rule) => !!r.n.expr_prefix,
            n: { expr: 1, dlist: 1, dmap: 1 },
            p: 'val',
            g: 'expr,expr-prefix',
            a: (r: Rule) => {
              const op = makeOp(r.o0, prefixTM)
              r.node = isOp(r.parent.node)
                ? prattify(r.parent.node, op)
                : prior(r, r.parent, op)
            },
          }
        : NONE,

      hasInfix
        ? {
            s: [INFIX],
            p: 'val',
            n: { expr: 1, expr_prefix: 0, dlist: 1, dmap: 1 },
            a: (r: Rule) => {
              const prev = r.prev
              const parent = r.parent
              const op = makeOp(r.o0, infixTM)

              // Second and further operators.
              if (isOp(parent.node) && !isTernaryOp(parent.node)) {
                r.node = prattify(parent.node, op)
              }

              // First term was unary expression.
              else if (isOp(prev.node)) {
                r.node = prattify(prev.node, op)
                r.parent = prev
              }

              // First term was plain value or ternary part.
              else {
                r.node = prior(r, prev, op)
              }
            },
            g: 'expr,expr-infix',
          }
        : NONE,

      hasSuffix
        ? {
            s: [SUFFIX],
            n: { expr: 1, expr_prefix: 0, dlist: 1, dmap: 1 },
            a: (r: Rule) => {
              const prev = r.prev
              const op = makeOp(r.o0, suffixTM)
              r.node = isOp(prev.node)
                ? prattify(prev.node, op)
                : prior(r, prev, op)
            },
            g: 'expr,expr-suffix',
          }
        : NONE,
    ])

      .bc((r: Rule) => {
        // Append final term to expression.
        if (isOp(r.node) && r.node?.length - 1 < r.node[0].terms) {
          r.node.push(r.child.node)
        }
      })

      .close([
        hasInfix
          ? {
              s: [INFIX],
              // Complete prefix first.
              c: (r: Rule) => !r.n.expr_prefix,
              b: 1,
              r: 'expr',
              g: 'expr,expr-infix',
            }
          : NONE,

        hasSuffix
          ? {
              s: [SUFFIX],
              c: (r: Rule) => !r.n.expr_prefix,
              b: 1,
              r: 'expr',
              g: 'expr,expr-suffix',
            }
          : NONE,

        hasParen
          ? {
              s: [CP],
              c: (r: Rule) => !!r.n.expr_paren,
              b: 1,
            }
          : NONE,

        hasTernary
          ? {
              s: [TERN0],
              c: (r: Rule) => !r.n.expr_prefix,
              b: 1,
              r: 'ternary',
              g: 'expr,expr-ternary',
            }
          : NONE,

        // Implicit list at the top level.
        {
          s: [CA],
          // c: { d: 0 },
          c: (r: Rule) => r.d <= 0,
          n: { expr: 0 },
          r: 'elem',
          a: (r: Rule) => (r.parent.node = r.node = [r.node]),
          g: 'expr,comma,list,top',
        },

        // Implicit list at the top level.
        {
          s: [VAL],
          // c: { d: 0 },
          c: (r: Rule) => r.d <= 0,
          n: { expr: 0 },
          b: 1,
          r: 'elem',
          a: (r: Rule) => (r.parent.node = r.node = [r.node]),
          g: 'expr,space,list,top',
        },

        // Implicit list indicated by comma.
        {
          s: [CA],
          c: (r: Rule) => r.lte('pk'),
          n: { expr: 0 },
          b: 1,
          h: implicitList,
          g: 'expr,list,val,imp,comma',
        },

        // Implicit list indicated by space separated value.
        {
          c: (r: Rule) => r.lte('pk') && r.lte('expr_suffix'),
          n: { expr: 0 },
          h: implicitList,
          g: 'expr,list,val,imp,space',
        },

        // Expression ends on non-expression token.
        {
          n: { expr: 0 },
          g: 'expr,expr-end',
        },
      ])

      .ac((r: Rule, ctx: Context) => {
        // Only evaluate at root of expr (where r.n.expr === 0)

        // console.log('EXPR AC', r)

        if (options.evaluate && 0 === r.n.expr) {
          // The parent node will contain the root of the expr tree
          r.parent.node = evaluation(
            r.parent,
            ctx,
            r.parent.node,
            options.evaluate,
          )
        }
      })
  })

  jsonic.rule('paren', (rs: RuleSpec) => {
    rs.bo((r: Rule) => {
      // Allow implicits inside parens
      r.n.dmap = 0
      r.n.dlist = 0
      r.n.pk = 0
    })
      .open([
        hasParen
          ? {
              s: [OP, CP],
              b: 1,
              g: 'expr,expr-paren,empty',
              c: (r: Rule) =>
                parenOTM[r.o0.tin].name === parenCTM[r.o1.tin].name,
              a: makeOpenParen(parenOTM),
            }
          : NONE,

        hasParen
          ? {
              s: [OP],
              p: 'val',
              n: {
                expr_paren: 1,
                expr: 0,
                expr_prefix: 0,
                expr_suffix: 0,
              },
              g: 'expr,expr-paren,open',
              a: makeOpenParen(parenOTM),
            }
          : NONE,
      ])

      .close([
        hasParen
          ? {
              s: [CP],
              c: (r: Rule) => {
                const pdef = parenCTM[r.c0.tin]
                let pd = 'expr_paren_depth_' + pdef.name
                return !!r.n[pd]
              },

              a: makeCloseParen(parenCTM),
              g: 'expr,expr-paren,close',
            }
          : NONE,
      ])

      .ac((r: Rule, ctx: Context) => {
        // A Paren can occur outside an expression
        if (options.evaluate && 0 === r.n.expr) {
          r.node = evaluation(r.child, ctx, r.child.node, options.evaluate)
        }
      })
  })

  // Ternary operators are like fancy parens.
  if (hasTernary) {
    jsonic.rule('ternary', (rs: RuleSpec) => {
      rs.open([
        {
          s: [TERN0],
          p: 'val',
          n: {
            expr_ternary: 1,
            expr: 0,
            expr_prefix: 0,
            expr_suffix: 0,
          },
          u: { expr_ternary_step: 1 },
          g: 'expr,expr-ternary,open',
          a: (r: Rule) => {
            let op = makeOp(r.o0, ternaryTM)
            r.u.expr_ternary_name = op.name

            if (isOp(r.prev.node)) {
              r.node = makeNode(r.prev.node, op, dupNode(r.prev.node))
            } else {
              r.node = r.prev.node = makeNode([], op, r.prev.node)
            }

            r.u.expr_ternary_paren =
              r.n.expr_paren || r.prev.u.expr_ternary_paren || 0

            r.n.expr_paren = 0
          },
        },
        {
          p: 'val',
          c: (r: Rule) => 2 === r.prev.u.expr_ternary_step,
          a: (r: Rule) => {
            r.u.expr_ternary_step = r.prev.u.expr_ternary_step
            r.n.expr_paren = r.u.expr_ternary_paren =
              r.prev.u.expr_ternary_paren
          },
          g: 'expr,expr-ternary,step',
        },
      ]).close([
        {
          s: [TERN1],
          c: (r: Rule) => {
            return (
              1 === r.u.expr_ternary_step &&
              r.u.expr_ternary_name === ternaryTM[r.c0.tin].name
            )
          },
          r: 'ternary',
          a: (r: Rule) => {
            r.u.expr_ternary_step++
            r.node.push(r.child.node)
          },
          g: 'expr,expr-ternary,step',
        },

        // End of ternary at top level. Implicit list indicated by comma.
        {
          s: [[CA, ...CP]],
          c: implicitTernaryCond,
          // Handle ternary as first item of imp list inside paren.
          b: (_r: Rule, ctx: Context) => (CP.includes(ctx.t0.tin) ? 1 : 0),
          r: (r: Rule, ctx: Context) =>
            !CP.includes(ctx.t0.tin) &&
            (0 === r.d ||
              (r.prev.u.expr_ternary_paren && !r.parent.node?.length))
              ? 'elem'
              : '',
          a: implicitTernaryAction,
          g: 'expr,expr-ternary,list,val,imp,comma',
        },

        // End of ternary at top level.
        // Implicit list indicated by space separated value.
        {
          c: implicitTernaryCond,
          // Handle ternary as first item of imp list inside paren.
          r: (r: Rule, ctx: Context) => {
            return (0 === r.d ||
              !CP.includes(ctx.t0.tin) ||
              r.prev.u.expr_ternary_paren) &&
              !r.parent.node?.length &&
              ZZ !== ctx.t0.tin
              ? 'elem'
              : ''
          },
          a: implicitTernaryAction,
          g: 'expr,expr-ternary,list,val,imp,space',
        },

        // End of ternary.
        {
          c: (r: Rule) => 0 < r.d && 2 === r.u.expr_ternary_step,
          a: (r: Rule) => {
            r.node.push(r.child.node)
          },
          g: 'expr,expr-ternary,close',
        },
      ])
    })
  }
}

// Convert prior (parent or previous) rule node into an expression.
function prior(rule: Rule, prior: Rule, op: Op) {
  let prior_node = prior.node
  if (isOp(prior.node)) {
    prior_node = dupNode(prior.node)
  } else {
    prior.node = []
  }

  makeNode(prior.node, op)

  if (!op.prefix) {
    prior.node[1] = prior_node
  }

  // Ensure first term val rule contains final expression.
  rule.parent = prior

  return prior.node
}

// Add token so that expression evaluator can reference source locations.
function makeOp(t: Token, om: OpMap): Op {
  return { ...om[t.tin], token: t, OP_MARK }
}

function makeNode(node: any, op: Op, ...terms: any): any {
  let out = node
  out[0] = op

  let tI = 0
  for (; tI < terms.length; tI++) {
    out[tI + 1] = terms[tI]
  }
  out.length = tI + 1

  return out
}

function dupNode(node: any): any {
  let out: any = [...node]
  return out
}

function makeOpenParen(parenOTM: OpMap) {
  return function openParen(r: Rule) {
    const op = makeOp(r.o0, parenOTM)
    let pd = 'expr_paren_depth_' + op.name
    r.u[pd] = r.n[pd] = 1
    r.node = undefined
  }
}

function makeCloseParen(parenCTM: OpMap) {
  return function closeParen(r: Rule) {
    if (isOp(r.child.node)) {
      r.node = r.child.node
    } else if (undefined === r.node) {
      r.node = r.child.node
    }

    const op = makeOp(r.c0, parenCTM)
    let pd = 'expr_paren_depth_' + op.name

    // Construct completed paren expression.
    if (r.u[pd] === r.n[pd]) {
      const val = r.node

      // r.node = [op.osrc]
      r.node = [op]
      if (undefined !== val) {
        r.node[1] = val
      }

      if (r.parent.prev.u.paren_preval) {
        if (isParenOp(r.parent.prev.node)) {
          r.node = makeNode(
            r.parent.prev.node,
            r.node[0],
            dupNode(r.parent.prev.node),
            r.node[1],
          )
        } else {
          r.node.splice(1, 0, r.parent.prev.node)
          r.parent.prev.node = r.node
        }
      }
    }
  }
}

function implicitList(rule: Rule, ctx: Context, a: any) {
  let paren: Rule | null = null

  // Find the paren rule that contains this implicit list.
  for (let rI = ctx.rsI - 1; -1 < rI; rI--) {
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
    else if (isOp(paren.child.node)) {
      paren.child.node = [paren.child.node]
      a.r = 'elem'
      a.b = 0
    }

    rule.node = paren.child.node
  }
  return a
}

function implicitTernaryCond(r: Rule) {
  let cond =
    (0 === r.d || 1 <= r.n.expr_paren) && !r.n.pk && 2 === r.u.expr_ternary_step
  // console.log('****** ITC', cond, r.n.pk)
  return cond
}

function implicitTernaryAction(r: Rule, _ctx: Context, a: AltMatch) {
  r.n.expr_paren = r.prev.u.expr_ternary_paren
  r.node.push(r.child.node)

  if ('elem' === a.r) {
    r.node[0] = dupNode(r.node)
    r.node.length = 1
  }
}

function isParenOp(node: any) {
  return isOpKind('paren', node)
}

function isTernaryOp(node: any) {
  return isOpKind('ternary', node)
}

function isOpKind(kind: string, node: any) {
  return null == node ? false : isOp(node) && true === node[0][kind]
}

function isOp(node: any) {
  return null == node ? false : node[0] && node[0].OP_MARK === OP_MARK
}

function makeOpMap(
  token: (tkn: string | Tin) => Tin | string,
  fixed: (tkn: string) => Tin,
  op: { [name: string]: OpDef },
  anyfix: 'prefix' | 'suffix' | 'infix' | 'ternary',
): OpMap {
  return Object.entries(op)
    .filter(([_, opdef]: [string, OpDef]) => opdef[anyfix])
    .reduce((odm: OpMap, [name, opdef]: [string, OpDef]) => {
      let tkn = ''
      let tin = -1
      let src = ''

      if ('string' === typeof opdef.src) {
        src = opdef.src
      } else {
        src = (opdef.src as string[])[0]
      }

      tin = (fixed(src) || token('#E' + src)) as Tin
      tkn = token(tin) as string

      let op = (odm[tin] = {
        src: src,
        left: opdef.left || Number.MIN_SAFE_INTEGER,
        right: opdef.right || Number.MAX_SAFE_INTEGER,
        name: name + (name.endsWith('-' + anyfix) ? '' : '-' + anyfix),
        infix: 'infix' === anyfix,
        prefix: 'prefix' === anyfix,
        suffix: 'suffix' === anyfix,
        ternary: 'ternary' === anyfix,
        tkn,
        tin,
        terms: 'ternary' === anyfix ? 3 : 'infix' === anyfix ? 2 : 1,
        use: {} as any,
        paren: false,
        osrc: '',
        csrc: '',
        otkn: '',
        ctkn: '',
        otin: -1,
        ctin: -1,
        preval: {
          active: false,
          required: false,
        },
        token: {} as Token,
        OP_MARK,
      })

      // Handle the second operator if ternary.
      if (op.ternary) {
        let srcs = opdef.src as string[]
        op.src = srcs[0]
        op.use.ternary = { opI: 0 }

        let op2 = { ...op }
        src = (opdef.src as string[])[1]

        tin = (fixed(src) || token('#E' + src)) as Tin
        tkn = token(tin) as string

        op2.src = src
        op2.use = { ternary: { opI: 1 } }
        op2.tkn = tkn
        op2.tin = tin

        odm[tin] = op2
      }

      return odm
    }, {})
}

function makeParenMap(
  token: (tkn_tin: string | Tin) => Tin | string,
  fixed: (tkn: string) => Tin,
  optop: { [name: string]: OpDef },
): OpMap {
  return entries(optop).reduce((a: OpMap, [name, pdef]: [string, any]) => {
    if (pdef.paren) {
      let otin = (fixed(pdef.osrc) || token('#E' + pdef.osrc)) as Tin
      let otkn = token(otin) as string
      let ctin = (fixed(pdef.csrc) || token('#E' + pdef.csrc)) as Tin
      let ctkn = token(ctin) as string

      a[otin] = {
        name: name + '-paren',
        osrc: pdef.osrc,
        csrc: pdef.csrc,
        otkn,
        otin,
        ctkn,
        ctin,
        preval: {
          // True by default if preval specified.
          active:
            null == pdef.preval
              ? false
              : null == pdef.preval.active
                ? true
                : pdef.preval.active,
          // False by default.
          required:
            null == pdef.preval
              ? false
              : null == pdef.preval.required
                ? false
                : pdef.preval.required,
        },
        use: {} as any,
        paren: true,
        src: pdef.osrc,
        // left: -1,
        // right: -1,
        left: Number.MIN_SAFE_INTEGER,
        right: Number.MAX_SAFE_INTEGER,
        infix: false,
        prefix: false,
        suffix: false,
        ternary: false,
        tkn: '',
        tin: -1,
        terms: 1,
        token: {} as Token,
        OP_MARK,
      }
    }
    return a
  }, {}) as OpMap
}

Expr.defaults = {
  op: {
    positive: {
      prefix: true,
      right: 14000,
      src: '+',
    },
    negative: {
      prefix: true,
      right: 14000,
      src: '-',
    },

    // NOTE: all these are left-associative as left < right
    // Example: 2+3+4 === (2+3)+4
    addition: {
      infix: true,
      left: 140,
      right: 150,
      src: '+',
    },
    subtraction: {
      infix: true,
      left: 140,
      right: 150,
      src: '-',
    },
    multiplication: {
      infix: true,
      left: 160,
      right: 170,
      src: '*',
    },
    division: {
      infix: true,
      left: 160,
      right: 170,
      src: '/',
    },
    remainder: {
      infix: true,
      left: 160,
      right: 170,
      src: '%',
    },

    plain: {
      paren: true,
      osrc: '(',
      csrc: ')',
    },
  },
} as ExprOptions

// Pratt algorithm embeds next operator.
// NOTE: preserves referential integrity of root expression.
function prattify(expr: any, op?: Op): any[] {
  let out = expr
  let expr_op = expr[0]

  if (op) {
    if (op.infix) {
      // op is lower
      if (expr_op.suffix || op.left <= expr_op.right) {
        makeNode(expr, op, dupNode(expr))
      }

      // op is higher
      else {
        const end = expr_op.terms

        if (isOp(expr[end]) && expr[end][0].right < op.left) {
          out = prattify(expr[end], op)
        } else {
          out = expr[end] = makeNode([], op, expr[end])
        }
      }
    } else if (op.prefix) {
      out = expr[expr_op.terms] = makeNode([], op)
    } else if (op.suffix) {
      if (!expr_op.suffix && expr_op.right <= op.left) {
        const end = expr_op.terms

        // NOTE: special case: higher precedence suffix "drills" into
        // lower precedence prefixes: @@1! => @(@(1!)), not @((@1)!)
        if (
          isOp(expr[end]) &&
          expr[end][0].prefix &&
          expr[end][0].right < op.left
        ) {
          prattify(expr[end], op)
        } else {
          expr[end] = makeNode([], op, expr[end])
        }
      } else {
        makeNode(expr, op, dupNode(expr))
      }
    }
  }

  return out
}

function evaluation(rule: Rule, ctx: Context, expr: any, evaluate: Evaluate) {
  // console.log('EXPR-EVAL', expr, resolve)

  if (null == expr) {
    return expr
  }

  if (isOp(expr)) {
    return evaluate(
      rule,
      ctx,
      expr[0],
      expr.slice(1).map((term: any) => evaluation(rule, ctx, term, evaluate)),
    )
  }

  return expr
}

const testing = {
  prattify,
  opify: (x: any) => ((x.OP_MARK = OP_MARK), x),
}

export { Expr, evaluation, testing }

export type { ExprOptions, OpDef, Op, Evaluate }
