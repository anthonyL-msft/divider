# 夾份 Divider

繁體中文團購分配與結算工具。依照每位成員的最低需求，自動計算訂購份數、實際分量及加拿大元（CAD）應付金額。

## 分配規則

- 以「個」計算的品項，每人最少 1 個，只分配整數件數。
- 以「盒／份」計算的品項，每人最少 `1/4`，平均分配可保留 `1/3` 等比例。
- 人數或最低需求超過現有數量時，自動追加完整一盒／一份。
- 指定數量視為最低需求，剩餘數量再由同一品項的 Share 成員平分。
- 獨食的完整份數獨立於 Share 池計算。

## 本機執行

```bash
npm install
npm run dev
```

開啟終端顯示的本機網址。開發伺服器通常使用 [http://localhost:3000](http://localhost:3000)。

正式資料同步至 Supabase，`localStorage` 作為本機 fallback。首次登入且雲端沒有資料時，會匯入 `groupbuy-001` 草稿。

請在 `.env.local` 設定：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

分享連結使用不可猜測的 token 並預設唯讀。Organizer 透過 Supabase Email OTP 登入，RLS 只允許 owner 修改自己的團購單。

## GitHub Pages

正式網址為 [https://anthonyl-msft.github.io/divider/](https://anthonyl-msft.github.io/divider/)。Repository 的 Actions secret 必須包含：

```text
SUPABASE_PUBLISHABLE_KEY
```

Supabase Authentication 的 Redirect URLs 必須加入：

```text
https://anthonyl-msft.github.io/divider/auth/callback/
```

## 驗證

```bash
npm run lint
npm test
npm run build
```

## GitHub Pages 部署

推送至 `main` 後，[GitHub Actions](.github/workflows/deploy-pages.yml) 會自動建立並部署靜態網站。

首次部署前，在 GitHub repository 開啟 **Settings → Pages**，將 **Source** 設為 **GitHub Actions**。工作流程完成後，網站位於：

[https://anthonyl-msft.github.io/divider/](https://anthonyl-msft.github.io/divider/)

本機模擬 GitHub Pages build：

```bash
GITHUB_PAGES=true npm run build
```

技術棧：Next.js 16、React 19、TypeScript、Vitest。
