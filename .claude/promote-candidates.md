---
name: Promote Candidates
description: 本專案累積的待 promote 教訓 backlog，由 session-park 寫入、/promote-lesson drain
type: feedback
---

## PC-001
- status: pending
- origin: local-new
- hit_count: 1
- last_hit: 2026-09-18
- target_hint: domain_pack
- domain: browser-automation
- source_project: pmba-exams
- date: 2026-09-18
- canonical: self
- draft: |
    Claude in Chrome 的 resize_window 回報 "Successfully resized" 但頁面 viewport
    不一定跟著變（window.innerWidth 維持原值），連兩次呼叫皆無效。症狀是「指令成功、
    畫面沒變」，容易誤以為 RWD 已驗過。
    驗收窄螢幕版面前，先用 javascript_tool 讀 window.innerWidth 確認 viewport 真的
    變了再截圖；沒變就不要宣稱驗過手機版面，改請使用者用實機或 devtools 裝置模式看。
    同場加映：computer screenshot 偶爾 CDP timeout 30s，重試一次通常就過；截圖的
    coordinate frame 與 viewport 不一定同尺寸，量元素位置要用 getBoundingClientRect
    而不是看圖猜座標。
