import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const fontPath = join(
    process.cwd(),
    "src/app/fonts/LibreBaskerville-Italic.woff",
  );
  const fontBuffer = await readFile(fontPath);
  const fontData = fontBuffer.buffer.slice(
    fontBuffer.byteOffset,
    fontBuffer.byteOffset + fontBuffer.byteLength,
  );

  return new ImageResponse(
    <div
      style={{
        fontSize: 22,
        fontFamily: "Libre Baskerville",
        fontStyle: "italic",
        background: "#faf9f6",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#18181b",
      }}
    >
      A
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Libre Baskerville",
          data: fontData as ArrayBuffer,
          style: "italic",
          weight: 400,
        },
      ],
    },
  );
}
