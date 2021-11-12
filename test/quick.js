

const { Jsonic } = require('jsonic')
const { Debug } = require('jsonic/debug')

const { Expr }  = require('..')

const clean = (v)=>JSON.parse(JSON.stringify(v))

const j = Jsonic.make().use(Debug).use(Expr,{
  op: {
    // factorial: {
    //   suffix: true, left: 15000, src: '!'
    // },
    // question: {
    //   suffix: true, left: 13000, src: '?'
    // }


    // question: {
    //   infix: true, left: 15, right: 14, src: '?'
    // },
    // semicolon: {
    //   infix: true, left: 16, right: 17, src: ';'
    // },
  },
  
  paren: {
    angle: {
      osrc: '<',
      csrc: '>',
      postval: true,
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

