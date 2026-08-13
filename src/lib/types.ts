export type UnitKind = "piece" | "portion";

export type MenuItem = {
  id: string;
  category: string;
  name: string;
  price: number;
  unitKind: UnitKind;
  packageLabel: "盒" | "份";
  piecesPerPackage?: number;
  detail?: string;
};

export type Member = {
  id: string;
  name: string;
  note?: string;
};

export type OrderRequest = {
  id: string;
  memberId: string;
  itemId: string;
  mode: "share" | "whole" | "undecided";
  minimum?: number;
  quantity?: number;
  flavor?: string;
  note?: string;
};

export type GroupBuy = {
  id: string;
  name: string;
  status: "draft" | "closed";
  members: Member[];
  requests: OrderRequest[];
  createdAt: string;
  updatedAt: string;
};

export type MemberAllocation = {
  memberId: string;
  amount: number;
  cost: number;
  mode: "share" | "whole";
};

export type ItemAllocation = {
  itemId: string;
  packageCount: number;
  totalCost: number;
  allocations: MemberAllocation[];
  undecidedMemberIds: string[];
};