import { useState, useEffect } from "react";
import { X } from "lucide-react";

const LS_DISMISSED_KEY = 'cog:photo-banner-dismissed';

/**
 * Dismissable "Add a profile photo" banner.
 * Appears once per session at the top of the lyrics view for users without avatars.
 * Persists dismissal to localStorage — never shows again after dismissed.
 */
const PhotoBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(LS_DISMISSED_KEY)) return;
    // Delay slightly so other entrance animations settle first
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(LS_DISMISSED_KEY, '1');
  };

  const handleAddPhoto = () => {
    // Lovable wires the actual photo picker to Supabase storage
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        backgroundColor: 'rgba(181,147,90,0.07)',
        borderBottom: '1px solid rgba(181,147,90,0.15)',
        transition: 'opacity 250ms ease',
      }}
      role="banner"
      aria-label="Add profile photo"
    >
      {/* Avatar placeholder */}
      <div
        className="rounded-full flex-shrink-0 flex items-center justify-center"
        style={{
          width: 28,
          height: 28,
          border: '1.5px dashed rgba(181,147,90,0.50)',
          backgroundColor: 'rgba(181,147,90,0.06)',
        }}
        aria-hidden="true"
      >
        <span className="text-[0.625rem]" style={{ color: '#B5935A' }}>○</span>
      </div>

      {/* Text */}
      <button
        onClick={handleAddPhoto}
        className="flex-1 text-left text-[0.8125rem] transition-opacity hover:opacity-70"
        style={{ color: '#666', fontFamily: 'var(--font-body)' }}
      >
        Add a photo so your collaborators recognize you{' '}
        <span style={{ color: '#B5935A' }}>→</span>
      </button>

      {/* Dismiss X */}
      <button
        onClick={dismiss}
        className="flex-shrink-0 transition-opacity hover:opacity-60 active:scale-90 p-1"
        aria-label="Dismiss"
        style={{ minWidth: 28, minHeight: 28, color: '#999' }}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
};

export default PhotoBanner;
