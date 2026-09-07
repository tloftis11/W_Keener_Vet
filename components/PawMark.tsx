export default function PawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="6.5" cy="9.3" rx="2" ry="2.6" />
      <ellipse cx="12" cy="6.3" rx="2.1" ry="2.8" />
      <ellipse cx="17.5" cy="9.3" rx="2" ry="2.6" />
      <path d="M12 11.6c-3.6 0-6.3 2.5-6.3 5.3 0 1.7 1.5 2.7 3.1 2.1.9-.3 2-.6 3.2-.6s2.3.3 3.2.6c1.6.6 3.1-.4 3.1-2.1 0-2.8-2.7-5.3-6.3-5.3z" />
    </svg>
  );
}
