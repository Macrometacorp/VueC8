import { FilterObject, C8Document } from "./types";
import { Config } from "jsc8";

export function walkSet<T>(
  obj: object,
  path: string | number,
  value: T
): T | T[] {
  // path can be a number
  const keys = ("" + path).split(".");
  // split will produce at least one element array
  const key = keys.pop() as string;
  const target = keys.reduce(
    (target, key): any =>
      // @ts-ignore
      target[key],
    obj
  ) as (Record<string | number, T> | T[]);

  return Array.isArray(target)
    ? target.splice(Number(key), 1, value)
    : (target[key] = value);
}

export function setTenantUrl(config: Config): string {
  if (typeof config === "string") {
    return config;
  } else if (config instanceof Array && config.length) {
    return config[0];
  } else if (typeof config === "object" && !(config instanceof Array)) {
    if (typeof config.url === "string") {
      return config.url;
    } else if (config.url instanceof Array && config.url.length) {
      return config.url[0];
    } else {
      return "";
    }
  } else {
    return "";
  }
}

export function filterQuery(
  filterArr: FilterObject[] = [],
  identifier = "doc"
): string {
  if (!filterArr.length) {
    return "";
  }

  const checkType = (val: any) => {
    if (typeof val === "string") {
      return `"${val}"`;
    }
    return val;
  };

  return filterArr
    .map(
      filter =>
        `FILTER ${identifier}.${filter.fieldPath} ${filter.opStr} ${checkType(
          filter.value
        )}`
    )
    .join(" ");
}

export function filterDocument(
  filterArr: FilterObject[] = [],
  document: C8Document
) {
  let flag = true;
  const length = filterArr.length;
  let count = 0;

  function compute({ fieldPath, opStr, value }: FilterObject) {
    switch (opStr) {
      case "==":
        return document[fieldPath] == value;

      case "<":
        return document[fieldPath] < value;

      case "<=":
        return document[fieldPath] <= value;

      case ">":
        return document[fieldPath] > value;

      case ">=":
        return document[fieldPath] >= value;

      default:
        return false;
    }
  }

  try {
    if (length) {
      while (flag && count < length) {
        flag = compute(filterArr[count]);
        count++;
      }
    }

    return flag;
  } catch (e) {
    flag = false;
  } finally {
    return flag;
  }
}
