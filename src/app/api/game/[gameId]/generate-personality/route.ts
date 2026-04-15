import { NextResponse } from 'next/server';
import { generateNobleAge, generateNobleGender, generateNoblePersonality } from '@/lib/tables';

const PERSONALITY_FIELDS = [
  'personality',
  'relationshipWithRuler',
  'belief',
  'valuedObject',
  'valuedPerson',
  'greatestDesire',
] as const;

const VALID_FIELDS = new Set([...PERSONALITY_FIELDS, 'gender', 'age']);

export async function POST(request: Request) {
  let body: { fields?: unknown };
  try {
    body = await request.json() as { fields?: unknown };
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const requestedFields: string[] = Array.isArray(body.fields) && body.fields.length > 0
    ? body.fields.filter((field: unknown): field is string => typeof field === 'string')
    : [...PERSONALITY_FIELDS, 'gender', 'age'];

  if (requestedFields.some((field) => !VALID_FIELDS.has(field))) {
    return NextResponse.json(
      { error: 'fields must only include personality fields, gender, or age' },
      { status: 400 }
    );
  }

  const response: Record<string, string> = {};
  const needsPersonality = requestedFields.some((field) => PERSONALITY_FIELDS.includes(field as typeof PERSONALITY_FIELDS[number]));

  if (needsPersonality) {
    const generatedPersonality = generateNoblePersonality();

    if (requestedFields.includes('personality')) {
      response.personality = generatedPersonality.personality;
    }
    if (requestedFields.includes('relationshipWithRuler')) {
      response.relationshipWithRuler = generatedPersonality.relationshipWithRuler;
    }
    if (requestedFields.includes('belief')) {
      response.belief = generatedPersonality.belief;
    }
    if (requestedFields.includes('valuedObject')) {
      response.valuedObject = generatedPersonality.valuedObject;
    }
    if (requestedFields.includes('valuedPerson')) {
      response.valuedPerson = generatedPersonality.valuedPerson;
    }
    if (requestedFields.includes('greatestDesire')) {
      response.greatestDesire = generatedPersonality.greatestDesire;
    }
  }

  if (requestedFields.includes('gender')) {
    response.gender = generateNobleGender();
  }

  if (requestedFields.includes('age')) {
    response.age = generateNobleAge();
  }

  return NextResponse.json(response);
}
