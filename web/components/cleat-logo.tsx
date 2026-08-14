type CleatLogoProps = {
  size?: number;
  className?: string;
};

/** Deck cleat. Two horns, a throat. Holds the line. */
export function CleatLogo({ size = 32, className }: CleatLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11 8.5a4.5 4.5 0 0 1 4.2 4.5h1.6A4.5 4.5 0 0 1 21 8.5a4.5 4.5 0 0 1 4.5 4.5v3.2A3.3 3.3 0 0 1 22.2 19.5h-3.4L16 17.4l-2.8 2.1H9.8A3.3 3.3 0 0 1 6.5 16.2V13A4.5 4.5 0 0 1 11 8.5Z" />
    </svg>
  );
}
