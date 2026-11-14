// Feature card icons — clean inline SVG (Lucide-style, MIT) stroked with the
// site's indigo→purple gradient, replacing the mixed emoji glyphs (⚡🔧📦🧩📝🖼️)
// that rendered with inconsistent colour/style across the 核心特性 cards.
import React from "react";

// Shared gradient definition, rendered once and referenced by all icons via
// fill/stroke="url(#nsbp-feature-icon-grad)".
export const FeatureIconGradient = () => (
  <svg
    width="0"
    height="0"
    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      {/* gradientUnits="userSpaceOnUse" + 0..24 coords: each icon's viewBox is
          0 0 24 24, so the gradient spans the whole icon. objectBoundingBox
          (the default) FAILS to paint on degenerate-bbox elements — e.g. the
          perfectly axis-aligned <line>s of the sliders icon (zero width OR
          height) — because their bounding box has no area, so the gradient is
          undefined and the stroke renders nothing. userSpaceOnUse is evaluated
          in the icon's user coordinate system, so it paints every element. */}
      <linearGradient
        id="nsbp-feature-icon-grad"
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="0"
        x2="24"
        y2="24"
      >
        <stop offset="0%" stopColor="#667eea" />
        <stop offset="100%" stopColor="#764ba2" />
      </linearGradient>
    </defs>
  </svg>
);

type IconProps = { size?: number };

const Svg = ({
  size = 44,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="url(#nsbp-feature-icon-grad)"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    {children}
  </svg>
);

// 极速服务端渲染 — bolt
export const IconBolt = (p: IconProps) => (
  <Svg {...p}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Svg>
);

// Lume C 引擎做前端 — cog / settings
export const IconCog = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

// FastCGI relay SSR — network (nodes + links)
export const IconNetwork = (p: IconProps) => (
  <Svg {...p}>
    <rect x="16" y="16" width="6" height="6" rx="1" />
    <rect x="2" y="16" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
    <path d="M12 12V8" />
  </Svg>
);

// React 19 原生支持 — atom
export const IconAtom = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="1" />
    <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" />
    <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />
  </Svg>
);

// TypeScript 类型安全 — braces (type-safe code)
export const IconBraces = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
    <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
  </Svg>
);

// 照片数据 + Lume 端点 — image
export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </Svg>
);

// ── Hero 特性卡（Light / Flex / TS / SSR）──────
// 轻量高效 — feather
export const IconFeather = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
    <line x1="16" y1="8" x2="2" y2="22" />
    <line x1="17.5" y1="15" x2="9" y2="15" />
  </Svg>
);

// 灵活配置 — sliders
export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="2" y1="14" x2="6" y2="14" />
    <line x1="10" y1="8" x2="14" y2="8" />
    <line x1="18" y1="16" x2="22" y2="16" />
  </Svg>
);

// 类型安全 — shield-check
export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

// 服务端渲染 — server rack
export const IconServer = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </Svg>
);
