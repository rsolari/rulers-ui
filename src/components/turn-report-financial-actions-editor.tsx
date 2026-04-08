'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  BUILDING_ACTION_OPTIONS,
  FORTIFICATION_MATERIAL_OPTIONS,
  OUTSIDE_SETTLEMENT_BUILDING_TYPES,
  TAX_ACTION_OPTIONS,
  TROOP_ACTION_OPTIONS,
  VARIABLE_MATERIAL_BUILDING_TYPES,
  WALL_SIZE_OPTIONS,
  createEmptyFinancialAction,
  getRequiredAllotmentType,
  replaceFinancialActionType,
} from '@/lib/financial-actions';
import type {
  BuildFinancialAction,
  FinancialAction,
  RecruitFinancialAction,
  TaxChangeFinancialAction,
} from '@/types/game';

interface SettlementOption {
  id: string;
  name: string;
}

interface TerritoryOption {
  id: string;
  name: string;
}

interface GosOption {
  id: string;
  name: string;
  type: string;
}

interface TurnReportFinancialActionsEditorProps {
  actions: FinancialAction[];
  settlements: SettlementOption[];
  territories: TerritoryOption[];
  gos: GosOption[];
  isSubmitted: boolean;
  onChange: (actions: FinancialAction[]) => void;
}

const ACTION_TYPE_OPTIONS = [
  { value: 'build', label: 'Build' },
  { value: 'recruit', label: 'Recruit' },
  { value: 'taxChange', label: 'Tax Change' },
  { value: 'spending', label: 'Spending' },
];

function formatDerivedCost(action: FinancialAction) {
  if (typeof action.cost !== 'number') return 'Calculated on save';
  return `${action.cost.toLocaleString()}gc`;
}

function describeBuildTiming(action: BuildFinancialAction) {
  if (!action.buildingSize || !action.constructionTurns) return 'Size and build time are derived on save.';
  const turnLabel = action.constructionTurns === 1 ? 'season' : 'seasons';
  return `${action.buildingSize}, ${action.constructionTurns} ${turnLabel}`;
}

