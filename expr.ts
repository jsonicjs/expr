/* Copyright (c) 2021 Richard Rodger, MIT License */

// This algorithm is based on Pratt parsing, and draws heavily from
// the explanation written by Aleksey Kladov here:
// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html


// TODO: paren binaries: a(b), a[c], a?b:c




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

          // // TODO: counter for paren level
          // { s: [OP], p: 'expr', n: { bp: 0, ed: 1 }, g: 'expr' },
          {
            s: [OP],
            p: 'expr',
            b: 1,
            // n: { ed: 0 },
            // p: 'expr',
            // n: { bp: Number.MAX_SAFE_INTEGER, ed: 0 }, g: 'expr'
          },
        ])
        .close([
          {
            s: [SUFFIX_UNARIES], b: 1, g: 'expr', r: 'expr',
            u: { suffix: true },
          },
          {
            s: [BINARIES], b: 1, g: 'expr',
            u: { binary: true },
            // r: 'expr',
            h: (r: Rule, _, a: any) => {

              // Only open an expression if not already in an expression.
              a.r = !r.n.ed ? 'expr' : ''

              // if ('expr' === a.r) {
              //   r.use.root = r
              // }

              // console.log('VAL CLOSE BIN', a.r, r.n.ed, r.use.root?.id)
              return a
            }
          },

          {
            s: [CP], b: 1, g: 'expr',
            // a: (r: Rule) => {
            //   console.log('VAL CLOSE CP', r.node)
            // }
          },

          // { s: [CP], b: 1, g: 'expr' },
        ])
    })



  jsonic
    .rule('expr', (rs: RuleSpec) => {
      rs
        .bo(function box(r: Rule) {
          // r.use.root = r.prev.use.root
          r.n.bp = r.n.bp || Number.MAX_SAFE_INTEGER
          // r.n.ed = (r.n.ed || 0) + 1

          // TODO: change to et for term count
          r.n.ed = (r.n.ed || 0)
          // console.log('EXPR BO ed=', r.n.ed, r.use.root?.id)

        })

        .open([
          {
            // TODO: handle overlap with SUFFIX_UNARIES
            s: [PREFIX_UNARIES], p: 'val', g: 'expr',
            c: (r: Rule) => r.parent.use.prefix,
            a: (r: Rule) => {
              r.n.ed++
              r.parent.use.prefix = false
              r.use.prefix = true
              let od = put2od[r.o0.tin]
              r.n.bp = obp[od.name][1]
              r.node = [od.src]
              r.node.expr$ = 1
              r.node.prefix$ = true
            }
          },

          {
            s: [SUFFIX_UNARIES], g: 'expr',
            c: (r: Rule) => r.prev.use.suffix,
            a: (r: Rule) => {
              r.n.ed++
              r.prev.use.suffix = false
              r.use.suffix = true
              let od = sut2od[r.o0.tin]
              let val = r.prev.node
              r.n.bp = obp[od.name][0]
              r.prev.node = r.node = [od.src, val]
              r.node.expr$ = 1
              r.node.suffix$ = true
            }
          },

          {
            s: [BINARIES], p: 'val', g: 'expr',
            c: (r: Rule) => r.prev.use.binary,
            a: (r: Rule) => {
              r.n.ed++

              let od = bt2od[r.o0.tin]
              // let val = r.parent.node
              let lhs = r.prev
              // let lhs = r.use.root
              // let val = lhs.node

              let lbp = od.bp[0]
              let rbp = od.bp[1]

              console.log('EXP OPEN BIN A',
                lbp, r.n,
                'r', JSON.parse(JSON.stringify(r.node)),
                'lhs', JSON.parse(JSON.stringify(lhs.node)),
                // 'root', JSON.parse(JSON.stringify(r.use.root.node)),
              )


              let log = ''

              if (lbp < r.n.bp) {
                log += 'D'

                // Preserve existing array references.
                if (lhs.node.expr$) {
                  lhs.node[1] = [...lhs.node]
                  lhs.node[0] = od.src
                  lhs.node.length = 2
                }
                else {
                  lhs.node = [od.src, lhs.node]
                }
                r.node = lhs.node

              }
              else if (lhs.node.expr$) {
                log += 'U'
                r.node = [od.src, lhs.node[2]]
                lhs.node[2] = r.node
                r.node.child$ = true
              }

              r.node.expr$ = 2
              r.n.bp = rbp

              console.log('EXP OPEN BIN B',
                log, r.n,
                'r', JSON.parse(JSON.stringify(r.node)),
                'lhs', JSON.parse(JSON.stringify(lhs.node)),
                // 'root', JSON.parse(JSON.stringify(r.use.root.node)),
              )
            }
          },

          {
            s: [OP], p: 'expr',
            //n: { bp: Number.MAX_SAFE_INTEGER, ed: 0 }, g: 'expr'
            n: { bp: 0, ed: 0, pd: 1 }, g: 'expr',
            // a: (r: Rule) => { r.use.pd = (r.n.pd || 0) + 1 },
            a: (r: Rule) => { r.use.pd = r.n.pd },
          },


          { p: 'val', g: 'expr' },

        ])

        .bc(function bc(r: Rule) {
          // Last value.
          if (undefined != r.node && r.node.length - 1 < r.node.expr$) {
            r.node.push(r.child.node)
          }
          else {
            r.node = r.child.node
            // console.log('EXPR BC REP', r.node)
          }

        })

        .close([
          {
            s: [BINARIES], b: 1, g: 'expr',
            u: { binary: true },
            //r: 'expr'
            h: (r: Rule, _, a: any) => {
              a.r = (!r.use.prefix && !r.use.suffix) ? 'expr' : ''
              // console.log('EXPR CLOSE BIN', r.n, r.parent.use, a.p)
              return a
            }
          },

          {
            s: [CP], g: 'expr', b: 1,
            h: (r: Rule, _, a: any) => {
              if (r.use.pd === r.n.pd) {
                a.b = 0
              }
              return a
              // r.prev.prev.node = r.node
            }
          },

          // {
          //   s: [CS], g: 'expr',
          //   // c: (r: Rule) => {
          //   //   let cn = 'expr' + r.o0.name
          //   //   console.log('CLOSE cn', cn, r.use[cn], r.n[cn], (0 < r.use[cn]))
          //   //   return (0 < r.use[cn]) && (r.use[cn] === r.n[cn])
          //   // }
          // },

          {}
        ])

        .ac((r: Rule) => {
          // if (!r.node?.child$) {
          // r.parent.node = r.node
          // r.prev.node = r.node
          // console.log('EXPR AC', r.prev.id, r.node)
          // }
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
