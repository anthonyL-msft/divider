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

  it("distinguishes fixed pieces and partial boxes from package prices", () => {
    const result = parseOrderMessage(`
Judy
北方鮮肉包子（share）想要2個 $15/8個
Sakura
沙翁(Share) 4個 $15/8個
滷水鴨翼（半盒）$12
Michelle
沙翁（Share）$15/8個
`, seedGroupBuy);

    expect(result.requests.map(({ memberId, itemId, mode, minimum, fixed }) => ({
      memberId,
      itemId,
      mode,
      minimum,
      fixed,
    }))).toEqual([
      { memberId: "judy", itemId: "pork-bun", mode: "share", minimum: 2, fixed: true },
      { memberId: "sakura", itemId: "sa-yung", mode: "share", minimum: 4, fixed: true },
      { memberId: "sakura", itemId: "duck-wing", mode: "share", minimum: 0.5, fixed: true },
      { memberId: "michelle", itemId: "sa-yung", mode: "share", minimum: undefined, fixed: false },
    ]);
  });
});