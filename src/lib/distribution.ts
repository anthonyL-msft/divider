import type {
  ItemAllocation,
  MenuItem,
  OrderRequest,
} from "./types";

const MIN_PORTION = 0.25;

function allocatePieceShares(
  requests: OrderRequest[],
  piecesPerPackage: number,
  price: number,
) {
  const amounts = requests.map((request) => ({
    memberId: request.memberId,
    amount: Math.max(1, Math.ceil(request.minimum ?? 1)),
  }));
  const minimumTotal = amounts.reduce((sum, entry) => sum + entry.amount, 0);
  const packageCount = Math.max(1, Math.ceil(minimumTotal / piecesPerPackage));
  let remaining = packageCount * piecesPerPackage - minimumTotal;

  while (remaining > 0) {
    const smallest = Math.min(...amounts.map((entry) => entry.amount));
    const recipient = amounts.find((entry) => entry.amount === smallest) ?? amounts[0];
    recipient.amount += 1;
    remaining -= 1;
  }

  return {
    packageCount,
    allocations: amounts.map((entry) => ({
      ...entry,
      cost: (entry.amount / piecesPerPackage) * price,
      mode: "share" as const,
    })),
  };
}

function allocatePortionShares(requests: OrderRequest[], price: number) {
  const minimums = requests.map((request) => ({
    memberId: request.memberId,
    amount: Math.max(MIN_PORTION, request.minimum ?? MIN_PORTION),
  }));
  const minimumTotal = minimums.reduce((sum, entry) => sum + entry.amount, 0);
  const packageCount = Math.max(1, Math.ceil(minimumTotal));
  const remainder = packageCount - minimumTotal;
  const sharedRemainder = remainder / minimums.length;

  return {
    packageCount,
    allocations: minimums.map((entry) => ({
      memberId: entry.memberId,
      amount: entry.amount + sharedRemainder,
      cost: (entry.amount + sharedRemainder) * price,
      mode: "share" as const,
    })),
  };
}

export function distributeItem(
  item: MenuItem,
  itemRequests: OrderRequest[],
): ItemAllocation {
  const undecidedMemberIds = itemRequests
    .filter((request) => request.mode === "undecided")
    .map((request) => request.memberId);
  const wholeRequests = itemRequests.filter((request) => request.mode === "whole");
  const shareRequests = itemRequests.filter((request) => request.mode === "share");
  const wholePackageCount = wholeRequests.reduce(
    (sum, request) => sum + Math.max(1, request.quantity ?? 1),
    0,
  );
  const wholeAllocations = wholeRequests.map((request) => {
    const quantity = Math.max(1, request.quantity ?? 1);
    return {
      memberId: request.memberId,
      amount:
        item.unitKind === "piece"
          ? quantity * (item.piecesPerPackage ?? 1)
          : quantity,
      cost: quantity * item.price,
      mode: "whole" as const,
    };
  });

  if (shareRequests.length === 0) {
    return {
      itemId: item.id,
      packageCount: wholePackageCount,
      totalCost: wholePackageCount * item.price,
      allocations: wholeAllocations,
      undecidedMemberIds,
    };
  }

  const shared =
    item.unitKind === "piece"
      ? allocatePieceShares(
          shareRequests,
          item.piecesPerPackage ?? 1,
          item.price,
        )
      : allocatePortionShares(shareRequests, item.price);
  const packageCount = wholePackageCount + shared.packageCount;

  return {
    itemId: item.id,
    packageCount,
    totalCost: packageCount * item.price,
    allocations: [...shared.allocations, ...wholeAllocations],
    undecidedMemberIds,
  };
}