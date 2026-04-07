'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ActionCommentRecord } from '@/types/game';

interface ActionCommentsProps {
  comments: ActionCommentRecord[];
  canComment?: boolean;
  saving?: boolean;
  onCreateComment?: (body: string) => Promise<void>;
}

export function ActionComments({
  comments,
  canComment = false,
  saving = false,
  onCreateComment,
}: ActionCommentsProps) {
  const [body, setBody] = useState('');

  async function submitComment() {
    const trimmed = body.trim();
    if (!trimmed || !onCreateComment) return;
    await onCreateComment(trimmed);
    setBody('');
  }

  return (
    <div className="space-y-3 border-t border-ink-100 pt-3">
      <p className="font-heading text-sm font-semibold text-ink-500">Discussion</p>
      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-sm text-ink-300">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded bg-parchment-100/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-heading text-sm font-semibold">{comment.authorLabel}</span>
                <span className="text-xs text-ink-300">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-500 whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))
        )}
      </div>

      {canComment ? (
        <div className="space-y-2">
          <Textarea
            label="Add Comment"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Leave a note for the player or GM."
          />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => void submitComment()} disabled={saving || !body.trim()}>
              {saving ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
