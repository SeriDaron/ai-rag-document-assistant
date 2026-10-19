"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Upload,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { SAMPLE_NAME, SAMPLE_TEXT } from "@/lib/sample";
import { chunkText } from "@/lib/chunk";
import type { AskResponse, Chunk, IngestResponse, Source } from "@/lib/types";

interface DocumentInfo {
  name: string;
  chunks: Chunk[];
}

interface Message {
  role: "user" | "assistant";
  text: string;
  mode?: AskResponse["mode"];
  sources?: Source[];
}

const SUGGESTIONS = [
  "How many vacation days do I get?",
  "What is the home office budget?",
  "When must I report a security incident?",
];

export default function ChatApp() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setLlmEnabled(Boolean(d.llm)))
      .catch(() => setLlmEnabled(false));
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const allChunks = documents.flatMap((d) => d.chunks);

  function loadSample() {
    if (documents.some((d) => d.name === SAMPLE_NAME)) return;
    setDocuments((docs) => [...docs, { name: SAMPLE_NAME, chunks: chunkText(SAMPLE_NAME, SAMPLE_TEXT) }]);
    setError(null);
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      const { source, chunks } = data as IngestResponse;
      setDocuments((docs) => [...docs.filter((d) => d.name !== source), { name: source, chunks }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    if (allChunks.length === 0) {
      setError("Upload a document or load the sample first.");
      return;
    }
    setError(null);
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, chunks: allChunks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");
      const result = data as AskResponse;
      setMessages((m) => [
        ...m,
        { role: "assistant", text: result.answer, mode: result.mode, sources: result.sources },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0F19] text-slate-100 md:flex-row">
      {/* Sidebar */}
      <aside className="w-full shrink-0 border-b border-slate-800 bg-[#0E1424] p-5 md:w-80 md:border-b-0 md:border-r">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">DocuMind</h1>
            <p className="text-xs text-slate-400">Ask your documents</p>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.txt,.md,.markdown,.csv"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 px-4 py-6 text-sm text-slate-300 transition hover:border-indigo-400 hover:text-white disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Reading file..." : "Upload PDF, TXT or Markdown"}
        </button>
        <button
          onClick={loadSample}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
        >
          <Sparkles className="h-4 w-4" /> Load sample handbook
        </button>

        <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Documents
        </h2>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">No documents yet.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li
                key={d.name}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-indigo-300" />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                  {d.chunks.length} parts
                  <button
                    aria-label={`Remove ${d.name}`}
                    onClick={() => setDocuments((docs) => docs.filter((x) => x.name !== d.name))}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 rounded-lg border border-slate-800 p-3 text-xs leading-relaxed text-slate-400">
          {llmEnabled === null ? (
            "Checking mode..."
          ) : llmEnabled ? (
            <>
              <span className="font-semibold text-emerald-400">Claude mode.</span> Answers are generated by
              Claude from the most relevant passages and cite their sources.
            </>
          ) : (
            <>
              <span className="font-semibold text-amber-400">Demo mode.</span> No API key is configured, so
              answers are the best-matching passages from your document (retrieval only, no LLM).
            </>
          )}
        </div>
      </aside>

      {/* Chat */}
      <main className="flex min-h-[70vh] flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-5 md:p-8">
          {messages.length === 0 && (
            <div className="mx-auto mt-10 max-w-xl text-center">
              <h2 className="text-2xl font-semibold">Ask questions about your documents</h2>
              <p className="mt-2 text-sm text-slate-400">
                Upload a file, or load the sample handbook, then ask anything. Every answer shows the passages it
                came from.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      loadSample();
                      setQuestion(s);
                    }}
                    className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-400 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-xl rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm"
                    : "max-w-2xl rounded-2xl rounded-bl-sm border border-slate-800 bg-[#111827] px-4 py-3 text-sm"
                }
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                {m.sources && m.sources.length > 0 && (
                  <details className="mt-3 border-t border-slate-800 pt-2">
                    <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                      {m.sources.length} source passages{m.mode === "extractive" ? " (retrieval only)" : ""}
                    </summary>
                    <ol className="mt-2 space-y-2">
                      {m.sources.map((s, n) => (
                        <li key={s.id} className="rounded-lg bg-slate-900 p-2.5 text-xs text-slate-300">
                          <div className="mb-1 flex items-center justify-between text-slate-500">
                            <span>
                              [{n + 1}] {s.source}
                            </span>
                            <span>score {s.score.toFixed(2)}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{s.text}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching the documents...
            </div>
          )}
          <div ref={bottom} />
        </div>

        {error && (
          <div className="mx-5 mb-2 flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300 md:mx-8">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2 border-t border-slate-800 p-4 md:px-8"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Ask a question about your documents..."
            className="flex-1 rounded-lg border border-slate-700 bg-[#111827] px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Ask
          </button>
        </form>
      </main>
    </div>
  );
}
