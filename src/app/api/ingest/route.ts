import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { chunkText } from "@/lib/chunk";
import { LIMITS, type IngestResponse } from "@/lib/types";


const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv"];

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size > LIMITS.maxFileBytes) {
      return NextResponse.json(
        { error: `File is too large (max ${LIMITS.maxFileBytes / 1024 / 1024} MB).` },
        { status: 413 }
      );
    }

    const name = file.name;
    const lower = name.toLowerCase();
    let text = "";

    if (lower.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
    } else if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      text = await file.text();
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF, TXT, or Markdown file." },
        { status: 415 }
      );
    }

    const chunks = chunkText(name, text).slice(0, LIMITS.maxChunksPerRequest);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No readable text found. Scanned PDFs need OCR first." },
        { status: 422 }
      );
    }

    const body: IngestResponse = { source: name, chunks };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[ingest] failed:", error);
    return NextResponse.json({ error: "Could not read this file." }, { status: 500 });
  }
}
