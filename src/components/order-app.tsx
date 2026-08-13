"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  Lock,
  Menu as MenuIcon,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { distributeItem } from "@/lib/distribution";
import { menu, menuById } from "@/lib/menu";
import { seedGroupBuy } from "@/lib/seed";
import type { GroupBuy, MenuItem, OrderRequest } from "@/lib/types";

const STORAGE_KEY = "divider-groupbuys-v1";
const money = new Intl.NumberFormat("zh-HK", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
});

type View = "items" | "members" | "menu";

function fractionLabel(value: number) {
  const whole = Math.floor(value + 0.0001);
  const decimal = value - whole;
  const fractions = [
    { value: 1 / 4, label: "1/4" },
    { value: 1 / 3, label: "1/3" },
    { value: 2 / 5, label: "2/5" },
    { value: 1 / 2, label: "1/2" },
    { value: 3 / 5, label: "3/5" },
    { value: 2 / 3, label: "2/3" },
    { value: 3 / 4, label: "3/4" },
  ];
  const fraction = fractions.find((entry) => Math.abs(entry.value - decimal) < 0.015);
  if (!fraction) return value.toFixed(2).replace(/\.00$/, "");
  return `${whole ? `${whole} ` : ""}${fraction.label}`;
}

function amountLabel(item: MenuItem, amount: number) {
  return item.unitKind === "piece"
    ? `${amount} 個`
    : `${fractionLabel(amount)} ${item.packageLabel}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function OrderApp() {
  const [groupBuys, setGroupBuys] = useState<GroupBuy[]>([seedGroupBuy]);
  const [activeId, setActiveId] = useState(seedGroupBuy.id);
  const [view, setView] = useState<View>("items");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>("ham-sui-gok");
  const [newMemberName, setNewMemberName] = useState("");
  const [menuMemberId, setMenuMemberId] = useState(seedGroupBuy.members[0].id);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as GroupBuy[];
          if (parsed.length > 0) {
            setGroupBuys(parsed);
            setActiveId(parsed[0].id);
            setMenuMemberId(parsed[0].members[0]?.id ?? "");
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groupBuys));
  }, [groupBuys, hydrated]);

  const groupBuy = groupBuys.find((group) => group.id === activeId) ?? groupBuys[0];
  const memberById = new Map(groupBuy.members.map((member) => [member.id, member]));
  const orderedItemIds = [...new Set(groupBuy.requests.map((request) => request.itemId))];
  const allocations = orderedItemIds
    .map((itemId) => {
      const item = menuById.get(itemId);
      return item
        ? distributeItem(
            item,
            groupBuy.requests.filter((request) => request.itemId === itemId),
          )
        : null;
    })
    .filter((allocation) => allocation !== null);
  const total = allocations.reduce((sum, allocation) => sum + allocation.totalCost, 0);
  const packageCount = allocations.reduce((sum, allocation) => sum + allocation.packageCount, 0);
  const pendingCount = allocations.reduce(
    (sum, allocation) => sum + allocation.undecidedMemberIds.length,
    0,
  );
  const memberTotals = new Map<string, number>();
  allocations.forEach((allocation) =>
    allocation.allocations.forEach((entry) =>
      memberTotals.set(entry.memberId, (memberTotals.get(entry.memberId) ?? 0) + entry.cost),
    ),
  );

  function updateGroup(updater: (group: GroupBuy) => GroupBuy) {
    setGroupBuys((current) =>
      current.map((group) =>
        group.id === activeId
          ? { ...updater(group), updatedAt: new Date().toISOString() }
          : group,
      ),
    );
  }

  function updateRequest(requestId: string, patch: Partial<OrderRequest>) {
    updateGroup((group) => ({
      ...group,
      requests: group.requests.map((request) =>
        request.id === requestId ? { ...request, ...patch } : request,
      ),
    }));
  }

  function addRequest(itemId: string, memberId = menuMemberId) {
    if (!memberId || groupBuy.status === "closed") return;
    const existing = groupBuy.requests.find(
      (request) => request.itemId === itemId && request.memberId === memberId,
    );
    if (existing) {
      setView("items");
      setExpanded(itemId);
      return;
    }
    updateGroup((group) => ({
      ...group,
      requests: [
        ...group.requests,
        {
          id: `request-${Date.now()}`,
          itemId,
          memberId,
          mode: "share",
        },
      ],
    }));
  }

  function addMember() {
    const name = newMemberName.trim();
    if (!name || groupBuy.status === "closed") return;
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "member"}-${Date.now()}`;
    updateGroup((group) => ({ ...group, members: [...group.members, { id, name }] }));
    setNewMemberName("");
    setMenuMemberId(id);
  }

  function createGroupBuy() {
    const sequence = String(groupBuys.length + 1).padStart(3, "0");
    const id = `groupbuy-${sequence}`;
    const next: GroupBuy = {
      id,
      name: `新團購 ${sequence}`,
      status: "draft",
      members: [],
      requests: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setGroupBuys((current) => [...current, next]);
    setActiveId(id);
    setView("members");
  }

  function resetSeed() {
    if (!window.confirm("確定以原始名單重設 groupbuy-001？現有修改將會被取代。")) return;
    setGroupBuys((current) => [seedGroupBuy, ...current.filter((group) => group.id !== seedGroupBuy.id)]);
    setActiveId(seedGroupBuy.id);
  }

  const filteredAllocations = allocations.filter((allocation) => {
    const item = menuById.get(allocation.itemId);
    return item?.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><CircleDollarSign size={21} /></span>
          <span>夾份</span>
        </div>
        <nav aria-label="主要導覽">
          <button className={view === "items" ? "nav-item active" : "nav-item"} onClick={() => setView("items")}>
            <ClipboardList size={19} /> 分配總覽
          </button>
          <button className={view === "members" ? "nav-item active" : "nav-item"} onClick={() => setView("members")}>
            <Users size={19} /> 成員
          </button>
          <button className={view === "menu" ? "nav-item active" : "nav-item"} onClick={() => setView("menu")}>
            <MenuIcon size={19} /> 菜單
          </button>
        </nav>
        <div className="rule-note">
          <strong>分配規則</strong>
          <span>「個」最少 1 個</span>
          <span>「盒／份」最少 1/4</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="order-picker">
            <label htmlFor="groupbuy">團購單</label>
            <select id="groupbuy" value={activeId} onChange={(event) => setActiveId(event.target.value)}>
              {groupBuys.map((group) => <option key={group.id} value={group.id}>{group.id}</option>)}
            </select>
            <span className={groupBuy.status === "draft" ? "status draft" : "status closed"}>
              {groupBuy.status === "draft" ? "草稿" : "已截單"}
            </span>
          </div>
          <div className="top-actions">
            <button className="icon-button" title="以原始名單重設" onClick={resetSeed}><RotateCcw size={18} /></button>
            <button className="secondary-button" onClick={createGroupBuy}><Plus size={17} /> 新團購</button>
            <button
              className="primary-button"
              onClick={() => updateGroup((group) => ({ ...group, status: group.status === "draft" ? "closed" : "draft" }))}
            >
              {groupBuy.status === "draft" ? <Lock size={17} /> : <RotateCcw size={17} />}
              {groupBuy.status === "draft" ? "截單" : "重新開啟"}
            </button>
          </div>
        </header>

        <main className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">{groupBuy.id}</p>
              <h1>{groupBuy.name}</h1>
              <p>按實際分量計算每人費用，尾數會分配給其中一位成員。</p>
            </div>
            <div className="save-state"><Check size={16} /> {hydrated ? "已自動儲存" : "正在載入"}</div>
          </section>

          <section className="metrics" aria-label="團購摘要">
            <div className="metric"><span>預計總額</span><strong>{money.format(total)}</strong></div>
            <div className="metric"><span>訂購品項</span><strong>{allocations.length}</strong><small>{packageCount} 盒／份</small></div>
            <div className="metric"><span>參與人數</span><strong>{groupBuy.members.length}</strong></div>
            <div className={pendingCount ? "metric warning" : "metric"}><span>待確認</span><strong>{pendingCount}</strong><small>{pendingCount ? "需要決定 Share 或獨食" : "資料完整"}</small></div>
          </section>

          {view === "items" && (
            <section className="panel order-panel">
              <div className="panel-header">
                <div><h2>分配總覽</h2><p>展開品項即可調整參與方式及最低份量。</p></div>
                <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋已點品項" /></label>
              </div>
              <div className="item-list">
                {filteredAllocations.map((allocation) => {
                  const item = menuById.get(allocation.itemId)!;
                  const requests = groupBuy.requests.filter((request) => request.itemId === item.id);
                  const isExpanded = expanded === item.id;
                  return (
                    <article className="order-item" key={item.id}>
                      <button className="item-summary" onClick={() => setExpanded(isExpanded ? null : item.id)}>
                        <span className="category-mark">{item.category.slice(0, 1)}</span>
                        <span className="item-identity"><strong>{item.name}</strong><small>{money.format(item.price)}／{item.unitKind === "piece" ? `${item.piecesPerPackage}個` : item.packageLabel}{item.detail ? ` · ${item.detail}` : ""}</small></span>
                        <span className="participants">
                          {allocation.allocations.slice(0, 5).map((entry) => <span className="avatar" title={memberById.get(entry.memberId)?.name} key={`${item.id}-${entry.memberId}`}>{initials(memberById.get(entry.memberId)?.name ?? "?")}</span>)}
                          {allocation.allocations.length > 5 && <span className="avatar more">+{allocation.allocations.length - 5}</span>}
                        </span>
                        <span className="package-total"><strong>{allocation.packageCount} {item.packageLabel}</strong><small>{money.format(allocation.totalCost)}</small></span>
                        {allocation.undecidedMemberIds.length > 0 && <span className="pending-dot" title="有待確認項目" />}
                        {isExpanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                      </button>
                      {isExpanded && (
                        <div className="item-detail">
                          <div className="allocation-grid">
                            {requests.map((request) => {
                              const result = allocation.allocations.find((entry) => entry.memberId === request.memberId);
                              const step = item.unitKind === "piece" ? 1 : 0.25;
                              const minimum = request.minimum ?? step;
                              return (
                                <div className={request.mode === "undecided" ? "allocation-row pending" : "allocation-row"} key={request.id}>
                                  <span className="avatar">{initials(memberById.get(request.memberId)?.name ?? "?")}</span>
                                  <div className="member-result"><strong>{memberById.get(request.memberId)?.name}</strong><small>{result ? `${amountLabel(item, result.amount)} · ${money.format(result.cost)}` : "待確認"}{request.flavor ? ` · ${request.flavor}` : ""}</small>{request.note && <em>{request.note}</em>}</div>
                                  <select value={request.mode} disabled={groupBuy.status === "closed"} onChange={(event) => updateRequest(request.id, { mode: event.target.value as OrderRequest["mode"] })}>
                                    <option value="share">Share</option><option value="whole">全份</option><option value="undecided">待確認</option>
                                  </select>
                                  {request.mode === "share" && (
                                    <div className="stepper">
                                      <button title="減少最低份量" disabled={groupBuy.status === "closed" || minimum <= step} onClick={() => updateRequest(request.id, { minimum: Math.max(step, minimum - step) })}><Minus size={15} /></button>
                                      <span>最少 {amountLabel(item, minimum)}</span>
                                      <button title="增加最低份量" disabled={groupBuy.status === "closed"} onClick={() => updateRequest(request.id, { minimum: minimum + step })}><Plus size={15} /></button>
                                    </div>
                                  )}
                                  {request.mode === "whole" && <span className="whole-label">{request.quantity ?? 1} {item.packageLabel}</span>}
                                  <button className="delete-button" title="移除此人的品項" disabled={groupBuy.status === "closed"} onClick={() => updateGroup((group) => ({ ...group, requests: group.requests.filter((entry) => entry.id !== request.id) }))}><Trash2 size={16} /></button>
                                </div>
                              );
                            })}
                          </div>
                          <div className="add-participant">
                            <select value={menuMemberId} onChange={(event) => setMenuMemberId(event.target.value)} disabled={groupBuy.status === "closed"}>
                              {groupBuy.members.filter((member) => !requests.some((request) => request.memberId === member.id)).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                            </select>
                            <button className="secondary-button" disabled={groupBuy.status === "closed" || groupBuy.members.every((member) => requests.some((request) => request.memberId === member.id))} onClick={() => addRequest(item.id)}><Plus size={16} /> 加入 Share</button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {view === "members" && (
            <section className="panel">
              <div className="panel-header"><div><h2>成員</h2><p>管理今次團購的參與者及查看個人小計。</p></div></div>
              <form className="add-member" onSubmit={(event) => { event.preventDefault(); addMember(); }}>
                <input value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="輸入成員名稱" disabled={groupBuy.status === "closed"} />
                <button className="primary-button" disabled={!newMemberName.trim() || groupBuy.status === "closed"}><Plus size={17} /> 新增成員</button>
              </form>
              <div className="member-grid">
                {groupBuy.members.map((member) => {
                  const count = groupBuy.requests.filter((request) => request.memberId === member.id).length;
                  return <article className="member-card" key={member.id}><div className="member-card-head"><span className="large-avatar">{initials(member.name)}</span><div><h3>{member.name}</h3><p>{member.note ?? "未有交收備註"}</p></div><button className="delete-button" title="刪除成員" disabled={groupBuy.status === "closed"} onClick={() => updateGroup((group) => ({ ...group, members: group.members.filter((entry) => entry.id !== member.id), requests: group.requests.filter((request) => request.memberId !== member.id) }))}><Trash2 size={16} /></button></div><div className="member-card-total"><span>{count} 個品項</span><strong>{money.format(memberTotals.get(member.id) ?? 0)}</strong></div></article>;
                })}
              </div>
            </section>
          )}

          {view === "menu" && (
            <section className="panel">
              <div className="panel-header menu-header"><div><h2>菜單</h2><p>選擇成員，再把品項加入其 Share 清單。</p></div><label><span>為誰加單</span><select value={menuMemberId} onChange={(event) => setMenuMemberId(event.target.value)}>{groupBuy.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div>
              {[...new Set(menu.map((item) => item.category))].map((category) => (
                <div className="menu-category" key={category}><h3>{category}</h3><div className="menu-grid">{menu.filter((item) => item.category === category).map((item) => { const added = groupBuy.requests.some((request) => request.itemId === item.id && request.memberId === menuMemberId); return <article className="menu-item" key={item.id}><div><strong>{item.name}</strong><small>{item.detail}</small></div><span>{money.format(item.price)}／{item.unitKind === "piece" ? `${item.piecesPerPackage}個` : item.packageLabel}</span><button className={added ? "added-button" : "icon-button"} title={added ? "已加入" : "加入 Share"} disabled={added || groupBuy.status === "closed" || !menuMemberId} onClick={() => addRequest(item.id)}>{added ? <Check size={17} /> : <Plus size={17} />}</button></article>; })}</div></div>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}