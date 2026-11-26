import { describe, expect, it } from "bun:test";
import { normalizeCityKey, sameCity } from "./city";

describe("normalizeCityKey", () => {
  it("maps København, KBH, Copenhagen, and CPH to the same city", () => {
    expect(normalizeCityKey("København")).toBe("copenhagen");
    expect(normalizeCityKey("KBH")).toBe("copenhagen");
    expect(normalizeCityKey("Copenhagen")).toBe("copenhagen");
    expect(normalizeCityKey("CPH")).toBe("copenhagen");
    expect(sameCity("København", "CPH")).toBe(true);
    expect(sameCity("kbh", "Copenhagen")).toBe(true);
  });

  it("normalizes other Danish and European city aliases", () => {
    expect(normalizeCityKey("Århus")).toBe("aarhus");
    expect(normalizeCityKey("Malmö")).toBe("malmo");
    expect(normalizeCityKey("STHLM")).toBe("stockholm");
    expect(normalizeCityKey("LDN")).toBe("london");
  });

  it("returns null for empty input", () => {
    expect(normalizeCityKey("   ")).toBeNull();
    expect(normalizeCityKey(null)).toBeNull();
  });
});