import type { InterpolationContext } from "./types";

export function interpolate(
  template: string,
  context: InterpolationContext
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
    const value = resolvePath(context, path.trim());
    if (value === undefined || value === null) return match;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

export function interpolateObject(
  obj: unknown,
  context: InterpolationContext
): unknown {
  if (typeof obj === "string") {
    return interpolate(obj, context);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, context));
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, context);
    }
    return result;
  }
  return obj;
}

export function evaluateCondition(
  expression: string,
  context: InterpolationContext
): boolean {
  const resolved = interpolate(expression, context);

  if (resolved === "true") return true;
  if (resolved === "false") return false;

  const operators = ["===", "!==", ">=", "<=", ">", "<"] as const;
  for (const op of operators) {
    const idx = resolved.indexOf(op);
    if (idx !== -1) {
      const left = resolved.slice(0, idx).trim();
      const right = resolved.slice(idx + op.length).trim();
      return compare(left, op, right);
    }
  }

  return resolved !== "" && resolved !== "0" && resolved !== "null" && resolved !== "undefined";
}

function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function compare(
  left: string,
  op: "===" | "!==" | ">" | "<" | ">=" | "<=",
  right: string
): boolean {
  const l = stripQuotes(left);
  const r = stripQuotes(right);

  const ln = Number(l);
  const rn = Number(r);
  if (!isNaN(ln) && !isNaN(rn)) {
    switch (op) {
      case "===": return ln === rn;
      case "!==": return ln !== rn;
      case ">":   return ln > rn;
      case "<":   return ln < rn;
      case ">=":  return ln >= rn;
      case "<=":  return ln <= rn;
    }
  }

  switch (op) {
    case "===": return l === r;
    case "!==": return l !== r;
    case ">":   return l > r;
    case "<":   return l < r;
    case ">=":  return l >= r;
    case "<=":  return l <= r;
  }
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}
