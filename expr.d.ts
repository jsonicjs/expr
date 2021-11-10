import { Plugin } from 'jsonic';
declare type OpDef = {
    left: number;
    right: number;
    src: string;
    prefix?: boolean;
    suffix?: boolean;
    infix?: boolean;
};
declare type OpFullDef = OpDef & {
    terms: number;
    name: string;
    tkn: string;
    tin: number;
    prefix: boolean;
    suffix: boolean;
};
declare let Expr: Plugin;
declare function term(expr: any, op?: OpFullDef): any[];
export { Expr, term, };
export type { OpFullDef };
