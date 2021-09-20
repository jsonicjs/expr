/* Copyright (c) 2021 Richard Rodger, MIT License */

// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html


// TODO: messes up implicit lists

// TODO: paren binaries: a(b), a[c], a?b:c


import { Jsonic, Plugin, Rule, RuleSpec, Tin } from 'jsonic'


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


type OpDef = {
  order: number,
  bp: number[],
  src: string
}

type OpFullDef = OpDef & {
  name: string,
  tkn: string,
  tin: number,
}


type ExprOptions = {
  op?: { [name: string]: OpDef },

  paren?: {
    open?: string
    close?: string
  }
}


let Expr: Plugin = function expr(jsonic: Jsonic, options: ExprOptions) {
  // let eval_expr = jsonic.options.plugin?.expr?.evaluate
  // eval_expr = null == eval_expr ? true : eval_expr

  // NOTE: the following transformations convert the user-friendly operations
  // definition list in options.op into more useful internal lookup structures.

  const opm: { [opname: string]: OpFullDef } =
    jsonic.util.omap(options.op, ([n, od]: [string, OpDef]) => [n, {
      ...od,
      name: n,
      tkn: '',
      tin: -1
    }])

  // Lookup for binding powers.
  const obp = jsonic.util.omap(opm, ([n, od]: [string, OpDef]) => [n, od.bp])

  // Determine unique token names. Some operations may share
  // operators (eg. positive, addition).
  const tm: { [src: string]: { tn: string, n: string[] } } =
    Object.keys(opm).reduce((a: any, n: any) =>
    ((a[opm[n].src] = {

      // Operator src may be used for an existing token, in which case, use that.
      tn: jsonic.token(jsonic.fixed(opm[n].src)) ||
        ((a[opm[n].src]?.tn || '') + '#expr-' + n + opm[n].src),
      n: (a[opm[n].src]?.n || [])
    }), a[opm[n].src].n.push(n), a), {})

  // Fixed tokens for Jsonic options.
  const fixed =
    jsonic.util.omap(tm, ([src, tm]: [string, { tn: string }]) => [tm.tn, src])

  // Lookup token name by operation name. Some operations may share
  // tokens (eg. negative, subtraction).
  const op2tn: { [opname: string]: string } =
    Object.keys(fixed).reduce((a: any, tn: string) =>
      (tm[fixed[tn]].n.map(on => a[on] = tn), a), {})

  // Tokens for the parens.
  fixed['#expr-open-paren'] = options?.paren?.open
  fixed['#expr-close-paren'] = options?.paren?.close


  jsonic.options({
    fixed: {
      token: fixed
    }
  })


  // Lookup token Tin by operator name.
  // Example: op2t['addition'] === jsonic.token('#expr-addition')
  // const op2t: { [opname: string]: Tin } = jsonic.util.omap(op2tn,
  //  ([on, tn]: [string, string]) => [on, jsonic.token(tn)])

  Object.values(opm).map((od: OpFullDef) => {
    od.tkn = op2tn[od.name]
    od.tin = jsonic.token(od.tkn)
  })


  const OP = jsonic.token['#expr-open-paren']
  const CP = jsonic.token['#expr-close-paren']

  // const CS = jsonic.token['#CS']


  // Apply `fn` to all operations of specified order.
  const ofOrder =
    (order: number, map?: (od: OpFullDef) => any) =>
      Object.values(opm)
        .filter((od: OpFullDef) => order === od.order)
        .map(map ? od => map(od) : (od => od))

  const forBinary = (fn?: (od: OpFullDef) => any) => ofOrder(2, fn || (x => x))


  const forUnary = (
    filter: (od: OpFullDef) => boolean,
    map: (od: OpFullDef) => any
  ) => ofOrder(1).filter(filter).map(map)

  let bt2od = forBinary().reduce((a, od) => (a[od.tin] = od, a), {})
  const BINARIES = [...forBinary(od => od.tin)]

  const put2od: { [tin: number]: OpFullDef } = {}
  const PREFIX_UNARIES = [...forUnary(
    (od => -1 === od.bp[0]),
    (od => (put2od[od.tin] = od, od.tin))
  )]

  const sut2od: { [tin: number]: OpFullDef } = {}
  const SUFFIX_UNARIES = [...forUnary(
    (od => -1 === od.bp[1]),
    (od => (sut2od[od.tin] = od, od.tin))
  )]

  jsonic
    .rule('val', (rs: RuleSpec) => {
      rs
        .open([
          {
            s: [PREFIX_UNARIES], b: 1, p: 'expr', g: 'expr',
            u: { prefix: true },
          },

          // TODO: counter for paren level
          { s: [OP], p: 'expr', n: { bp: 0 }, g: 'expr' },
        ])
        .close([
          {
            s: [SUFFIX_UNARIES], b: 1, g: 'expr', p: 'expr',
            u: { suffix: true },
          },
          {
            s: [BINARIES], b: 1, g: 'expr',
            u: { binary: true },
            h: (r: Rule, _, a: any) => {
              a.p = !r.n.ed ? 'expr' : ''
              return a
            }
          },

          { s: [CP], b: 1, g: 'expr' },
        ])
    })



  jsonic
    .rule('expr', (rs: RuleSpec) => {
      rs
        .bo(function box(r: Rule) {
          r.n.bp = r.n.bp || Number.MAX_SAFE_INTEGER
          r.n.ed = (r.n.ed || 0) + 1
        })

        .open([
          {
            // TODO: handle overlap with SUFFIX_UNARIES
            s: [PREFIX_UNARIES], p: 'val', g: 'expr',
            c: (r: Rule) => r.parent.use.prefix,
            a: (r: Rule) => {
              let od = put2od[r.o0.tin]
              r.n.bp = obp[od.name][1]
              r.node = [od.src]
              r.node.expr$ = 1
            }
          },

          {
            s: [SUFFIX_UNARIES], g: 'expr',
            c: (r: Rule) => r.parent.use.suffix,
            a: (r: Rule) => {
              let od = sut2od[r.o0.tin]
              let val = r.parent.node
              r.n.bp = obp[od.name][0]
              r.node = [od.src, val]
              r.node.expr$ = 1
            }
          },

          {
            s: [BINARIES], p: 'val', g: 'expr',
            c: (r: Rule) => r.parent.use.binary,
            a: (r: Rule) => {
              let od = bt2od[r.o0.tin]
              let val = r.parent.node

              let lbp = od.bp[0]
              let rbp = od.bp[1]

              if (lbp < r.n.bp) {
                r.node = [od.src, val]
              }
              else if (r.parent.node.expr$) {
                r.node = [od.src, r.parent.node[2]]
                r.parent.node[2] = r.node
                r.node.child$ = true
              }

              r.node.expr$ = 2
              r.n.bp = rbp
            }
          },

          { p: 'val', g: 'expr' }
        ])

        .bc(function bc(r: Rule) {
          // Last value.
          if (undefined != r.node && r.node.length - 1 < r.node.expr$) {
            r.node.push(r.child.node)
          }
          else {
            r.node = r.child.node
          }
        })

        .close([
          {
            s: [BINARIES], b: 1, g: 'expr',
            u: { binary: true },
            h: (r: Rule, _, a: any) => {
              a.p =
                (1 === r.n.ed ||
                  (!r.parent.use.prefix && !r.parent.use.suffix)) ? 'expr' : ''
              // console.log('WWW', r.n, r.parent.use, a.p)
              return a
            }
          },

          { s: [CP], g: 'expr' },

          // {
          //   s: [CS], g: 'expr',
          //   // c: (r: Rule) => {
          //   //   let cn = 'expr' + r.o0.name
          //   //   console.log('CLOSE cn', cn, r.use[cn], r.n[cn], (0 < r.use[cn]))
          //   //   return (0 < r.use[cn]) && (r.use[cn] === r.n[cn])
          //   // }
          // },
        ])

        .ac((r: Rule) => {
          if (!r.node?.child$) {
            r.parent.node = r.node
          }
        })
    })
}


Expr.defaults = {

  // TODO: this should not be a list, use a map for easier overrides
  op: {
    positive: {
      order: 1, bp: [-1, 10400], src: '+'
    },
    negative: {
      order: 1, bp: [-1, 10400], src: '-'
    },

    // TODO: move to test
    factorial: {
      order: 1, bp: [10400, -1], src: '!'
    },


    // NOTE: right-associative as lbp > rbp
    // Example: 2**3**4 === 2**(3**4)
    exponentiation: {
      order: 2, bp: [1700, 1600], src: '**'
    },

    // NOTE: all these are left-associative as lbp < rbp
    // Example: 2+3+4 === (2+3)+4
    addition: {
      order: 2, bp: [140, 150], src: '+'
    },
    subtraction: {
      order: 2, bp: [140, 150], src: '-'
    },
    multiplication: {
      order: 2, bp: [160, 170], src: '*'
    },
    division: {
      order: 2, bp: [160, 170], src: '/'
    },
    remainder: {
      order: 2, bp: [160, 170], src: '%'
    },
  },
  paren: {
    open: '(',
    close: ')',
  }
} as ExprOptions


export {
  Expr,
  evaluate,
}
