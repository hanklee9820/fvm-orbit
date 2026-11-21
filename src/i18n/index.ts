import type { LanguagePreference, Locale } from "../types/fvm";
import { en, type Messages } from "./en";
import { zh } from "./zh";

export const dictionaries: Record<Locale, Messages> = {
  zh,
  en,
};

type DotNestedKeys<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : `${K}.${DotNestedKeys<T[K]>}`;
}[keyof T & string];

export type TranslationKey = DotNestedKeys<typeof zh>;
export type TranslationParams = Record<string, string | number>;
export type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const candidates =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  const primary = (candidates[0] ?? "en").trim().toLowerCase();
  return primary.startsWith("zh") ? "zh" : "en";
}

export function resolveLocale(
  pref: LanguagePreference,
  nativeSystemLocale?: Locale | null
): Locale {
  if (pref === "zh" || pref === "en") return pref;
  return nativeSystemLocale ?? detectBrowserLocale();
}

export function applyLocaleToDocument(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = dictionaries[locale].app.documentTitle;
}

function lookupRaw(dict: Messages, key: string): string {
  const parts = key.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? current : key;
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const raw = lookupRaw(dictionaries[locale], key);
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
    const val = params[name];
    return val !== undefined ? String(val) : match;
  });
}

export function createTranslator(locale: Locale): TranslateFn {
  return (key, params) => translate(locale, key, params);
}
