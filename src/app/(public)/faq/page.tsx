import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getLocale } from "next-intl/server";
import { loadFaq } from "@/lib/site/content";

export async function generateMetadata(): Promise<Metadata> {
  const faq = await loadFaq(await getLocale());
  return { title: faq.title, description: faq.intro };
}

/** Frequently asked questions, grouped, each answer opening in place. */
export default async function FaqPage() {
  const faq = await loadFaq(await getLocale());
  const structured = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.groups.flatMap((g) =>
      g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a.join(" ") } })),
    ),
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="mb-3 text-3xl sm:text-4xl">{faq.title}</h1>
      <p className="mb-10 max-w-[60ch] text-lg text-ink-soft">{faq.intro}</p>
      <div className="flex flex-col gap-10">
        {faq.groups.map((g) => (
          <section key={g.heading} aria-labelledby={`faq-${g.heading}`}>
            <h2 id={`faq-${g.heading}`} className="mb-3 text-xl sm:text-2xl">
              {g.heading}
            </h2>
            <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
              {g.items.map((item) => (
                <li key={item.q}>
                  <details className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <ChevronDown aria-hidden size={20} className="shrink-0 text-covenant transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="flex flex-col gap-2 px-5 pb-5">
                      {item.a.map((p, i) => (
                        <p key={i} className="max-w-[65ch] leading-relaxed text-ink-soft">
                          {p}
                        </p>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    </div>
  );
}
