"use client";

import { useEffect, useRef } from "react";

interface AutoGrowTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  maxHeight?: number;
}

// Enter sends, Shift+Enter inserts a newline — the height grows with the
// content (up to maxHeight, then scrolls) so a longer symptom description or
// vet reply doesn't get cramped into a single scrolling line.
export default function AutoGrowTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  disabled,
  className,
  maxHeight = 120,
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`resize-none overflow-y-auto ${className ?? ""}`}
    />
  );
}
