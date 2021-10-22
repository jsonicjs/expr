

const { Jsonic } = require('jsonic')
const { Debug } = require('jsonic/debug')

const { Expr }  = require('..')

const clean = (v)=>JSON.parse(JSON.stringify(v))

const j = Jsonic.make().use(Debug).use(Expr, {
  op: {
    factorial: {
      suffix: true, left: 15000, right: 15000, src: '!'
    },
    question: {
      suffix: true, left: 13000, right: 13000, src: '?'
    }
  }
})

console.log(j.describe())
// , {
//   op: {
//     square: {
//       order: 2, bp: [100410, 100400], src: '[', close: ']'
//     }
//   }
// })


// console.dir(j.rule('elem').def, {depth:null})

const v = j(process.argv[2], { log: -1 })
// console.log(v)
//console.log(clean(v), '###', v)
console.dir(clean(v),{depth:null})

