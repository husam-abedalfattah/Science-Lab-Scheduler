import React, { useState } from 'react';
import { CheckCircle2, XCircle, Undo2, ClipboardCheck } from 'lucide-react';
import { SupervisorReview } from '../types';
import { SUPERVISOR_DECLINE_REASONS, MAX_REVIEW_REASON_LENGTH } from '../constants';

interface SupervisorReviewPanelProps {
  review?: SupervisorReview;
  /** Only the lab supervisor (admin) can set a review; everyone else reads it. */
  canReview: boolean;
  onChange: (review: SupervisorReview | null) => void;
}

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ', ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * The lab supervisor's response to one booking.
 *
 * Deliberately visible to teachers as well, in read-only form. A decline that
 * only the supervisor can see does not help anyone -- the teacher is the person
 * who has to change their plan, so the reason has to reach them.
 */
export const SupervisorReviewPanel: React.FC<SupervisorReviewPanelProps> = ({
  review,
  canReview,
  onChange
}) => {
  const [isDeclining, setIsDeclining] = useState(false);
  const [reason, setReason] = useState('');

  const submitDecline = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onChange({
      status: 'declined',
      reason: trimmed.slice(0, MAX_REVIEW_REASON_LENGTH),
      reviewedAt: new Date().toISOString()
    });
    setIsDeclining(false);
    setReason('');
  };

  // --- Already reviewed -------------------------------------------------
  if (review && !isDeclining) {
    const declined = review.status === 'declined';
    return (
      <div
        className={`rounded-lg border p-3 ${
          declined
            ? 'bg-brand-coral-50 border-brand-coral-300'
            : 'bg-brand-green-50 border-brand-green-300'
        }`}
      >
        <div className="flex items-start gap-2">
          {declined ? (
            <XCircle className="w-4 h-4 text-brand-coral-700 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2
              className="w-4 h-4 text-brand-green-800 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 flex-grow">
            <p
              className={`text-xs font-bold ${
                declined ? 'text-brand-coral-900' : 'text-brand-green-900'
              }`}
            >
              {declined ? 'Lab supervisor cannot prepare this' : 'Reviewed by the lab supervisor'}
            </p>
            {review.reason && (
              <p className="text-xs text-slate-800 mt-1 leading-relaxed break-words">
                {review.reason}
              </p>
            )}
            <p className="text-[11px] text-slate-600 mt-1">{formatWhen(review.reviewedAt)}</p>
          </div>
        </div>

        {canReview && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {!declined && (
              <button
                type="button"
                onClick={() => setIsDeclining(true)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-brand-coral-50 text-brand-coral-800 border border-brand-coral-300 text-xs font-semibold transition"
              >
                Change to “cannot prepare”
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition"
            >
              <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear review</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
        <p className="text-xs text-slate-700">Not yet reviewed by the lab supervisor.</p>
      </div>
    );
  }

  // --- Declining: pick a reason ----------------------------------------
  if (isDeclining) {
    return (
      <div className="rounded-lg border border-brand-coral-300 bg-brand-coral-50 p-3">
        <p className="text-xs font-bold text-brand-coral-900">Why can this not be prepared?</p>
        <p className="text-[11px] text-slate-700 mt-0.5">
          The teacher sees this, so they can re-plan the session.
        </p>

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {SUPERVISOR_DECLINE_REASONS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              aria-pressed={reason === preset}
              className={`px-2.5 py-1.5 rounded-full border text-[11px] font-semibold transition text-left ${
                reason === preset
                  ? 'bg-brand-coral-700 text-white border-brand-coral-700'
                  : 'bg-white text-slate-800 border-slate-300 hover:border-brand-coral-500'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <label htmlFor="review-reason" className="block text-[11px] font-bold text-slate-800 mt-3">
          Reason
        </label>
        <textarea
          id="review-reason"
          rows={2}
          value={reason}
          maxLength={MAX_REVIEW_REASON_LENGTH}
          onChange={e => setReason(e.target.value)}
          placeholder="Pick one above, or write your own."
          className="w-full mt-1 bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-coral-500 focus:border-brand-coral-500 transition"
        />

        <div className="flex flex-wrap gap-2 mt-2.5">
          <button
            type="button"
            onClick={submitDecline}
            disabled={!reason.trim()}
            className="px-3 py-1.5 rounded-lg bg-brand-coral-700 hover:bg-brand-coral-800 text-white text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save reason
          </button>
          <button
            type="button"
            onClick={() => {
              setIsDeclining(false);
              setReason('');
            }}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // --- Not reviewed yet -------------------------------------------------
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-800">Lab supervisor review</p>
      <p className="text-[11px] text-slate-700 mt-0.5">
        Confirm you can prepare this session, or say why you cannot.
      </p>
      <div className="flex flex-wrap gap-2 mt-2.5">
        <button
          type="button"
          onClick={() =>
            onChange({ status: 'acknowledged', reviewedAt: new Date().toISOString() })
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green-800 hover:bg-brand-green-900 text-white text-xs font-bold transition"
        >
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reviewed — can prepare</span>
        </button>
        <button
          type="button"
          onClick={() => setIsDeclining(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-brand-coral-50 text-brand-coral-800 border border-brand-coral-300 text-xs font-bold transition"
        >
          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Cannot prepare</span>
        </button>
      </div>
    </div>
  );
};
