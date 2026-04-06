import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectGet = vi.fn();
  const selectWhere = vi.fn(() => ({ get: selectGet }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  return {
    db: { select, update },
    select,
    selectFrom,
    selectWhere,
    selectGet,
    update,
    updateSet,
    updateWhere,
  };
});

vi.mock('@/db', () => ({ db: mocks.db }));

import { POST } from './route';

describe('POST /api/game/[gameId]/turn/advance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when the game does not exist', async () => {
    mocks.selectGet.mockResolvedValue(undefined);

    const response = await POST(new Request('http://localhost/api/game/game-1/turn/advance'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Game not found' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('advances to the next season and resets the turn phase', async () => {
    mocks.selectGet.mockResolvedValue({
      id: 'game-1',
      currentSeason: 'Spring',
      currentYear: 3,
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/turn/advance'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(mocks.updateSet).toHaveBeenCalledWith({
      currentSeason: 'Summer',
      currentYear: 3,
      turnPhase: 'Submission',
    });
    await expect(response.json()).resolves.toEqual({
      year: 3,
      season: 'Summer',
      phase: 'Submission',
    });
  });

  it('rolls Winter into Spring and increments the year', async () => {
    mocks.selectGet.mockResolvedValue({
      id: 'game-1',
      currentSeason: 'Winter',
      currentYear: 3,
    });

    const response = await POST(new Request('http://localhost/api/game/game-1/turn/advance'), {
      params: Promise.resolve({ gameId: 'game-1' }),
    });

    expect(mocks.updateSet).toHaveBeenCalledWith({
      currentSeason: 'Spring',
      currentYear: 4,
      turnPhase: 'Submission',
    });
    await expect(response.json()).resolves.toEqual({
      year: 4,
      season: 'Spring',
      phase: 'Submission',
    });
  });
});
