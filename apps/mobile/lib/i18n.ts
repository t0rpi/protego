import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { createI18nOptions } from "@protego/config";

if (!i18n.isInitialized) {
  // i18n.use() is the real instance method here, not the unrelated named `use` export.
  // eslint-disable-next-line import/no-named-as-default-member
  i18n.use(initReactI18next).init(createI18nOptions());
}

export default i18n;
