'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface NobleStatusEditorProps {
  gameId: string;
  nobleId: string;
  nobleName: string;
  initialText: string | null;
  onSaved?: (text: string | null) => void;
}

export function NobleStatusEditor({
  gameId,
  nobleId,
  nobleName,
  initialText,
  onSaved,
}: NobleStatusEditorProps) {
  const [text, setText] = useState(initialText ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);

    const gmStatusText = text.trim() || null;

    const response = await fetch(`/api/game/${gameId}/nobles/${nobleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmStatusText }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Failed to save status');
    } else {
      onSaved?.(gmStatusText);
    }

    setSaving(false);
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Input
          label={`${nobleName} — GM status`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. on a trade mission to Gondor"
        />
      </div>
      <Button variant="outline" size="sm" onClick={() => void save()} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
