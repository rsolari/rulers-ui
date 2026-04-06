import { describe, expect, it } from 'vitest';
import { deriveGameInitState, toLegacyGamePhase } from './game-init-state';

describe('game init state helpers', () => {
  it('keeps world setup as a hard gate', () => {
    expect(deriveGameInitState({
      currentInitState: 'gm_world_setup',
      gmSetupState: 'pending',
      playerSetupStates: [],
    })).toBe('gm_world_setup');
  });

  it('stays in invite mode until setup work begins', () => {
    expect(deriveGameInitState({
      currentInitState: 'player_invites_open',
      gmSetupState: 'configuring',
      playerSetupStates: ['unclaimed', 'unclaimed'],
    })).toBe('parallel_final_setup');
  });

  it('reaches ready_to_start only when gm and every player are ready', () => {
    expect(deriveGameInitState({
      currentInitState: 'parallel_final_setup',
      gmSetupState: 'ready',
      playerSetupStates: ['ready', 'ready'],
    })).toBe('ready_to_start');
  });

  it('maps init states back to the legacy phase compatibility enum', () => {
    expect(toLegacyGamePhase('gm_world_setup')).toBe('Setup');
    expect(toLegacyGamePhase('parallel_final_setup')).toBe('RealmCreation');
    expect(toLegacyGamePhase('active')).toBe('Active');
  });
});
