# THE GOLDEN PATH — Colors of Glory's worldclass flow
### From a hum in your head to a song your people can hear

The design grammar of the whole app is the pattern the guided capture rail proved:
**one card at a time · every card skippable · the take already safe · it ends in where it lives.**
These diagrams are the contract — every surface either follows this grammar or has a reason.

The three laws every arrow obeys:
1. **Momentum** — finishing any step presents the next most-likely step, one tap away. No dead stops.
2. **One bold thing** — at any moment, one dominant piece of information (gold = the one primary act).
3. **The 8-year-old test** — every fork is guessable by a child; every tap does what it looks like.

---

## D1 · The whole journey — spark → shape → room → song → door → return

```mermaid
flowchart TD

subgraph SPARK["🎤 THE SPARK — capture, untouchable: it works"]
  A1(["Open mic — one tap, already recording"]) --> A2["Take SAFE on device<br/><i>before any question is asked</i>"]
end

subgraph SHAPE["🃏 THE SHAPE — the guided rail (the beloved pattern)"]
  B1["Card 1 · The words<br/><i>skippable · knows what you spoke</i>"]
  B2["Card 2 · Which part?<br/>Verse · Chorus · Bridge · Tag · Intro<br/><i>heard parts show as done — can't duplicate</i>"]
  B3["Card 3 · The chords<br/>tap the KEY → tap its own six chords<br/><i>typing stays as the fallback</i>"]
  B4["Card 4 · Where does it live?"]
  B1 -->|"add / skip"| B2 -->|"tap / skip"| B3 -->|"build / skip"| B4
end

A2 --> B1

subgraph HOME["🏠 THE HOME CHOICE — the last card answers itself"]
  C1{"Captured inside<br/>a song?"}
  C2["Add to THIS song<br/><i>gold — one tap</i>"]
  C3["Pick from MY songs<br/><i>inline list — no second sheet</i>"]
  C4["Keep it loose in my ideas<br/><i>always below, never a trap</i>"]
  C1 -->|yes| C2
  C1 -->|no| C3
  C1 -->|either| C4
end

B4 --> C1

subgraph ROOM["📖 THE ROOM — the Glory Feed (Ideas page)"]
  D1["Your card appears<br/><b>WHO</b> · dot + name in their color<br/><b>WHAT</b> · the content is the one bold"]
  D2(["Tap ▶ — hear it instantly<br/><i>local-first: never waits on a server</i>"])
  D3(["Layer over this — one tap<br/>count-in · guide in your headphones"])
  D4["≡ 2 layers<br/><i>a stack LOOKS stacked at rest</i>"]
  D1 --> D2 --> D3 --> D4
  D4 -->|"open Layers · N"| D5["The stack sheet<br/>mute · volume · tries"]
end

C2 --> D1
C3 --> D1
C4 -.->|"file it later from the shelf"| D1

subgraph SONG["🎵 THE SONG — Final page (listen mode)"]
  E1["→ Final<br/><i>ghost flies · tab pulses · Undo lives in the toast</i>"]
  E2(["HEAR IT — the promote toast's own next step"])
  E3["The set list — tap ANY part,<br/>the song plays from there"]
  E4["Read-along: the sounding part<br/>opens its words in serif"]
  E5{"The song finishes"}
  E6(["Play it again"])
  E7(["Keep shaping in Ideas"])
  E1 --> E2 --> E3 --> E4 --> E5
  E5 --> E6
  E5 --> E7
end

D1 -->|"swipe right or → Final"| E1
E7 --> D1

subgraph DOOR["🚪 THE DOOR — many hands, one song (Lane B)"]
  F1(["Invite — one chip in the header"])
  F2["They land INSIDE the song<br/>phone-first, least friction"]
  F3["The room announces:<br/>“Sarah added a layer on ‘Morning hum’”<br/>→ See it, one tap"]
  F1 --> F2 --> F3
end

E2 -.->|"someone should hear this"| F1
F3 --> D2

classDef gold fill:#B8953A,stroke:#8a6f2b,color:#fff,font-weight:bold
classDef sage fill:#7d9471,stroke:#5f7355,color:#fff
classDef safe fill:#FAF7F2,stroke:#B8953A,color:#1C1A17
class A1,D2,D3,E2,E6,E7,F1 gold
class E1,E3,E4 sage
class A2,C4 safe
```

