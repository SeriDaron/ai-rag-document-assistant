import type { Chunk, Source } from "./types";

const STOPWORDS = new Set(
  "a an the and or but if then of to in on at by for with from as is are was were be been being it its this that these those i you he she we they my your our their do does did can could should would will not no yes what which who whom how when where why about into than so such".split(
    " "
  )
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [])
    .map((t) => stem(t))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Very small suffix stemmer: good enough for English BM25 without extra deps. */
function stem(word: string): string {
  const w = word.replace(/'s$/, "");
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      return w.slice(0, -suffix.length);
    }
  }
  return w;
}

/**
 * BM25 ranking over the provided chunks.
 * k1 / b are the standard defaults.
 */
export function rank(question: string, chunks: Chunk[], topK: number): Source[] {
  const k1 = 1.5;
  const b = 0.75;
  const queryTerms = Array.from(new Set(tokenize(question)));
  if (queryTerms.length === 0 || chunks.length === 0) return [];

  const docs = chunks.map((c) => tokenize(c.text));
  const avgLen = docs.reduce((sum, d) => sum + d.length, 0) / docs.length || 1;

  const docFreq = new Map<string, number>();
  for (const term of queryTerms) {
    docFreq.set(term, docs.filter((d) => d.includes(term)).length);
  }

  const scored = chunks.map((chunk, i) => {
    const tokens = docs[i];
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of queryTerms) {
      const tf = counts.get(term) ?? 0;
      if (!tf) continue;
      const df = docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * tokens.length) / avgLen)));
    }
    return { ...chunk, score };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, topK);
}

/** Pick the sentence(s) of a passage that best answer the question (demo mode, no LLM). */
export function bestSentences(question: string, text: string, max = 2): string {
  const terms = new Set(tokenize(question));
  const wantsNumber = /\bhow (many|much|long|often)\b|\bwhen\b|\bdeadline\b|\blimit\b|\bbudget\b/i.test(question);

  // PDFs often hard-wrap lines mid-sentence: join single line breaks, keep paragraph breaks.
  const joined = text.replace(/(?<!\n)\n(?!\n)/g, " ");

  // Split on sentence ends followed by a capital/digit (keeps "1.5" and "e.g." intact) and on paragraph breaks.
  const all = joined
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Headings ("5. Expense Reimbursement") are context, not answers.
  const isHeading = (s: string) => !/[.!?]$/.test(s) && s.split(/\s+/).length < 9;
  const sentences = all.filter((s) => !isHeading(s));
  const pool = sentences.length ? sentences : all;

  const scored = pool
    .map((s, index) => {
      const overlap = new Set(tokenize(s).filter((t) => terms.has(t))).size;
      const numberBonus = wantsNumber && /\d/.test(s) ? 1 : 0;
      return { s, index, score: overlap + numberBonus };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const top = scored[0];
  if (!top || top.score === 0) return pool[0] ?? text;
  // Keep a second sentence only if it is almost as relevant as the best one.
  return scored
    .filter((x) => x.score >= top.score * 0.8)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((x) => x.s)
    .join(" ");
}
