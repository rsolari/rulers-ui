import type { GOSType } from '@/types/game';

export interface SelectOption {
  value: string;
  label: string;
}

export interface GOSOption extends SelectOption {
  type: GOSType;
}

export interface SettlementOptionSource {
  id: string;
  name: string;
  kind?: string | null;
}

export interface NobleOptionSource {
  id: string;
  name: string;
  reasonSkill: number;
  cunningSkill: number;
}

export function lookupLabel(options: SelectOption[], value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

export function toSelectOptions(records: Array<{ id: string; name: string }>): SelectOption[] {
  return records.map((record) => ({ value: record.id, label: record.name }));
}

export function toSettlementOptions(settlements: SettlementOptionSource[]): SelectOption[] {
  return settlements
    .filter((settlement) => !settlement.kind || settlement.kind === 'settlement')
    .map((settlement) => ({ value: settlement.id, label: settlement.name }));
}

export function toNobleOptions(nobles: NobleOptionSource[]): SelectOption[] {
  return nobles.map((noble) => ({
    value: noble.id,
    label: `${noble.name} (R${noble.reasonSkill} / C${noble.cunningSkill})`,
  }));
}

export function toGosOptions(gosList: Array<{ id: string; name: string; type: GOSType }>): GOSOption[] {
  return gosList.map((gos) => ({ value: gos.id, label: `${gos.name} (${gos.type})`, type: gos.type }));
}
