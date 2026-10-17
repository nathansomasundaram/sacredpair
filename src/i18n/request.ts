import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, localeCookie } from "./config";

// No locale in the URL: the language comes from the user's saved choice
// (cookie), falling back to US English.
export default getRequestConfig(async () => {
  const saved = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(saved) ? saved : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "America/New_York",
  };
});
