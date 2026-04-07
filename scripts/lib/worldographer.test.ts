import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  buildCuratedMapDefinition,
  getWorldographerHexCenter,
  parseWorldographerWxxBuffer,
  serializeCuratedMapDefinition,
} from './worldographer.mjs';

function createTileLine(terrainCode: number, elevation: number) {
  return `${terrainCode}\t${elevation}\t0\t0\t42\tZ`;
}

function createFixtureBuffer() {
  const rows = [
    [createTileLine(0, -3), createTileLine(1, 1000)],
    [createTileLine(1, 1000), createTileLine(3, 6000)],
  ];
  const labelOne = getWorldographerHexCenter(0, 1);
  const labelTwo = getWorldographerHexCenter(1, 0);
  const volcano = getWorldographerHexCenter(1, 1);

  const xml = `<?xml version='1.1' encoding='utf-16'?>
<map type="WORLD" release="2025" version="2.00" schema="1.02" lastViewLevel="CONTINENT" hexOrientation="COLUMNS" mapProjection="FLAT">
  <terrainmap>Classic/Water Ocean\t0\tClassic/Flat Farmland\t1\tClassic/Mountains\t3</terrainmap>
  <tiles viewLevel="CONTINENT" tilesWide="2" tilesHigh="2">
    <tilerow>
${rows[0].join('\n')}
    </tilerow>
    <tilerow>
${rows[1].join('\n')}
    </tilerow>
  </tiles>
  <features>
    <feature type="Classic/Natural Volcano">
      <location viewLevel="CONTINENT" x="${volcano.x}" y="${volcano.y}" />
    </feature>
  </features>
  <labels>
    <label style="Nation">
      <location viewLevel="CONTINENT" x="${labelOne.x}" y="${labelOne.y}" scale="75.0" />
      Kingdom 1
    </label>
    <label style="Nation">
      <location viewLevel="CONTINENT" x="${labelTwo.x}" y="${labelTwo.y}" scale="75.0" />
      Kingdom 2
    </label>
  </labels>
  <shapes>
    <shape type="Path" mapLayer="Above Terrain">
      <p type="m" x="487.5" y="0" />
      <p x="487.5" y="900" />
    </shape>
  </shapes>
  <informations>
    <information type="Information" title="Intro"><![CDATA[<h1>Intro</h1>]]></information>
  </informations>
</map>`;

  return gzipSync(Buffer.from(`\uFEFF${xml}`, 'utf16le'));
}

describe('parseWorldographerWxxBuffer', () => {
  it('parses terrain, tiles, labels, features, and shapes from a WXX buffer', () => {
    const parsed = parseWorldographerWxxBuffer(createFixtureBuffer());

    expect(parsed.width).toBe(2);
    expect(parsed.height).toBe(2);
    expect(parsed.terrainMap.get(0)).toBe('Classic/Water Ocean');
    expect(parsed.columns[0][0]).toMatchObject({ column: 0, row: 0, terrainCode: 0, elevation: -3 });
    expect(parsed.columns[1][1]).toMatchObject({ column: 1, row: 1, terrainCode: 3, elevation: 6000 });
    expect(parsed.labels.map((label) => label.name)).toEqual(['Kingdom 1', 'Kingdom 2']);
    expect(parsed.features).toHaveLength(1);
    expect(parsed.shapes).toHaveLength(1);
    expect(parsed.informations[0]).toMatchObject({ type: 'Information', title: 'Intro', body: 'Intro' });
  });
});

describe('buildCuratedMapDefinition', () => {
  it('derives territories, water kinds, suggested starts, and features', () => {
    const parsed = {
      width: 3,
      height: 3,
      orientation: 'COLUMNS',
      projection: 'FLAT',
      terrainMap: new Map([
        [0, 'Classic/Water Ocean'],
        [1, 'Classic/Flat Farmland'],
        [3, 'Classic/Mountains'],
        [7, 'Classic/Flat Forest Deciduous'],
        [12, 'Classic/Flat Forest Jungle'],
      ]),
      columns: [
        [
          { column: 0, row: 0, terrainCode: 1, elevation: 1000 },
          { column: 0, row: 1, terrainCode: 7, elevation: 1000 },
          { column: 0, row: 2, terrainCode: 1, elevation: 1000 },
        ],
        [
          { column: 1, row: 0, terrainCode: 1, elevation: 1000 },
          { column: 1, row: 1, terrainCode: 0, elevation: -3 },
          { column: 1, row: 2, terrainCode: 3, elevation: 6000 },
        ],
        [
          { column: 2, row: 0, terrainCode: 1, elevation: 1000 },
          { column: 2, row: 1, terrainCode: 12, elevation: 1000 },
          { column: 2, row: 2, terrainCode: 1, elevation: 1000 },
        ],
      ],
      labels: [
        { name: 'Kingdom 1', ...getWorldographerHexCenter(0, 1) },
        { name: 'Kingdom 2', ...getWorldographerHexCenter(2, 1) },
      ],
      features: [
        { rawType: 'Classic/Natural Volcano Dormant', ...getWorldographerHexCenter(2, 2) },
      ],
      shapes: [],
      informations: [],
    };

    const definition = buildCuratedMapDefinition(parsed, {
      key: 'fixture-world',
      name: 'Fixture World',
      version: 7,
    });

    const lakeHex = definition.hexes.find((hex) => hex.kind === 'water');
    const volcanoHex = definition.hexes.find((hex) => hex.kind === 'land' && hex.features?.some((feature: { type: string }) => feature.type === 'volcano'));
    const coastHexes = definition.hexes.filter((hex) => hex.kind === 'land' && hex.features?.some((feature: { type: string }) => feature.type === 'coast'));

    expect(definition.key).toBe('fixture-world');
    expect(definition.name).toBe('Fixture World');
    expect(definition.version).toBe(7);
    expect(definition.territories).toHaveLength(2);
    expect(definition.suggestedStarts).toHaveLength(2);
    expect(lakeHex).toMatchObject({ kind: 'water', waterKind: 'lake' });
    expect(volcanoHex?.features).toContainEqual({ type: 'volcano', metadata: { state: 'dormant' } });
    expect(coastHexes.length).toBeGreaterThan(0);
    expect(definition.hexes.filter((hex) => hex.kind === 'land').every((hex) => hex.territoryKey === 'kingdom-1' || hex.territoryKey === 'kingdom-2')).toBe(true);
  });

  it('serializes a curated map definition into a TypeScript module', () => {
    const source = serializeCuratedMapDefinition({
      key: 'fixture-world',
      name: 'Fixture World',
      version: 1,
      territories: [{ key: 'kingdom-1', name: 'Kingdom 1' }],
      hexes: [{ q: 0, r: 0, kind: 'water', waterKind: 'sea' }],
    }, {
      sourceFile: '/tmp/world.wxx',
    });

    expect(source).toContain("import type { CuratedMapDefinition } from '@/lib/maps/types';");
    expect(source).toContain('Generated by scripts/generate-world-v1.mjs from /tmp/world.wxx.');
    expect(source).toContain('export const WORLD_V1_MAP_DEFINITION = {');
    expect(source).toContain('"waterKind": "sea"');
  });
});
