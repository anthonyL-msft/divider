import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseOrderMessage } from "./import-order";
import { seedGroupBuy } from "./seed";

describe("parseOrderMessage", () => {
  it("parses member sections, flexible sharing, fixed pieces, fractions and whole items", () => {
    const result = parseOrderMessage(`
Joyce
咸水角 (Share)$15/10個
滷水鴨翼（可share 或獨食）
——
Judy
斑斕椰汁糕(share) 要5個$10/盒
滷味鴨翅膀(share) 可要1/3 $12/盒
——
Anthony
芋頭糕 $10/盒
`, seedGroupBuy);

    expect(result.members.map((member) => member.name)).toEqual(["Joyce", "Judy", "Anthony"]);
    expect(result.requests).toHaveLength(5);
    expect(result.requests.find((request) => request.itemId === "pandan-layer-cake")).toMatchObject({
      mode: "share",
      minimum: 5,
      fixed: true,
    });
    expect(result.requests.find((request) => request.itemId === "duck-wing" && request.memberId === "joyce")?.mode).toBe("share");
    expect(result.requests.find((request) => request.itemId === "taro-cake")?.mode).toBe("whole");
    expect(result.unmatchedLines).toEqual([]);
  });

  it("parses the complete supplied current order message", () => {
    const message = readFileSync(resolve(process.cwd(), "current-order.md"), "utf8");
    const result = parseOrderMessage(message, seedGroupBuy);

    expect(result.members).toHaveLength(10);
    expect(result.requests.length).toBeGreaterThanOrEqual(60);
    expect(result.unmatchedLines).toEqual([]);
  });

  it("recognizes Simplified Chinese layer-cake names", () => {
    const result = parseOrderMessage(`
Alvin Leung
红枣姜汁千层糕 $10
黑芝麻椰汁千层糕 $10
`, seedGroupBuy);

    expect(result.requests.map((request) => request.itemId)).toEqual([
      "jujube-ginger-layer-cake",
      "sesame-layer-cake",
    ]);
    expect(result.unmatchedLines).toEqual([]);
  });
});