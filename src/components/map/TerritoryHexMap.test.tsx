import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TerritoryHexMap } from '@/components/map/TerritoryHexMap';
import type { TerritoryMapData } from '@/lib/maps/territory-map';

const territoryMap: TerritoryMapData = {
  territoryId: 'territory-1',
  territoryName: 'Test Territory',
  suggestedStartHexId: '0:0',
  selectableHexIds: ['0:0'],
  hexes: [
    {
      id: '0:0',
      q: 0,
      r: 0,
      hexKind: 'land',
      waterKind: null,
      terrainType: 'flat_grassland',
      territoryId: 'territory-1',
      isTerritoryHex: true,
      isNeighborTerritoryHex: false,
      isWaterContextHex: false,
      features: [],
    },
  ],
};

describe('TerritoryHexMap responsive affordances', () => {
  it('uses responsive full-map heights and touch-sized zoom controls', () => {
    render(<TerritoryHexMap data={territoryMap} variant="full" />);

    expect(screen.getByTestId('territory-map-territory-1').getAttribute('class')).toContain('h-64');
    expect(screen.getByTestId('territory-map-territory-1').getAttribute('class')).toContain('md:h-80');
    expect(screen.getByRole('button', { name: 'Zoom in' }).className).toContain('min-h-11');
    expect(screen.getByRole('button', { name: 'Zoom out' }).className).toContain('min-w-11');
  });

  it('allows callers to provide a context-specific height class', () => {
    render(<TerritoryHexMap data={territoryMap} heightClassName="h-52 w-full" />);

    expect(screen.getByTestId('territory-map-territory-1').getAttribute('class')).toBe('h-52 w-full');
  });
});
