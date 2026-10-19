import { Fragment } from "react";

/** Render **bold** inside a line without pulling in a Markdown library. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

/**
 * Minimal renderer for model answers: paragraphs, "- " bullet lists and **bold**.
 * Everything is rendered as React text nodes, so model output can never inject HTML.
 */
export default function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean);
        const bullets = lines.filter((l) => /^\s*[-*]\s+/.test(l));
        if (bullets.length === lines.length && lines.length > 0) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {/^\s*[-*]\s+/.test(l) ? (
                  <>• {renderInline(l.replace(/^\s*[-*]\s+/, ""))}</>
                ) : (
                  renderInline(l)
                )}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
