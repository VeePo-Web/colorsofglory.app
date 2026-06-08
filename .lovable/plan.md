# Plan

Phase 1 (shipped 2026-06-08): Adobe-Podcast-inspired Capture Scene scaffolding.
- Files: src/lib/capture/{sectionKeywords,transcriptModel}.ts, src/components/capture/{BigMic,SideRail,LiveTranscript,CaptureScene}.tsx, src/pages/CapturePage.tsx.
- Routes: / -> Capture, /songs -> Catalog, /songs/:id/capture -> Capture, bottom nav refreshed.
- 8 unit tests passing for section keyword matcher.

Phase 1.5 (Claude handoff): see docs/claude-handoffs/2026-06-08-capture-scene.md
- Live STT through Lovable AI Gateway / batch fallback via voice-memo-transcribe.
- Review Sheet (rename / merge / split / destination picker).
- Canvas commit (blocks -> section zones + cards).
- Idle side-rail capture sheets, keybindings, full a11y.
