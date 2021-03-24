/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */



import Lab from '@hapi/lab'
import Code from '@hapi/code'


const lab = (exports.lab = Lab.script())
const describe = lab.describe
const it = lab.it
const expect = Code.expect



import { Jsonic } from 'jsonic'
import { Expr, evaluate } from '../expr'


describe('expr', function() {
  it('happy', () => {
    let j0 = Jsonic.make().use(Expr)

    expect(j0('2 + 3', { xlog: -1 })).equal(5)
    expect(j0('2 + 3 + 4', { xlog: -1 })).equal(9)

    expect(j0('2 * 3', { xlog: -2 })).equal(6)
    expect(j0('2 * 3 * 4', { xlog: -1 })).equal(24)

    expect(j0('2 + 3 * 4', { xlog: -1 })).equal(14)
    expect(j0('2 * 3 + 4', { xlog: -1 })).equal(10)

    expect(j0('3 + 4 * 5 + 6', { log: -1 })).equal(29)
    expect(j0('3 * 4 + 5 * 6', { xlog: -1 })).equal(42)
  })

  it('evaluate', () => {
    console.log(evaluate({ a: 2, o: '+', b: { a: 3, o: '*', b: 4 } }))
  })


})

