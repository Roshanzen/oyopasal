import React from 'react';
import { Bike, MapPin } from 'lucide-react';
import { adminService } from '../../services';
import {
  AdminAuditLogItem,
  AdminRiderItem,
  AdminTicketItem,
  AdminUserItem,
  AdminZoneItem,
} from '../../types';

interface AdminFleetTabProps {
  zones: AdminZoneItem[];
  riders: AdminRiderItem[];
  usersList: AdminUserItem[];
  zoneName: string;
  zoneSlug: string;
  setZoneName: (v: string) => void;
  setZoneSlug: (v: string) => void;
  onRefresh: () => Promise<void>;
}

export function AdminFleetTab({
  zones,
  riders,
  usersList,
  zoneName,
  zoneSlug,
  setZoneName,
  setZoneSlug,
  onRefresh,
}: AdminFleetTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" /> Delivery Zones
        </h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await adminService.createAdminZone({ name: zoneName, slug: zoneSlug });
            setZoneName('');
            setZoneSlug('');
            onRefresh();
          }}
          className="flex gap-2"
        >
          <input
            required
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="Zone Name"
            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs"
          />
          <input
            required
            value={zoneSlug}
            onChange={(e) => setZoneSlug(e.target.value)}
            placeholder="slug"
            className="w-28 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs"
          />
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold cursor-pointer">
            Add
          </button>
        </form>
        <div className="space-y-2">
          {zones.map((z) => (
            <div key={z.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-xs">
              <span className="font-bold text-white">
                {z.name} ({z.city})
              </span>
              <span className="text-slate-400">
                Fee Rs. {z.baseDeliveryFee} · ETA {z.estimatedMins}m
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Bike className="w-4 h-4 text-sky-400" /> Fleet Riders & Users
        </h3>
        {riders.map((r) => (
          <div key={r.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-white">{r.fullName}</span>
              <span className="text-slate-400 block">
                {r.vehicleNumber} · {r.availabilityStatus}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold uppercase">
              {r.verificationStatus}
            </span>
          </div>
        ))}
        <div className="pt-2 border-t border-slate-800 space-y-1.5 max-h-56 overflow-y-auto">
          {usersList.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-xs text-slate-300 py-1">
              <span className="truncate">
                {u.email} ({u.role})
              </span>
              <button
                onClick={async () => {
                  await adminService.updateAdminUser(u.id, { is_active: !u.is_active });
                  onRefresh();
                }}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  u.is_active ? 'bg-slate-800 text-emerald-400' : 'bg-rose-950 text-rose-300'
                }`}
              >
                {u.is_active ? 'Active' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AdminSettingsTabProps {
  deliveryFeesCfg: {
    baseDeliveryFee: number;
    freeDeliveryThreshold: number;
    handlingFee: number;
    defaultEtaMins: number;
  };
  commissionCfg: {
    defaultCommissionRate: number;
    newSellerZeroCommissionDays: number;
  };
  supportCfg: {
    brandName: string;
    tagline: string;
    email: string;
    phone: string;
    address: string;
    hours: string;
  };
  savingSettingKey: string | null;
  setDeliveryFeesCfg: React.Dispatch<
    React.SetStateAction<{
      baseDeliveryFee: number;
      freeDeliveryThreshold: number;
      handlingFee: number;
      defaultEtaMins: number;
    }>
  >;
  setCommissionCfg: React.Dispatch<
    React.SetStateAction<{
      defaultCommissionRate: number;
      newSellerZeroCommissionDays: number;
    }>
  >;
  setSupportCfg: React.Dispatch<
    React.SetStateAction<{
      brandName: string;
      tagline: string;
      email: string;
      phone: string;
      address: string;
      hours: string;
    }>
  >;
  onSaveSetting: (key: string, value: Record<string, unknown>, description: string, label: string) => Promise<void>;
}

export function AdminSettingsTab({
  deliveryFeesCfg,
  commissionCfg,
  supportCfg,
  savingSettingKey,
  setDeliveryFeesCfg,
  setCommissionCfg,
  setSupportCfg,
  onSaveSetting,
}: AdminSettingsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSaveSetting('delivery_fees', deliveryFeesCfg, 'Default delivery & handling fees', 'Delivery fees updated');
        }}
        className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
      >
        <h3 className="font-bold text-white">Delivery & Handling Fees</h3>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Base Delivery Fee (NPR)</label>
          <input
            type="number"
            value={deliveryFeesCfg.baseDeliveryFee}
            onChange={(e) => setDeliveryFeesCfg((p) => ({ ...p, baseDeliveryFee: Number(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Free Delivery Threshold (NPR)</label>
          <input
            type="number"
            value={deliveryFeesCfg.freeDeliveryThreshold}
            onChange={(e) => setDeliveryFeesCfg((p) => ({ ...p, freeDeliveryThreshold: Number(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Handling Fee (NPR)</label>
          <input
            type="number"
            value={deliveryFeesCfg.handlingFee}
            onChange={(e) => setDeliveryFeesCfg((p) => ({ ...p, handlingFee: Number(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Default ETA (Mins)</label>
          <input
            type="number"
            value={deliveryFeesCfg.defaultEtaMins}
            onChange={(e) => setDeliveryFeesCfg((p) => ({ ...p, defaultEtaMins: Number(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
        </div>
        <button
          type="submit"
          disabled={savingSettingKey === 'delivery_fees'}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
        >
          {savingSettingKey === 'delivery_fees' ? 'Saving...' : 'Save Delivery Fees'}
        </button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSaveSetting('commission_policy', commissionCfg, 'Default marketplace commission rules', 'Commission policy updated');
        }}
        className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
      >
        <h3 className="font-bold text-white">Commission Policy</h3>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Default Commission Rate (%)</label>
          <input
            type="number"
            value={commissionCfg.defaultCommissionRate}
            onChange={(e) => setCommissionCfg((p) => ({ ...p, defaultCommissionRate: Number(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Zero-Commission Onboarding Days</label>
          <input
            type="number"
            value={commissionCfg.newSellerZeroCommissionDays}
            onChange={(e) => setCommissionCfg((p) => ({ ...p, newSellerZeroCommissionDays: Number(e.target.value) }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
        </div>
        <button
          type="submit"
          disabled={savingSettingKey === 'commission_policy'}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
        >
          {savingSettingKey === 'commission_policy' ? 'Saving...' : 'Save Commission Policy'}
        </button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSaveSetting('store_support', supportCfg, 'Storefront branding and support contact info', 'Store support & branding updated');
        }}
        className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
      >
        <h3 className="font-bold text-white">Brand & Customer Support Info</h3>
        <input
          value={supportCfg.brandName}
          onChange={(e) => setSupportCfg((p) => ({ ...p, brandName: e.target.value }))}
          placeholder="Brand Name"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <input
          value={supportCfg.tagline}
          onChange={(e) => setSupportCfg((p) => ({ ...p, tagline: e.target.value }))}
          placeholder="Tagline"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <input
          value={supportCfg.email}
          onChange={(e) => setSupportCfg((p) => ({ ...p, email: e.target.value }))}
          placeholder="Support Email"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <input
          value={supportCfg.phone}
          onChange={(e) => setSupportCfg((p) => ({ ...p, phone: e.target.value }))}
          placeholder="Support Phone"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <input
          value={supportCfg.address}
          onChange={(e) => setSupportCfg((p) => ({ ...p, address: e.target.value }))}
          placeholder="Office Address"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <input
          value={supportCfg.hours}
          onChange={(e) => setSupportCfg((p) => ({ ...p, hours: e.target.value }))}
          placeholder="Support Hours"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <button
          type="submit"
          disabled={savingSettingKey === 'store_support'}
          className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold cursor-pointer"
        >
          {savingSettingKey === 'store_support' ? 'Saving...' : 'Save Support Settings'}
        </button>
      </form>
    </div>
  );
}

interface AdminTicketsTabProps {
  tickets: AdminTicketItem[];
  ticketReplyDraft: Record<number, string>;
  onChangeReplyDraft: (ticketId: number, val: string) => void;
  onReply: (ticketId: number) => void;
  onRefresh: () => Promise<void>;
}

export function AdminTicketsTab({
  tickets,
  ticketReplyDraft,
  onChangeReplyDraft,
  onReply,
  onRefresh,
}: AdminTicketsTabProps) {
  return (
    <div className="space-y-4">
      {tickets.length === 0 ? (
        <p className="text-center py-10 text-slate-400">No support tickets found.</p>
      ) : (
        tickets.map((tkt) => (
          <div key={tkt.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-indigo-400">
                  {tkt.ticketNumber} · {tkt.customer_name}
                </span>
                <h3 className="font-bold text-white">{tkt.subject}</h3>
              </div>
              <select
                value={tkt.status}
                onChange={async (e) => {
                  await adminService.updateAdminTicket(tkt.id, e.target.value);
                  onRefresh();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-1.5">
              {tkt.messages?.map((m) => (
                <div key={m.id} className="p-2 rounded-lg bg-slate-950 text-xs text-slate-300">
                  <strong className="text-emerald-400 uppercase mr-1">{m.senderRole}:</strong> {m.message}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ticketReplyDraft[tkt.id] || ''}
                onChange={(e) => onChangeReplyDraft(tkt.id, e.target.value)}
                placeholder="Write admin reply..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
              <button
                onClick={() => onReply(tkt.id)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
              >
                Reply
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

interface AdminAuditTabProps {
  auditLogs: AdminAuditLogItem[];
}

export function AdminAuditTab({ auditLogs }: AdminAuditTabProps) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
      {auditLogs.length === 0 ? (
        <p className="text-center py-10 text-slate-400">No audit log records found.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase">
              <th className="pb-2">Action</th>
              <th className="pb-2">Role</th>
              <th className="pb-2">Entity</th>
              <th className="pb-2">Details</th>
              <th className="pb-2">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td className="py-2 font-bold text-indigo-300">{log.action}</td>
                <td className="py-2 text-slate-300">{log.actorRole}</td>
                <td className="py-2 text-slate-400">
                  {log.entityType} #{log.entityId}
                </td>
                <td className="py-2 font-mono text-slate-400 max-w-xs truncate">{JSON.stringify(log.details)}</td>
                <td className="py-2 text-slate-500">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
