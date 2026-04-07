'use client';

interface TerritoryLabelProps {
  x: number;
  y: number;
  name: string;
}

export function TerritoryLabel({ x, y, name }: TerritoryLabelProps) {
  const words = name.split(' ');
  const lines = words.length > 2
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [name];

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily="'Cinzel', serif"
      fontSize="10"
      fontWeight="700"
      fill="#3a2a1e"
      stroke="rgba(253, 248, 240, 0.75)"
      strokeWidth="2.4"
      paintOrder="stroke"
      pointerEvents="none"
    >
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : 11}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
