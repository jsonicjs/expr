import { Plugin } from 'jsonic';
declare type OpDef = {
    left?: number;
    right?: number;
    src?: string | string[];
    prefix?: boolean;
    suffix?: boolean;
    infix?: boolean;
    ternary?: boolean;
    use?: any;
};
declare type OpFullDef = OpDef & {
    src: string;
    left: number;
    right: number;
    terms: number;
    name: string;
    tkn: string;
    tin: number;
    prefix: boolean;
    suffix: boolean;
    infix: boolean;
    ternary: boolean;
    use: any;
};
declare type ParenDef = {
    osrc: string;
    csrc: string;
    preval?: {
        active?: boolean;
        required?: boolean;
    };
};
declare type ParenFullDef = ParenDef & {
    name: string;
    otkn: string;
    otin: number;
    ctkn: string;
    ctin: number;
    preval: {
        active: boolean;
        required: boolean;
    };
};
declare let Expr: Plugin;
declare function prattify(expr: any, op?: OpFullDef): any[];
declare function evaluate(expr: any, resolve: (op: OpFullDef | ParenFullDef, ...terms: any) => any): any;
export { Expr, prattify, evaluate, };
export type { OpFullDef, ParenFullDef, };
