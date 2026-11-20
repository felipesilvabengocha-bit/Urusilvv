import React from 'react';
import { Palette, User } from 'lucide-react';

interface CreditsFooterProps {
  variant?: 'dark' | 'cream';
  compact?: boolean;
}

export const CreditsFooter: React.FC<CreditsFooterProps> = ({ variant = 'dark', compact = false }) => {
  const isDark = variant === 'dark';

  return (
    <footer
      className={`w-full ${
        isDark
          ? 'border-t border-[#574239]/35 bg-[#0A0F10]/95 text-[#CDC6B8]'
          : 'border-t border-[#DDD2BE] bg-[#FAF6EE] text-[#4F5658]'
      } ${compact ? 'px-4 py-3' : 'px-4 py-5 sm:px-6'}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <div
          className={`inline-flex flex-wrap items-center justify-center gap-3 rounded-full border px-4 py-1.5 font-mono-data text-[11px] font-medium tracking-wider shadow-xs ${
            isDark
              ? 'border-[#574239]/55 bg-[#171C1D] text-[#E9E2D4]'
              : 'border-[#DDD2BE] bg-[#F3EBDD] text-[#252A2B]'
          }`}
        >
          <a
            href="https://www.instagram.com/felisilvv/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition hover:text-[#FFB691] hover:underline"
          >
            <User className="h-3 w-3 text-[#E87532]" />
            <span>
              IG: <strong className="text-[#E87532]">@felisilvv</strong>
            </span>
          </a>
          <span aria-hidden="true" className={isDark ? 'text-[#574239]' : 'text-[#C8BCA6]'}>
            •
          </span>
          <a
            href="https://www.instagram.com/silvvdesign/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition hover:text-[#ACCEBF] hover:underline"
          >
            <Palette className="h-3 w-3 text-[#ACCEBF]" />
            <span>
              DISEÑO: <strong className={isDark ? 'text-[#ACCEBF]' : 'text-[#3D584D]'}>@silvvdesign</strong>
            </span>
          </a>
        </div>

        <span
          className={`font-display text-[11px] italic tracking-normal ${
            isDark ? 'text-[#CDC6B8]/65' : 'text-[#5E6567]'
          }`}
        >
          República Oriental del Uruguay · El Despacho Republicano
        </span>
      </div>
    </footer>
  );
};
