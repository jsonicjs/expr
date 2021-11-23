import { Plugin } from 'jsonic';
declare type OpDef = {
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
declare type Op = {
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
};
declare type ExprOptions = {
    op?: {
        [name: string]: OpDef;
    };
};
declare let Expr: Plugin;
declare function prattify(expr: any, op?: Op): any[];
declare function evaluate(expr: any, resolve: (op: Op, ...terms: any) => any): any;
export { Expr, prattify, evaluate, };
export type { ExprOptions, OpDef, Op, };
