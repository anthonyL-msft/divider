import { describe, expect, it } from "vitest";
import { buildShopOrderMessage } from "./order-messages";
import type { GroupBuy, OrderRequest } from "./types";

const request = (
  id: string,
  memberId: string,
  itemId: string,
  mode: OrderRequest["mode"],
  quantity?: number,
): OrderRequest => ({ id, memberId, itemId, mode, quantity });

describe("buildShopOrderMessage", () => {
  it("groups mixed members into Share order and pure whole members separately", () => {
    const groupBuy: GroupBuy = {
      id: "groupbuy-test",
      name: "測試團購",
      status: "draft",
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
      members: [
        { id: "anthony", name: "Anthony" },
        { id: "alvin", name: "Alvin Leung" },
        { id: "adrian", name: "Adrian" },
      ],
      requests: [
        request("1", "anthony", "pandan-layer-cake", "share"),
        request("2", "anthony", "taro-cake", "whole"),
        request("3", "alvin", "sa-yung", "whole"),
        request("4", "adrian", "sticky-rice", "whole", 2),
      ],
    };

    const message = buildShopOrderMessage(groupBuy);

    expect(message).toContain("【Share order】");
    expect(message).toContain("斑斕椰汁千層糕：1 份（每份28個）");
    expect(message).toContain("廣式臘味芋頭糕：1 盒");
    expect(message).toContain("【Alvin Leung's order】\n• 糖沙翁（蛋球）：1 份（每份8個）");
    expect(message).toContain("【Adrian's order】\n• 廣式臘味糯米飯：2 份");
  });
});