export function TurnReportFinancialActionsEditor({
  actions,
  settlements,
  territories,
  gos,
  isSubmitted,
  onChange,
}: TurnReportFinancialActionsEditorProps) {
  function updateAction(index: number, nextAction: FinancialAction) {
    onChange(actions.map((action, actionIndex) => (actionIndex === index ? nextAction : action)));
  }

  function addAction() {
    onChange([...actions, createEmptyFinancialAction()]);
  }

  return (
    <div className="space-y-3">
      {actions.map((action, index) => {
        const locationType = action.type === 'build'
          ? action.locationType ?? (action.territoryId && !action.settlementId ? 'territory' : 'settlement')
          : 'settlement';
        const canBuildOutsideSettlement = action.type === 'build'
          ? OUTSIDE_SETTLEMENT_BUILDING_TYPES.has(action.buildingType)
          : false;
        const requiredAllotmentType = action.type === 'build'
          ? getRequiredAllotmentType(action.buildingType)
          : null;
        const filteredGos = requiredAllotmentType
          ? gos.filter((entry) => entry.type === requiredAllotmentType)
          : [];

        return (
          <div key={`${action.type}-${index}`} className="space-y-4 rounded p-3 medieval-border">
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                label="Type"
                options={ACTION_TYPE_OPTIONS}
                value={action.type}
                onChange={(event) => updateAction(index, replaceFinancialActionType(event.target.value as FinancialAction['type']))}
                disabled={isSubmitted}
              />
              <Input
                label="Description"
                value={action.description || ''}
                onChange={(event) => updateAction(index, { ...action, description: event.target.value })}
                disabled={isSubmitted}
              />
              <div className="flex flex-col gap-1.5">
                <span className="font-heading text-sm font-medium text-ink-500">Derived Cost</span>
                <div className="rounded border-2 border-input-border bg-input-bg px-4 py-2.5 text-sm text-foreground">
                  {formatDerivedCost(action)}
                </div>
              </div>
            </div>

            {action.type === 'build' && (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <Select
                    label="Building"
                    options={BUILDING_ACTION_OPTIONS}
                    value={action.buildingType}
                    onChange={(event) => {
                      const buildingType = event.target.value as BuildFinancialAction['buildingType'];
                      const nextAction: BuildFinancialAction = {
                        ...action,
                        buildingType,
                        locationType: OUTSIDE_SETTLEMENT_BUILDING_TYPES.has(buildingType) ? locationType : 'settlement',
                        territoryId: OUTSIDE_SETTLEMENT_BUILDING_TYPES.has(buildingType) ? action.territoryId ?? null : null,
                        wallSize: buildingType === 'Walls' ? action.wallSize ?? null : null,
                        material: VARIABLE_MATERIAL_BUILDING_TYPES.has(buildingType) ? action.material ?? null : null,
                        allottedGosId: getRequiredAllotmentType(buildingType) === requiredAllotmentType ? action.allottedGosId ?? null : null,
                        buildingSize: undefined,
                        constructionTurns: undefined,
                        cost: undefined,
                      };
                      updateAction(index, nextAction);
                    }}
                    disabled={isSubmitted}
                  />
                  {canBuildOutsideSettlement ? (
                    <Select
                      label="Placement"
                      options={[
                        { value: 'settlement', label: 'Settlement' },
                        { value: 'territory', label: 'Standalone Territory' },
                      ]}
                      value={locationType}
                      onChange={(event) => updateAction(index, {
                        ...action,
                        locationType: event.target.value as BuildFinancialAction['locationType'],
                        settlementId: event.target.value === 'settlement' ? action.settlementId ?? null : null,
                        territoryId: event.target.value === 'territory' ? action.territoryId ?? null : null,
                        buildingSize: undefined,
                        constructionTurns: undefined,
                        cost: undefined,
                      })}
                      disabled={isSubmitted}
                    />
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <span className="font-heading text-sm font-medium text-ink-500">Placement</span>
                      <div className="rounded border-2 border-input-border bg-input-bg px-4 py-2.5 text-sm text-foreground">
                        Settlement
                      </div>
                    </div>
                  )}
                  {locationType === 'territory' ? (
                    <Select
                      label="Territory"
                      options={territories.map((territory) => ({ value: territory.id, label: territory.name }))}
                      value={action.territoryId ?? ''}
                      placeholder="Select territory"
                      onChange={(event) => updateAction(index, {
                        ...action,
                        territoryId: event.target.value || null,
                        settlementId: null,
                        buildingSize: undefined,
                        constructionTurns: undefined,
                        cost: undefined,
                      })}
                      disabled={isSubmitted}
                    />
                  ) : (
                    <Select
                      label="Settlement"
                      options={settlements.map((settlement) => ({ value: settlement.id, label: settlement.name }))}
                      value={action.settlementId ?? ''}
                      placeholder="Select settlement"
                      onChange={(event) => updateAction(index, {
                        ...action,
                        settlementId: event.target.value || null,
                        territoryId: null,
                        buildingSize: undefined,
                        constructionTurns: undefined,
                        cost: undefined,
                      })}
                      disabled={isSubmitted}
                    />
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {VARIABLE_MATERIAL_BUILDING_TYPES.has(action.buildingType) ? (
                    <Select
                      label="Material"
                      options={FORTIFICATION_MATERIAL_OPTIONS}
                      value={action.material ?? ''}
                      placeholder="Select material"
                      onChange={(event) => updateAction(index, {
                        ...action,
                        material: event.target.value === 'Timber' || event.target.value === 'Stone'
                          ? event.target.value
                          : null,
                        buildingSize: undefined,
                        constructionTurns: undefined,
                        cost: undefined,
                      })}
                      disabled={isSubmitted}
                    />
                  ) : <div />}
                  {action.buildingType === 'Walls' && locationType === 'territory' ? (
                    <Select
                      label="Wall Size"
                      options={WALL_SIZE_OPTIONS}
                      value={action.wallSize ?? ''}
                      placeholder="Select size"
                      onChange={(event) => updateAction(index, {
                        ...action,
                        wallSize: event.target.value === '' ? null : event.target.value as BuildFinancialAction['wallSize'],
                        buildingSize: undefined,
                        constructionTurns: undefined,
                        cost: undefined,
                      })}
                      disabled={isSubmitted}
                    />
                  ) : <div />}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-heading text-sm font-medium text-ink-500">Build Profile</span>
                    <div className="rounded border-2 border-input-border bg-input-bg px-4 py-2.5 text-sm text-foreground">
                      {describeBuildTiming(action)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 rounded border-2 border-input-border bg-input-bg px-4 py-3 text-sm text-foreground">
                    G.O.S. owner is optional and controls upkeep/accounting.
                  </label>
                  <Select
                    label="G.O.S. Owner"
                    options={gos.map((entry) => ({ value: entry.id, label: entry.name }))}
                    value={action.ownerGosId ?? ''}
                    placeholder="Select owner"
                    onChange={(event) => {
                      const nextOwnerGosId = event.target.value || null;
                      const nextOwner = gos.find((entry) => entry.id === nextOwnerGosId) ?? null;

                      updateAction(index, {
                        ...action,
                        ownerGosId: nextOwnerGosId,
                        allottedGosId: requiredAllotmentType === 'Guild' && !action.allottedGosId && nextOwner?.type === 'Guild'
                          ? nextOwner.id
                          : action.allottedGosId ?? null,
                        cost: undefined,
                      });
                    }}
                    disabled={isSubmitted}
                  />
                  {requiredAllotmentType ? (
                    <Select
                      label={`${requiredAllotmentType} Allotment`}
                      options={filteredGos.map((entry) => ({ value: entry.id, label: entry.name }))}
                      value={action.allottedGosId ?? ''}
                      placeholder={`Select ${requiredAllotmentType.toLowerCase()}`}
                      onChange={(event) => updateAction(index, {
                        ...action,
                        allottedGosId: event.target.value || null,
                        cost: undefined,
                      })}
                      disabled={isSubmitted}
                    />
                  ) : <div />}
                </div>
              </>
            )}

            {action.type === 'recruit' && (
              <div className="grid gap-3 md:grid-cols-3">
                <Select
                  label="Troop"
                  options={TROOP_ACTION_OPTIONS}
                  value={action.troopType}
                  onChange={(event) => updateAction(index, {
                    ...action,
                    troopType: event.target.value as RecruitFinancialAction['troopType'],
                    cost: undefined,
                  })}
                  disabled={isSubmitted}
                />
                <Select
                  label="Settlement"
                  options={settlements.map((settlement) => ({ value: settlement.id, label: settlement.name }))}
                  value={action.settlementId ?? ''}
                  placeholder="Select settlement"
                  onChange={(event) => updateAction(index, {
                    ...action,
                    settlementId: event.target.value || null,
                    cost: undefined,
                  })}
                  disabled={isSubmitted}
                />
              </div>
            )}

            {action.type === 'taxChange' && (
              <div className="grid gap-3 md:grid-cols-3">
                <Select
                  label="Tax Type"
                  options={TAX_ACTION_OPTIONS}
                  value={action.taxType}
                  onChange={(event) => updateAction(index, {
                    ...action,
                    taxType: event.target.value as TaxChangeFinancialAction['taxType'],
                    cost: 0,
                  })}
                  disabled={isSubmitted}
                />
              </div>
            )}

            {action.type === 'spending' && (
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  label="Spending Amount"
                  type="number"
                  value={String(action.cost)}
                  onChange={(event) => updateAction(index, {
                    ...action,
                    cost: parseInt(event.target.value, 10) || 0,
                  })}
                  disabled={isSubmitted}
                />
              </div>
            )}
          </div>
        );
      })}

      {!isSubmitted && (
        <Button variant="outline" size="sm" className="mt-3" onClick={addAction}>
          + Add Financial Action
        </Button>
      )}
    </div>
  );
}
