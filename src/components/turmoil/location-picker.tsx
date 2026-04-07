import { Select } from '@/components/ui/select';
import type { WinterUnrestLocationOption } from '@/types/game';

interface LocationPickerProps {
  value: string;
  options: WinterUnrestLocationOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function LocationPicker({ value, options, onChange, disabled = false }: LocationPickerProps) {
  return (
    <Select
      label="Incident location"
      value={value}
      disabled={disabled}
      options={options.map((option) => ({
        value: option.settlementId,
        label: `${option.settlementName} (${option.territoryName})`,
      }))}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
