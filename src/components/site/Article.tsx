import type { Block } from "@/lib/site/content";

/** Renders content blocks: optional heading, paragraphs and a bullet list. */
export function Blocks({ blocks, level = 2 }: { blocks: Block[]; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-col gap-8">
      {blocks.map((b, i) => (
        <section key={i} className="flex flex-col gap-3">
          {b.heading && <H className={level === 2 ? "text-xl sm:text-2xl" : "text-xl"}>{b.heading}</H>}
          {b.paragraphs.map((p, j) => (
            <p key={j} className="max-w-[68ch] text-[1.0625rem] leading-relaxed">
              {p}
            </p>
          ))}
          {b.items && (
            <ul className="flex max-w-[68ch] list-disc flex-col gap-1.5 ps-6 leading-relaxed">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
