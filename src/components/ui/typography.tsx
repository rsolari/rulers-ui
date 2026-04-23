import Image from 'next/image';
import { type HTMLAttributes } from 'react';

export function Eyebrow({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`font-display text-[11px] font-medium uppercase tracking-[0.22em] text-ink-400 ${className}`}
      {...props}
    />
  );
}

export function Lede({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`font-body italic text-[1.25rem] leading-relaxed text-ink-400 ${className}`}
      {...props}
    />
  );
}

interface FleurDividerProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  tone?: 'default' | 'light';
}

export function FleurDivider({
  className = '',
  size = 22,
  tone = 'default',
  ...props
}: FleurDividerProps) {
  const toneClass = tone === 'light' ? 'fleur-divider--light' : '';
  return (
    <div aria-hidden className={`fleur-divider ${toneClass} ${className}`} {...props}>
      <Image
        src="/icons/fleur.svg"
        alt=""
        width={size}
        height={size}
        className="[filter:brightness(0)_saturate(100%)_invert(78%)_sepia(47%)_saturate(635%)_hue-rotate(3deg)_brightness(95%)_contrast(90%)]"
      />
    </div>
  );
}
