import React from 'react';
import { CheckCircle2, Phone } from 'lucide-react';
import { TranslatorFn } from '../../i18n';
import { DeliveryTrackingTelemetry, TrackingStep } from '../../types';

interface OrderTrackingTimelineProps {
  steps: TrackingStep[];
  assignment: DeliveryTrackingTelemetry['assignment'];
  isCancelled: boolean;
  t: TranslatorFn;
}

export default function OrderTrackingTimeline({
  steps,
  assignment,
  isCancelled,
  t,
}: OrderTrackingTimelineProps) {
  return (
    <>
      <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white uppercase tracking-wide mb-5">
          {t('track.milestonesTitle')}
        </h3>
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              <div
                className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                  step.done ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-3" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</h4>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{step.timestamp}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {assignment?.agent && !isCancelled && (
        <div className="p-5 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-base flex items-center justify-center shrink-0">
              {assignment.agent.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">{assignment.agent.full_name}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {assignment.agent.vehicle_type} · {assignment.agent.vehicle_number} · ★ {assignment.agent.rating}
              </p>
            </div>
          </div>
          <a
            href={`tel:${assignment.agent.phone}`}
            className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800"
          >
            <Phone className="w-4 h-4" />
            <span>{assignment.agent.phone}</span>
          </a>
        </div>
      )}
    </>
  );
}