**Why this shape wins:** every subgraph ends by *handing you* to the next one. The rail ends in the
home choice; the home choice ends in the room; the room's cards each carry their own next act;
promoting ends in *hearing*; hearing ends in *playing again or shaping more*; and the door feeds
arrivals straight back into listening. The loop never opens.

---

## D2 · The guided rail — the beloved pattern, exactly

```mermaid
flowchart LR
  S(["STOP tapped —<br/>take already safe"]) --> P["Progress dots · 1 of 4<br/><i>the active dot stretches</i>"]
  P --> W

  subgraph RAIL["One card at a time — mounted alone, 240ms rise"]
    W["<b>The words</b><br/>“Your spoken words are already below —<br/>add more, or skip”"]
    K["<b>Which part?</b><br/>chips: Verse · Chorus · Bridge · Tag · Intro<br/>✓ heard chips are gold + done"]
    H["<b>Chords underneath?</b><br/>KEY chips → that key's six chords →<br/>tap-built progression, tap-out to remove"]
    L{"<b>Where does it live?</b>"}
    W -->|"Add words / Skip"| K
    K -->|"one tap / Skip"| H
    H -->|"Add chords / Skip"| L
    K -->|"◀ Back"| W
    H -->|"◀ Back"| K
    L -->|"◀ Back"| H
  end

  L -->|"in a song: Add to ⟨song⟩ (gold)"| R1(["Committed to the canvas"])
  L -->|"no song: my songs, inline list"| R2(["Filed into the picked song"])
  L -->|"Keep it loose"| R3(["The ideas shelf — shape it any time"])
  X["✕ dismiss at ANY step"] -.-> E["Full editor —<br/>nothing lost, all blocks kept"]

  R1 --> M(["“Saved — Hear it?”<br/>momentum never stops"])
  R2 --> M

  style S fill:#FAF7F2,stroke:#B8953A,color:#1C1A17
  style R1 fill:#B8953A,color:#fff
  style R2 fill:#B8953A,color:#fff
  style M fill:#7d9471,color:#fff
```

**The rules this pattern proves** (apply them anywhere a flow feels confusing):
- The thing is **safe before the first question** — so skipping everything is fearless.
- Each card asks **one question** with one obvious answer-gesture (type / tap a chip / pick a row).
- The rail **already knows** what happened (spoken words acknowledged, heard sections pre-checked) — it never asks as if it wasn't listening.
- The last card is always **"where does it live?"** — and it answers itself (current song → one gold tap; no song → the list is *right there*; loose → always allowed).
- **Back** is real, **Skip** costs nothing, **✕** lands in the full editor, never in loss.

---

## D3 · The safety rails — every failure keeps the idea

```mermaid
flowchart TD
  T(["A take exists — in memory"]) --> D{"What goes wrong?"}
  D -->|"nothing"| OK["Saved → queued → uploaded<br/>card swaps to its real id;<br/>layers follow the rename"]
  D -->|"phone call / backgrounded"| I["Auto-finalized AND written<br/>to the device store IMMEDIATELY<br/><i>(durable before you ever tap Save)</i>"]
  D -->|"network drops"| N["Queued on device —<br/>retries on load AND on reconnect"]
  D -->|"layer's base still uploading"| G["Held back honestly:<br/>“finishing the base take first”<br/>heals + sends itself when the base lands"]
  D -->|"double-tap / triple race"| R["In-flight guard:<br/>one row uploads exactly once"]
  D -->|"demo room (no server)"| L["Lives on-device, plays instantly —<br/>never queued for a server<br/>that will never accept it"]
  I --> OK
  N --> OK
  G --> OK
  R --> OK

  style T fill:#FAF7F2,stroke:#B8953A,color:#1C1A17
  style OK fill:#7d9471,color:#fff
```

---

## Where the grammar is NOT yet applied (the next passes)

| Moment | Today | The rail-grammar version |
|---|---|---|
| **New song creation** | a name dialog | Card 1: hum or type its first spark → Card 2: name it (suggested from the words) → Card 3: who is it for? *(the "for..." dedication)* → lands in the room |
| **Inviting someone** (Lane B) | share sheet | Card 1: who? → Card 2: what can they do? (one human sentence, sane default) → "the door is open" |
| **First open of a song room** | the feed | One welcome card: "This is ⟨song⟩'s room — everything for it stays here" → dissolves into the feed |

*Last updated: 2026-08-10 · The guided rail (`GuidedShapeRail.tsx`) is the reference implementation of this grammar.*
