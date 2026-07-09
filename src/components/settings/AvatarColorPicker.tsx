import { Check } from "lucide-react";

/** The aurora identity palette (tokens.css) + brand gold — hex values as stored in profiles.avatar_color. */
export const AVATAR_COLORS: Array<{ hex: string; name: string }> = [
  { hex: "#B8953A", name: "Gold" },
  { hex: "#53AB8B", name: "Teal" },
  { hex: "#D4AE5C", name: "Light gold" },
  { hex: "#8070C4", name: "Purple" },
  { hex: "#C26A95", name: "Rose" },
];

interface AvatarColorPickerProps {
  value: string | null;
  onChange: (hex: string) => void;
  disabled?: boolean;
}

/**
 * Radio-group swatch row for picking the avatar color.
 * Same palette collaborators already see in avatar stacks across the app.
 */
const AvatarColorPicker = ({ value, onChange, disabled = false }: AvatarColorPickerProps) => (
  <div role="radiogroup" aria-label="Avatar color" className="flex items-center gap-3">
    {AVATAR_COLORS.map((color) => {
      const selected = value?.toLowerCase() === color.hex.toLowerCase();
      return (
        <button
          key={color.hex}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={color.name}
          disabled={disabled}
          onClick={() => onChange(color.hex)}
          className="flex items-center justify-center rounded-full transition-transform duration-150 active:scale-95 disabled:opacity-50"
          style={{
            width: 40,
            height: 40,
            backgroundColor: color.hex,
            border: selected ? "2.5px solid var(--cog-charcoal)" : "2.5px solid transparent",
            boxShadow: selected ? "0 0 0 2px var(--cog-cream)" : "none",
          }}
        >
          {selected && <Check size={16} strokeWidth={3} color="#FFF" aria-hidden="true" />}
        </button>
      );
    })}
  </div>
);

export default AvatarColorPicker;
