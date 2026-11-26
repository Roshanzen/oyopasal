import React, { useState } from 'react';
import { CheckCircle2, Phone, Package, Store } from 'lucide-react';
import { TranslatorFn } from '../../i18n';
import { DeliveryTrackingTelemetry, Order, TrackingStep } from '../../types';
import { syncMilestoneSteps, normalizeOrderStatus } from '../../utils/orderMilestones';

interface OrderTrackingTimelineProps {
  steps: TrackingStep[];
  assignment: DeliveryTrackingTelemetry['assignment'];
  isCancelled: boolean;
  t: TranslatorFn;
  order?: Order | null;
}

export default function OrderTrackingTimeline({
  steps,
  assignment,
  isCancelled,
  t,
  order,
}: OrderTrackingTimelineProps) {
  const vendorGroups = order?.items_by_vendor || [];
  const hasMultipleVendors = vendorGroups.length > 1;
  const [selectedVendorIdx, setSelectedVendorIdx] = useState<number>(0);

  // Active vendor package if multi-vendor
  const activeVendorGroup = hasMultipleVendors ? vendorGroups[selectedVendorIdx] : vendorGroups[0];
  const activeStatus = activeVendorGroup?.fulfillment_status || order?.status;
  const activeRawSteps = activeVendorGroup?.tracking_updates || steps || [];

  const syncedSteps = syncMilestoneSteps(
    activeStatus,
    activeRawSteps,
    order?.created_at
  );

  return (
    <>
      <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white uppercase tracking-wide">
              {t('track.milestonesTitle')}
            </h3>
            {hasMultipleVendors && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-vendor delivery: each store fulfills and dispatches independently.
              </p>
            )}
          </div>

          {/* Multi-Vendor Sub-Order Tabs */}
          {hasMultipleVendors && (
            <div className="flex flex-wrap gap-2">
              {vendorGroups.map((vg, idx) => {
                const vStatus = vg.fulfillment_status || order?.status;
                const isSelected = selectedVendorIdx === idx;
                return (
                  <button
                    key={vg.fulfillment_id || idx}
                    type="button"
                    onClick={() => setSelectedVendorIdx(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>{vg.vendor?.name || `Vendor ${idx + 1}`}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {vStatus?.replace(/_/g, ' ')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Milestone Progression */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {syncedSteps.map((step, idx) => {
            const isCompleted = step.done && !step.current;
            const isCurrent = Boolean(step.current && !isCancelled);

            return (
              <div key={idx} className="relative">
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    isCancelled
                      ? 'bg-rose-500 text-white'
                      : step.done
                      ? isCurrent
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/25 shadow-sm animate-pulse'
                        : 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-3" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h4
                      className={`text-sm font-bold ${
                        isCurrent
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : step.done
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {step.title}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 tracking-wider">
                          Active
                        </span>
                      )}
                    </h4>
                    {step.timestamp && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                        {step.timestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>
                </div>
              </div>
            );
          })}
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
            href={`tel:${assignment.agent.phone || assignment.agent.phone_number}`}
            className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800"
          >
            <Phone className="w-4 h-4" />
            <span>{assignment.agent.phone || assignment.agent.phone_number}</span>
          </a>
        </div>
      )}
    </>
  );
}
