/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */


import { Jsonic, Rule } from 'jsonic'
import { Expr } from '../expr'




describe('expr', () => {

  test('happy', () => {
    const j = Jsonic.make().use(Expr)

    console.log(j('1 + 2', { log: -1 }))
    // expect(j('1+2')).toMatchObject(['+', 1, 2])

  })
})


