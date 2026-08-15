interface CheckerLogoProps {
  className?: string;
}

/**
 * The project's brand mark — a checker piece.
 *
 * Deliberately kept as hand-written SVG rather than a library icon: it is the
 * app's identity, not a UI affordance. It used to be duplicated byte-for-byte
 * in Header and MainMenu; this is the single definition.
 */
const CheckerLogo = ({ className = 'w-6 h-6 text-white' }: CheckerLogoProps) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Checkers"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
  </svg>
);

export default CheckerLogo;
