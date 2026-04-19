export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="20" cy="22" r="12" fill="var(--ember)" stroke="none" />
      <circle cx="15.5" cy="21" r="3.2" fill="var(--paper)" stroke="none" />
      <circle cx="24.5" cy="21" r="3.2" fill="var(--paper)" stroke="none" />
      <circle cx="15.5" cy="21" r="1.2" fill="var(--ink)" stroke="none" />
      <circle cx="24.5" cy="21" r="1.2" fill="var(--ink)" stroke="none" />
      <path d="M11 14c0 2 1.2 3 3 3M29 14c0 2-1.2 3-3 3" stroke="var(--ink)" />
      <path d="M20 25l-1.2 1.5L20 28l1.2-1.5z" fill="var(--ink)" stroke="none" />
    </svg>
  );
}
