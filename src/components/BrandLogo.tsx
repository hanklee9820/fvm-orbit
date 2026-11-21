import { useEffect, useId, useState } from "react";
import { useFvmStore } from "../store/useFvmStore";

interface BrandLogoProps {
  className?: string;
}

function getEffectiveTheme(theme: "system" | "light" | "dark"): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

/**
 * Transparent, theme-adaptive FVM Orbit SVG mark for the in-app TitleBar.
 * Colors are driven by `--logo-*` CSS custom properties in `src/index.css`
 * (`:root` for dark mode, `:root[data-theme="light"]` for light mode), with
 * theme-keyed gradient IDs so macOS WKWebView repaints gradients immediately on toggle.
 */
export function BrandLogo({ className = "w-6 h-6" }: BrandLogoProps) {
  const theme = useFvmStore((s) => s.theme);
  const [effective, setEffective] = useState<"light" | "dark">(() => getEffectiveTheme(theme));

  useEffect(() => {
    setEffective(getEffectiveTheme(theme));
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setEffective(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const uid = `${useId().replace(/:/g, "")}-${effective}`;
  const upperId = `fvm-upper-${uid}`;
  const lowerId = `fvm-lower-${uid}`;
  const cyanId = `fvm-cyan-${uid}`;
  const arcId = `fvm-arc-${uid}`;
  const clipId = `fvm-chev-${uid}`;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={upperId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--logo-chev-upper-start)" }} />
          <stop offset="100%" style={{ stopColor: "var(--logo-chev-upper-end)" }} />
        </linearGradient>
        <linearGradient id={lowerId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--logo-chev-lower-start)" }} />
          <stop offset="100%" style={{ stopColor: "var(--logo-chev-lower-end)" }} />
        </linearGradient>
        <linearGradient id={cyanId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--logo-cursor-start)" }} />
          <stop offset="100%" style={{ stopColor: "var(--logo-cursor-end)" }} />
        </linearGradient>
        <linearGradient id={arcId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop
            offset="0%"
            style={{ stopColor: "var(--logo-orbit-start)", stopOpacity: 0.14 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "var(--logo-orbit-end)", stopOpacity: 0.92 }}
          />
        </linearGradient>
        <clipPath id={clipId}>
          <path d="M8.5,13L2.47,7H6.71L11.67,11.95C12.25,12.54 12.25,13.5 11.67,14.07L6.74,19H2.5L8.5,13Z" />
        </clipPath>
      </defs>

      {/* Optically centered background-free FVM >_ mark + Orbit arc & satellite node */}
      <g transform="translate(0.25, -0.75)">
        {/* Subtle orbital trail sweeping into the top-right cyan satellite node */}
        <path
          d="M9.6,10.2 Q14.3,6.1 18.8,7.8"
          stroke={`url(#${arcId})`}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <circle cx="18.8" cy="7.8" r="1.65" style={{ fill: "var(--logo-node)" }} />

        {/* Official FVM > chevron with 45° folded-ribbon shading */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d="M8.5,13L2.47,7H6.71L11.67,11.95C12.25,12.54 12.25,13.5 11.67,14.07L6.74,19H2.5L8.5,13Z"
            fill={`url(#${lowerId})`}
          />
          <polygon
            points="8.5,13.0 10.62,15.12 9.15,16.59 7.03,14.47"
            style={{ fill: "var(--logo-crease)" }}
          />
          <path
            d="M2.0,6.5 L7.2,6.5 L12.6,11.9 L12.6,14.5 L10.62,15.12 L8.5,13.0 Z"
            fill={`url(#${upperId})`}
          />
        </g>

        {/* Active Flutter-cyan underscore cursor bar */}
        <rect x="13" y="16" width="8" height="3" rx="0.55" fill={`url(#${cyanId})`} />
      </g>
    </svg>
  );
}
