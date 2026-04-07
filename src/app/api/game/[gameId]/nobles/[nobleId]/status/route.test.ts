import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nobles } from '@/db/schema';

function createSelectMock(getMock: ReturnType<typeof vi.fn>) {
  const chain = {
    get: getMock,
    where: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
  };

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => chain),
    })),
  };
}

const dbMocks = vi.hoisted(() => {
  const dbGet = vi.fn();
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const selectBuilder = createSelectMock(dbGet);

  return {
    db: {
      select: selectBuilder.select,
      update,
    },
    dbGet,
    update,
    updateSet,
    updateWhere,
  };
});

vi.mock('@/db', () => ({
  db: dbMocks.db,
}));

const authMocks = vi.hoisted(() => ({
  requireGM: vi.fn(),
  isAuthError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'status' in error),
}));

vi.mock('@/lib/auth', () => authMocks);

import { PATCH } from './route';

describe('PATCH /api/game/[gameId]/nobles/[nobleId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.dbGet.mockReset();
    dbMocks.updateSet.mockReset();
    dbMocks.updateWhere.mockReset();
    authMocks.requireGM.mockReset();
  });

  it('allows a GM to set a noble status text', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    dbMocks.dbGet.mockResolvedValue({ id: 'noble-1' });
    dbMocks.updateWhere.mockResolvedValue(undefined);

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmStatusText: 'on a trade mission to Gondor' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nobleId: 'noble-1',
      gmStatusText: 'on a trade mission to Gondor',
    });
    expect(authMocks.requireGM).toHaveBeenCalledWith('game-1');
    expect(dbMocks.update).toHaveBeenCalledWith(nobles);
    expect(dbMocks.updateSet).toHaveBeenCalledWith({ gmStatusText: 'on a trade mission to Gondor' });
  });

  it('allows a GM to clear a noble status text to null', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    dbMocks.dbGet.mockResolvedValue({ id: 'noble-1' });
    dbMocks.updateWhere.mockResolvedValue(undefined);

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmStatusText: null }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nobleId: 'noble-1',
      gmStatusText: null,
    });
    expect(dbMocks.updateSet).toHaveBeenCalledWith({ gmStatusText: null });
  });

  it('rejects non-GM access', async () => {
    authMocks.requireGM.mockRejectedValue(
      Object.assign(new Error('GM access required'), { status: 403 })
    );

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmStatusText: 'away' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'GM access required' });
    expect(dbMocks.dbGet).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the noble is not in the requested game', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });
    dbMocks.dbGet.mockResolvedValue(undefined);

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmStatusText: 'away' }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Noble not found' });
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it('validates gmStatusText input', async () => {
    authMocks.requireGM.mockResolvedValue({ id: 'game-1' });

    const response = await PATCH(new Request('http://localhost/api/game/game-1/nobles/noble-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmStatusText: 42 }),
    }), {
      params: Promise.resolve({ gameId: 'game-1', nobleId: 'noble-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'gmStatusText must be a string or null' });
    expect(dbMocks.dbGet).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });
});
