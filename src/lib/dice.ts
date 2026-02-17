export function rollDice(sides: number, count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
}

export function rollD6(count: number): number[] {
  return rollDice(6, count);
}

export function rollD8(count: number): number[] {
  return rollDice(8, count);
}

export function rollD10(count: number): number[] {
  return rollDice(10, count);
}

export function countSuccesses(rolls: number[]): number {
  return rolls.filter((r) => r >= 5).length;
}

export function countFailures(rolls: number[]): number {
  return rolls.filter((r) => r <= 2).length;
}
