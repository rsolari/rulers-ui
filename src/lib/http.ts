interface BlockerPayload {
  displayName?: string | null;
  id: string;
  missingRequirements?: string[];
}

interface ErrorResponsePayload {
  error?: string;
  blockers?: BlockerPayload[];
}

function hasErrorPayload(value: unknown): value is ErrorResponsePayload {
  return typeof value === 'object' && value !== null;
}

export async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();

    if (!hasErrorPayload(data)) {
      return fallback;
    }

    const blockerSummary = Array.isArray(data.blockers)
      ? data.blockers
        .map((blocker) => {
          const label = blocker.displayName?.trim() || blocker.id;
          const missing = Array.isArray(blocker.missingRequirements)
            ? blocker.missingRequirements.join(', ')
            : '';
          return missing ? `${label}: ${missing}` : label;
        })
        .join(' · ')
      : '';

    if (typeof data.error === 'string' && data.error.trim().length > 0) {
      return blockerSummary ? `${data.error} - ${blockerSummary}` : data.error;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
