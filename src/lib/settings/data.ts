import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_RADIUS_KM,
  nearestRadius,
  type FilterField,
  type Gender,
} from "./options";

export type Settings = {
  gender: Gender | null;
  visible: boolean;
  lookingFor: Gender[];
  ageMin: number;
  ageMax: number;
  radiusKm: number;
  zip: string;
  filters: Record<FilterField, string[]>;
  notify: {
    email: boolean;
    push: boolean;
    sms: boolean;
    messages: boolean;
    connections: boolean;
    journey: boolean;
    marketing: boolean;
  };
  phone: string | null;
  phoneVerified: boolean;
};

/** The member's own settings. Row Level Security: owner only. */
export async function getSettings(me: string): Promise<Settings> {
  const supabase = await createClient();
  const [profile, prefs, priv] = await Promise.all([
    supabase
      .from("profiles")
      .select("gender, is_visible")
      .eq("id", me)
      .single(),
    supabase.from("preferences").select("*").eq("profile_id", me).single(),
    supabase
      .from("account_private")
      .select("phone, phone_verified_at, zip_code")
      .eq("user_id", me)
      .single(),
  ]);
  for (const r of [profile, prefs, priv]) if (r.error) throw r.error;
  const p = prefs.data!;
  return {
    gender: profile.data!.gender,
    visible: profile.data!.is_visible,
    lookingFor: p.looking_for ?? [],
    ageMin: p.age_min,
    ageMax: p.age_max,
    radiusKm: nearestRadius(p.radius_km ?? DEFAULT_RADIUS_KM),
    zip: priv.data!.zip_code ?? "",
    filters: {
      religion: p.religion ?? [],
      ethnicity: p.ethnicity ?? [],
      family_plan: p.family_plan ?? [],
      smoking: p.smoking ?? [],
      drinking: p.drinking ?? [],
      pets: p.pets ?? [],
    },
    notify: {
      email: p.notify_email,
      push: p.notify_push,
      sms: p.notify_sms,
      messages: p.notify_messages,
      connections: p.notify_connections,
      journey: p.notify_journey,
      marketing: p.marketing_emails,
    },
    phone: priv.data!.phone,
    phoneVerified: !!priv.data!.phone_verified_at,
  };
}
