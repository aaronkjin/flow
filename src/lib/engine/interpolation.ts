import type { InterpolationContext } from "./types";

/**
 * Resolve {{variable.path}} templates in a string.
 *
 * Supports:
 *   {{input.fieldName}}         — workflow input data
 *   {{steps.stepId.fieldName}}  — output from a completed step
 *   {{steps.stepId.nested.key}} — deep access
 */
export function interpolate(
  template: string,
  context: InterpolationContext
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
    const value = resolvePath(context, path.trim());
    if (value === undefined || value === null) return match; // leave unresolved
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Recursively interpolate all string values in an object/array.
 */
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

/**
 * Evaluate a simple condition expression after interpolation.
 * Supports: ===, !==, >, <, >=, <=, and boolean values.
 */
export function evaluateCondition(
  expression: string,
  context: InterpolationContext
): boolean {
  const resolved = interpolate(expression, context);

  // Direct boolean values
  if (resolved === "true") return true;
  if (resolved === "false") return false;

  // Comparison operators
  const operators = ["===", "!==", ">=", "<=", ">", "<"] as const;
  for (const op of operators) {
    const idx = resolved.indexOf(op);
    if (idx !== -1) {
      const left = resolved.slice(0, idx).trim();
      const right = resolved.slice(idx + op.length).trim();
      return compare(left, op, right);
    }
  }

  // Truthy check
  return resolved !== "" && resolved !== "0" && resolved !== "null" && resolved !== "undefined";
}

// --- Internal helpers ---

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
  // Strip surrounding quotes for string comparison
  const l = stripQuotes(left);
  const r = stripQuotes(right);

  // Try numeric comparison
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

  // String comparison
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
