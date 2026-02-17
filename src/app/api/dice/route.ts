import { NextResponse } from 'next/server';
import { rollDice, countSuccesses, countFailures } from '@/lib/dice';

export async function POST(request: Request) {
  const body = await request.json();
  const { sides = 6, count = 1 } = body;

  if (sides < 2 || sides > 100 || count < 1 || count > 100) {
    return NextResponse.json({ error: 'Invalid dice parameters' }, { status: 400 });
  }

  const rolls = rollDice(sides, count);
  const total = rolls.reduce((a, b) => a + b, 0);
  const successes = sides === 6 ? countSuccesses(rolls) : undefined;
  const failures = sides === 6 ? countFailures(rolls) : undefined;

  return NextResponse.json({ rolls, total, successes, failures });
}
