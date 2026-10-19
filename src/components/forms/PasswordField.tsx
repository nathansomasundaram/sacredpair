"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Field } from "./Field";

export function PasswordField(
  props: Omit<ComponentProps<typeof Field>, "type" | "trailing">,
) {
  const t = useTranslations("auth.fields");
  const [visible, setVisible] = useState(false);

  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute inset-y-1 end-1 rounded-md px-3 text-[0.9375rem] font-semibold text-covenant hover:bg-mist"
        >
          {visible ? t("hidePassword") : t("showPassword")}
        </button>
      }
    />
  );
}
