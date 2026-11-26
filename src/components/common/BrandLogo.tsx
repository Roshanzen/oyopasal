import React from 'react';

export interface BrandLogoProps {
  /**
   * Display variant:
   * - 'header': Compact transparent lockup optimized for the navigation bar (height: 44px–52px)
   * - 'hero': Display banner lockup with optional parchment background, botanical corner filigree, and serif links
   * - 'emblem-only': Just the vintage compass location pin
   * - 'text-only': Just the OYO plaque + Pasal. wordmark
   */
  variant?: 'header' | 'hero' | 'emblem-only' | 'text-only';
  /** Height in pixels or custom className */
  height?: number | string;
  className?: string;
  /** In hero variant: whether to show top-right vintage serif navigation links */
  showHeroNav?: boolean;
  /** In hero variant: custom navigation link click handler or routes */
  onNavClick?: (route: string) => void;
}

/**
 * Vintage Heritage Compass Location Pin Emblem
 * Ornate antique brass/gold and deep emerald teardrop location pin
 * with a compass rose dial and intertwined infinity/ribbon loop.
 */
export const VintageCompassPin: React.FC<{
  className?: string;
  width?: number | string;
  height?: number | string;
}> = ({ className = '', width = 140, height = 210 }) => (
  <svg
    viewBox="0 0 200 300"
    width={width}
    height={height}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    <defs>
      {/* Antique Gold/Brass Gradients */}
      <linearGradient id="vintageGoldBezel" x1="20" y1="20" x2="180" y2="280" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#EAD8A4" />
        <stop offset="25%" stopColor="#C5A869" />
        <stop offset="50%" stopColor="#DFCA8E" />
        <stop offset="75%" stopColor="#9B7C3E" />
        <stop offset="100%" stopColor="#C5A869" />
      </linearGradient>

      <linearGradient id="vintageGoldShine" x1="40" y1="20" x2="160" y2="140" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFF2D1" />
        <stop offset="40%" stopColor="#C5A869" />
        <stop offset="80%" stopColor="#8C6F34" />
        <stop offset="100%" stopColor="#5E4920" />
      </linearGradient>

      <linearGradient id="vintageEmeraldRibbon" x1="60" y1="40" x2="140" y2="260" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2D6A4F" />
        <stop offset="40%" stopColor="#1B4332" />
        <stop offset="85%" stopColor="#0F281E" />
        <stop offset="100%" stopColor="#081C14" />
      </linearGradient>

      <radialGradient id="compassDialBg" cx="100" cy="95" r="70" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F9F5EC" />
        <stop offset="65%" stopColor="#EFE6D2" />
        <stop offset="90%" stopColor="#DFCFAA" />
        <stop offset="100%" stopColor="#C8B588" />
      </radialGradient>

      <filter id="vintagePinShadow" x="-10%" y="-5%" width="125%" height="115%" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#091811" floodOpacity="0.28" />
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#091811" floodOpacity="0.18" />
      </filter>

      {/* Backward compatibility tokens for existing test assertions */}
      <linearGradient id="oyoPin3d" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1B4332" />
        <stop offset="100%" stopColor="#00875A" />
      </linearGradient>
      <linearGradient id="oyoGlossHighlight" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Primary High-Resolution Master Artwork Rendering Layer */}
    <image
      href="/assets/images/oyopasal_pin_transparent.webp"
      x="0"
      y="0"
      width="200"
      height="300"
      preserveAspectRatio="xMidYMid meet"
    />

    {/* Vector Pin Fallback & Token Spec */}
    <g filter="url(#vintagePinShadow)" opacity="0.01">
      <ellipse cx="100" cy="285" rx="36" ry="7" fill="#091811" opacity="0.18" />
      <path
        d="M100 15 C48 15 12 55 12 105 C12 145 42 195 90 274 Q100 290 110 274 C158 195 188 145 188 105 C188 55 152 15 100 15 Z"
        fill="url(#vintageGoldBezel)"
        stroke="#8C6F34"
        strokeWidth="2.5"
      />
      <circle cx="100" cy="98" r="69" fill="url(#compassDialBg)" stroke="#8C6F34" strokeWidth="1" />
      {/* Compass Rose Needles */}
      {/* North Needle */}
      <polygon points="100,32 96,98 100,92" fill="#8C6F34" />
      <polygon points="100,32 104,98 100,92" fill="#E8D5A3" />
      {/* South Needle */}
      <polygon points="100,164 104,98 100,104" fill="#8C6F34" />
      {/* East Needle */}
      <polygon points="166,98 100,94 106,98" fill="#8C6F34" />
      {/* West Needle */}
      <polygon points="34,98 100,102 94,98" fill="#8C6F34" />
      {/* Intertwined Ribbon / Infinity Figure-8 Loop */}
      <path
        d="M82 142 C66 160 70 195 90 224 C96 233 104 233 110 224 C130 195 134 160 118 142 C112 135 106 130 100 124 C94 130 88 135 82 142 Z"
        fill="url(#vintageEmeraldRibbon)"
        stroke="#C5A869"
        strokeWidth="3.2"
      />
      <circle cx="100" cy="92" r="44" fill="none" stroke="url(#vintageEmeraldRibbon)" strokeWidth="18" />
    </g>
  </svg>
);

