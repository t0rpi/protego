import { describe, expect, it } from "vitest";
import ro from "./strings.ro.json";
import en from "./strings.en.json";

/** Flattens a nested string dictionary into dot-path keys, e.g. "shield.sosHold". */
function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe("i18n RO/EN key parity", () => {
  it("has identical keys in both languages (design/HANDOFF.md §7)", () => {
    const roKeys = flattenKeys(ro).sort();
    const enKeys = flattenKeys(en).sort();

    const missingInEn = roKeys.filter((k) => !enKeys.includes(k));
    const missingInRo = enKeys.filter((k) => !roKeys.includes(k));

    expect(missingInEn, `keys present in RO but missing in EN: ${missingInEn.join(", ")}`).toEqual([]);
    expect(missingInRo, `keys present in EN but missing in RO: ${missingInRo.join(", ")}`).toEqual([]);
  });
});
