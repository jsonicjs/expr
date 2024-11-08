import { Plugin, Rule, Token } from 'jsonic';
type OpDef = {
    src?: string | string[];
    osrc?: string;
    csrc?: string;
    left?: number;
    right?: number;
    use?: any;
    prefix?: boolean;
    suffix?: boolean;
    infix?: boolean;
    ternary?: boolean;
    paren?: boolean;
    preval?: {
        active?: boolean;
        required?: boolean;
    };
};
type ExprOptions = {
    op?: {
        [name: string]: OpDef;
    };
    evaluate?: typeof evaluate;
};
type Op = {
    name: string;
    src: string;
    left: number;
    right: number;
    use: any;
    prefix: boolean;
    suffix: boolean;
    infix: boolean;
    ternary: boolean;
    paren: boolean;
    terms: number;
    tkn: string;
    tin: number;
    osrc: string;
    csrc: string;
    otkn: string;
    otin: number;
    ctkn: string;
    ctin: number;
    preval: {
        active: boolean;
        required: boolean;
    };
    token: Token;
    OP_MARK: typeof OP_MARK;
};
type Resolve = (rule: Rule, op: Op, ...terms: any) => any;
declare const OP_MARK: {};
declare let Expr: Plugin;
declare function prattify(expr: any, op?: Op): any[];
declare function evaluate(rule: Rule, expr: any, resolve: Resolve): any;
declare const testing: {
    prattify: typeof prattify;
    opify: (x: any) => any;
};
export { Expr, evaluate, testing };
export type { ExprOptions, OpDef, Op, Resolve };
