"use strict";
/* Copyright (c) 2021 Richard Rodger and other contributors, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
const jsonic_1 = require("jsonic");
const expr_1 = require("../expr");
describe('expr', () => {
    test('happy', () => {
        const je = jsonic_1.Jsonic.make().use(expr_1.Expr);
        const j = (s, m) => JSON.parse(JSON.stringify(je(s, m)));
        // console.log(j('1+2', { xlog: -1 }))
        //expect(['+', 1, 2]).toMatchObject(['+', 1, 2])
        expect(j('1+2')).toMatchObject(['+', 1, 2]);
    });
});
//# sourceMappingURL=expr.test.js.map