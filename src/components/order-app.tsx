"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCopy,
  ClipboardList,
  FileUp,
  KeyRound,
  Lock,
  LogOut,
  Menu as MenuIcon,
  Minus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { distributeItem } from "@/lib/distribution";
import { parseOrderMessage } from "@/lib/import-order";
import { menu, menuById } from "@/lib/menu";
import { buildShopOrderMessage } from "@/lib/order-messages";
import { seedGroupBuy } from "@/lib/seed";
import {
  getSupabase,
  loadOwnedGroupBuys,
  loadSharedGroupBuy,
  saveGroupBuy,
} from "@/lib/supabase";
import type { GroupBuy, MenuItem, OrderRequest } from "@/lib/types";

const STORAGE_KEY = "divider-groupbuys-v2";
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
  const [isEditing, setIsEditing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [syncState, setSyncState] = useState<"local" | "loading" | "syncing" | "saved" | "error">("loading");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState<"message" | "shop" | "link" | null>(null);
  const lastCloudSnapshot = useRef("");

  useEffect(() => {
    queueMicrotask(async () => {
      const supabase = getSupabase();
      const saved = window.localStorage.getItem(STORAGE_KEY);
      let localGroups = [seedGroupBuy];
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as GroupBuy[];
          if (parsed.length > 0) localGroups = parsed;
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      try {
        const params = new URLSearchParams(window.location.search);
        const sharedId = params.get("group");
        const shareToken = params.get("token");
        if (sharedId && shareToken) {
          const shared = await loadSharedGroupBuy(sharedId, shareToken);
          if (!shared) throw new Error("找不到這張團購單，或分享連結無效。");
          localGroups = [shared];
          setSyncState("saved");
        } else if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            setUserId(data.session.user.id);
            setIsEditing(true);
            const cloudGroups = await loadOwnedGroupBuys();
            if (cloudGroups.length > 0) localGroups = cloudGroups;
            setSyncState("saved");
          } else {
            setSyncState("local");
          }
        } else {
          setSyncState("local");
        }
      } catch (error) {
        setAuthMessage(error instanceof Error ? error.message : "無法讀取共享團購單");
        setSyncState("error");
      }
      setGroupBuys(localGroups);
      setActiveId(localGroups[0].id);
      setMenuMemberId(localGroups[0].members[0]?.id ?? "");
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groupBuys));
  }, [groupBuys, hydrated]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    const snapshot = JSON.stringify(groupBuys);
    if (snapshot === lastCloudSnapshot.current) return;
    lastCloudSnapshot.current = snapshot;
    setSyncState("syncing");
    const timeout = window.setTimeout(async () => {
      try {
        const results = await Promise.all(
          groupBuys.map(async (group) => ({
            id: group.id,
            result: await saveGroupBuy(group, userId),
          })),
        );
        setGroupBuys((current) =>
          current.map((group) => {
            const saved = results.find((entry) => entry.id === group.id);
            return saved && group.shareToken !== saved.result.shareToken
              ? { ...group, shareToken: saved.result.shareToken }
              : group;
          }),
        );
        setSyncState("saved");
      } catch (error) {
        setAuthMessage(error instanceof Error ? error.message : "同步失敗");
        setSyncState("error");
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [groupBuys, hydrated, userId]);

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
  const editDisabled = !isEditing || groupBuy.status === "closed";
  const importPreview = importText.trim()
    ? parseOrderMessage(importText, groupBuy)
    : null;

  function updateGroup(updater: (group: GroupBuy) => GroupBuy) {
    if (!isEditing) return;
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
    if (!memberId || editDisabled) return;
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
    if (!name || editDisabled) return;
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "member"}-${Date.now()}`;
    updateGroup((group) => ({ ...group, members: [...group.members, { id, name }] }));
    setNewMemberName("");
    setMenuMemberId(id);
  }

  function createGroupBuy() {
    if (!isEditing) return;
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
    if (!isEditing) return;
    if (!window.confirm("確定以原始名單重設 groupbuy-001？現有修改將會被取代。")) return;
    setGroupBuys((current) => [seedGroupBuy, ...current.filter((group) => group.id !== seedGroupBuy.id)]);
    setActiveId(seedGroupBuy.id);
  }

  async function sendMagicLink() {
    const supabase = getSupabase();
    if (!supabase || !authEmail.trim()) return;
    setAuthMessage("正在傳送登入連結…");
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}${basePath}/auth/callback/`,
      },
    });
    setAuthMessage(error ? `無法傳送：${error.message}` : "登入連結已寄出，請檢查電郵。");
  }

  async function signInWithPassword() {
    const supabase = getSupabase();
    if (!supabase || !authEmail.trim() || !authPassword) return;
    setAuthMessage("正在登入…");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    if (error || !data.user) {
      setAuthMessage(`登入失敗：${error?.message ?? "沒有使用者資料"}`);
      return;
    }
    setUserId(data.user.id);
    setIsEditing(true);
    setAuthPassword("");
    setLoginOpen(false);
    setSyncState("loading");
    try {
      const cloudGroups = await loadOwnedGroupBuys();
      if (cloudGroups.length > 0) {
        setGroupBuys(cloudGroups);
        setActiveId(cloudGroups[0].id);
        setMenuMemberId(cloudGroups[0].members[0]?.id ?? "");
      }
      setSyncState("saved");
    } catch (loadError) {
      setAuthMessage(loadError instanceof Error ? loadError.message : "無法載入雲端團購單");
      setSyncState("error");
    }
  }

  async function lockEditing() {
    await getSupabase()?.auth.signOut();
    setUserId(null);
    setIsEditing(false);
    setSyncState("local");
  }

  function applyImport() {
    if (!importPreview || importPreview.members.length === 0 || importPreview.requests.length === 0) return;
    updateGroup((group) => ({
      ...group,
      members: importPreview.members,
      requests: importPreview.requests,
      status: "draft",
    }));
    setMenuMemberId(importPreview.members[0]?.id ?? "");
    setImportOpen(false);
    setImportText("");
    setView("items");
  }

  function memberAllocations(memberId: string) {
    return allocations.flatMap((allocation) => {
      const item = menuById.get(allocation.itemId);
      const entry = allocation.allocations.find((candidate) => candidate.memberId === memberId);
      const request = groupBuy.requests.find((candidate) => candidate.itemId === allocation.itemId && candidate.memberId === memberId);
      return item && entry && request ? [{ item, entry, request }] : [];
    });
  }

  async function copySettlementMessage() {
    const lines = [`${groupBuy.name}（${groupBuy.id}）`, ""];
    groupBuy.members.forEach((member) => {
      lines.push(member.name);
      memberAllocations(member.id).forEach(({ item, entry, request }) => {
        lines.push(`• ${item.name}：${amountLabel(item, entry.amount)}${request.flavor ? ` · ${request.flavor}` : ""}${request.note ? ` · ${request.note}` : ""}（${money.format(entry.cost)}）`);
      });
      lines.push(`合計：${money.format(memberTotals.get(member.id) ?? 0)}`, "");
    });
    await navigator.clipboard.writeText(lines.join("\n").trim());
    setCopied("message");
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function copyShopOrderMessage() {
    await navigator.clipboard.writeText(buildShopOrderMessage(groupBuy));
    setCopied("shop");
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function copyShareLink() {
    if (!groupBuy.shareToken) {
      setAuthMessage("團購單尚未完成雲端同步，請稍後再試。");
      return;
    }
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("group", groupBuy.id);
    url.searchParams.set("token", groupBuy.shareToken);
    await navigator.clipboard.writeText(url.toString());
    setCopied("link");
    window.setTimeout(() => setCopied(null), 1800);
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
            <button className="icon-button" title={copied === "link" ? "已複製" : "複製分享連結"} onClick={copyShareLink}><ClipboardCopy size={18} /></button>
            <button className="secondary-button copy-message" onClick={copySettlementMessage}><ClipboardCopy size={17} /> {copied === "message" ? "已複製" : "複製結算"}</button>
            <button className="secondary-button shop-copy-message" onClick={copyShopOrderMessage}><ClipboardList size={17} /> {copied === "shop" ? "已複製" : "複製店舖單"}</button>
            {isEditing ? <>
              <button className="icon-button edit-only-action" title="以原始名單重設" onClick={resetSeed}><RotateCcw size={18} /></button>
              <button className="secondary-button edit-only-action" onClick={() => setImportOpen(true)}><FileUp size={17} /> 匯入訊息</button>
              <button className="secondary-button edit-only-action" onClick={createGroupBuy}><Plus size={17} /> 新團購</button>
              <button className="primary-button" onClick={() => updateGroup((group) => ({ ...group, status: group.status === "draft" ? "closed" : "draft" }))}>
                {groupBuy.status === "draft" ? <Lock size={17} /> : <RotateCcw size={17} />}
                {groupBuy.status === "draft" ? "截單" : "重開"}
              </button>
              <button className="icon-button" title="離開編輯" onClick={lockEditing}><LogOut size={18} /></button>
            </> : <button className="primary-button" onClick={() => setLoginOpen(true)}><KeyRound size={17} /> 登入編輯</button>}
            <details className="mobile-actions">
              <summary title="更多操作" aria-label="更多操作"><MoreHorizontal size={20} /></summary>
              <div className="mobile-actions-menu">
                <button onClick={(event) => { void copyShareLink(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><ClipboardCopy size={17} /> 複製分享連結</button>
                <button onClick={(event) => { void copyShopOrderMessage(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><ClipboardList size={17} /> 複製店舖單</button>
                {isEditing && <>
                  <button onClick={(event) => { resetSeed(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><RotateCcw size={17} /> 以原始名單重設</button>
                  <button onClick={(event) => { setImportOpen(true); event.currentTarget.closest("details")?.removeAttribute("open"); }}><FileUp size={17} /> 匯入訊息</button>
                  <button onClick={(event) => { createGroupBuy(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><Plus size={17} /> 新團購</button>
                  <button onClick={(event) => { void lockEditing(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><LogOut size={17} /> 離開編輯</button>
                </>}
              </div>
            </details>
          </div>
        </header>

        <main className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">{groupBuy.id}</p>
              <h1>{groupBuy.name}</h1>
              <p>按實際分量計算每人費用，尾數會分配給其中一位成員。</p>
            </div>
            <div className={isEditing ? "save-state" : "save-state readonly"}>{isEditing ? <Check size={16} /> : <Lock size={16} />} {isEditing ? (syncState === "syncing" ? "正在同步…" : syncState === "error" ? "同步失敗" : "雲端已儲存") : syncState === "saved" ? "雲端唯讀" : "本機唯讀"}</div>
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
                                  <select value={request.mode} disabled={editDisabled} onChange={(event) => updateRequest(request.id, { mode: event.target.value as OrderRequest["mode"] })}>
                                    <option value="share">Share</option><option value="whole">全份</option><option value="undecided">待確認</option>
                                  </select>
                                  {request.mode === "share" && (
                                    <div className="stepper">
                                      <button title="減少固定份量" disabled={editDisabled || minimum <= step} onClick={() => updateRequest(request.id, { minimum: Math.max(step, minimum - step), fixed: true })}><Minus size={15} /></button>
                                      <span>{request.fixed ? "固定" : "最少"} {amountLabel(item, minimum)}</span>
                                      <button title="增加固定份量" disabled={editDisabled} onClick={() => updateRequest(request.id, { minimum: minimum + step, fixed: true })}><Plus size={15} /></button>
                                    </div>
                                  )}
                                  {request.mode === "whole" && <span className="whole-label">{request.quantity ?? 1} {item.packageLabel}</span>}
                                  <button className="delete-button" title="移除此人的品項" disabled={editDisabled} onClick={() => updateGroup((group) => ({ ...group, requests: group.requests.filter((entry) => entry.id !== request.id) }))}><Trash2 size={16} /></button>
                                </div>
                              );
                            })}
                          </div>
                          <div className="add-participant">
                            <select value={menuMemberId} onChange={(event) => setMenuMemberId(event.target.value)} disabled={editDisabled}>
                              {groupBuy.members.filter((member) => !requests.some((request) => request.memberId === member.id)).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                            </select>
                            <button className="secondary-button" disabled={editDisabled || groupBuy.members.every((member) => requests.some((request) => request.memberId === member.id))} onClick={() => addRequest(item.id)}><Plus size={16} /> 加入 Share</button>
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
                <input value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="輸入成員名稱" disabled={editDisabled} />
                <button className="primary-button" disabled={!newMemberName.trim() || editDisabled}><Plus size={17} /> 新增成員</button>
              </form>
              <div className="member-grid">
                {groupBuy.members.map((member) => {
                  const count = groupBuy.requests.filter((request) => request.memberId === member.id).length;
                  const details = memberAllocations(member.id);
                  return <article className="member-card" key={member.id}><div className="member-card-head"><span className="large-avatar">{initials(member.name)}</span><div><h3>{member.name}</h3><p>{member.note ?? "未有交收備註"}</p></div><button className="delete-button" title="刪除成員" disabled={editDisabled} onClick={() => updateGroup((group) => ({ ...group, members: group.members.filter((entry) => entry.id !== member.id), requests: group.requests.filter((request) => request.memberId !== member.id) }))}><Trash2 size={16} /></button></div><ul className="member-order-list">{details.map(({ item, entry, request }) => <li key={item.id}><span><strong>{item.name}</strong><small>{amountLabel(item, entry.amount)}{request.flavor ? ` · ${request.flavor}` : ""}{request.note ? ` · ${request.note}` : ""}</small></span><b>{money.format(entry.cost)}</b></li>)}</ul><div className="member-card-total"><span>{count} 個品項</span><strong>{money.format(memberTotals.get(member.id) ?? 0)}</strong></div></article>;
                })}
              </div>
            </section>
          )}

          {view === "menu" && (
            <section className="panel">
              <div className="panel-header menu-header"><div><h2>菜單</h2><p>選擇成員，再把品項加入其 Share 清單。</p></div><label><span>為誰加單</span><select value={menuMemberId} onChange={(event) => setMenuMemberId(event.target.value)}>{groupBuy.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div>
              {[...new Set(menu.map((item) => item.category))].map((category) => (
                <div className="menu-category" key={category}><h3>{category}</h3><div className="menu-grid">{menu.filter((item) => item.category === category).map((item) => { const added = groupBuy.requests.some((request) => request.itemId === item.id && request.memberId === menuMemberId); return <article className="menu-item" key={item.id}><div><strong>{item.name}</strong><small>{item.detail}</small></div><span>{money.format(item.price)}／{item.unitKind === "piece" ? `${item.piecesPerPackage}個` : item.packageLabel}</span><button className={added ? "added-button" : "icon-button"} title={added ? "已加入" : "加入 Share"} disabled={added || editDisabled || !menuMemberId} onClick={() => addRequest(item.id)}>{added ? <Check size={17} /> : <Plus size={17} />}</button></article>; })}</div></div>
              ))}
            </section>
          )}
        </main>
      </div>

      {loginOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setLoginOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" title="關閉" onClick={() => setLoginOpen(false)}><X size={18} /></button><div className="modal-icon"><KeyRound size={22} /></div><h2 id="login-title">登入編輯模式</h2><p>查看連結預設為唯讀。Organizer 可用 Supabase 帳戶登入，密碼不會儲存在 Divider。</p><form onSubmit={(event) => { event.preventDefault(); void signInWithPassword(); }}><label><span>Organizer 電郵</span><input type="email" value={authEmail} autoFocus onChange={(event) => { setAuthEmail(event.target.value); setAuthMessage(""); }} placeholder="name@example.com" /></label><label><span>密碼</span><input type="password" value={authPassword} onChange={(event) => { setAuthPassword(event.target.value); setAuthMessage(""); }} placeholder="輸入 Supabase 帳戶密碼" /></label>{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button" type="submit" disabled={!authEmail.trim() || !authPassword}><KeyRound size={17} /> 用密碼登入</button><button className="secondary-button" type="button" disabled={!authEmail.trim()} onClick={() => void sendMagicLink()}>寄 Magic Link</button></form></section></div>}

      {importOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setImportOpen(false)}><section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" title="關閉" onClick={() => setImportOpen(false)}><X size={18} /></button><div className="modal-icon"><FileUp size={22} /></div><h2 id="import-title">貼上訂單訊息</h2><p>系統會辨認成員、菜單別名、Share、全份及固定數量。確認後會取代目前團購內容。</p><textarea value={importText} autoFocus onChange={(event) => setImportText(event.target.value)} placeholder="在此貼上 WhatsApp 或群組訂單訊息…" />{importPreview && <div className="import-preview"><div><strong>{importPreview.members.length}</strong><span>位成員</span></div><div><strong>{importPreview.requests.length}</strong><span>個要求</span></div><div className={importPreview.unmatchedLines.length ? "has-warning" : ""}><strong>{importPreview.unmatchedLines.length}</strong><span>行未辨認</span></div></div>}{importPreview && importPreview.unmatchedLines.length > 0 && <details className="unmatched"><summary>查看未辨認內容</summary>{importPreview.unmatchedLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}</details>}<div className="modal-actions"><button className="secondary-button" onClick={() => setImportOpen(false)}>取消</button><button className="primary-button" disabled={!importPreview || importPreview.members.length === 0 || importPreview.requests.length === 0} onClick={applyImport}><FileUp size={17} /> 匯入並更新</button></div></section></div>}
    </div>
  );
}