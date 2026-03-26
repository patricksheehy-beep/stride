---
phase: 2
slug: route-building-and-scoring-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (installed in Phase 1) |
| **Config file** | vitest.config.js |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | ROUTE-07 | unit | `npx vitest run tests/scoring/` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | ROUTE-01 | unit | `npx vitest run tests/route-builder/` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | ROUTE-02 | unit | `npx vitest run tests/route-builder/` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | ROUTE-03, ROUTE-04 | integration | `npx vitest run tests/generator/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scoring/` directory structure
- [ ] `tests/route-builder/` directory structure
- [ ] `tests/generator/` directory structure
- [ ] Mock ORS/OSRM responses for deterministic testing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Loop route visually returns to start on map | ROUTE-01 | Requires visual map inspection | Generate route, verify start/end markers overlap on Leaflet map |
| Routes prefer trails over roads visually | ROUTE-04 | Requires visual comparison with satellite imagery | Generate route near known trails, compare with satellite view |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
