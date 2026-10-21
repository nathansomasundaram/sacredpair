import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { PolicyPage } from "@/components/site/PolicyPage";
import { loadPolicy } from "@/lib/site/content";

export async function generateMetadata(): Promise<Metadata> {
  const policy = await loadPolicy("privacy", await getLocale());
  return { title: policy.title, description: policy.intro };
}

export default async function Page() {
  return <PolicyPage policy={await loadPolicy("privacy", await getLocale())} />;
}
