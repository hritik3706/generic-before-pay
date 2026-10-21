import { describe, expect, it } from "vitest";
import { kendrasForPin } from "@/lib/kendra/pin";

describe("kendra PIN lookup", () => {
  it("returns published Kendras for a PIN and nothing for an unknown PIN", () => {
    const delhi = kendrasForPin("110001");
    expect(Array.isArray(delhi)).toBe(true);
    if (!Array.isArray(delhi)) return;
    expect(delhi.some((row) => row.address.includes("Shastri Bhawan"))).toBe(true);
    expect(kendrasForPin("000000")).toEqual([]);
    expect(kendrasForPin("abc")).toBe("invalid");
  });
});
