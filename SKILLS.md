# SKILLS.md — บันทึกทักษะที่ใช้ในโปรเจกต์นี้

> ไฟล์นี้ใช้จดว่าแต่ละส่วนของโปรเจกต์ใช้ทักษะ/เทคนิคอะไร เพื่อทบทวนและเอาไปต่อยอด

## Backend / Node.js
- **REST API design** — ออกแบบ resource + status code + error format เดียวกันทั้งระบบ (`docs/API.md`)
- **Fastify** — route, JSON schema validation, serving static files
- **`node:sqlite`** — ใช้ SQLite ในตัว Node 23 (prepare/run/get/all, transaction) โดยไม่ต้องลง native module
- **Database schema design** — soft delete (`deleted_at`), fractional indexing (`sort_order REAL`) สำหรับ drag & drop, แยก `due_at` / `completed_at`
- **Timezone-safe API** — server ไม่คำนวณ "วันนี้" เอง ให้ client ส่งช่วงเวลา UTC มา
- **Integration testing** — vitest + `fastify.inject()` ทดสอบทุก endpoint โดยไม่ต้องเปิด port จริง

## CLI
- **commander** — สร้าง subcommand (`todo add`, `todo done`, ...)
- **chrono-node** — parse วันที่ภาษาคน ("tomorrow 6pm")
- **Process management** — auto-start server แบบ detached + poll health check
- **UX ใน terminal** — สี (picocolors), ตารางลำดับเลขอ้างอิงจากลิสต์ล่าสุด

## Frontend / React
- **React 18 + Vite** — โครงสร้าง components/views/hooks
- **TanStack Query** — cache + optimistic updates (ปัดเสร็จแล้ว UI ตอบทันที ไม่รอ server)
- **Tailwind CSS v4** — CSS-first config, dark mode ด้วย `dark:` variant + class strategy
- **framer-motion** — swipe gesture (drag + directionLock), layout animation
- **dnd-kit** — drag & drop ข้ามคอลัมน์ที่รองรับ touch
- **Timestamp-based timer** — จับเวลาโดยคำนวณจาก `started_at` เสมอ กัน iOS suspend JS แล้วเวลาเพี้ยน

## PWA / Platform
- **Web App Manifest + Service Worker** — ติดตั้งบน iPhone/iPad/Mac, cache static assets
- **Responsive + touch-first design** — bottom tab bar บนมือถือ / sidebar บนจอใหญ่

## Engineering practice
- **npm workspaces (monorepo)** — แยก server / web / cli แต่แชร์กันได้
- **API contract first** — เขียน `docs/API.md` ก่อนโค้ด ทำให้ CLI กับ web พัฒนาขนานกันได้
- **Milestone + Definition of Done** — แบ่งงานเป็นช่วงที่จบแล้วใช้ได้จริงทุกช่วง

## สิ่งที่อยากเรียนต่อ (backlog)
- [ ] Recurring tasks (RRULE)
- [ ] Deploy ขึ้น VPS + เพิ่ม auth
- [ ] Capacitor / Tauri ห่อเป็น native app
