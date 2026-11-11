import React, { type ReactNode } from "react";

/**
 * The water backdrop for the documentation site. Decorative only: it sits
 * behind the layout, ignores pointer events, and stops with reduced motion.
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="docs-sea" aria-hidden="true">
        <svg
          className="docs-sea__wave docs-sea__wave--far"
          viewBox="0 0 2880 320"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M0 150 C 240 96 480 204 720 150 C 960 96 1200 204 1440 150 C 1680 96 1920 204 2160 150 C 2400 96 2640 204 2880 150 L 2880 320 L 0 320 Z" />
        </svg>
        <svg
          className="docs-sea__wave docs-sea__wave--mid"
          viewBox="0 0 2880 320"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M0 170 C 240 126 480 214 720 170 C 960 126 1200 214 1440 170 C 1680 126 1920 214 2160 170 C 2400 126 2640 214 2880 170 L 2880 320 L 0 320 Z" />
        </svg>
        <svg
          className="docs-sea__wave docs-sea__wave--near"
          viewBox="0 0 2880 320"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M0 190 C 240 156 480 224 720 190 C 960 156 1200 224 1440 190 C 1680 156 1920 224 2160 190 C 2400 156 2640 224 2880 190 L 2880 320 L 0 320 Z" />
        </svg>
      </div>
    </>
  );
}
