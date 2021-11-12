/* Copyright (c) 2021 Richard Rodger, MIT License */

// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html


// TODO: error on incomplete expr: 1+2+
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

          // The opening parenthesis of an expression with a preceding value.
          // foo(1) => preval='foo', expr=['(',1]
          hasParen ? {
            s: [OP],
            b: 1,
            r: 'paren',
            c: (r: Rule) => parenOTM[r.c0.tin].preval,
            u: { paren_preval: true },
            g: 'expr,expr-paren,expr-paren-prefix',
          } : NONE,

          {
            s: [CA],
            c: (r: Rule) => 1 === r.d && 1 <= r.n.expr,
            b: 1,
            g: 'expr,list,val,imp,comma,top',
          },

          {
            s: [VAL],
            c: (r: Rule) => 1 === r.d && 1 <= r.n.expr,
            b: 1,
            g: 'expr,list,val,imp,space,top',
          },

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
            g: 'expr,expr-paren,imp,map',
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
            n: { expr: 1, il: 1, im: 1 },
            p: 'val',
            g: 'expr,expr-prefix',
            a: (r: Rule) => {
              const parent = r.parent
              const op = prefixTM[r.o0.tin]
              r.node =
                parent.node?.op$ ? prattify(parent.node, op) : prior(r, parent, op)
            }
          } : NONE,

          hasInfix ? {
            s: [INFIX],
            p: 'val',
            n: { expr: 1, expr_prefix: 0, il: 1, im: 1 },
            a: (r: Rule) => {
              const prev = r.prev
              const parent = r.parent
              const op = infixTM[r.o0.tin]

              // Second and further operators.
              if (parent.node?.op$) {
                r.node = prattify(parent.node, op)
              }

              // First term was unary expression.
              else if (prev.node?.op$) {
                r.node = prattify(prev.node, op)
                r.parent = prev
              }

              // First term was plain value.
              else {
                r.node = prior(r, prev, op)
              }
            },
            g: 'expr,expr-infix',
          } : NONE,

          hasSuffix ? {
            s: [SUFFIX],
            n: { expr: 1, expr_prefix: 0, il: 1, im: 1 },
            a: (r: Rule) => {
              const prev = r.prev
              const op = suffixTM[r.o0.tin]
              r.node =
                prev.node?.op$ ? prattify(prev.node, op) : prior(r, prev, op)
            },
            g: 'expr,expr-suffix',
          } : NONE,
        ])
        .bc((r: Rule) => {
          // Append final term to expression.
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

          // Implicit list at the top level. 
          {
            s: [CA],
            c: { d: 0 },
            n: { expr: 0 },
            r: 'elem',
            a: (rule: Rule) => rule.parent.node = rule.node = [rule.node],
            g: 'expr,comma,list,top',
          },

          // Implicit list at the top level. 
          {
            s: [VAL],
            c: { d: 0 },
            n: { expr: 0 },
            b: 1,
            r: 'elem',
            a: (rule: Rule) => rule.parent.node = rule.node = [rule.node],
            g: 'expr,space,list,top',
          },

          // Implicit list indicated by comma.
          {
            s: [CA],
            c: { n: { pk: 0 } },
            n: { expr: 0 },
            b: 1,
            h: implicitList,
            g: 'expr,list,val,imp,comma',
          },

          // Implicit list indicated by space separated value.
          {
            c: { n: { pk: 0, expr_suffix: 0 } },
            n: { expr: 0 },
            h: implicitList,
            g: 'expr,list,val,imp,space',
          },

          // Expression ends with non-expression token.
          {
            g: 'expr,expr-end',
          }
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
          hasParen ? {
            s: [OP, CP],
            b: 1,
            g: 'expr,expr-paren,empty',
            c: (r: Rule) => parenOTM[r.o0.tin].name === parenCTM[r.o1.tin].name,
            a: makeOpenParen(parenOTM),
          } : NONE,

          hasParen ? {
            s: [OP],
            p: 'val',
            n: {
              expr: 0, expr_prefix: 0, expr_suffix: 0,
            },
            g: 'expr,expr-paren,open',
            a: makeOpenParen(parenOTM),
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
            a: makeCloseParen(parenCTM),
            g: 'expr,expr-paren,close',
          } : NONE,
        ])
    })
}


