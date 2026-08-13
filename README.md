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

資料儲存在瀏覽器 `localStorage`，不需要後端。首次載入會匯入 `groupbuy-001` 的目前訂單草稿。

分享連結預設為唯讀；輸入編輯密碼才可修改。請在 `.env.local` 設定：

```bash
NEXT_PUBLIC_EDIT_PASSWORD=你的密碼
```

未設定時的開發密碼為 `divider2026`。這是前端防誤改機制；需要真正的存取控制時，應改用後端登入與資料庫權限。

## 驗證

```bash
npm run lint
npm test
npm run build
```

技術棧：Next.js 16、React 19、TypeScript、Vitest。
