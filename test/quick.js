

const { Jsonic } = require('jsonic')
const { Expr }  = require('..')

const clean = (v)=>JSON.parse(JSON.stringify(v))

const j = Jsonic.make().use(Expr)

const v = j(process.argv[2], { log: -1 })
console.log(clean(v), '###', v)


