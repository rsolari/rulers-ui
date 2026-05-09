type MutationFeedbackStatus = 'pending' | 'success' | 'error' | 'info';

interface InlineMutationMessageProps {
  id?: string;
  status: MutationFeedbackStatus;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}

const statusClasses: Record<MutationFeedbackStatus, string> = {
  pending: 'text-ink-300',
  success: 'text-green-700',
  error: 'text-red-700',
  info: 'text-ink-300',
};

export function InlineMutationMessage({
  id,
  status,
  message,
  retryLabel,
  onRetry,
}: InlineMutationMessageProps) {
  const isError = status === 'error';

  return (
    <p
      id={id}
      className={`text-sm ${statusClasses[status]}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {message}
      {isError && onRetry ? (
        <>
          {' '}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={onRetry}
          >
            {retryLabel ?? 'Try again'}
          </button>
        </>
      ) : null}
    </p>
  );
}
