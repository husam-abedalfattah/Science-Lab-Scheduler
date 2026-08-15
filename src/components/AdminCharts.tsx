import React from 'react';
import { CheckCircle2, XCircle, Circle } from 'lucide-react';
import { Lab, Reservation } from '../types';
import { DAYS_LIST, PERIODS_LIST } from '../data/initialData';
import {
  MAX_CONCURRENT_LABS_PER_PERIOD,
  MAX_ACTIVE_PERIODS_PER_DAY,
  DAYS_PER_WEEK,
  WEEKLY_SLOT_CAPACITY
} from '../constants';

/**
 * Charts for the admin statistics tab.
 *
 * Colour decisions, in the order the method requires (form → job → validate):
 *
 * 1. Every distribution here answers "compare magnitude", not "tell series
 *    apart", so they are **sequential**: one hue (Kingdom Green), more-is-darker
 *    by length alone. A categorical palette would imply the days or the labs are
 *    different *kinds* of thing, which they are not.
 *
 * 2. Review status is the one genuinely categorical set, and it is a *status*
 *    palette, so it ships with an icon and a written label on every segment --
 *    colour is never the only carrier.
 *
 * 3. The status pair was validated rather than eyeballed, and the obvious choice
 *    failed: green #009a4e against coral #bf4e28 separates at only ΔE 4.7 under
 *    deuteranopia -- the classic red/green collision, invisible to roughly one in
 *    twelve men. Aqua #0092b6 against the same coral measures ΔE 19.2 (deutan),
 *    27.2 (normal), both above a 3:1 contrast floor. Hence aqua for "reviewed".
 *    If you change these, re-run the validator; do not reason about it.
 *
 * Bars are capped in thickness, rounded at the data end and square at the
 * baseline, and separated by a surface-coloured gap rather than a border.
 */

const BAR_FILL = 'bg-brand-kingdom-600';
const TRACK = 'bg-slate-200';

interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Capacity for this row, when there is a meaningful ceiling. */
  ceiling?: number;
}

/**
 * Horizontal magnitude bars.
 *
 * Scaled to the largest row rather than to capacity: on a lightly-booked week
 * scaling to capacity flattens every bar into a stub, which is exactly when you
 * are trying to see where the bookings clustered. The count sits at the end of
 * each bar so the relative scale can never mislead on its own.
 */
