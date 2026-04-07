import { describe, expect, it } from 'vitest';
import { deriveGameInitState, derivePlayerSetupState, toLegacyGamePhase } from './game-init-state';

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

  it('keeps the game out of ready_to_start while any player is still mid-checklist', () => {
    expect(deriveGameInitState({
      currentInitState: 'parallel_final_setup',
      gmSetupState: 'ready',
      playerSetupStates: ['ready', 'ruler_created'],
    })).toBe('parallel_final_setup');
  });

  it('uses ruler_created as the checkpoint after the ruler exists but before the full checklist is done', () => {
    expect(derivePlayerSetupState({
      currentSetupState: 'realm_created',
      claimedAt: new Date(),
      checklist: {
        realmCreated: true,
        rulerCreated: true,
        nobleSetupCompleted: false,
        guildOrderSocietySetupCompleted: true,
        startingArmyPresent: true,
        settlementsPlacedNamed: true,
        economyInitialized: true,
      },
    })).toBe('ruler_created');
  });

  it('marks a player ready only when every setup artifact exists', () => {
    expect(derivePlayerSetupState({
      currentSetupState: 'ruler_created',
      claimedAt: new Date(),
      checklist: {
        realmCreated: true,
        rulerCreated: true,
        nobleSetupCompleted: true,
        guildOrderSocietySetupCompleted: true,
        startingArmyPresent: true,
        settlementsPlacedNamed: true,
        economyInitialized: true,
      },
    })).toBe('ready');
  });

  it('maps init states back to the legacy phase compatibility enum', () => {
    expect(toLegacyGamePhase('gm_world_setup')).toBe('Setup');
    expect(toLegacyGamePhase('parallel_final_setup')).toBe('RealmCreation');
    expect(toLegacyGamePhase('active')).toBe('Active');
  });
});
