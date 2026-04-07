/**
 * Shared data-mapper for deriving a noble's "current activity" from
 * their offices, life-status flags, and GM freeform status text.
 *
 * Both the player nobles page and the GM governance panel consume this
 * so that the display stays consistent.
 */

// ── Input types (match the shapes returned by the nobles GET endpoint) ──

export interface NobleActivityInput {
  id: string;
  name: string;
  isRuler: boolean;
  isHeir: boolean;
  isActingRuler?: boolean;
  title: string | null;          // office label, e.g. "Gondor Governor"
  isPrisoner: boolean;
  isAlive?: boolean;             // defaults to true if omitted
  gmStatusText: string | null;
}

// ── Output ──

export type ActivityKind =
  | 'ruler'
  | 'heir'
  | 'acting_ruler'
  | 'office'        // governor / general / GOS leader
  | 'gm_status'     // freeform text set by GM
  | 'prisoner'
  | 'deceased'
  | 'idle';

export interface ActivityLine {
  kind: ActivityKind;
  label: string;
}

export interface NobleActivity {
  /** Primary one-liner for compact display (first meaningful line). */
  summary: string;
  /** All activity lines, ordered by priority. */
  lines: ActivityLine[];
}

// ── Mapper ──

export function deriveNobleActivity(noble: NobleActivityInput): NobleActivity {
  const lines: ActivityLine[] = [];

  // Life-status gates (highest priority)
  if (noble.isAlive === false) {
    lines.push({ kind: 'deceased', label: 'Deceased' });
  }

  if (noble.isPrisoner) {
    lines.push({ kind: 'prisoner', label: 'Prisoner' });
  }

  // Realm roles
  if (noble.isRuler) {
    lines.push({ kind: 'ruler', label: 'Ruler' });
  }

  if (noble.isHeir) {
    lines.push({ kind: 'heir', label: 'Heir' });
  }

  if (noble.isActingRuler) {
    lines.push({ kind: 'acting_ruler', label: 'Acting Ruler' });
  }

  // Office (governor / general / GOS leader)
  if (noble.title) {
    lines.push({ kind: 'office', label: noble.title });
  }

  // GM freeform status
  if (noble.gmStatusText) {
    lines.push({ kind: 'gm_status', label: noble.gmStatusText });
  }

  // Fallback
  if (lines.length === 0) {
    lines.push({ kind: 'idle', label: 'At court' });
  }

  const summary = lines.map((l) => l.label).join(' · ');

  return { summary, lines };
}
