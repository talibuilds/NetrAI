import { describe, it, expect } from "vitest";
import { labelColor, wasteColor } from "@/lib/colors";

describe("labelColor", () => {
  it("returns amber for pothole labels", () => {
    expect(labelColor("pothole")).toBe("#f59e0b");
    expect(labelColor("Pothole")).toBe("#f59e0b");
    expect(labelColor("POTHOLE")).toBe("#f59e0b");
    expect(labelColor("large pothole")).toBe("#f59e0b");
  });

  it("returns mint for crack labels", () => {
    expect(labelColor("crack")).toBe("#3CFFD0");
    expect(labelColor("alligator crack")).toBe("#3CFFD0");
    expect(labelColor("surface crack")).toBe("#3CFFD0");
  });

  it("returns purple for wear/surface labels", () => {
    expect(labelColor("wear")).toBe("#a855f7");
    expect(labelColor("surface damage")).toBe("#a855f7");
    expect(labelColor("road surface")).toBe("#a855f7");
  });

  it("returns red as fallback for unknown labels", () => {
    expect(labelColor("unknown")).toBe("#ef4444");
    expect(labelColor("")).toBe("#ef4444");
    expect(labelColor("patch repair")).toBe("#ef4444");
  });

  it("prioritises pothole over crack when both appear", () => {
    // 'pothole' check comes first in the function
    expect(labelColor("pothole with crack")).toBe("#f59e0b");
  });
});

describe("wasteColor", () => {
  it("returns red for garbage and pile", () => {
    expect(wasteColor("garbage bag")).toBe("#FF0000");
    expect(wasteColor("GARBAGE")).toBe("#FF0000");
    expect(wasteColor("trash pile")).toBe("#FF0000");
  });

  it("returns orange for bottle, plastic, cardboard", () => {
    expect(wasteColor("plastic bottle")).toBe("#FF8C00");
    expect(wasteColor("cardboard box")).toBe("#FF8C00");
    expect(wasteColor("bottle")).toBe("#FF8C00");
    expect(wasteColor("PLASTIC")).toBe("#FF8C00");
  });

  it("returns green for metal", () => {
    expect(wasteColor("metal can")).toBe("#22c55e");
    expect(wasteColor("METAL")).toBe("#22c55e");
  });

  it("returns lime for organic", () => {
    expect(wasteColor("organic waste")).toBe("#84cc16");
    expect(wasteColor("ORGANIC")).toBe("#84cc16");
  });

  it("returns amber as fallback for unknown waste", () => {
    expect(wasteColor("unknown item")).toBe("#f59e0b");
    expect(wasteColor("")).toBe("#f59e0b");
    expect(wasteColor("litter")).toBe("#f59e0b");
  });

  it("matches on substring — 'plastic bottle' returns orange not amber", () => {
    expect(wasteColor("plastic bottle")).toBe("#FF8C00");
  });
});