// Convert prior (parent or previous) rule node into an expression.
function prior(rule: Rule, prior: Rule, op: OpFullDef) {
  if (op.prefix) {
    prior.node = [op.src]
  }
  else {
    prior.node = [op.src, prior.node]
  }

  prior.node.op$ = op

  // Ensure first term val rule contains final expression.
  rule.parent = prior

  return prior.node
}


function makeOpenParen(parenOTM: ParenDefMap) {
  return function openParen(r: Rule) {
    const pdef = parenOTM[r.o0.tin]
    let pd = 'expr_paren_depth_' + pdef.name
    r.use[pd] = r.n[pd] = 1
    r.node = undefined
  }
}

function makeCloseParen(parenCTM: ParenDefMap) {
  return function closeParen(r: Rule) {
    if (r.child.node?.op$) {
      r.node = r.child.node
    }
    else if (undefined === r.node) {
      r.node = r.child.node
    }

    const pdef = parenCTM[r.c0.tin]
    let pd = 'expr_paren_depth_' + pdef.name

    // Construct completed paren expression.
    if (r.use[pd] === r.n[pd]) {
      const pdef = parenCTM[r.c0.tin]

      const val = r.node
      r.node = [pdef.osrc]
      if (undefined !== val) {
        r.node[1] = val
      }
      // r.node.paren$ = true
      r.node.paren$ = pdef

      if (r.prev.use.paren_preval) {
        r.node.prefix$ = true
        r.node[2] = r.node[1]
        r.node[1] = r.prev.node
        r.prev.node = r.node
      }
    }
  }
}

function implicitList(rule: Rule, ctx: Context, a: any) {
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
    else if (paren.child.node.op$) {
      paren.child.node = [paren.child.node]
      a.r = 'elem'
      a.b = 0
    }

    rule.node = paren.child.node
  }
  return a
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
    // test_exponentiation: {
    //   infix: true, left: 1700, right: 1600, src: '**'
    // },

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


// Pratt algorithm embeds next operator.
// NOTE: preserves referential integrity of root expression.
function prattify(expr: any, op?: OpFullDef): any[] {
  let out = expr

  if (op) {
    if (op.infix) {

      // op is lower
      if (expr.op$.suffix || op.left <= expr.op$.right) {
        expr[1] = [...expr]
        expr[1].op$ = expr.op$

        expr[0] = op.src
        expr.op$ = op
        expr.length = 2
      }

      // op is higher
      else {
        const end = expr.op$.terms
        expr[end] = [op.src, expr[end]]
        expr[end].op$ = op
        out = expr[end]
      }
    }

    else if (op.prefix) {
      // expr.op$ MUST be infix or prefix
      const end = expr.op$.terms
      expr[end] = [op.src]
      expr[end].op$ = op
      out = expr[end]

    }
    else if (op.suffix) {
      if (!expr.op$.suffix && expr.op$.right <= op.left) {
        const end = expr.op$.terms

        // NOTE: special case: higher precedence suffix "drills" into
        // lower precedence prefixes - @@1! => @(@(1!)), not @((@1)!)
        if (expr[end].op$ &&
          expr[end].op$.prefix &&
          expr[end].op$.right < op.left) {
          prattify(expr[end], op)
        }
        else {
          expr[end] = [op.src, expr[end]]
          expr[end].op$ = op
        }
      }

      else {
        expr[1] = [...expr]
        expr[1].op$ = expr.op$

        expr[0] = op.src
        expr.op$ = op
        expr.length = 2
      }
    }
  }

  return out
}



export {
  Expr,
  prattify,
}

export type {
  OpFullDef
}


