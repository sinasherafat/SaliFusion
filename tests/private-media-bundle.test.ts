import { describe, expect, it } from "vitest";
import { createPrivateMediaBundle, parsePrivateMediaBundle } from "@/lib/media/private-media-bundle";

describe("private media bundle", () => {
  it("round-trips binary browser-local media without changing its slot mapping", async () => {
    const source = [
      { slot: "ultrasound", name: "review.webm", type: "video/webm", lastModified: 123, blob: new Blob([new Uint8Array([0, 1, 2, 255])], { type: "video/webm" }) },
      { slot: "ductal", name: "ductal.png", type: "image/png", lastModified: 456, blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }) },
    ];
    const bundle = createPrivateMediaBundle("case-01", source);
    const restored = await parsePrivateMediaBundle(bundle, "case-01", ["ultrasound", "ductal"]);

    expect(bundle.type).toBe("application/vnd.salifusion.private-media");
    expect(restored.map((item) => item.slot)).toEqual(["ultrasound", "ductal"]);
    expect(restored.map((item) => item.name)).toEqual(["review.webm", "ductal.png"]);
    expect(Array.from(new Uint8Array(await restored[0].blob.arrayBuffer()))).toEqual([0, 1, 2, 255]);
    expect(Array.from(new Uint8Array(await restored[1].blob.arrayBuffer()))).toEqual([137, 80, 78, 71]);
  });

  it("rejects a bundle for the wrong case and an unexpected slot", async () => {
    const bundle = createPrivateMediaBundle("case-02", [{ slot: "composite", name: "review.webm", type: "video/webm", lastModified: 1, blob: new Blob(["local-only"], { type: "video/webm" }) }]);

    await expect(parsePrivateMediaBundle(bundle, "case-01", ["composite"])).rejects.toThrow("belongs to case-02");
    await expect(parsePrivateMediaBundle(bundle, "case-02", ["ultrasound"])).rejects.toThrow("unexpected or duplicate slot");
  });

  it("rejects content that is not a SaliFusion private media bundle", async () => {
    await expect(parsePrivateMediaBundle(new Blob(["not a bundle"]), "case-01", ["ultrasound"])).rejects.toThrow("not a SaliFusion private media bundle");
  });
});
