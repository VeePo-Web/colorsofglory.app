# Handoff — `…` Contextual Card Menu (Pattern 7)

_Owner: Claude. No backend changes._

## Rule
Every card surface shows ONE primary action (the card tap) + content. All secondary actions live behind a `…` (DotsHorizontal) trigger in the top-right corner. 32×32 hit area minimum.

## Reusable component
`src/components/cog/CardMenu.tsx`
```tsx
type MenuItem = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  group?: number;       // dividers inserted between groups
  destructive?: boolean;
  disabled?: boolean;
};

<CardMenu triggerLabel="More actions for Sunday afternoon" items={items} />
```
- Built on shadcn `DropdownMenu`.
- Anchored top-right of the card; fade+scale-in 150ms (`--cog-ease`).
- Items sorted by `group` then array order. Destructive items render in `--destructive` color, always last.
- Keyboard: Tab to trigger, Enter opens, arrows navigate, Esc closes, focus returns to trigger.
- `aria-label` on trigger MUST be specific: "More actions for <name>".

## Canonical vocabulary (use these exact labels)

| Card | Primary (tap) | `…` menu |
|---|---|---|
| Song card (catalog) | Open workspace | Rename · Duplicate · Invite collaborator · Notification prefs · Archive |
| Take row | Play inline | Use this take · Rename · Move to section · Download · Archive |
| Voice memo card | Open takes drawer | Rename · Link to section · Re-record · Archive |
| Lyric line | Edit | Add chord · Add note · Suggest change · Link voice memo · Remove |
| Collaborator row | Open profile | Change role · Resend invite · Remove from song |
| Activity row | Jump to source | Mark as read · Mute this kind |
| Note card | Edit | Pin to top · Convert to lyric · Convert to scripture · Archive |
| Capture (idea) row | Open detail | Move to song · Rename · Convert to lyric · Convert to voice memo · Archive |

## Anti-patterns
- Never put more than ONE visible button on a card besides the menu trigger.
- Never expose Delete; use Archive everywhere except for the user's own pending captures.
- No icon-only secondary actions outside the menu.