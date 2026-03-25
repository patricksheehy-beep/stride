---
phase: 1
slug: architecture-foundation-and-data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.js (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | ARCH-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | DATA-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | DATA-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | DATA-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | ARCH-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `jsdom` — install test framework and DOM environment
- [ ] `tests/setup.js` — shared test setup
- [ ] `tests/` directory structure mirroring `src/`

*Test framework not yet installed — Wave 0 creates infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App loads in browser from ES Modules | ARCH-01 | Requires actual browser load | Open index.html, verify no console errors, check Network tab shows module loading |
| IndexedDB cache persists across page reload | ARCH-04 | Requires browser persistence | Generate route, reload page, verify cache hit in console |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