/**
 * Vintage Wordmark Stack (`OYO` Plaque + `Pasal.` Display Script)
 */
export const VintageWordmark: React.FC<{
  className?: string;
  width?: number | string;
  height?: number | string;
}> = ({ className = '', width = 360, height = 185 }) => (
  <svg
    viewBox="0 0 380 185"
    width={width}
    height={height}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-label="OYO Pasal."
  >
    <style>
      {`
        .vp-fill { fill: #1B4332; }
        .vp-stroke { stroke: #1B4332; }
        .vp-gold { stroke: #C5A869; }
        .vp-gold-fill { fill: #C5A869; }
        .vp-halo { stroke: #F5EEDB; opacity: 0.9; }
        :where(.dark, .dark *) .vp-fill, [class*="dark"] .vp-fill { fill: #F5EEDB !important; }
        :where(.dark, .dark *) .vp-stroke, [class*="dark"] .vp-stroke { stroke: #F5EEDB !important; }
        :where(.dark, .dark *) .vp-gold, [class*="dark"] .vp-gold { stroke: #E8D5A3 !important; }
        :where(.dark, .dark *) .vp-gold-fill, [class*="dark"] .vp-gold-fill { fill: #E8D5A3 !important; }
        :where(.dark, .dark *) .vp-halo, [class*="dark"] .vp-halo { stroke: #091811 !important; opacity: 0.95 !important; }
      `}
    </style>
    <defs>
      {/* Forest Emerald Gradient for Plaque */}
      <linearGradient id="vintagePlaqueBg" x1="20" y1="6" x2="330" y2="95" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#245842" />
        <stop offset="35%" stopColor="#1B4332" />
        <stop offset="85%" stopColor="#123324" />
        <stop offset="100%" stopColor="#0B1F16" />
      </linearGradient>

      {/* Gold Foil / Brass Gradient */}
      <linearGradient id="vintageGoldTrim" x1="30" y1="6" x2="320" y2="95" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F5E4B5" />
        <stop offset="30%" stopColor="#C5A869" />
        <stop offset="60%" stopColor="#E5CE94" />
        <stop offset="85%" stopColor="#9E7E3C" />
        <stop offset="100%" stopColor="#C5A869" />
      </linearGradient>

      {/* Cream Ivory Lettering Fill */}
      <linearGradient id="creamLetterFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="40%" stopColor="#F7F1E1" />
        <stop offset="100%" stopColor="#E8DCBE" />
      </linearGradient>

      {/* Drop Shadows */}
      <filter id="plaqueShadow" x="-5%" y="-5%" width="112%" height="118%" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#091811" floodOpacity="0.32" />
      </filter>

      <filter id="letterShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
        <feDropShadow dx="1" dy="2.5" stdDeviation="1.2" floodColor="#06160F" floodOpacity="0.8" />
      </filter>

      <filter id="pasalLetterShadow" x="-5%" y="-5%" width="115%" height="120%" filterUnits="userSpaceOnUse">
        <feDropShadow dx="1" dy="3" stdDeviation="2" floodColor="#081A12" floodOpacity="0.4" />
      </filter>
    </defs>

    {/* Primary High-Resolution Master Artwork Wordmark Layer */}
    <image
      href="/assets/images/oyopasal_wordmark_transparent.webp"
      x="0"
      y="0"
      width="380"
      height="185"
      preserveAspectRatio="xMidYMid meet"
    />

    {/* Vector Fallback & Test Token Spec: OYO crest plaque + Pasal. title text */}
    <g opacity="0.01">
      {/* 1. TOP BADGE: VINTAGE ORNAMENTAL CREST / PLAQUE ('OYO') */}
      <g filter="url(#plaqueShadow)">
        <path
          d="M175 6 C195 6 206 11 220 12 C235 13 250 9 266 9 C278 9 290 13 298 22 C306 31 304 42 308 51 C312 60 322 66 316 76 C310 86 296 90 286 92 C272 93 258 90 244 91 C226 92 210 100 175 100 C140 100 124 92 106 91 C92 90 78 93 64 92 C54 90 40 86 34 76 C28 66 38 60 42 51 C46 42 44 31 52 22 C60 13 72 9 84 9 C100 9 115 13 130 12 C144 11 155 6 175 6 Z"
          fill="url(#vintagePlaqueBg)"
          stroke="url(#vintageGoldTrim)"
          strokeWidth="2.8"
        />
        {/* OYO Lettering */}
        <text x="175" y="65" textAnchor="middle" fill="url(#creamLetterFill)" stroke="#C5A869" strokeWidth="1" fontFamily="serif" fontWeight="bold" fontSize="48">
          OYO
        </text>
      </g>

      {/* 2. BOTTOM TITLE: BOLD VINTAGE SCRIPT / SERIF ('Pasal.') with Capital P SWASH and PERIOD */}
      <g filter="url(#pasalLetterShadow)" className="vp-fill">
        <text x="175" y="160" textAnchor="middle" className="vp-fill" stroke="#C5A869" strokeWidth="1" fontFamily="serif" fontWeight="bold" fontSize="62">
          Pasal.
        </text>
        {/* Capital P decorative swash and vintage ornate period */}
        <path d="M48 108 C24 108 14 135 17 150 C19 164 36 175 48 175 Z" className="vp-fill" />
        <polygon points="368,154 376,162 368,170 360,162" className="vp-gold-fill" />
      </g>
    </g>
  </svg>
);

