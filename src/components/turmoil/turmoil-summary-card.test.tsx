import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TurmoilSummaryCard } from '@/components/turmoil/turmoil-summary-card';

describe('TurmoilSummaryCard', () => {
  it('shows building reductions as a turmoil factor', () => {
    render(
      <TurmoilSummaryCard
        projectedTurmoil={1}
        buildingTurmoilReduction={2}
        turmoilBreakdown={[]}
        taxType="Tribute"
      />,
    );

    expect(screen.getByText('Building reductions')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
  });
});
