
import * as fs from "fs/promises";
import * as path from "path";
import type { CopilotArtifactRef } from "./artifact-types";
import { MAX_ARTIFACTS_PER_REQUEST } from "./artifact-types";
import { extractAllArtifactContexts } from "./extract-artifact-context";
import { composeArtifactContext } from "./context-composer";

const ARTIFACTS_DIR = path.join(
  process.cwd(),
  "data",
  "tmp",
  "copilot-artifacts"
);

function metadataPath(id: string): string {
  return path.join(ARTIFACTS_DIR, `${id}.meta.json`);
}

export async function saveArtifactMetadata(
  ref: CopilotArtifactRef
): Promise<void> {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  await fs.writeFile(metadataPath(ref.id), JSON.stringify(ref), "utf-8");
}

export async function loadArtifactMetadata(
  id: string
): Promise<CopilotArtifactRef | null> {
  try {
    const raw = await fs.readFile(metadataPath(id), "utf-8");
    return JSON.parse(raw) as CopilotArtifactRef;
  } catch {
    return null;
  }
}

export async function resolveArtifactContext(
  artifactIds?: string[]
): Promise<{
  groundingSection: string;
  warnings: string[];
}> {
  if (!artifactIds || artifactIds.length === 0) {
    return { groundingSection: "", warnings: [] };
  }

  const warnings: string[] = [];

  const ids = artifactIds.slice(0, MAX_ARTIFACTS_PER_REQUEST);
  if (artifactIds.length > MAX_ARTIFACTS_PER_REQUEST) {
    warnings.push(
      `Only the first ${MAX_ARTIFACTS_PER_REQUEST} artifacts will be used (${artifactIds.length} provided).`
    );
  }

  const refs: CopilotArtifactRef[] = [];
  for (const id of ids) {
    const ref = await loadArtifactMetadata(id);
    if (ref) {
      refs.push(ref);
    } else {
      warnings.push(`Artifact "${id}" not found — skipping.`);
    }
  }

  if (refs.length === 0) {
    return { groundingSection: "", warnings };
  }

  const { contexts, warnings: extractWarnings } =
    await extractAllArtifactContexts(refs);
  warnings.push(...extractWarnings);

  const composed = composeArtifactContext(contexts);

  return {
    groundingSection: composed.groundingSection,
    warnings,
  };
}
