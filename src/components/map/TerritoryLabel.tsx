'use client';

interface TerritoryLabelProps {
  x: number;
  y: number;
  name: string;
  realmName: string | null;
}

export function TerritoryLabel({ x, y, name, realmName }: TerritoryLabelProps) {
  const words = name.split(' ');
  const lines = words.length > 2
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [name];

  return (
    <g pointerEvents="none">
      {realmName ? (
        <text
          x={x}
          y={y - 10}
          textAnchor="middle"
          fontFamily="'Cinzel', serif"
          fontSize="7"
          fontWeight="600"
          fill="#5a4a3e"
          stroke="rgba(253, 248, 240, 0.7)"
          strokeWidth="2"
          paintOrder="stroke"
          fontStyle="italic"
        >
          {realmName}
        </text>
      ) : null}
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
      >
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : 11}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
