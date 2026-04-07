'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/select';

interface NobleOption {
  id: string;
  name: string;
}

interface NobleAssignmentSelectProps {
  label: string;
  nobles: NobleOption[];
  currentNobleId: string | null;
  /** Called with nobleId (or null to clear). Returns an error string on failure. */
  onAssign: (nobleId: string | null) => Promise<string | null>;
  disabled?: boolean;
}

export function NobleAssignmentSelect({
  label,
  nobles,
  currentNobleId,
  onAssign,
  disabled,
}: NobleAssignmentSelectProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = [
    { value: '', label: 'None' },
    ...nobles.map((n) => ({ value: n.id, label: n.name })),
  ];

  async function handleChange(value: string) {
    const nobleId = value || null;
    if (nobleId === currentNobleId) return;

    setSaving(true);
    setError(null);

    const result = await onAssign(nobleId);
    if (result) setError(result);

    setSaving(false);
  }

  return (
    <div>
      <Select
        label={label}
        options={options}
        value={currentNobleId ?? ''}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={disabled || saving}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
