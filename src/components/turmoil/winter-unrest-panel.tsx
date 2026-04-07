import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocationPicker } from '@/components/turmoil/location-picker';
import type { WinterUnrestPayload } from '@/types/game';

interface WinterUnrestPanelProps {
  payload: WinterUnrestPayload;
  busy?: boolean;
  onPickLocation?: (settlementId: string) => void;
  onResolve?: () => void;
  onDismiss?: () => void;
}

export function WinterUnrestPanel({
  payload,
  busy = false,
  onPickLocation,
  onResolve,
  onDismiss,
}: WinterUnrestPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Winter Unrest</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span>Outcome</span>
          <Badge variant={payload.unrestKind === 'revolt' ? 'red' : 'gold'}>
            {payload.unrestKind}
          </Badge>
        </div>
        {onPickLocation ? (
          <LocationPicker
            value={payload.selectedSettlementId ?? ''}
            options={payload.locationOptions}
            onChange={onPickLocation}
            disabled={busy}
          />
        ) : null}
        {payload.gmNotes ? (
          <p className="text-sm text-ink-300">{payload.gmNotes}</p>
        ) : null}
        <div className="flex gap-2">
          {onResolve ? (
            <Button variant="accent" disabled={busy} onClick={onResolve}>
              Resolve
            </Button>
          ) : null}
          {onDismiss ? (
            <Button variant="outline" disabled={busy} onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