const BarChart: React.FC<{ rows: BarRow[]; caption: string }> = ({ rows, caption }) => {
  const max = Math.max(1, ...rows.map(r => r.value));

  return (
    <div>
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {rows.map(r => {
            const atCeiling = r.ceiling !== undefined && r.value >= r.ceiling;
            return (
              <tr key={r.key}>
                <th
                  scope="row"
                  className="text-left text-xs font-medium text-slate-700 py-1 pr-2 w-28 max-w-28 truncate align-middle"
                  title={r.label}
                >
                  {r.label}
                </th>
                <td className="py-1 align-middle w-full">
                  <div
                    className={`${TRACK} h-4 rounded-r-[4px] overflow-hidden`}
                    title={
                      r.ceiling !== undefined
                        ? `${r.label}: ${r.value} of ${r.ceiling}`
                        : `${r.label}: ${r.value}`
                    }
                  >
                    <div
                      className={`${
                        atCeiling ? 'bg-brand-coral-700' : BAR_FILL
                      } h-full rounded-r-[4px]`}
                      style={{ width: `${(r.value / max) * 100}%` }}
                    />
                  </div>
                </td>
                <td className="py-1 pl-2 align-middle text-right">
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      atCeiling ? 'text-brand-coral-800' : 'text-slate-900'
                    }`}
                  >
                    {r.value}
                  </span>
                  {r.ceiling !== undefined && (
                    <span className="text-[11px] text-slate-600">/{r.ceiling}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** Section wrapper: chart on the left, the sentence explaining it on the right. */
const ChartBlock: React.FC<{
  title: string;
  children: React.ReactNode;
  note: React.ReactNode;
}> = ({ title, children, note }) => (
  <div className="bg-white p-3.5 rounded-xl border border-slate-300">
    <h5 className="text-xs font-bold uppercase tracking-wide text-slate-800 mb-2.5">{title}</h5>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_16rem] gap-4 items-start">
      <div>{children}</div>
      <p className="text-xs leading-relaxed text-slate-700 lg:border-l lg:border-slate-200 lg:pl-4">
        {note}
      </p>
    </div>
  </div>
);

interface AdminChartsProps {
  reservations: Reservation[];
  labs: Lab[];
  weekNumber: number;
}

export const AdminCharts: React.FC<AdminChartsProps> = ({ reservations, labs, weekNumber }) => {
  const total = reservations.length;

  // Per-day ceiling is the technician's, not the timetable's: they can cover
  // MAX_ACTIVE_PERIODS_PER_DAY periods a day, each holding
  // MAX_CONCURRENT_LABS_PER_PERIOD labs. The room count is not the binding limit.
  const perDayCeiling = MAX_ACTIVE_PERIODS_PER_DAY * MAX_CONCURRENT_LABS_PER_PERIOD;
  const perPeriodCeiling = DAYS_PER_WEEK * MAX_CONCURRENT_LABS_PER_PERIOD;

  const byDay = DAYS_LIST.map(d => ({
    key: d.id,
    label: d.short,
    value: reservations.filter(r => r.day === d.id).length,
    ceiling: perDayCeiling
  }));

  const byPeriod = PERIODS_LIST.map(p => ({
    key: `p${p}`,
    label: `Period ${p}`,
    value: reservations.filter(r => r.period === p).length,
    ceiling: perPeriodCeiling
  }));

  const byLab = labs.map(l => ({
    key: l.id,
    label: l.name,
    value: reservations.filter(r => r.labId === l.id).length
  }));

  const reviewed = reservations.filter(
    r => r.supervisorReview?.status === 'acknowledged'
  ).length;
  const declined = reservations.filter(r => r.supervisorReview?.status === 'declined').length;
  const pending = total - reviewed - declined;

  if (total === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-300 text-center">
        <p className="text-sm text-slate-700">
          Nothing is booked in week {weekNumber} yet, so there is nothing to chart. These
          breakdowns appear once teachers start reserving slots.
        </p>
      </div>
    );
  }

  const pct = (n: number) => Math.round((n / total) * 100);
  const heaviestDay = [...byDay].sort((a, b) => b.value - a.value)[0];
  const quietestDay = [...byDay].sort((a, b) => a.value - b.value)[0];
  const daysOverLimit = byDay.filter(d => d.value >= perDayCeiling);
  const heaviestPeriod = [...byPeriod].sort((a, b) => b.value - a.value)[0];
  const unusedLabs = byLab.filter(l => l.value === 0);
  const busiestLab = [...byLab].sort((a, b) => b.value - a.value)[0];

  const STATUS = [
    {
      key: 'reviewed',
      label: 'Reviewed',
      value: reviewed,
      fill: 'bg-brand-aqua-700',
      text: 'text-brand-aqua-800',
      Icon: CheckCircle2
    },
    {
      key: 'declined',
      label: 'Declined',
      value: declined,
      fill: 'bg-brand-coral-700',
      text: 'text-brand-coral-800',
      Icon: XCircle
    },
    {
      key: 'pending',
      label: 'Not seen yet',
      value: pending,
      fill: 'bg-slate-400',
      text: 'text-slate-700',
      Icon: Circle
    }
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-3">
      <ChartBlock
        title="Bookings per day"
        note={
          <>
            {heaviestDay.value === quietestDay.value ? (
              <>
                The week is evenly spread — every day carries {heaviestDay.value} booking
                {heaviestDay.value === 1 ? '' : 's'}. Nothing to rebalance.
              </>
            ) : (
              <>
                <strong className="text-slate-900">{heaviestDay.label}</strong> is the heaviest day
                with {heaviestDay.value} of {total} bookings ({pct(heaviestDay.value)}%);{' '}
                <strong className="text-slate-900">{quietestDay.label}</strong> has{' '}
                {quietestDay.value}. Moving a session from the first to the second is the cheapest
                way to ease the technician's load.
              </>
            )}
            {daysOverLimit.length > 0 && (
              <>
                {' '}
                <strong className="text-brand-coral-800">
                  {daysOverLimit.map(d => d.label).join(', ')}{' '}
                  {daysOverLimit.length === 1 ? 'is' : 'are'} at the technician's daily ceiling of{' '}
                  {perDayCeiling}.
                </strong>
              </>
            )}
          </>
        }
      >
        <BarChart rows={byDay} caption="Bookings per day of the week" />
      </ChartBlock>

      <ChartBlock
        title="Bookings per period"
        note={
          <>
            <strong className="text-slate-900">{heaviestPeriod.label}</strong> is the busiest slot
            in the timetable at {heaviestPeriod.value} booking
            {heaviestPeriod.value === 1 ? '' : 's'} across the week, against a ceiling of{' '}
            {perPeriodCeiling} ({MAX_CONCURRENT_LABS_PER_PERIOD} labs × {DAYS_PER_WEEK} days).
            Periods near their ceiling are where a late booking is most likely to be refused.
          </>
        }
      >
        <BarChart rows={byPeriod} caption="Bookings per period across the week" />
      </ChartBlock>

      <ChartBlock
        title="Bookings per lab"
        note={
          <>
            <strong className="text-slate-900">{busiestLab.label}</strong> takes the most traffic
            at {busiestLab.value} booking{busiestLab.value === 1 ? '' : 's'}.
            {unusedLabs.length > 0 ? (
              <>
                {' '}
                {unusedLabs.length === 1 ? 'One lab is' : `${unusedLabs.length} labs are`} unused
                this week ({unusedLabs.map(l => l.label).join(', ')}) — spare capacity if a period
                is refused for room reasons.
              </>
            ) : (
              <> Every lab is in use this week.</>
            )}
          </>
        }
      >
        <BarChart rows={byLab} caption="Bookings per laboratory" />
      </ChartBlock>

      <ChartBlock
        title="Lab supervisor review"
        note={
          <>
            {pending === total ? (
              <>
                None of this week's {total} bookings have been looked at by the lab supervisor yet.
              </>
            ) : (
              <>
                The supervisor has responded to{' '}
                <strong className="text-slate-900">{reviewed + declined} of {total}</strong>{' '}
                bookings ({pct(reviewed + declined)}%).
              </>
            )}
            {declined > 0 && (
              <>
                {' '}
                <strong className="text-brand-coral-800">
                  {declined} cannot be prepared
                </strong>{' '}
                — open those bookings to read the reason and tell the teacher.
              </>
            )}
            {pending > 0 && pending !== total && (
              <> {pending} still {pending === 1 ? 'awaits' : 'await'} a decision.</>
            )}
          </>
        }
      >
        {/* Part-to-whole. Segments are separated by a surface-coloured gap
            rather than a stroke, and every one is repeated in the legend below
            with an icon and a word -- this is a status palette, so colour is
            never the only thing carrying the meaning. */}
        <div className="flex gap-0.5 h-5 w-full" role="img" aria-label={
          `Review status: ${reviewed} reviewed, ${declined} declined, ${pending} not seen yet, of ${total} bookings.`
        }>
          {STATUS.map((s, i) => (
            <div
              key={s.key}
              className={`${s.fill} h-full ${i === 0 ? 'rounded-l-[4px]' : ''} ${
                i === STATUS.length - 1 ? 'rounded-r-[4px]' : ''
              }`}
              style={{ width: `${(s.value / total) * 100}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {STATUS.map(s => (
            <li key={s.key} className="flex items-center gap-1.5">
              <s.Icon className={`w-3.5 h-3.5 ${s.text}`} aria-hidden="true" />
              <span className="text-xs text-slate-800">
                <strong className="font-bold text-slate-900 tabular-nums">{s.value}</strong>{' '}
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </ChartBlock>

      <p className="text-[11px] text-slate-600 px-1">
        All four cover week {weekNumber} only. Weekly capacity is {WEEKLY_SLOT_CAPACITY} slots —{' '}
        {DAYS_PER_WEEK} days × {PERIODS_LIST.length} periods ×{' '}
        {MAX_CONCURRENT_LABS_PER_PERIOD} labs the technician can run at once.
      </p>
    </div>
  );
};
