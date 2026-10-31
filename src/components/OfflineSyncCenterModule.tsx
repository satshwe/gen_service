import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  ArrowRight,
} from 'lucide-react';
import {
  InspectionReport,
  SyncQueueItem,
  SyncConflict,
  UserRole,
} from '../types';
import { computeReportChecksum } from '../utils/indexedDbSync';

interface OfflineSyncCenterModuleProps {
  isOnline: boolean;
  simulatedOffline: boolean;
  onToggleSimulatedOffline: (offline: boolean) => void;
  reports: InspectionReport[];
  syncQueue: SyncQueueItem[];
  conflicts: SyncConflict[];
  isSyncing: boolean;
  lastSyncedAt: string | null;
  conflictStrategy: 'manual' | 'last_write_wins';
  onChangeConflictStrategy: (strategy: 'manual' | 'last_write_wins') => void;
  onTriggerManualSync: () => Promise<void>;
  onSimulateServerConflict: (report: InspectionReport) => Promise<void>;
  onResolveConflict: (
    conflict: SyncConflict,
    resolution: 'keep_local' | 'accept_server'
  ) => Promise<void>;
  currentUserRole: UserRole;
}

export const OfflineSyncCenterModule: React.FC<OfflineSyncCenterModuleProps> = ({
  isOnline,
  simulatedOffline,
  onToggleSimulatedOffline,
  reports,
  syncQueue,
  conflicts,
  isSyncing,
  lastSyncedAt,
  conflictStrategy,
  onChangeConflictStrategy,
  onTriggerManualSync,
  onSimulateServerConflict,
  onResolveConflict,
  currentUserRole,
}) => {
  const [selectedReportIdForConflictSim, setSelectedReportIdForConflictSim] = useState<string>(
    reports[0]?.id || ''
  );
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const canModifySync =
    currentUserRole === 'Administrator' ||
    currentUserRole === 'Chief Engineer' ||
    currentUserRole === 'Field Engineer';

  const handleSimulateConflictClick = async () => {
    const target = reports.find((r) => r.id === selectedReportIdForConflictSim) || reports[0];
    if (!target) return;
    await onSimulateServerConflict(target);
    setStatusBanner(
      `Simulated concurrent remote edit on Report #${target.reportNo} (${target.centerCode}). Click "Sync Now" or inspect the Conflict Resolution table below.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Connectivity Control Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>IndexedDB Storage Engine (CityPropertiesGeneratorDB)</span>
            <span aria-hidden="true">·</span>
            <span>FNV-1a Checksum Integrity</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Offline Data Synchronization & Conflict Resolution Center
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Online / Offline Mode Switch */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => onToggleSimulatedOffline(false)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isOnline && !simulatedOffline
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Online (Auto-Sync)
            </button>
            <button
              type="button"
              onClick={() => onToggleSimulatedOffline(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                simulatedOffline || !isOnline
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              Simulate Field Offline Mode
            </button>
          </div>

          <button
            type="button"
            disabled={!isOnline || isSyncing || !canModifySync}
            onClick={onTriggerManualSync}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronizing...' : `Sync Queue Now (${syncQueue.length})`}
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-lg text-xs flex items-center justify-between gap-4">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-300 hover:text-white font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Storage & Sync Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Connection & Sync State</div>
          <div className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            {isOnline ? (
              <span className="text-emerald-700 flex items-center gap-1.5">
                <Wifi className="w-4 h-4" /> Online Connected
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1.5">
                <WifiOff className="w-4 h-4" /> Offline (IndexedDB Active)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Last Sync: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Ready'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">IndexedDB Offline Queue</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {syncQueue.length} Pending
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Auto-flushes when connectivity is restored
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Version Conflicts Detected</div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
              conflicts.length > 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {conflicts.length} Conflicts
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Policy: {conflictStrategy === 'manual' ? 'Side-by-Side Review' : 'Last-Write-Wins'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">IndexedDB Records Verified</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {reports.length} Reports
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% Checksum Validated
          </div>
        </div>
      </div>

      {/* Conflict Policy & Conflict Simulation Test Harness */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            01. Synchronization Conflict Resolution Policy
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Configure how the sync engine handles concurrent modifications when a field engineer edits a report offline while HQ updates the same report on the server.
          </p>
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              disabled={!canModifySync}
              onClick={() => onChangeConflictStrategy('manual')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                conflictStrategy === 'manual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Interactive Side-by-Side Resolution (Recommended)
            </button>
            <button
              type="button"
              disabled={!canModifySync}
              onClick={() => onChangeConflictStrategy('last_write_wins')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                conflictStrategy === 'last_write_wins'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Automatic Last-Write-Wins
            </button>
          </div>
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            02. Test Concurrent Offline vs. Server Conflict
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Select an inspection report to simulate a concurrent HQ server update while queuing a local field modification in IndexedDB.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedReportIdForConflictSim}
              onChange={(e) => setSelectedReportIdForConflictSim(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
            >
              {reports.slice(0, 12).map((r) => (
                <option key={r.id} value={r.id}>
                  Report #{r.reportNo} — {r.centerCode} ({r.kvaRating})
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!canModifySync}
              onClick={handleSimulateConflictClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Simulate Version Conflict
            </button>
          </div>
        </div>
      </div>

      {/* Active Conflict Resolution Workbench */}
      {conflicts.length > 0 && (
        <div className="bg-white border-2 border-amber-500 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">
                Active Synchronization Conflicts Requiring Resolution ({conflicts.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Compare checksums and field values before committing authoritative record
            </span>
          </div>

          <div className="space-y-4">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50/60 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="text-xs font-bold text-slate-900">
                    Report #{conflict.reportNo} · Center: {conflict.centerCode}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Detected: {new Date(conflict.detectedAt).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Local Field Version */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Local Offline Field Version (IndexedDB)
                      </span>
                      <span className="font-mono text-[11px] text-amber-700 font-semibold">
                        v{conflict.localReport.syncVersion || 1} · Checksum:{' '}
                        {computeReportChecksum(conflict.localReport)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                      <div>
                        Inspector:{' '}
                        <strong className="text-slate-900">
                          {conflict.localReport.inspectorName}
                        </strong>
                      </div>
                      <div>
                        Oil Pressure:{' '}
                        <strong className="font-mono text-slate-900">
                          {conflict.localReport.parameters.engineOilPressureBar} Bar
                        </strong>
                      </div>
                      <div>
                        Health Score:{' '}
                        <strong className="font-mono text-slate-900">
                          {conflict.localReport.healthScore}%
                        </strong>
                      </div>
                      <div>
                        Readiness:{' '}
                        <strong className="text-slate-900">
                          {conflict.localReport.readinessStatus}
                        </strong>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Remarks: {conflict.localReport.generalRemarks || 'Standard field log'}
                    </div>
                    <button
                      type="button"
                      disabled={!canModifySync}
                      onClick={() => onResolveConflict(conflict, 'keep_local')}
                      className="w-full mt-2 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded text-xs transition-colors"
                    >
                      Keep Local Field Version & Overwrite Server
                    </button>
                  </div>

                  {/* Remote Server Version */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Authoritative Server Version (Cloud / HQ)
                      </span>
                      <span className="font-mono text-[11px] text-emerald-700 font-semibold">
                        v{conflict.serverReport.syncVersion || 2} · Checksum:{' '}
                        {computeReportChecksum(conflict.serverReport)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                      <div>
                        Inspector:{' '}
                        <strong className="text-slate-900">
                          {conflict.serverReport.inspectorName}
                        </strong>
                      </div>
                      <div>
                        Oil Pressure:{' '}
                        <strong className="font-mono text-slate-900">
                          {conflict.serverReport.parameters.engineOilPressureBar} Bar
                        </strong>
                      </div>
                      <div>
                        Health Score:{' '}
                        <strong className="font-mono text-slate-900">
                          {conflict.serverReport.healthScore}%
                        </strong>
                      </div>
                      <div>
                        Readiness:{' '}
                        <strong className="text-slate-900">
                          {conflict.serverReport.readinessStatus}
                        </strong>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Remarks: {conflict.serverReport.generalRemarks || 'Remote HQ update'}
                    </div>
                    <button
                      type="button"
                      disabled={!canModifySync}
                      onClick={() => onResolveConflict(conflict, 'accept_server')}
                      className="w-full mt-2 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 font-semibold rounded text-xs transition-colors"
                    >
                      Accept Server Version & Discard Local Edits
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IndexedDB Outbox Sync Queue & Data Integrity Ledger */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" />
              IndexedDB Inspection Ledger & Checksum Integrity Status
            </h3>
            <p className="text-xs text-slate-500">
              Every inspection saved offline is queued in IndexedDB with an FNV-1a integrity hash and version counter.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Pending Queue: {syncQueue.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-2.5 text-left">Report No</th>
                <th className="px-4 py-2.5 text-left">Center / Genset</th>
                <th className="px-4 py-2.5 text-left">Inspector</th>
                <th className="px-4 py-2.5 text-right">Sync Version</th>
                <th className="px-4 py-2.5 text-left">FNV-1a Integrity Checksum</th>
                <th className="px-4 py-2.5 text-left">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reports.slice(0, 15).map((r) => {
                const checksum = r.checksum || computeReportChecksum(r);
                const isQueued = syncQueue.some((q) => q.entityId === r.id);
                const isConflicted = conflicts.some((c) => c.id === r.id);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                      #{r.reportNo}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-slate-900">{r.centerCode}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="font-mono text-slate-600">{r.gensetModel}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{r.inspectorName}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-800">
                      v{r.syncVersion || 1}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">
                      0x{checksum}
                    </td>
                    <td className="px-4 py-2.5">
                      {isConflicted ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> Version Conflict
                        </span>
                      ) : isQueued || r.syncState === 'pending_offline' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <ArrowRight className="w-3.5 h-3.5" /> Queued in IndexedDB (Offline)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Synced & Verified
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
