declare module "pdf-parse" {
  interface PDFParseOptions {
    data?: Uint8Array | Buffer;
    file?: string;
    verbosity?: number;
  }

  interface PDFTextResult {
    pages: { text: string; num: number }[];
    text: string;
    total: number;
  }

  class PDFParse {
    constructor(options: PDFParseOptions);
    load(): Promise<void>;
    getText(): Promise<PDFTextResult>;
    getInfo(): Promise<Record<string, unknown>>;
    destroy(): void;
  }

  export { PDFParse };
}
