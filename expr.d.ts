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
declare let Expr: Plugin;
declare function prattify(expr: any, op?: OpFullDef): any[];
export { Expr, prattify, };
export type { OpFullDef };
