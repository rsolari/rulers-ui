'use client';

import type { ReactNode } from 'react';
import { RulesHelpProvider, RulesHelpButton } from '@/components/help/rules-help-surface';

export function RulesHelpLayoutClient({ children }: { children: ReactNode }) {
  return (
    <RulesHelpProvider surfaceId="rules-help">
      {children}
    </RulesHelpProvider>
  );
}

export function RulesHelpHeaderButton() {
  return <RulesHelpButton label="Ask Advisor" shortLabel="Ask" />;
}
