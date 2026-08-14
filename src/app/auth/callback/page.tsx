"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("正在完成登入…");

  useEffect(() => {
    const completeSignIn = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      const supabase = getSupabase();
      if (!supabase) {
        setMessage("Supabase 尚未設定。");
        return;
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(`登入失敗：${error.message}`);
          return;
        }
      } else {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          setMessage("登入連結無效、已過期，或在另一個瀏覽器開啟。");
          return;
        }
      }
      window.location.replace(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
    };
    void completeSignIn();
  }, []);

  return <main className="auth-callback"><p>{message}</p></main>;
}