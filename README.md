# 💸 SplitMates 分帳好夥伴 — LINE & IG 好友多人即時分帳平台

專為 **LINE 群組** 與 **Instagram (IG) 小盒子 / 限時動態** 打造的多人旅遊、聚餐、合租即時分帳 Web App（基於 **React 18 + TypeScript + Vite + Tailwind CSS**，支援 **GitHub Pages** 自動部署）。

---

## ✨ 五大核心功能

1. **☁️ 雲端即時共同編輯 (Firebase Firestore) + 連結壓縮快照雙模同步**
   - 支援 **Firebase Firestore** 即時同步 (`onSnapshot`)：親友點開同一個專屬連結，**免下載 App、免註冊帳號**即可同時記帳、即時看到最新帳目。
   - **免設定即開即用**：即使尚未設定 Firebase，系統也會自動透過 `lz-string` 將完整帳目壓縮進分享連結 (`?group=...&s=...`)，貼到 LINE 或 IG 點開立即載入！
2. **⚡ 最少轉帳次數演算法 (Min-Cash-Flow Debt Simplification)**
   - 自動抵銷多人交叉墊付，算出**最少筆數**的最佳化還款路徑（誰該轉給誰多少錢），並支援一鍵「**標記已結清**」。
3. **⚖️ 四種彈性分攤模式 & 多人共同先墊付**
   - **平均分攤 (Equal)**、**自訂金額 (Exact)**、**比例/份數 (Shares，例如 1.5 份 vs 1 份)**、**百分比 (Percent)**。
   - 支援 **單人先墊付** 與 **多人共同湊錢墊付**，並內建 **+5% / +8% / +10% 服務費與消費稅**一鍵加成。
4. **🌍 出國旅遊多幣別即時換算**
   - 內建 `TWD`、`JPY`、`KRW`、`USD`、`EUR`、`THB`、`HKD`、`GBP`、`SGD` 等常見旅遊幣別。
   - 支援自動抓取最新匯率，亦可為該趟旅程**鎖定自訂固定匯率**（例如日幣固定算 `0.215`）。
5. **📲 LINE & IG 深度整合分享中心**
   - **結算圖片小卡產生器 (Retina 2x Canvas PNG)**：一鍵產生高畫質結算明細圖片小卡，支援手機原生 `Web Share API` 直接傳進 **IG 小盒子 / 限動** 或 **LINE 聊天室**。
   - **LINE / IG 排版結算文字**：一鍵複製含 Emoji 排版的結算清單、個人淨額與收款帳號（LINE Pay / 街口 / 銀行帳號）。
   - **LINE LIFF SDK 串接**：支援在 LINE 內自動帶入個人暱稱，並透過 `liff.shareTargetPicker` 一鍵轉發 **LINE Flex Message 互動卡片**。

---

## 🚀 快速啟動與本機開發

```bash
npm install
npm run dev
```

執行單元測試與生產環境打包：

```bash
npm test
npm run build
```

---

## 📦 自動部署至 GitHub Pages

本專案已內建 [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) GitHub Actions 自動部署流程：

1. 將此專案推送到 GitHub Repository（分支 `main`）。
2. 前往 GitHub Repo 的 **Settings ➜ Pages**，將 **Build and deployment ➜ Source** 設為 **GitHub Actions**。
3. 每次 Push 時，GitHub Actions 會自動執行單元測試、打包 Vite 專案並發布至 `https://<妳的GitHub帳號>.github.io/<Repo名稱>/`！
