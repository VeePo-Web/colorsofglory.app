# COLORS OF GLORY — SESSION STARTER PROMPT
## Paste this at the start of any new build session

---

## CONTEXT RESET — READ FIRST

We are building **Colors of Glory** — a mobile-first Christian songwriting collaboration app. This codebase previously had fly4me.ca code in it. That is all being deleted/has been deleted. Do NOT reference fly4me. Do NOT restore any fly4me pages or components.

The project CLAUDE.md at the root of this repo contains the complete specification. Read it now before doing anything else.

The source documents (UX specs, product vision PDFs, visual mockups) are all inside:
```
zip_extracted/20. SONGWRITING SPECIFIC PART/
```

---

## SESSION GOAL: DOCUMENT REVIEW + KNOWLEDGE EXTRACTION

**Your job this session is to go through the source documents one by one and build a complete, accurate understanding of what we are building before writing a single line of code.**

We are going to read the documents in order. For each document you read, extract and output:

1. **What screen(s) it describes** — exact screen names/states
2. **The core UX flow** — what the user does, step by step
3. **Component list** — every visual component on the screen
4. **Exact copy strings** — headlines, button labels, microcopy, captions (verbatim from the doc)
5. **Interaction logic** — what triggers what, what the states are, edge cases
6. **Visual/design notes** — colors, layout, spacing, typography callouts
7. **Implementation notes** — any technical specifics called out in the doc
8. **Open questions** — anything unclear that needs a decision before building

After reading all the documents in a phase, produce:
- A consolidated screen map
- A component inventory
- A data flow summary
- A priority-ordered build sequence

---

## DOCUMENT READING ORDER FOR THIS SESSION

### PHASE 1 — Product Vision (read all 15, in order)
These tell you WHY the product exists and what it must feel like.

Start with:
```
zip_extracted/20. SONGWRITING SPECIFIC PART/2. More Onboarding- System -- with reference images/COG_Product_Vision_01_Scattered_Ideas_Before_Colors_of_Glory_UX_Build_Handoff.pdf
```

Then continue through Product Vision 02, 03, 04... up to 15 in order.
After each one, output the 8-point extraction above.

### PHASE 2 — Reference Images (view all, describe each)
After reading all Product Vision PDFs, view every image in:
```
zip_extracted/20. SONGWRITING SPECIFIC PART/2. More Onboarding- System -- with reference images/reference images/
```

For each image, output:
- What screen this shows
- All visible UI elements
- Exact text/copy visible
- Color and layout observations
- How this maps to the Product Vision docs

### PHASE 3 — Master Onboarding Flow
```
zip_extracted/20. SONGWRITING SPECIFIC PART/20. COG -- ONBOARDING/1. Onboarding Flow PDFS - with reference images/master_onboarding_flow.pdf
```
Then read all Onboarding screen PDFs (04 through 18) in order.

### PHASE 4 — Song Canvas Features
Read the canvas documents in:
```
zip_extracted/20. SONGWRITING SPECIFIC PART/4. SONG WRITING CANVAS/
```
Start with COG_Product_01 through 14, then the individual feature docs.

### PHASE 5 — Feature Implementation Plans
Read all feature PDFs in:
```
zip_extracted/20. SONGWRITING SPECIFIC PART/3. System operations/
```
Read in feature number order (Feature 04, 05, 07, 08, 09... through 33).

### PHASE 6 — Business Model
Read both PDFs in:
```
zip_extracted/20. SONGWRITING SPECIFIC PART/0.1 Songwriting full payment plan and structure/
```

---

## AFTER ALL DOCUMENTS ARE READ

Once you have read every document and viewed every image, produce the following master outputs:

### OUTPUT 1 — Complete Screen Inventory
A numbered list of every screen in the app with:
- Screen name
- Route path
- Source document(s)
- Primary user action

### OUTPUT 2 — Complete Component Library List
Every reusable component needed, with:
- Component name
- Props/variants
- Which screens it appears on
- Visual spec summary

### OUTPUT 3 — Supabase Schema (final version)
Finalized database tables and columns, informed by what you learned from the docs.

### OUTPUT 4 — Build Priority Queue
Ordered list of what to build first through last, with:
- Feature name
- Dependencies (what must exist before it)
- Estimated complexity (S/M/L/XL)
- Source document reference

### OUTPUT 5 — Design Token File
A complete `src/styles/tokens.css` file with all CSS custom properties for the Colors of Glory design system, ready to drop in.

---

## RULES FOR THIS SESSION

1. **Never build without reading first.** For any screen we start implementing, we MUST have read its source document in this session or a previous one.

2. **Visual mockups are law.** When a PDF spec and a reference image conflict, the image wins. The images show the final approved visual language.

3. **The CLAUDE.md is always right.** If something in a doc contradicts the CLAUDE.md locked decisions (Section 11), flag it as a conflict rather than silently overriding.

4. **Ask before assuming.** If a document is unclear about an interaction or visual, flag it as an open question. Do not invent a solution silently.

5. **Fly4me is dead.** If you encounter fly4me code while navigating the repo, note it for deletion. Do not integrate with it, reference it, or build on top of it.

6. **One document at a time.** Read one document → extract → output → confirm → move to next. Do not skip ahead.

---

## BEFORE WE START — CONFIRM THE FOLLOWING

Before reading any documents, confirm:
- [ ] You have read the project CLAUDE.md
- [ ] You understand the product: one song = one private room, mobile-first, Christian/worship context
- [ ] You understand the visual system: cream background, gold accent, warm serif typography
- [ ] You know the tech stack: React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Supabase + Framer Motion
- [ ] You know that ALL fly4me code is to be removed

Once confirmed, say "Ready. Beginning Phase 1 — Product Vision 01." and start reading.

---

*Session Starter v1.0 · Colors of Glory · 2026-06-02*
