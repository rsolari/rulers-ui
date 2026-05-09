'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GameShellNav } from '@/components/app-shell/game-shell-nav';
import type { ShellNavSection } from '@/lib/game-navigation';

export function MobileGameNav({ sections }: { sections: ShellNavSection[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-ink-200 bg-parchment-50 px-4 py-3 lg:hidden">
      <Button className="min-h-11 w-full sm:w-auto" type="button" variant="outline" size="sm" onClick={() => setOpen((current) => !current)}>
        {open ? 'Hide Navigation' : 'Show Navigation'}
      </Button>
      {open && (
        <div className="mt-4">
          <GameShellNav sections={sections} compact />
        </div>
      )}
    </div>
  );
}
