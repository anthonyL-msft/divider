import { distributeItem } from "./distribution";
import { menu } from "./menu";
import type { GroupBuy, MenuItem, OrderRequest } from "./types";

function packageAmount(item: MenuItem, quantity: number) {
  const packageName = item.unitKind === "piece" ? "份" : item.packageLabel;
  const packageSize = item.unitKind === "piece" ? `（每份${item.piecesPerPackage}個）` : "";
  return `${quantity} ${packageName}${packageSize}`;
}

function itemLines(requests: OrderRequest[]) {
  return menu.flatMap((item) => {
    const itemRequests = requests.filter((request) => request.itemId === item.id);
    if (itemRequests.length === 0) return [];
    const allocation = distributeItem(item, itemRequests);
    return [`• ${item.name}：${packageAmount(item, allocation.packageCount)}`];
  });
}

export function buildShopOrderMessage(groupBuy: GroupBuy) {
  const requestsByMember = new Map(
    groupBuy.members.map((member) => [
      member.id,
      groupBuy.requests.filter((request) => request.memberId === member.id),
    ]),
  );
  const individualMembers = groupBuy.members.filter((member) => {
    const requests = requestsByMember.get(member.id) ?? [];
    return requests.length > 0 && requests.every((request) => request.mode === "whole");
  });
  const individualMemberIds = new Set(individualMembers.map((member) => member.id));
  const shareRequests = groupBuy.requests.filter((request) => !individualMemberIds.has(request.memberId));
  const lines = [`${groupBuy.name}（${groupBuy.id}）店舖總單`, "", "【Share order】"];

  const sharedLines = itemLines(shareRequests);
  lines.push(...(sharedLines.length > 0 ? sharedLines : ["（沒有）"]));

  individualMembers.forEach((member) => {
    lines.push("", `【${member.name}'s order】`);
    const requests = requestsByMember.get(member.id) ?? [];
    const quantities = new Map<string, number>();
    requests.forEach((request) => {
      quantities.set(request.itemId, (quantities.get(request.itemId) ?? 0) + Math.max(1, request.quantity ?? 1));
    });
    menu.forEach((item) => {
      const quantity = quantities.get(item.id);
      if (quantity) lines.push(`• ${item.name}：${packageAmount(item, quantity)}`);
    });
  });

  return lines.join("\n");
}