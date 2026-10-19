export interface Chunk {
  id: string;
  source: string;
  text: string;
}

export interface Source extends Chunk {
  score: number;
}

export type AnswerMode = "claude" | "extractive";

export interface AskResponse {
  mode: AnswerMode;
  answer: string;
  sources: Source[];
}

export interface IngestResponse {
  source: string;
  chunks: Chunk[];
}

export const LIMITS = {
  maxFileBytes: 3 * 1024 * 1024,
  maxChunksPerRequest: 600,
  maxChunkChars: 1500,
  maxQuestionChars: 500,
  topK: 5,
} as const;
