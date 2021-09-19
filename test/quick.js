

const { Jsonic } = require('jsonic')
const { Expr }  = require('..')

const clean = (v)=>JSON.parse(JSON.stringify(v))

const j = Jsonic.make().use(Expr, {
  op: {
    cs: {
      order: 2, bp: [160, 170], src: '['
    }
  }
})

const v = j(process.argv[2], { xlog: -1 })
console.log(v)
// console.log(clean(v), '###', v)


