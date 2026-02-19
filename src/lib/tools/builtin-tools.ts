import type { Tool } from "./types";

function makeBuiltinTool(
  name: string,
  description: string,
  parameters: Tool["definition"]["parameters"],
  handler: (params: Record<string, unknown>) => Promise<unknown>
): Tool {
  return {
    definition: { name, description, category: "builtin", parameters },
    execute: async (params, _ctx) => {
      const start = Date.now();
      try {
        const data = await handler(params);
        return { success: true, data, executionTimeMs: Date.now() - start };
      } catch (err) {
        return {
          success: false,
          data: null,
          error: err instanceof Error ? err.message : String(err),
          executionTimeMs: Date.now() - start,
        };
      }
    },
  };
}

export const builtinTools: Tool[] = [
  makeBuiltinTool(
    "search_web",
    "Search the web for information (placeholder — not yet connected to a provider)",
    {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: {
          type: "number",
          description: "Maximum number of results to return",
          default: 5,
        },
      },
      required: ["query"],
    },
    async () => {
      return {
        results: [],
        note: "search_web not yet connected to a provider",
      };
    }
  ),

  makeBuiltinTool(
    "parse_json",
    "Parse a JSON string into a structured object",
    {
      type: "object",
      properties: {
        json_string: {
          type: "string",
          description: "The JSON string to parse",
        },
      },
      required: ["json_string"],
    },
    async (params) => {
      return JSON.parse(params.json_string as string);
    }
  ),

  makeBuiltinTool(
    "format_text",
    "Apply text transformations: uppercase, lowercase, trim, or template substitution",
    {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to transform" },
        operation: {
          type: "string",
          description: "The transformation to apply",
          enum: ["uppercase", "lowercase", "trim", "template"],
        },
        variables: {
          type: "object",
          description:
            "Key-value pairs for template substitution (used when operation is 'template')",
        },
      },
      required: ["text", "operation"],
    },
    async (params) => {
      const text = params.text as string;
      const operation = params.operation as string;

      switch (operation) {
        case "uppercase":
          return { result: text.toUpperCase() };
        case "lowercase":
          return { result: text.toLowerCase() };
        case "trim":
          return { result: text.trim() };
        case "template": {
          const variables = (params.variables as Record<string, string>) || {};
          let result = text;
          for (const [key, value] of Object.entries(variables)) {
            result = result.replaceAll(`{{${key}}}`, String(value));
          }
          return { result };
        }
        default:
          throw new Error(
            `Unknown operation: "${operation}". Supported: uppercase, lowercase, trim, template`
          );
      }
    }
  ),

  makeBuiltinTool(
    "read_file",
    "Read a file from the data/ directory (read-only, path-traversal protected)",
    {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative file path within the data/ directory",
        },
      },
      required: ["path"],
    },
    async (params) => {
      const pathMod = await import("path");
      const fsMod = await import("fs/promises");

      const dataDir = pathMod.resolve("data");
      const resolved = pathMod.resolve("data", params.path as string);

      if (!resolved.startsWith(dataDir + pathMod.sep) && resolved !== dataDir) {
        throw new Error("Path traversal not allowed");
      }

      const content = await fsMod.readFile(resolved, "utf-8");
      return { content, path: params.path };
    }
  ),
];
