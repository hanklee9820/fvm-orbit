import { useMemo } from "react";
import { useFvmStore } from "../store/useFvmStore";
import { createTranslator } from "./index";

export function useI18n() {
  const language = useFvmStore((s) => s.language);
  const locale = useFvmStore((s) => s.resolvedLocale);
  const setLanguage = useFvmStore((s) => s.setLanguage);

  const t = useMemo(() => createTranslator(locale), [locale]);

  return {
    language,
    locale,
    setLanguage,
    t,
  };
}
