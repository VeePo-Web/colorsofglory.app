interface CogMarkProps {
  size?: number;
  className?: string;
}

const CogMark = ({ size = 32, className }: CogMarkProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cog-aurora" x1="136" y1="526" x2="888" y2="526" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8070C4" />
          <stop offset="0.25" stopColor="#4D8FD2" />
          <stop offset="0.50" stopColor="#53AB8B" />
          <stop offset="0.72" stopColor="#D4AE5C" />
          <stop offset="1" stopColor="#C26A95" />
        </linearGradient>
        <filter id="cog-softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      {/* Glow halos */}
      <path d="M146 528C300 322 724 322 878 528" stroke="#B8953A" strokeOpacity="0.20" strokeWidth="62" strokeLinecap="round" filter="url(#cog-softGlow)" />
      <path d="M146 528C305 705 719 705 878 528" stroke="#B8953A" strokeOpacity="0.16" strokeWidth="50" strokeLinecap="round" filter="url(#cog-softGlow)" />
      {/* Main arcs */}
      <path d="M146 528C305 705 719 705 878 528" stroke="#B8953A" strokeOpacity="0.82" strokeWidth="24" strokeLinecap="round" />
      <path d="M208 520C352 656 672 656 816 520" stroke="#D4AE5C" strokeOpacity="0.46" strokeWidth="8" strokeLinecap="round" />
      <path d="M146 528C300 322 724 322 878 528" stroke="#B8953A" strokeOpacity="0.58" strokeWidth="18" strokeLinecap="round" />
      {/* Aurora color strands */}
      <path d="M168 530C244 405 345 358 454 344" stroke="#8070C4" strokeWidth="22" strokeLinecap="round" />
      <path d="M310 410C408 354 499 334 594 349" stroke="#4D8FD2" strokeWidth="22" strokeLinecap="round" />
      <path d="M436 357C534 325 634 341 724 403" stroke="#53AB8B" strokeWidth="22" strokeLinecap="round" />
      <path d="M594 361C688 380 760 430 828 503" stroke="#D4AE5C" strokeWidth="22" strokeLinecap="round" />
      <path d="M710 422C775 456 827 503 878 528" stroke="#C26A95" strokeWidth="22" strokeLinecap="round" />
      {/* Gold teardrop */}
      <path d="M512 434C546 488 562 529 534 598C526 617 516 634 512 640C508 634 498 617 490 598C462 529 478 488 512 434Z" fill="#B8953A" />
      <path d="M520 472C541 521 530 571 506 600C493 564 478 528 520 472Z" fill="#E15E39" />
      <ellipse cx="512" cy="588" rx="12" ry="14" fill="#1C1A17" fillOpacity="0.62" />
    </svg>
  );
};

export default CogMark;
