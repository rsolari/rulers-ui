import { Badge } from '@/components/ui/badge';
import { formatTechnicalKnowledgeLabel } from '@/lib/technical-knowledge';

interface TechnicalKnowledgeBadgesProps {
  knowledge: string[];
  emptyLabel?: string;
  variant?: 'default' | 'gold' | 'red' | 'green';
}

export function TechnicalKnowledgeBadges({
  knowledge,
  emptyLabel = 'No technical knowledge recorded.',
  variant = 'default',
}: TechnicalKnowledgeBadgesProps) {
  if (knowledge.length === 0) {
    return <p className="text-sm text-ink-300">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {knowledge.map((entry) => (
        <Badge key={entry} variant={variant}>
          {formatTechnicalKnowledgeLabel(entry)}
        </Badge>
      ))}
    </div>
  );
}
