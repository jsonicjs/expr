/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */



import Lab from '@hapi/lab'
import Code from '@hapi/code'


const lab = (exports.lab = Lab.script())
const describe = lab.describe
const it = lab.it
const expect = Code.expect



import { Jsonic } from 'jsonic'
import { Expr } from '../expr'


describe('expr', function() {
  it('happy', () => {
    let j0 = Jsonic.make().use(Expr)

    expect(j0('1 + 2', { xlog: -1 })).equal(3)
    expect(j0('1 + 2 + 3', { xlog: -1 })).equal(6)

    expect(j0('1 * 2', { xlog: -1 })).equal(2)
    expect(j0('1 * 2 * 3', { xlog: -1 })).equal(6)

    expect(j0('2 + 3 * 4', { xlog: -1 })).equal(14)
    expect(j0('2 * 3 + 4', { xlog: -1 })).equal(10)

    expect(j0('2 + 3 * 4 + 5', { xlog: -1 })).equal(19)
    expect(j0('2 * 3 + 4 * 5', { xlog: -1 })).equal(26)
  })
})

