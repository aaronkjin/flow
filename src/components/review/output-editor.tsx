"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface OutputEditorProps {
  initialOutput: Record<string, unknown>;
  onConfirm: (editedOutput: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function OutputEditor({
  initialOutput,
  onConfirm,
  onCancel,
}: OutputEditorProps) {
  const isStringResult =
    typeof initialOutput.result === "string";
  const [text, setText] = useState(
    isStringResult
      ? (initialOutput.result as string)
      : JSON.stringify(initialOutput, null, 2)
  );
  const [parseError, setParseError] = useState<string | null>(null);

  function handleConfirm() {
    if (isStringResult) {
      onConfirm({ ...initialOutput, result: text });
    } else {
      try {
        const parsed = JSON.parse(text);
        setParseError(null);
        onConfirm(parsed);
      } catch {
        setParseError("Invalid JSON. Please fix the syntax and try again.");
      }
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (parseError) setParseError(null);
        }}
        rows={10}
        className="font-mono text-sm"
      />
      {parseError && (
        <p className="text-sm text-rose-600">{parseError}</p>
      )}
      <div className="flex items-center gap-2">
        <Button onClick={handleConfirm}>Confirm Edit</Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
