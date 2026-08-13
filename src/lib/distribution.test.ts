import { describe, expect, it } from "vitest";
import { distributeItem } from "./distribution";
import type { MenuItem, OrderRequest } from "./types";

const pieceItem: MenuItem = {
  id: "ham-sui-gok",
  category: "小吃",
  name: "鹹水角",
  price: 15,
  unitKind: "piece",
  packageLabel: "份",
  piecesPerPackage: 10,
};

const request = (
  id: string,
  memberId: string,
  minimum?: number,
): OrderRequest => ({ id, memberId, itemId: pieceItem.id, mode: "share", minimum });

describe("distributeItem", () => {
  it("respects piece minimums, allocates every piece, and reconciles price", () => {
    const result = distributeItem(pieceItem, [
      request("1", "judy", 3),
      request("2", "susan", 2),
      request("3", "joyce"),
    ]);

    expect(result.packageCount).toBe(1);
    expect(result.allocations.reduce((sum, entry) => sum + entry.amount, 0)).toBe(10);
    expect(result.allocations.find((entry) => entry.memberId === "judy")?.amount).toBeGreaterThanOrEqual(3);
    expect(result.allocations.find((entry) => entry.memberId === "susan")?.amount).toBeGreaterThanOrEqual(2);
    expect(result.allocations.reduce((sum, entry) => sum + entry.cost, 0)).toBeCloseTo(15);
  });

  it("adds a package when there are more people than pieces", () => {
    const requests = Array.from({ length: 12 }, (_, index) =>
      request(String(index), `member-${index}`),
    );
    const result = distributeItem(pieceItem, requests);

    expect(result.packageCount).toBe(2);
    expect(result.allocations.every((entry) => entry.amount >= 1)).toBe(true);
    expect(result.allocations.reduce((sum, entry) => sum + entry.amount, 0)).toBe(20);
  });

  it("keeps written quantities fixed and gives leftovers to flexible sharers", () => {
    const fixedRequest = { ...request("1", "judy", 5), fixed: true };
    const result = distributeItem(pieceItem, [
      fixedRequest,
      request("2", "anthony"),
      request("3", "ring"),
    ]);

    expect(result.allocations.find((entry) => entry.memberId === "judy")?.amount).toBe(5);
    expect(result.allocations.reduce((sum, entry) => sum + entry.amount, 0)).toBe(10);
  });

  it("keeps every portion share at or above one quarter", () => {
    const portionItem: MenuItem = {
      ...pieceItem,
      id: "pork-ear",
      price: 12,
      unitKind: "portion",
      packageLabel: "盒",
      piecesPerPackage: undefined,
    };
    const requests = Array.from({ length: 5 }, (_, index) => ({
      ...request(String(index), `member-${index}`),
      itemId: portionItem.id,
    }));
    const result = distributeItem(portionItem, requests);

    expect(result.packageCount).toBe(2);
    expect(result.allocations.every((entry) => entry.amount >= 0.25)).toBe(true);
    expect(result.allocations.reduce((sum, entry) => sum + entry.amount, 0)).toBeCloseTo(2);
  });
});