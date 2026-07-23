import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "./availability";

describe("normalizePhoneNumber", () => {
  it("normalizes Brazilian phone numbers to E.164 format", () => {
    expect(normalizePhoneNumber("81997150571")).toBe("+5581997150571");
    expect(normalizePhoneNumber("+55 (81) 99715-0571")).toBe("+5581997150571");
  });

  it("returns undefined for empty or invalid phone values", () => {
    expect(normalizePhoneNumber("")) .toBeUndefined();
    expect(normalizePhoneNumber("abc")).toBeUndefined();
  });
});
