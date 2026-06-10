## Password Hint Addition

Add a hint line below the password input in `PasswordGate.tsx` that reads **"COG x2)"** — styled in muted/warm-gray text as a subtle helper. This is a one-line UI text addition with no logic changes.

### Files to edit
- `src/components/PasswordGate.tsx` — insert hint text below the `<input>`

### Visual placement
````text
Password
[        input        ]
COG x2)    ← new hint
[    Enter button    ]
````

### Styling
- Use the existing `var(--cog-warm-gray)` or `var(--cog-muted)` color token
- Small label size (`text-xs`), centered, no new CSS variables needed