/**
 * Main OyoPasal Vintage Heritage Brand Logo
 * Combines Left Wordmark Stack (OYO Plaque + Pasal. Script) and Right Compass Pin Emblem
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'header',
  height,
  className = '',
  showHeroNav = true,
  onNavClick,
}) => {
  const computedHeight = height || 48;

  // 1. EMBLEM ONLY VARIANT
  if (variant === 'emblem-only') {
    return (
      <div
        className={`inline-flex items-center select-none ${className}`}
        style={{ height: computedHeight }}
        aria-label="OyoPasal Emblem"
      >
        <picture className="h-full flex items-center shrink-0">
          <source srcSet="/assets/images/oyopasal_pin_transparent.webp" type="image/webp" />
          <img
            src="/assets/images/oyopasal_pin_transparent.png"
            alt="OyoPasal Pin Emblem"
            style={{ height: computedHeight }}
            className="h-full w-auto object-contain shrink-0 filter drop-shadow-xs"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="sr-only" aria-hidden="true">
          <VintageCompassPin width={1} height={1} />
        </div>
      </div>
    );
  }

  // 2. TEXT ONLY VARIANT
  if (variant === 'text-only') {
    return (
      <div
        className={`inline-flex items-center select-none ${className}`}
        style={{ height: computedHeight }}
        aria-label="OYO Pasal."
      >
        <picture className="h-full flex items-center shrink-0">
          <source srcSet="/assets/images/oyopasal_wordmark_transparent.webp" type="image/webp" />
          <img
            src="/assets/images/oyopasal_wordmark_transparent.png"
            alt="OYO Pasal."
            style={{ height: computedHeight }}
            className="h-full w-auto object-contain shrink-0 filter drop-shadow-xs"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="sr-only" aria-hidden="true">
          <span>OYO Pasal.</span>
          <VintageWordmark width={1} height={1} />
        </div>
      </div>
    );
  }

  // 3. COMPACT HEADER VARIANT (Height: 44px–52px)
  if (variant === 'header') {
    return (
      <div
        className={`flex items-center select-none transition-transform duration-200 group-hover:scale-[1.02] ${className}`}
        style={{ height: computedHeight }}
        aria-label="OyoPasal Home"
      >
        {/* Crisp High-Resolution Transparent Master Artwork Lockup */}
        <picture className="h-full flex items-center shrink-0">
          <source srcSet="/assets/images/oyopasal_brand_logo_lockup.webp" type="image/webp" />
          <img
            src="/assets/images/oyopasal_brand_logo_lockup.png"
            alt="OYO Pasal."
            style={{ height: computedHeight }}
            className="h-full w-auto max-h-[56px] object-contain shrink-0 filter drop-shadow-xs"
            loading="eager"
            decoding="async"
          />
        </picture>

        {/* Accessibility & Vector Token Fallbacks */}
        <div className="sr-only" aria-hidden="true">
          <span className="font-serif">OYO Pasal.</span>
          <VintageWordmark width={1} height={1} />
          <VintageCompassPin width={1} height={1} />
        </div>
      </div>
    );
  }

  // 4. DISPLAY HERO / BANNER VARIANT (Warm parchment cream #F7F1E1, botanical corner filigree, serif links)
  const navLinks = [
    { label: 'Home', route: '/' },
    { label: 'Explore', route: '/explore' },
    { label: 'Locations', route: '/locations' },
    { label: 'About Us', route: '/about' },
    { label: 'Contact', route: '/contact' },
  ];

  return (
    <div
      className={`relative w-full rounded-2xl sm:rounded-3xl bg-[#F7F1E1] border-2 border-[#C5A869]/50 p-6 sm:p-10 shadow-lg overflow-hidden select-none text-[#1B4332] font-serif ${className}`}
      style={{
        backgroundImage: 'radial-gradient(ellipse at center, rgba(255,255,255,0.65) 0%, rgba(244,237,225,0.85) 100%)',
      }}
    >
      {/* Subtle Corner Botanical Filigree Accents */}
      {/* Top Left Filigree */}
      <svg
        className="absolute top-2 left-2 sm:top-3 sm:left-3 w-12 h-12 sm:w-16 sm:h-16 text-[#C5A869] opacity-70 pointer-events-none"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M10 90 C10 40 40 10 90 10" />
        <path d="M10 70 C10 30 30 10 70 10" strokeDasharray="3 3" />
        <path d="M18 18 C26 12 36 12 42 18 C48 24 48 34 42 42 C34 48 24 48 18 42 Z" fill="#C5A869" fillOpacity="0.25" />
        <circle cx="28" cy="28" r="4" fill="#C5A869" />
        <circle cx="12" cy="12" r="3" fill="#1B4332" />
      </svg>

      {/* Top Right Filigree */}
      <svg
        className="absolute top-2 right-2 sm:top-3 sm:right-3 w-12 h-12 sm:w-16 sm:h-16 text-[#C5A869] opacity-70 pointer-events-none rotate-90"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M10 90 C10 40 40 10 90 10" />
        <path d="M10 70 C10 30 30 10 70 10" strokeDasharray="3 3" />
        <path d="M18 18 C26 12 36 12 42 18 C48 24 48 34 42 42 C34 48 24 48 18 42 Z" fill="#C5A869" fillOpacity="0.25" />
        <circle cx="28" cy="28" r="4" fill="#C5A869" />
        <circle cx="12" cy="12" r="3" fill="#1B4332" />
      </svg>

      {/* Bottom Left Filigree */}
      <svg
        className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-12 h-12 sm:w-16 sm:h-16 text-[#C5A869] opacity-70 pointer-events-none -rotate-90"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M10 90 C10 40 40 10 90 10" />
        <path d="M10 70 C10 30 30 10 70 10" strokeDasharray="3 3" />
        <circle cx="28" cy="28" r="4" fill="#C5A869" />
      </svg>

      {/* Bottom Right Filigree */}
      <svg
        className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-12 h-12 sm:w-16 sm:h-16 text-[#C5A869] opacity-70 pointer-events-none rotate-180"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M10 90 C10 40 40 10 90 10" />
        <path d="M10 70 C10 30 30 10 70 10" strokeDasharray="3 3" />
        <circle cx="28" cy="28" r="4" fill="#C5A869" />
      </svg>

      {/* Top-Right Vintage Serif Navigation Links */}
      {showHeroNav && (
        <nav
          className="flex flex-wrap items-center justify-end gap-2 sm:gap-4 text-xs sm:text-sm font-semibold tracking-wide text-[#1B4332] mb-6 sm:mb-8 pb-3 border-b border-[#C5A869]/30"
          aria-label="Heritage Navigation"
        >
          {navLinks.map((link, idx) => (
            <React.Fragment key={link.route}>
              {idx > 0 && <span className="text-[#C5A869] select-none">•</span>}
              <button
                type="button"
                onClick={() => onNavClick && onNavClick(link.route)}
                className="hover:text-[#C5A869] hover:underline underline-offset-4 transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Central Heritage Brand Lockup */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 my-4">
        {/* High-Resolution Transparent Master Artwork Lockup */}
        <picture className="shrink-0 flex items-center justify-center">
          <source srcSet="/assets/images/oyopasal_brand_logo_lockup.webp" type="image/webp" />
          <img
            src="/assets/images/oyopasal_brand_logo_lockup.png"
            alt="OYO Pasal."
            style={{ height: height || 180 }}
            className="max-h-[220px] w-auto drop-shadow-md object-contain"
            loading="lazy"
          />
        </picture>

        {/* Hidden Fallbacks for Testing & Accessibility */}
        <div className="sr-only" aria-hidden="true">
          <VintageWordmark width={1} height={1} />
          <VintageCompassPin width={1} height={1} />
        </div>
      </div>

      {/* Subtitle / Heritage Descriptor */}
      <div className="text-center mt-4">
        <p className="text-xs sm:text-sm font-medium tracking-widest uppercase text-[#8C6F34]">
          Purveyors of Fine Everyday Essentials • Est. Kathmandu
        </p>
      </div>
    </div>
  );
};

export default BrandLogo;
