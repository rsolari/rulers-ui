'use client';

interface RealmFlagProps {
  x: number;
  y: number;
  fill: string;
}

export function RealmFlag({ x, y, fill }: RealmFlagProps) {
  // A small pennant: vertical pole with triangular flag
  const poleTop = y - 10;
  const poleBottom = y + 2;
  const flagTop = poleTop;
  const flagBottom = poleTop + 7;

  return (
    <g pointerEvents="none">
      {/* Pole */}
      <line
        x1={x}
        y1={poleTop}
        x2={x}
        y2={poleBottom}
        stroke="#3a2a1e"
        strokeWidth={1.2}
      />
      {/* Pennant triangle */}
      <polygon
        points={`${x},${flagTop} ${x + 7},${flagTop + 3.5} ${x},${flagBottom}`}
        fill={fill}
        stroke="#3a2a1e"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
    </g>
  );
}
