import { Config } from "jsc8";

export type OptionType = {
  auth: {
    tenant: string;
    user: string;
    password: string;
  };
  config: Config;
  fabricName?: string;
};

export type FilterOp = "<" | "<=" | "==" | ">=" | ">";
export type FilterObject = {
  fieldPath: string;
  opStr: FilterOp;
  value: any;
};

export type C8DbBindObjectRef =
  | {
      collection: string;
      filter?: Array<FilterObject>;
      documentId?: string;
      fabricName?: string;
    }
  | string;
export type C8DbBindObject = Record<string, C8DbBindObjectRef>;
export type C8DbBindOption<V> = C8DbBindObject | ((this: V) => C8DbBindObject);

export interface OperationsType {
  set: (target: Record<string, any>, key: string | number, value: any) => any;
  add: (array: any[], index: number, data: any) => any;
  remove: (array: any[], index: number) => any;
}

export type C8Document = Partial<Record<string, any>>;
