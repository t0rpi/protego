import ro from "./strings.ro.json";
import en from "./strings.en.json";

/**
 * RO is the default language (MASTERPROMPT §2.5: "i18n RO/EN din ziua 1").
 * EN is secondary — relevant especially for Valul 2 (Senior/Kids, often
 * paid for from the diaspora).
 */
export const defaultLanguage = "ro" as const;
export const supportedLanguages = ["ro", "en"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const i18nResources = {
  ro: { translation: ro },
  en: { translation: en },
} as const;

/**
 * Plain i18next-shaped init options. Each app (web/mobile) wires this into
 * its own i18next + framework binding (react-i18next) — this package stays
 * framework-agnostic and holds only the shared config + resources.
 */
export function createI18nOptions(lng: SupportedLanguage = defaultLanguage) {
  return {
    resources: i18nResources,
    lng,
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    interpolation: { escapeValue: false },
  };
}

export { ro as stringsRo, en as stringsEn };
