"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Play,
  Loader2,
  FileText,
  Code,
  Upload,
  X,
  ChevronDown,
  ArrowLeft,
  FileUp,
  CirclePlus,
} from "lucide-react";
import type { InferredInputField } from "@/lib/engine/input-schema";

interface RunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string | null;
  onRun: (input: Record<string, unknown>) => Promise<void>;
}

type Mode = "paste" | "form" | "json";
type ExtractionStatus = "idle" | "extracting" | "extracted" | "extract-error";

interface DroppedFile {
  file: File;
  name: string;
  type: string;
  size: number;
}

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
]);

const ACCEPTED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "txt",
  "csv",
  "md",
  "html",
  "json",
  "xml",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.has(ext ?? "")) {
    return `Unsupported file type: ${file.type || file.name}. Supported: PDF, images, and text files.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File exceeds 10 MB limit.";
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDefaultValue(type: InferredInputField["type"]): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return "";
  }
}

function FormField({
  field,
  value,
  onChange,
}: {
  field: InferredInputField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-heading text-xs">
        {field.name}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {field.type === "string" && (
        <Input
          className="bg-muted/50 border-transparent"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description || field.name}
        />
      )}
      {field.type === "text" && (
        <Textarea
          rows={4}
          className="bg-muted/50 border-transparent"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description || field.name}
        />
      )}
      {field.type === "number" && (
        <Input
          type="number"
          className="bg-muted/50 border-transparent"
          value={String(value ?? 0)}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder={field.description || field.name}
        />
      )}
      {field.type === "boolean" && (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <span className="text-xs text-muted-foreground">
            {value ? "Yes" : "No"}
          </span>
        </div>
      )}
      {field.type === "json" && (
        <Textarea
          rows={4}
          className="bg-muted/50 border-transparent font-mono text-sm"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder='{"key": "value"}'
        />
      )}
      {field.description && (
        <p className="text-xs text-muted-foreground/60">{field.description}</p>
      )}
    </div>
  );
}

export function RunDialog({
  open,
  onOpenChange,
  workflowId,
  onRun,
}: RunDialogProps) {
  const [schema, setSchema] = useState<InferredInputField[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [mode, setMode] = useState<Mode>("paste");
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [pasteContent, setPasteContent] = useState("");
  const [rawJson, setRawJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [droppedFile, setDroppedFile] = useState<DroppedFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractionStatus, setExtractionStatus] =
    useState<ExtractionStatus>("idle");
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setMode("paste");
    setFormValues({});
    setPasteContent("");
    setRawJson("{}");
    setError(null);
    setSchema([]);
    setDroppedFile(null);
    setIsDragOver(false);
    setExtractionStatus("idle");
    dragCounterRef.current = 0;

    if (!workflowId) return;

    setIsLoadingSchema(true);
    fetch(`/api/workflows/${workflowId}/input-schema`)
      .then((res) => res.json())
      .then((data) => {
        const fields: InferredInputField[] = data.schema ?? [];
        setSchema(fields);

        const defaults: Record<string, unknown> = {};
        for (const field of fields) {
          defaults[field.name] = getDefaultValue(field.type);
        }
        setFormValues(defaults);
      })
      .catch((err) => {
        console.warn("Failed to fetch input schema:", err);
        setSchema([]);
      })
      .finally(() => {
        setIsLoadingSchema(false);
      });
  }, [open, workflowId]);

  const firstTextFieldName = useMemo(() => {
    const textField = schema.find((f) => f.type === "text");
    return textField?.name ?? "content";
  }, [schema]);

  const missingFields = useMemo(() => {
    if (mode !== "form") return [];
    return schema
      .filter((f) => f.required)
      .filter((f) => {
        const v = formValues[f.name];
        return v === "" || v === null || v === undefined;
      })
      .map((f) => f.name);
  }, [schema, formValues, mode]);

  const extractFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setDroppedFile({ file, name: file.name, type: file.type, size: file.size });
    setExtractionStatus("extracting");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ||
            "Failed to extract text from file",
        );
      }

      const data = (await res.json()) as { text: unknown };
      const extracted = typeof data.text === "string" ? data.text : JSON.stringify(data.text, null, 2);
      setPasteContent(extracted);
      setExtractionStatus("extracted");
    } catch (err) {
      setExtractionStatus("extract-error");
      setError(
        err instanceof Error ? err.message : "Failed to extract text from file",
      );
    }
  }, []);

  const clearFile = useCallback(() => {
    setDroppedFile(null);
    setExtractionStatus("idle");
    setPasteContent("");
    setError(null);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) extractFile(file);
    },
    [extractFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) extractFile(file);
      e.target.value = "";
    },
    [extractFile],
  );

  const buildInput = useCallback(async (): Promise<Record<string, unknown>> => {
    if (mode === "form") {
      const result: Record<string, unknown> = { ...formValues };
      for (const field of schema) {
        if (field.type === "json" && typeof result[field.name] === "string") {
          const str = result[field.name] as string;
          if (str.trim()) {
            result[field.name] = JSON.parse(str);
          }
        }
      }
      return result;
    }

    if (mode === "paste") {
      if (!pasteContent.trim()) return {};

      if (schema.length > 0) {
        try {
          const res = await fetch("/api/parse-input", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: pasteContent,
              fields: schema.map((f) => ({
                name: f.name,
                type: f.type,
                description: f.description,
              })),
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { parsed: Record<string, unknown> };
            return data.parsed;
          }
        } catch {
        }
        return { [firstTextFieldName]: pasteContent };
      }

      try {
        const parsed: unknown = JSON.parse(pasteContent);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          return parsed as Record<string, unknown>;
        }
        return { [firstTextFieldName]: pasteContent };
      } catch {
        return { [firstTextFieldName]: pasteContent };
      }
    }

    const parsed: unknown = JSON.parse(rawJson);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new SyntaxError("Input must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  }, [mode, formValues, pasteContent, rawJson, schema, firstTextFieldName]);

  const handleRun = useCallback(async () => {
    setError(null);
    setIsRunning(true);
    try {
      const input = await buildInput();
      await onRun(input);
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? "Invalid JSON input"
          : err instanceof Error
            ? err.message
            : "Failed to start run",
      );
    } finally {
      setIsRunning(false);
    }
  }, [buildInput, onRun]);

  const updateFormValue = useCallback((name: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const runButtonLabel = useMemo(() => {
    if (!isRunning) return "Start Run";
    if (mode === "paste" && schema.length > 0) return "Parsing & Running...";
    return "Running...";
  }, [isRunning, mode, schema.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Run Workflow</DialogTitle>
          <DialogDescription className="sr-only">
            Provide input for the workflow run.
          </DialogDescription>
        </DialogHeader>

        {isLoadingSchema ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {mode === "paste" && (
              <>
                <div
                  className={cn(
                    "relative rounded-lg border-2 border-dashed transition-colors",
                    isDragOver
                      ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
                      : "border-muted-foreground/25 hover:border-muted-foreground/40",
                  )}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {extractionStatus === "extracting" && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Extracting text from {droppedFile?.name}...
                      </div>
                    </div>
                  )}

                  {isDragOver && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-orange-50/80 dark:bg-orange-950/40">
                      <div className="flex flex-col items-center gap-1 text-orange-600">
                        <Upload className="size-6" />
                        <span className="text-sm font-medium">
                          Drop file here
                        </span>
                      </div>
                    </div>
                  )}

                  <Textarea
                    className="border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 pb-10"
                    style={{ minHeight: 200, fieldSizing: "fixed" }}
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    placeholder="Paste text or drag & drop a file..."
                    disabled={extractionStatus === "extracting"}
                  />

                  <button
                    type="button"
                    className="absolute bottom-2.5 left-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    title="Browse files"
                  >
                    <CirclePlus className="size-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.md,.html,.json,.xml"
                    onChange={handleFileSelect}
                  />
                </div>

                {droppedFile && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
                      <FileUp className="size-3" />
                      {droppedFile.name}
                      <span className="text-muted-foreground">
                        ({formatFileSize(droppedFile.size)})
                      </span>
                      <button
                        type="button"
                        onClick={clearFile}
                        className="ml-0.5 hover:text-destructive transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  </div>
                )}

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                    >
                      <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
                      More options
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      {schema.length > 0 ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setMode("form")}
                          >
                            <FileText className="size-3.5 mr-1.5" />
                            Fill form
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setMode("json")}
                          >
                            <Code className="size-3.5 mr-1.5" />
                            Raw JSON
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full col-span-2"
                          onClick={() => setMode("json")}
                        >
                          <Code className="size-3.5 mr-1.5" />
                          Raw JSON
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            {mode === "form" && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-3" />
                  Back to paste
                </button>
                {schema.map((field) => (
                  <FormField
                    key={field.name}
                    field={field}
                    value={formValues[field.name]}
                    onChange={(v) => updateFormValue(field.name, v)}
                  />
                ))}
                {schema.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No input fields detected.
                  </p>
                )}
              </div>
            )}

            {mode === "json" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setMode("paste")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-3" />
                  Back to paste
                </button>
                <Textarea
                  rows={10}
                  className="bg-muted/50 border-transparent font-mono text-sm"
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  placeholder="{}"
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {missingFields.length > 0 && (
          <p className="text-xs text-amber-600">
            Missing required: {missingFields.join(", ")}
          </p>
        )}

        <DialogFooter>
          <Button
            onClick={handleRun}
            disabled={isRunning || extractionStatus === "extracting"}
            className="font-heading bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isRunning ? (
              <Loader2 className="size-4 mr-1.5 animate-spin" />
            ) : (
              <Play className="size-4 mr-1.5" />
            )}
            {runButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
