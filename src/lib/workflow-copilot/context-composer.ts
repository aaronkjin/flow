
import type { ExtractedArtifactContext } from "./artifact-types";
import { MAX_CONTEXT_LENGTH_CHARS } from "./artifact-types";

export interface ComposedArtifactContext {
    groundingSection: string;
    artifactCount: number;
    totalChars: number;
}

export function composeArtifactContext(
  contexts: ExtractedArtifactContext[]
): ComposedArtifactContext {
  if (contexts.length === 0) {
    return { groundingSection: "", artifactCount: 0, totalChars: 0 };
  }

  const parts: string[] = [];
  parts.push("## Grounding Context (from uploaded artifacts)\n");
  parts.push(
    "The following context was extracted from user-provided artifacts. Use it to inform the workflow design — field names, entity types, process steps, and domain-specific terminology should be reflected in the generated workflow.\n"
  );

  for (let i = 0; i < contexts.length; i++) {
    const ctx = contexts[i];
    parts.push(`### Source ${i + 1}: "${ctx.name}" (${ctx.extractionType})`);
    parts.push(ctx.summary);

    const fieldEntries = Object.entries(ctx.keyFields);
    if (fieldEntries.length > 0) {
      parts.push("Key fields:");
      for (const [key, value] of fieldEntries) {
        parts.push(`  - ${key}: ${JSON.stringify(value)}`);
      }
    }

    parts.push("");
  }

  const allEntities = new Set<string>();
  for (const ctx of contexts) {
    for (const entity of ctx.keyEntities) {
      allEntities.add(entity);
    }
  }
  if (allEntities.size > 0) {
    const entityList = Array.from(allEntities).slice(0, 20);
    parts.push(
      `### Key entities across all artifacts\n${entityList.join(", ")}`
    );
    parts.push("");
  }

  let joined = parts.join("\n");
  if (joined.length < MAX_CONTEXT_LENGTH_CHARS - 500) {
    for (const ctx of contexts) {
      if (!ctx.rawExcerpt) continue;
      const excerptSection = `### Raw excerpt from "${ctx.name}"\n\`\`\`\n${ctx.rawExcerpt.slice(0, 1000)}\n\`\`\`\n`;
      if (joined.length + excerptSection.length < MAX_CONTEXT_LENGTH_CHARS) {
        parts.push(excerptSection);
        joined = parts.join("\n");
      } else {
        break;
      }
    }
  }

  let groundingSection = parts.join("\n");
  if (groundingSection.length > MAX_CONTEXT_LENGTH_CHARS) {
    groundingSection =
      groundingSection.slice(0, MAX_CONTEXT_LENGTH_CHARS - 50) +
      "\n\n[...context truncated for length...]";
  }

  return {
    groundingSection,
    artifactCount: contexts.length,
    totalChars: groundingSection.length,
  };
}
