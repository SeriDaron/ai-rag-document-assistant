import type { Chunk } from "./types";

const TARGET_CHARS = 900;
const OVERLAP_CHARS = 150;

/** Normalize whitespace but keep paragraph breaks. */
function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split a document into overlapping chunks, preferring paragraph boundaries.
 * Overlap keeps sentences that straddle a boundary retrievable.
 */
export function chunkText(source: string, rawText: string): Chunk[] {
  const text = normalize(rawText);
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) {
      chunks.push({ id: `${source}#${chunks.length + 1}`, source, text: trimmed });
    }
    // Carry the tail of the previous chunk into the next one, starting at a sentence
    // (or at least word) boundary so chunks never begin mid-word.
    if (trimmed.length > OVERLAP_CHARS) {
      const tail = trimmed.slice(-OVERLAP_CHARS);
      const sentenceEnd = tail.search(/[.!?]\s+/);
      current =
        sentenceEnd >= 0 ? tail.slice(sentenceEnd + 2).trim() : tail.replace(/^\S*\s+/, "");
    } else {
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    // A single very long paragraph is split on sentence ends.
    const pieces =
      paragraph.length > TARGET_CHARS * 1.5
        ? paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [paragraph]
        : [paragraph];

    for (const piece of pieces) {
      if ((current + "\n\n" + piece).length > TARGET_CHARS && current.trim()) {
        flush();
      }
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current.trim() && (chunks.length === 0 || current.length > OVERLAP_CHARS)) {
    flush();
  }

  return chunks;
}
