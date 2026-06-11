# SKILLS.md — บันทึกทักษะที่ใช้ในโปรเจกต์นี้

> ไฟล์นี้ใช้จดว่าแต่ละส่วนของโปรเจกต์ใช้ทักษะ/เทคนิคอะไร เพื่อทบทวนและเอาไปต่อยอด

## Backend / Node.js
- **REST API design** — ออกแบบ resource + status code + error format เดียวกันทั้งระบบ (`docs/API.md`)
- **Fastify** — route, JSON schema validation (ปรับ Ajv ให้ reject unknown fields), serving static files + SPA fallback
- **`node:sqlite`** — ใช้ SQLite ในตัว Node 23 (prepare/run/get/all, transaction) โดยไม่ต้องลง native module
- **Database schema design** — soft delete (`deleted_at`), fractional indexing (`sort_order REAL`) สำหรับ drag & drop, แยก `due_at` / `completed_at`
- **Timezone-safe API** — server ไม่คำนวณ "วันนี้" เอง ให้ client ส่งช่วงเวลา UTC มา
- **Atomic import/export** — backup ทั้งฐานข้อมูลแบบ transaction + rollback, รักษา id และ autoincrement sequence
- **Schema migration กับข้อมูลจริง** — เพิ่มคอลัมน์ผ่าน migration แบบ append-only แล้วทดสอบ upgrade กับไฟล์ฐานข้อมูลเวอร์ชันเก่าจริง ไม่ใช่แค่ `:memory:`
- **Recurring tasks** — งานเกิดซ้ำโดย "ทำเสร็จแล้ว spawn ตัวถัดไป" + บทเรียนสำคัญ: `setMonth` ของ JS ล้นเดือนสั้น (31 ม.ค. + 1 เดือน = 3 มี.ค.!) ต้อง clamp วันเอง
- **Integration testing** — vitest + `fastify.inject()` ทดสอบทุก endpoint โดยไม่ต้องเปิด port จริง

## CLI
- **commander** — สร้าง subcommand (`todo add`, `todo done`, ...)
- **chrono-node** — parse วันที่ภาษาคน ("tomorrow 6pm") + กฎ "ห้ามได้วันในอดีต" (default 18:00 เลื่อนวัน, weekday เลื่อนสัปดาห์)
- **Process management** — auto-start server แบบ detached + poll health check + PID file
- **UX ใน terminal** — สี (picocolors), progress bar ด้วย `\r`, ลำดับเลขอ้างอิงจากลิสต์ล่าสุด, undo ระดับเดียว

## Frontend / React
- **React 18 + Vite** — โครงสร้าง components/views/hooks, code-splitting ด้วย `React.lazy` (แยก dnd-kit และ chrono เป็น chunk ที่โหลดเมื่อใช้)
- **TanStack Query** — single cache + optimistic updates (snapshot → rollback → reconcile)
- **Tailwind CSS v4** — CSS-first config, design tokens เป็น CSS variables ทำให้สร้างธีมที่ 4 (Wa mode) ได้โดย override ตัวแปรใต้ `data-theme` เดียว ไม่ต้องแก้ component
- **framer-motion** — swipe gesture (drag + directionLock), layout animation, ตราฮังโกะเด้งด้วย spring
- **dnd-kit** — drag & drop ที่รองรับ mouse + touch + **คีย์บอร์ด** (KeyboardSensor)
- **Timestamp-based timer** — จับเวลาจาก `started_at` เสมอ + sync ตอน `visibilitychange` กัน iOS suspend แล้วเวลาเพี้ยน
- **State machine ใน UI** — Focus view 4 สถานะ (idle/running/finished/break) + Pomodoro round cycle พร้อม ref guard กัน effect ยิงซ้ำ

## Local-first / Offline
- **Standalone data engine** — implement business rules เดียวกับ server ทั้งหมดบน localStorage แล้วตรึงความเท่ากันด้วย parity test suite
- **Storage adapter pattern** — engine รับ storage ภายนอกได้ (localStorage / memory / native ในอนาคต) + กู้คืน snapshot พัง + reconcile id sequence

## Design / UX
- **Japanese minimalism** — ศึกษาหลัก 間 ma, 簡素 kanso, 渋い shibui, wabi-sabi แล้วแปลงเป็นธีม Wa: กระดาษวาชิ + หมึกสุมิ + แดงชาดจุดเดียว, ensō ring, brush strikethrough
- **WCAG accessibility** — เช็ค contrast เป็นตัวเลขจริง (เลือกสีที่ ≥4.5:1), `prefers-reduced-motion`, `aria-hidden` กับของตกแต่ง, focus-visible escape hatch ให้คีย์บอร์ด
- **Typography** — จับคู่ Shippori Mincho / Zen Kaku Gothic New / Noto Sans Thai ให้สามภาษาอยู่ร่วมกัน

## PWA / Platform / DevOps
- **Web App Manifest + Service Worker** — network-first, ไม่ cache `/api`, รองรับ subpath (`%BASE_URL%`, relative scope)
- **Deploy ฟรีบน GitHub Pages** — workflow build standalone + 404.html SPA fallback + เปิด Pages ผ่าน REST API
- **GitHub Actions CI** — เทสทุก workspace + build ทุก push
- **Capacitor (iOS)** — scaffold ด้วย Swift Package Manager (ไม่ใช้ CocoaPods), icon ไม่มี alpha ตามข้อกำหนด App Store, `ITSAppUsesNonExemptEncryption`
- **Playwright (headless Chromium)** — ถ่าย screenshot จริงของแอพสำหรับเอกสาร + **E2E test ใน CI**: webServer config ชี้ server จริง (DB `:memory:`) เสิร์ฟ production build, เขียน selector ที่ไม่ flake (role/label แทนพิกัด), assertion ที่พิสูจน์ผลลัพธ์เจาะจง (เช่น "แถวที่เหลือคือตัว spawn ไม่ใช่ตัวที่เพิ่งเสร็จ")
- **Storage durability** — `navigator.storage.persist()` กันเบราว์เซอร์ลบข้อมูล local-first app

## Engineering practice
- **npm workspaces (monorepo)** — แยก server / web / cli แต่แชร์กันได้
- **API contract first** — เขียน `docs/API.md` ก่อนโค้ด ทำให้ CLI กับ web พัฒนาขนานกันได้
- **Milestone + Definition of Done** — แบ่งงานเป็นช่วงที่จบแล้วใช้ได้จริงทุกช่วง
- **QA discipline** — แผนเทสเป็นลายลักษณ์อักษร (`docs/QA_PLAN.md`), บั๊กทุกตัวแก้พร้อม regression test, review แยกจากคนเขียนก่อน merge

## สิ่งที่อยากเรียนต่อ (backlog → ดูแผนละเอียดใน `docs/ROADMAP.md`)
- [x] ~~Recurring tasks~~ ✓ (daily/weekly/monthly + clamp เดือนสั้น)
- [x] ~~E2E testing ด้วย Playwright ใน CI~~ ✓ (7 เทส รันทุก push)
- [x] ~~`navigator.storage.persist()`~~ ✓ (เหลือ IndexedDB adapter เป็นขั้นถัดไป)
- [ ] Sync ข้ามเครื่อง (Cloudflare Workers + D1 free tier) — priority 1 ของ roadmap
- [ ] Thai natural-language dates ("พรุ่งนี้ 6 โมงเย็น") — priority 2
- [ ] กราฟสถิติรายสัปดาห์ + streak — priority 3
- [ ] ESLint flat config ใน CI
