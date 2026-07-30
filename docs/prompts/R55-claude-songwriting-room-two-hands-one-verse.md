# R55 — "Two hands, one verse"

**The one goal of the room:** everything for this song stays connected here.
**The R55 defect:** the room stops the music to ask a question.

---

## 1. Stress test (2 phones, 1 song, same verse)

| Step | Today | Verdict |
|---|---|---|
| A types line 1, B types line 3, both save | Second saver gets `status: "conflict"` | ❌ False alarm — they never touched the same words |
| Conflict fires | UI must render a side-by-side "yours vs theirs" screen | ❌ A modal in the middle of writing a song |
| A and B both retype line 2 | Someone's words are simply gone after they pick | ❌ Work destroyed |
| A adds a line while B is typing | B's save can't see it | ❌ Line lost or duplicated |

## 2. The reference standard

- **Google Docs / Figma / Notion:** conflict dialogs do not exist. Disjoint edits merge; identity of the edit is preserved.
- **Linear:** when a true collision happens, the loser's text is never discarded — it becomes a visible artifact you can act on.
- **Temu forward-motion, applied honestly:** never end a moment with a question. Save, then show the *one* thing left to decide, inline, where it happened.

## 3. The R55 rule

> Two people writing different lines never see anything.
> Two people writing the same line: **theirs stays, yours becomes a suggestion on that line.**
> There is no conflict screen anywhere in the product.

## 4. Backend (shipped)

`save_section_lyrics_merged(_song_id, _section_id, _base, _content, _plain_text, _label, _position)`
- Three-way merge by stable line id: base (what your editor loaded) vs mine vs server.
- Same-line collision → server line kept + a row in `lyric_suggestions` (`line_id`, `original_text` = theirs, `suggested_text` = yours, `status: 'open'`).
- Their deletions respected; their new lines appended; my new lines kept in my order.
- Always returns `status: "saved"` with the merged `content`, plus `merged_lines`, `kept_theirs`, `suggestions_created`.

SDK: `saveSectionMerged(songId, section, baseLines, { position })` in `src/integrations/cog/sheet.ts`.

## 5. Frontend work — every interaction

### 5.1 Wire the editor
1. On load of the sheet, store a **base snapshot** per section: `baseLines[sectionId] = lines` (structuredClone).
2. Autosave a section 800ms after the last keystroke, and immediately on blur / section switch / route change / `visibilitychange → hidden`.
3. Call `saveSectionMerged(songId, section, baseLines[sectionId])`.
4. On return: `setSection(result.lines)` and `baseLines[sectionId] = result.lines`. This is the only place base is refreshed.
5. Caret preservation: before applying `result.lines`, record `(lineId, selectionStart)`. After apply, restore by line id — never by index. If the line vanished (they deleted it), put the caret at the end of the previous line.
6. Never block input during a save. No spinner, no disabled state, no "Saving…" text.

### 5.2 Realtime
- The `room:{id}` channel (R53) already carries `song_lyrics` changes. On a remote change for a section **you are not focused in**: apply lines + refresh base silently.
- On a remote change for the section you **are** focused in: do nothing. Your next autosave merges it. This prevents text jumping under the caret.

### 5.3 The only visible artifact: the inline suggestion
When `kept_theirs > 0`, the merged lines contain their text and your text is an open suggestion on those line ids.
- Render on that line, right-aligned, at `--t-label` in the author's cast colour (R52): `Your version` + a 2px left rule in that colour.
- Tap → expands **in place**, 180ms, `--cog-ease-reveal`, to show the alternate text and two ghost buttons: **Use this** / **Dismiss**. Nothing else. No author name, no timestamp, no diff highlighting.
- **Use this** → writes the suggested text into the line, accepts the suggestion, collapses. Optimistic, reversible via the standard undo strip.
- **Dismiss** → declines the suggestion, collapses.
- Owner and collaborator both may act on their own suggestions; only the owner may act on someone else's.

### 5.4 The quiet notice (once per save, never a toast)
If `kept_theirs > 0`, fade a single 24px strip under the section header for 4s:
`Sarah wrote here too — your line is saved below.`
Charcoal on `--cog-cream-dark`, no icon, no dismiss button, no count badge.
If `kept_theirs === 0`: absolutely no UI. Silence is the success state.

### 5.5 Deletions
Delete the whole `lyric_suggestions` UI surface from the room the moment a line is deleted — suggestions on a removed line are auto-hidden client-side (do not render an orphan pin).

## 6. Removals — trim the fat (do all five)
1. **Delete the conflict screen / "yours vs theirs" component entirely.** No route, no modal, no drawer.
2. **Delete every call to `saveSectionGuarded` from the editor.** Keep the function only for bulk import/replace paths.
3. **Delete "Saving…", "Saved", the cloud icon and any save button** in the sheet. Autosave is invisible or it isn't autosave.
4. **Delete the suggestions counter** anywhere it survived R52 (tab dots, header pills).
5. **Delete polling of `getSectionHeads` from the editor** — the realtime channel plus merge-on-save makes it dead weight and a per-keystroke network cost.

## 7. Performance gates
- Autosave payload: one section only, never the whole sheet.
- Coalesce: at most one in-flight save per section; queue at most one follow-up.
- Zero re-render of untouched sections when a merged result lands (key by line id, memo per line).
- Typing latency budget: input → paint under 16ms with 12 sections and 200 lines loaded.

## 8. Definition of done
- Two devices, same verse, different lines, 60s of continuous typing → zero dialogs, zero lost characters, both sets of lines present.
- Two devices, same line → their line visible to both; one inline `Your version` marker; two taps to resolve; result identical on both devices within 1s.
- Kill the network for 20s while typing → text stays, save flushes on reconnect, merge still correct.
