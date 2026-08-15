import { useState } from 'react';
import type { ReactNode } from 'react';
import { isMuted, setMuted } from '../game/audio';

/** Global CRT overlay: just the vignette (scanlines removed — read as noise). */
export function CrtOverlays() {
  return <div className="vignette" />;
}

/** Sound toggle pinned to the top-right corner. */
export function MuteButton() {
  const [m, setM] = useState(isMuted());
  return (
    <button
      type="button"
      aria-label={m ? 'Unmute sound' : 'Mute sound'}
      onClick={() => {
        const next = !m;
        setMuted(next);
        setM(next);
      }}
      className="hard-sm btn-press fixed top-3 right-3 z-[90] flex h-10 w-10 items-center justify-center bg-[#2B3A4A] text-[#D8C7A1]"
    >
      {m ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
          <path d="m16 9 6 6M22 9l-6 6" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}

interface PixelButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: 'khaki' | 'brass' | 'red' | 'indigo' | 'sepia';
  pixel?: boolean;
  className?: string;
}

const COLORS: Record<NonNullable<PixelButtonProps['color']>, string> = {
  khaki: 'bg-[#B9A576] text-[#1a2430] hover:bg-[#c9b78c]',
  brass: 'bg-[#9C7A3C] text-[#1a2430] hover:bg-[#b08d49]',
  red: 'bg-[#8C2F2B] text-[#D8C7A1] hover:bg-[#a03a35]',
  indigo: 'bg-[#2B3A4A] text-[#D8C7A1] hover:bg-[#38506a]',
  sepia: 'bg-[#D8C7A1] text-[#1a2430] hover:bg-[#e6d8b8]',
};

export function PixelButton({
  children,
  onClick,
  disabled,
  color = 'khaki',
  pixel = false,
  className = '',
}: PixelButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`hard btn-press px-5 py-2 text-left ${pixel ? 'font-pixel text-xs leading-5 tracking-wide' : 'font-vt text-2xl'} ${COLORS[color]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Small keyboard-hint chip shown on buttons, e.g. [A] on APPROVE. */
export function KeyHint({ k }: { k: string }) {
  return (
    <span className="ml-2 inline-block border-2 border-current px-1 font-vt text-base leading-none opacity-70">
      {k}
    </span>
  );
}

/** Brass name plate, as used for speaker tags and labels. */
export function NamePlate({ children }: { children: ReactNode }) {
  return (
    <span className="hard-sm inline-block bg-[#9C7A3C] px-3 py-0.5 font-vt text-xl tracking-wide text-[#1a2430] uppercase">
      {children}
    </span>
  );
}
