import React from "react";
import { Block, Inline, parseMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/**
 * A model answer, rendered rather than printed.
 *
 * Every provider formats its answers in Markdown whether or not it is asked
 * to, and the page used to show the source: `**Question:**` with the asterisks
 * visible, bullet lists as a run of hyphens, a production breakdown as a wall
 * of pipes.
 *
 * The parser returns a description of the blocks and this turns them into
 * elements — nothing is ever handed to dangerouslySetInnerHTML, so an answer
 * cannot carry markup into the page.
 */

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.type === "strong") return <strong key={i} className="font-semibold text-foreground">{span.text}</strong>;
        if (span.type === "em") return <em key={i}>{span.text}</em>;
        if (span.type === "code") {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
              {span.text}
            </code>
          );
        }
        return <React.Fragment key={i}>{span.text}</React.Fragment>;
      })}
    </>
  );
}

function Rendered({ block, index }: { block: Block; index: number }) {
  const spacing = index === 0 ? "" : "mt-3";

  switch (block.type) {
    case "heading": {
      // The question above is the section's own heading, so an answer's
      // headings start below it rather than competing with it.
      const Tag = (["h3", "h4", "h5"] as const)[block.level - 1];
      return (
        <Tag className={cn(spacing, "text-sm font-semibold tracking-tight text-foreground")}>
          <Spans spans={block.spans} />
        </Tag>
      );
    }
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={cn(spacing, "space-y-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}>
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed marker:text-muted-foreground">
              <Spans spans={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case "code":
      return (
        <pre className={cn(spacing, "overflow-x-auto rounded-md border border-border bg-muted/50 p-3")}>
          <code className="font-mono text-xs leading-relaxed text-foreground">{block.text}</code>
        </pre>
      );
    case "table":
      return (
        // A question about production across mines comes back tabular, and a
        // table is the one block that can be wider than the column it sits in.
        <div className={cn(spacing, "overflow-x-auto rounded-md border border-border")}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {block.head.map((cell, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={cn(
                      "px-3 py-2 font-medium text-muted-foreground",
                      block.numeric[i] ? "text-right" : "text-left"
                    )}
                  >
                    <Spans spans={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-border last:border-0">
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={cn(
                        "px-3 py-2 align-top text-foreground",
                        block.numeric[c] ? "text-right font-mono tabular-nums" : "text-left"
                      )}
                    >
                      <Spans spans={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return (
        <p className={cn(spacing, "leading-relaxed text-foreground")}>
          <Spans spans={block.spans} />
        </p>
      );
  }
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className={cn("text-sm", className)}>
      {blocks.map((block, i) => (
        <Rendered key={i} block={block} index={i} />
      ))}
    </div>
  );
}
