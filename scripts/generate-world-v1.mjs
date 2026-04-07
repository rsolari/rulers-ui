import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildCuratedMapDefinition,
  parseWorldographerWxxBuffer,
  serializeCuratedMapDefinition,
  summarizeParsedMap,
} from './lib/worldographer.mjs';

const DEFAULT_INPUT = '.context/attachments/World 3 Draft.wxx';
const DEFAULT_OUTPUT = 'src/lib/maps/definitions/world-v1.ts';

const inputPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_INPUT);
const outputPath = resolve(process.cwd(), process.argv[3] ?? DEFAULT_OUTPUT);

const parsedMap = parseWorldographerWxxBuffer(readFileSync(inputPath));
const definition = buildCuratedMapDefinition(parsedMap, {
  key: 'world-v1',
  name: 'World Map v1',
  version: 1,
});
const source = serializeCuratedMapDefinition(definition, {
  sourceFile: inputPath,
});

writeFileSync(outputPath, source);

const summary = summarizeParsedMap(parsedMap);
console.log(JSON.stringify({
  inputPath,
  outputPath,
  territoryCount: definition.territories.length,
  hexCount: definition.hexes.length,
  summary,
}, null, 2));
