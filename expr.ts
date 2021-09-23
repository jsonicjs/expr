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
  order: number
  bp: number[]
  src: string
}

type OpFullDef = OpDef & {
  name: string
  tkn: string
  tin: number
}

type ParenDef = {
  osrc: string
  csrc: string
  prefix?: {
    active?: boolean
    required?: boolean
  }
  suffix?: {
    active?: boolean
    required?: boolean
  }
}

type ParenFullDef = ParenDef & {
  name: string
  otkn: string
  otin: number
  ctkn: string
  ctin: number
  prefix: {
    active: boolean
    required: boolean
  }
  suffix: {
    active: boolean
    required: boolean
  }
}



type ExprOptions = {
  op?: { [name: string]: OpDef },

  paren?: { [name: string]: ParenDef },
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

  const pm: { [opname: string]: ParenFullDef } =
    jsonic.util.omap(options.paren, ([n, pd]: [string, ParenDef]) => [n, {
      ...pd,
      name: n,
      otkn: '',
      otin: -1,
      ctkn: '',
      ctin: -1,
      prefix: {
        active: null != pd.prefix && false !== pd.prefix?.active,
        required: true === pd.prefix?.required,
      },
      suffix: {
        active: null != pd.suffix && false !== pd.suffix?.active,
        required: true === pd.suffix?.required,
      },
    }])

  // console.log('pm', pm)




  // Lookup for operator binding powers.
  const obp = jsonic.util.omap(opm, ([n, od]: [string, OpDef]) => [n, od.bp])

  // Operator src may be used for an existing token, in which case, use that.
  const resolveToken = (a: any, name: string, src?: string) => {
    if (null != src) {
      a[src] = {
        tn: jsonic.token(jsonic.fixed(src)) ||

          // Operator src may be used for multiple operators (eg. unary and binary).
          ((a[src]?.tn || '') + '#expr-' + name + src),
        n: (a[src]?.n || [])
      }
      a[src].n.push(name)
    }
  }

  // Determine unique token names. Some operations may share
  // operators (eg. positive, addition).
  const tm: { [src: string]: { tn: string, n: string[] } } =
    Object.keys(opm).reduce((a: any, name: any) =>
      (resolveToken(a, name, opm[name].src), a), {})

  Object.keys(pm).reduce((a: any, name: any) => (
    resolveToken(a, name + '-open', pm[name].osrc),
    resolveToken(a, name + '-close', pm[name].csrc),
    a), tm)


  // console.log('tm', tm)


  // Fixed tokens for Jsonic options.
  const fixed =
    jsonic.util.omap(tm, ([src, tm]: [string, { tn: string }]) => [tm.tn, src])

  // Lookup token name by operation or paren name. Some operations or
  // parens may share tokens (eg. negative, subtraction).
  const n2tn: { [opname: string]: string } =
    Object.keys(fixed).reduce((a: any, tn: string) =>
      (tm[fixed[tn]].n.map(on => a[on] = tn), a), {})


  // console.log('fixed', fixed)

  // console.log('n2tn', n2tn)



  // Tokens for the parens.
  // fixed['#expr-open-paren'] = options?.paren?.open
  // fixed['#expr-close-paren'] = options?.paren?.close


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
    od.tkn = n2tn[od.name]
    od.tin = jsonic.token(od.tkn)
  })
  // console.log('opm', opm)

  Object.values(pm).map((pd: ParenFullDef) => {
    pd.otkn = n2tn[pd.name + '-open']
    pd.otin = jsonic.token(pd.otkn)
    pd.ctkn = n2tn[pd.name + '-close']
    pd.ctin = jsonic.token(pd.ctkn)
  })
  // console.log('pm', pm)


  // const OP = jsonic.token['#expr-open-paren']
  // const CP = jsonic.token['#expr-close-paren']

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


  const po2pd: { [tin: number]: ParenFullDef } = {}
  const pc2pd: { [tin: number]: ParenFullDef } = {}
  const PAREN_OPENS = Object.values(pm).map(pd => {
    po2pd[pd.otin] = pd
    return pd.otin
  })
  const PAREN_CLOSES = Object.values(pm).map(pd => {
    pc2pd[pd.ctin] = pd
    return pd.ctin
  })

  // console.log('PAREN_OPENS', PAREN_OPENS)
  // console.log('PAREN_CLOSES', PAREN_CLOSES)
  // console.log('po2pd', po2pd)
  // console.log('pc2pd', pc2pd)


  jsonic
    .rule('val', (rs: RuleSpec) => {
      rs
        .open([
          {
            s: [PREFIX_UNARIES], b: 1, p: 'expr', g: 'expr,unary,prefix',
            u: { prefix: true },
          },

          {
            s: [PAREN_OPENS], b: 1, p: 'expr', g: 'expr,paren',
            c: (r: Rule) => {
              let pd = po2pd[r.o0.tin]
              return !pd.prefix.required
            }
          },
        ])
        .close([
          {
            s: [SUFFIX_UNARIES], b: 1, r: 'expr', g: 'expr,unary,suffix',
            u: { suffix: true },
          },
          {
            s: [BINARIES], b: 1, g: 'expr,binary',
            u: { binary: true },
            h: (r: Rule, _, a: any) => {
              // Only open an expression if not already in an expression.
              a.r = !r.n.ed ? 'expr' : ''
              return a
            }
          },

          {
            s: [PAREN_CLOSES], b: 1, g: 'expr,paren',
            c: (r: Rule) => !!r.n.pd
          },


          {
            s: [PAREN_OPENS],
            p: 'expr',
            b: 1,
            c: (r: Rule) => {
              let pd = po2pd[r.c0.tin]
              return pd.prefix.active
            },
            u: { paren_prefix: true },
            g: 'expr,paren,prefix'
          },
        ])
    })


  jsonic
    .rule('elem', (rs: RuleSpec) => {
      rs
        .close([
          {
            s: [PAREN_CLOSES], b: 1, g: 'expr,paren',
            c: (r: Rule) => !!r.n.pd
          },
        ])
    })

  jsonic
    .rule('pair', (rs: RuleSpec) => {
      rs
        .close([
          {
            s: [PAREN_CLOSES], b: 1, g: 'expr,paren',
            c: (r: Rule) => !!r.n.pd
          },
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
            s: [PREFIX_UNARIES], p: 'val', g: 'expr,unary,prefix',
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
            s: [SUFFIX_UNARIES], g: 'expr,unary,suffix',
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
            s: [BINARIES],
            p: 'val',
            g: 'expr,binary',
            c: (r: Rule) => r.prev.use.binary,
            a: (r: Rule) => {
              r.use.op = r.o0.name

              r.n.ed++

              let od = bt2od[r.o0.tin]
              let lhs = r.prev

              let lbp = od.bp[0]
              let rbp = od.bp[1]

              if (lbp < r.n.bp) {
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
                r.node = [od.src, lhs.node[2]]
                lhs.node[2] = r.node
                r.node.child$ = true
              }

              r.node.expr$ = 2
              r.n.bp = rbp
            }
          },

          {
            s: [PAREN_OPENS], p: 'expr',
            n: {
              bp: 0, ed: 0, pd: 1,
            },
            g: 'expr,paren',
            a: (r: Rule) => {
              r.use.pd = r.n.pd
              let pd = po2pd[r.o0.tin]

              if (r.parent.use.paren_prefix) {
                r.parent.node = [r.o0.src, r.parent.node]
                r.parent.node.expr$ = 2

                // Ternary.
                if (pd.suffix.active) {
                  r.parent.node.expr$ = 3
                }

                r.node = r.parent.node
                console.log('EXPR PO', r.node)
              }
              else if (pd.prefix.required) {
                r.o0.err = 'prefix_required'
                return r.o0
              }
            },
          },

          { p: 'val', g: 'expr,val' },
        ])

        .bc(function bc(r: Rule) {
          // Last value.
          if (undefined != r.node && r.node.length - 1 < r.node.expr$
            && r.node !== r.child.node) {
            r.node.push(r.child.node)
          }
          else {
            let pd = po2pd[r.o0.tin]
            if (pd) {
              r.node = r.child.node
              if (!Array.isArray(r.node)) {
                r.node = ['', r.node]
              }
              r.node.expr$ = 1
              r.node.paren$ = pd.osrc
            }
            else {
              r.node = r.child.node
            }
          }
        })

        .close([
          {
            s: [BINARIES], b: 1, g: 'expr,binary',
            u: { binary: true },
            h: (r: Rule, _, a: any) => {
              a.r = (!r.use.prefix && !r.use.suffix) ? 'expr' : ''
              return a
            }
          },

          {
            s: [PAREN_CLOSES], g: 'expr,paren', b: 1,
            c: (r: Rule) => !!r.n.pd,
            h: (r: Rule, _, a: any) => {

              // Only act on matching close paren
              if (r.use.pd === r.n.pd) {
                a.b = 0

                // Suffix
                let pd = pc2pd[r.c0.tin]
                if (pd.suffix.active) {
                  a.n = a.n || {}
                  a.n.il = 1
                  a.r = 'expr'
                  a.u = a.u || {}

                  // TODO: also paren_prefix = pd
                  a.u.paren_suffix = pd
                }
              }
              return a
            }
          },

          // {
          //   s: [CS], g: 'expr',
          //   c: (r: Rule) => {
          //     console.log('CS', r.c0.tin, r.name, r.id, r.use, r.node)
          //     // let cn = 'expr' + r.o0.name
          //     // console.log('CLOSE cn', cn, r.use[cn], r.n[cn], (0 < r.use[cn]))
          //     // return (0 < r.use[cn]) && (r.use[cn] === r.n[cn])
          //     // return true

          //     if (r.use.ctin === r.c0.tin) {
          //       return true
          //     }
          //     else {
          //       return false
          //     }
          //   }
          // },

          {
            c: (r: Rule) => r.prev.use.paren_suffix,
            a: (r: Rule) => {
              let pd = r.prev.use.paren_suffix
              let val = r.prev.node
              r.prev.node = [pd.osrc, val, r.child.node]
            }
          },

          {}
        ])

        .ac((r: Rule) => {
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
    // factorial: {
    //   order: 1, bp: [10400, -1], src: '!'
    // },

    // // TODO: move to test
    // indexation: {
    //   order: 2, bp: [2700, 2600], src: '[', csrc: ']'
    // },




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
    pure: {
      osrc: '(', csrc: ')',
      prefix: {}
    },

    // func: {
    //   osrc: '<', csrc: '>',
    //   prefix: {
    //     // required: false
    //   }
    // },

    // TODO: move to test
    // index: {
    //   osrc: '[', csrc: ']', prefix: {
    //     required: true
    //   }
    // },
    // ternary: { osrc: '?', csrc: ':', prefix: {}, suffix: {} },
    // ternary: { osrc: '<', csrc: '>', prefix: true, suffix: true },
    // quote: { osrc: '<<', csrc: '>>', prefix: {}, suffix: {} },
  }

} as ExprOptions


export {
  Expr,
  evaluate,
}
