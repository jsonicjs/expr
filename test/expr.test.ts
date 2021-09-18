/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */


import { Jsonic } from 'jsonic'
import { Expr } from '../expr'




describe('expr', () => {

  test('happy', () => {
    const je = Jsonic.make().use(Expr)
    const j = (s: string, m?: any) => JSON.parse(JSON.stringify(je(s, m)))

    // console.log(j('1+2', { xlog: -1 }))
    //expect(['+', 1, 2]).toMatchObject(['+', 1, 2])
    expect(j('1+2')).toMatchObject(['+', 1, 2])

  })
})


