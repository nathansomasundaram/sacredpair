import {
  CircleUserRound,
  MessageCircle,
  ScrollText,
  Sprout,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

export type TabKey = "discover" | "details" | "together" | "chat" | "profile";

export const tabs: { key: TabKey; href: `/${TabKey}`; icon: LucideIcon }[] = [
  { key: "discover", href: "/discover", icon: WandSparkles },
  { key: "details", href: "/details", icon: ScrollText },
  { key: "together", href: "/together", icon: Sprout },
  { key: "chat", href: "/chat", icon: MessageCircle },
  { key: "profile", href: "/profile", icon: CircleUserRound },
];
