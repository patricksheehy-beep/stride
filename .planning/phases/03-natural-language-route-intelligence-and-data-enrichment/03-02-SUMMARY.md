---
phase: 03-natural-language-route-intelligence-and-data-enrichment
plan: 02
subsystem: nl, scoring
tags: [claude-api, natural-language, structured-outputs, weight-merging, haiku, cors-browser-access]

# Dependency graph
requires:
  - phase: 03-natural-language-route-intelligence-and-data-enrichment
    plan: 01
    provides: "5-factor weight profiles (surface, continuity, trailPreference, scenic, greenSpace)"
provides:
  - "ClaudeClient class wrapping fetch to Claude Messages API with CORS browser-access header"
  - "NL_PARSER_SYSTEM_PROMPT and WEIGHT_SCHEMA for structured NL parsing"
  - "NLParser class converting natural language route descriptions to weight adjustments"
  - "mergeWeights function composing NL overrides with region defaults, normalized to sum 1.0"
affects: [03-03-PLAN, route-generation, scoring-pipeline, ui-input]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Claude Messages API direct browser access via anthropic-dangerous-direct-browser-access header", "Structured outputs with output_config.format for guaranteed JSON schema compliance", "Graceful degradation returning null on API failure for pipeline continuity", "Weight clamping to [0,1] range before returning NL results"]

key-files:
  created:
    - "src/nl/claude-client.js"
    - "src/nl/prompt-templates.js"
    - "src/nl/nl-parser.js"
    - "tests/nl/claude-client.test.js"
    - "tests/nl/nl-parser.test.js"
  modified:
    - "src/scoring/weights.js"
    - "tests/scoring/weights.test.js"

key-decisions:
  - "Claude Haiku 4.5 (claude-haiku-4-5-20250514) as default model -- cheapest structured output model, sufficient for NL parsing"
  - "Direct fetch() to Claude API with CORS header instead of SDK -- smaller bundle, simpler for single endpoint"
  - "NLParser returns null on any failure (graceful degradation) -- scoring pipeline continues with default weights"
  - "Weight values clamped to [0,1] range in NLParser before returning -- guards against out-of-range Claude outputs"

patterns-established:
  - "Claude API adapter pattern: ClaudeClient wraps fetch with headers, model default, structured output support"
  - "NL parser pattern: falsy input check -> API call -> validate response -> clamp values -> return structured result"
  - "Weight merging pattern: copy region defaults -> override with NL values -> normalize sum to 1.0"

requirements-completed: [ROUTE-05]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 03 Plan 02: NL Parsing Pipeline and Weight Merging Summary

**NLParser converts natural language route descriptions to scoring weight adjustments via Claude Haiku 4.5 structured outputs, with ClaudeClient CORS adapter and mergeWeights normalization**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T18:39:26Z
- **Completed:** 2026-03-27T18:42:26Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments
- ClaudeClient adapter for direct browser access to Claude Messages API with CORS header, structured output support, and model/token overrides
- NL_PARSER_SYSTEM_PROMPT with scoring weight instructions and WEIGHT_SCHEMA JSON schema for constrained decoding
- NLParser class that converts vibes ("shady waterfront trail") into structured weight adjustments and boolean preferences with graceful degradation
- mergeWeights function that composes NL-derived overrides with region defaults and normalizes to sum 1.0
- 258 total tests passing (23 new tests added, zero regressions)

## Task Commits

Each task was committed atomically (TDD: RED test commit, then GREEN implementation commit):

1. **Task 1: Claude API client, prompt templates, and NL parser with weight merging**
   - `2735790` (test: failing tests for ClaudeClient, NLParser, and mergeWeights)
   - `23e7c40` (feat: NL parsing pipeline implementation)

## Files Created/Modified
- `src/nl/claude-client.js` - ClaudeClient class wrapping fetch to Claude Messages API with CORS browser-access header
- `src/nl/prompt-templates.js` - NL_PARSER_SYSTEM_PROMPT and WEIGHT_SCHEMA for structured NL parsing output
- `src/nl/nl-parser.js` - NLParser class converting natural language to weight adjustments with clamping and graceful degradation
- `src/scoring/weights.js` - Added mergeWeights function for composing NL + region weights with normalization
- `tests/nl/claude-client.test.js` - 9 tests for ClaudeClient (headers, model default, structured output, error handling)
- `tests/nl/nl-parser.test.js` - 8 tests for NLParser (parse results, empty input, graceful degradation, clamping)
- `tests/scoring/weights.test.js` - Extended with 6 mergeWeights tests (merge, normalize, null handling, partial overrides)

## Decisions Made
- Claude Haiku 4.5 (`claude-haiku-4-5-20250514`) as default model -- cheapest structured output model at $1/$5 per MTok, sufficient for NL parsing task
- Direct fetch() to Claude API with `anthropic-dangerous-direct-browser-access: true` header instead of @anthropic-ai/sdk -- smaller bundle, no extra dependency for a single endpoint
- NLParser returns null on any failure (network error, 429, invalid response) -- graceful degradation keeps scoring pipeline working with default weights
- Weight values clamped to [0, 1] range in NLParser before returning -- guards against out-of-range Claude outputs even with structured outputs

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functions are fully implemented with real logic and tested.

## Issues Encountered

None - all implementations worked as specified on first pass.

## User Setup Required

None - no external service configuration required. Claude API key is read from localStorage (`stride_api_key`) at runtime by consuming code (not this module).

## Next Phase Readiness
- NLParser ready for Plan 03 (route explanation) to use the same ClaudeClient adapter
- mergeWeights ready for RouteGenerator integration: `mergeWeights(getWeightsForRegion(region), nlResult.weights)`
- Preference flags (preferWater, preferParks, etc.) ready for downstream Overpass query filtering
- vibeKeywords ready for UI display alongside route results

## Self-Check: PASSED

- All 5 created files exist on disk
- All 2 commit hashes (2735790, 23e7c40) found in git log
- 258 tests passing across 23 test files (0 failures)

---
*Phase: 03-natural-language-route-intelligence-and-data-enrichment*
*Completed: 2026-03-27*
