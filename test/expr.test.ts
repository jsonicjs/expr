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


  it('ast', () => {
    let j0 = Jsonic.make().use(Expr, { evaluate: false })

    let s = ''

    // console.dir(j0('(11)', { log: -1 }), { depth: null })
    // console.dir(j0('((11))', { log: -1 }), { depth: null })
    // console.dir(j0('(11)+22', { log: -1 }), { depth: null })
    // console.dir(j0('((11)+22)', { log: -1 }), { depth: null })
    // console.dir(j0('((11+22)+33)', { log: -1 }), { depth: null })
    // console.dir(j0('(((11+22))+33)', { log: -1 }), { depth: null })
    // console.dir(j0('11*(22+33)', { log: -1 }), { depth: null })
    // console.dir(j0('11*((22+33)*44)', { log: -1 }), { depth: null })

    // console.dir(j0('22+33*44', { xlog: -1 }), { depth: null })
    // console.dir(j0('22*33+44', { xlog: -1 }), { depth: null })
    // console.dir(j0('22+33+44', { xlog: -1 }), { depth: null })
    // console.dir(j0('22+33+44+55+66', { xlog: -1 }), { depth: null })
    //return

    // console.dir(j0('2*3', { log: -1 }), { depth: null })
    // console.dir(j0('2+3+4+5+6', { log: -1 }), { depth: null })
    // console.dir(j0('{a:2+3+4+5+6}', { log: -1 }), { depth: null })

    expect((s = '2 + 3', j0(s, { xlog: -1 }))).equal(['+', 2, 3])
    expect((s = 'a: 2 + 3', j0(s, { xlog: -1 }))).equal({ a: ['+', 2, 3] })

    expect((s = '2 * 3', j0(s, { xlog: -1 }))).equal(['*', 2, 3])
    expect((s = 'a: 2 * 3', j0(s, { xlog: -1 }))).equal({ a: ['*', 2, 3] })

    expect((s = '2 + 3 + 4', j0(s, { xlog: -1 }))).contains(['+', ['+', 2, 3], 4])
    expect((s = '2 * 3 * 4', j0(s, { xlog: -1 }))).contains(['*', ['*', 2, 3], 4])

    expect((s = '2 + 3 + 4 + 5', j0(s, { xlog: -1 })))
      .contains(['+', ['+', ['+', 2, 3], 4], 5])
    expect((s = '2 * 3 * 4 * 5', j0(s, { xlog: -1 })))
      .contains(['*', ['*', ['*', 2, 3], 4], 5])


    expect((s = '2 + 3 * 4', j0(s, { xlog: -1 }))).equal(['+', 2, ['*', 3, 4]])
    expect((s = '2 * 3 + 4', j0(s, { xlog: -1 }))).equal(['+', ['*', 2, 3], 4])

    expect((s = '(2 + 3) * 4', j0(s, { xlog: -1 }))).equal(['*', ['+', 2, 3], 4])
    expect((s = '2 * (3 + 4)', j0(s, { xlog: -1 }))).equal(['*', 2, ['+', 3, 4]])

    /*
      
      console.log(s = '+1', j0(s, { log: -1 }))
      console.log(s = '-1', j0(s, { log: -1 }))
  
      console.log(s = '2+(1)', j0(s, { log: -1 }))
  
      console.log(s = '2', j0(s, { xlog: -1 }))
  
      console.log(s = '2 + 3', j0(s, { xlog: -1 }))
      console.log(s = '2 + 3 + 4', j0(s, { xlog: -1 }))
  
      console.log(s = 'a: 2 + 3', j0(s, { xlog: -1 }))
  
  
      console.log(s = '2 * 3', j0(s, { xlog: -1 }))
      console.log(s = '2 * 3 * 4', j0(s, { xlog: -1 }))
  
      console.log(s = '2 * 3 + 4', j0(s, { xlog: -1 }))
      console.log(s = '2 + 3 * 4', j0(s, { xlog: -1 }))
  
      console.log(s = '3 + 4 * 5 + 6', j0(s, { xlog: -1 }))
      console.log(s = '3 * 4 + 5 * 6', j0(s, { xlog: -1 }))
  
      console.log(s = '(2)', j0(s, { xlog: -1 }))
      console.log(s = '(2 + 3)', j0(s, { xlog: -1 }))
      console.log(s = '(2) + (3)', j0(s, { xlog: -1 }))
  
  
      console.log(s = '(2 + 3) + 4', j0(s, { xlog: -1 }))
      console.log(s = '2 + (3 + 4)', j0(s, { xlog: -1 }))
  
      console.log(s = '(2 + 3) * 4', j0(s, { xlog: -1 }))
  
  
      console.log(s = '2 - 3', j0(s, { xlog: -1 }))
      console.log(s = '2 - 3 - 4', j0(s, { xlog: -1 }))
      console.log(s = '2 - (3 + 4)', j0(s, { xlog: -1 }))
  
      console.log(s = '2 - ((3 + 4) * 5)', j0(s, { xlog: -1 }))
      console.log(s = '2 * ((3 - 4) * 5)', j0(s, { xlog: -1 }))
  
      console.log(s = '2 / 3', j0(s, { xlog: -1 }))
      console.log(s = '2 % 3', j0(s, { xlog: -1 }))
  
      console.log(s = '1 + 2 / 3', j0(s, { xlog: -1 }))
      console.log(s = '1 + 2 % 3', j0(s, { xlog: -1 }))
  
  
      console.log(s = '2 ^ 3', j0(s, { xlog: -1 }))
      console.log(s = '2 * 3 ^ 4', j0(s, { xlog: -1 }))
      console.log(s = '2 + 3 ^ 4', j0(s, { xlog: -1 }))
      console.log(s = '(2 * 3) ^ 4', j0(s, { xlog: -1 }))
      console.log(s = '(2 + 3) ^ 4', j0(s, { xlog: -1 }))
  
      console.log(s = '-2 + 2', j0(s, { xlog: -1 }))
      console.log(s = '+2 + 2', j0(s, { xlog: -1 }))
  
      console.log(s = '1+-2', j0(s, { xlog: -1 }))
      console.log(s = '1-+2', j0(s, { xlog: -1 }))
    })
  
  
    it('expr-evaluate', () => {
      let j0 = Jsonic.make().use(Expr)
  
      expect(j0('2 + 3', { xlog: -1 })).equal(5)
      expect(j0('2 + 3 + 4', { xlog: -1 })).equal(9)
  
      expect(j0('2 * 3', { xlog: -2 })).equal(6)
      expect(j0('2 * 3 * 4', { xlog: -1 })).equal(24)
  
      expect(j0('2 + 3 * 4', { xlog: -1 })).equal(14)
      expect(j0('2 * 3 + 4', { xlog: -1 })).equal(10)
  
      expect(j0('3 + 4 * 5 + 6', { xlog: -1 })).equal(29)
      expect(j0('3 * 4 + 5 * 6', { xlog: -1 })).equal(42)
  
      expect(j0('a: 2 + 3', { xlog: -1 })).equal({ a: 5 })
  
      expect(j0('-2', { xlog: -1 })).equal(-2)
      expect(j0('+2', { xlog: -1 })).equal(2)
      expect(j0('(2)', { xlog: -1 })).equal(2)
  
      expect(j0('1 + -2', { xlog: -1 })).equal(-1)
      expect(j0('1 + +2', { xlog: -1 })).equal(3)
      expect(j0('1 + (2)', { xlog: -1 })).equal(3)
  
      expect(j0('1 +-2', { xlog: -1 })).equal(-1)
  
      expect(j0('(2 + 3) * 4', { xlog: -1 })).equal(20)
      expect(j0('2 * (3 + 4)', { xlog: -1 })).equal(14)
      expect(j0('2 * ((3 + 4) * 5)', { xlog: -1 })).equal(70)
      expect(j0('2 * (3 * (4 + 5))', { xlog: -1 })).equal(54)
    })
  
    it('evaluate', () => {
      console.log(evaluate(['+', 2, ['*', 4, 5]]))
    })
    */

  })
})
