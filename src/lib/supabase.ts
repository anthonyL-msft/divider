import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GroupBuy } from "./types";

type GroupBuyRow = {
  id: string;
  share_token?: string;
  name: string;
  status: GroupBuy["status"];
  payload: GroupBuy;
  created_at: string;
  updated_at: string;
};

let browserClient: SupabaseClient | null | undefined;

export function getSupabase() {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  browserClient = url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null;
  return browserClient;
}

function rowToGroupBuy(row: GroupBuyRow): GroupBuy {
  return {
    ...row.payload,
    id: row.id,
    shareToken: row.share_token ?? row.payload.shareToken,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadSharedGroupBuy(id: string, shareToken: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase 尚未設定");
  const { data, error } = await supabase.rpc("divider_get_group_buy", {
    p_id: id,
    p_share_token: shareToken,
  });
  if (error) throw error;
  const row = (data?.[0] ?? null) as GroupBuyRow | null;
  return row ? rowToGroupBuy({ ...row, share_token: shareToken }) : null;
}

export async function loadOwnedGroupBuys() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase 尚未設定");
  const { data, error } = await supabase
    .from("divider_group_buys")
    .select("id, share_token, name, status, payload, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as GroupBuyRow[]).map(rowToGroupBuy);
}

export async function saveGroupBuy(groupBuy: GroupBuy, ownerId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase 尚未設定");
  const payload = { ...groupBuy };
  delete payload.shareToken;
  const { data, error } = await supabase
    .from("divider_group_buys")
    .upsert(
      {
        id: groupBuy.id,
        name: groupBuy.name,
        status: groupBuy.status,
        payload,
        owner_id: ownerId,
      },
      { onConflict: "id" },
    )
    .select("share_token, updated_at")
    .single();
  if (error) throw error;
  return {
    shareToken: data.share_token as string,
    updatedAt: data.updated_at as string,
  };
}