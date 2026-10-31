import React, { useState, useMemo, useRef } from 'react';
import {
  Building2,
  Cpu,
  Plus,
  Search,
  Edit3,
  Trash2,
  Upload,
  FileSpreadsheet,
  Download,
  ClipboardCheck,
  X,
} from 'lucide-react';
import { Center, GeneratorAsset, BreakerType, BreakerPoles, UserRole } from '../types';
import {
  exportMasterAssetsToExcel,
  parseImportedAssetsFile,
  getSectorForCenter,
  getActiveSectorDirectory,
  saveCenterSectorOverride,
  saveCustomSectorDirectory,
} from '../utils/exportUtils';

interface MasterAssetModuleProps {
  centers: Center[];
  generators: GeneratorAsset[];
  onSaveCenter: (center: Center) => void;
  onDeleteCenter: (id: string) => void;
  onSaveGenerator: (generator: GeneratorAsset) => void;
  onDeleteGenerator: (id: string) => void;
  onBulkUpdateAssets: (centers: Center[], generators: GeneratorAsset[]) => void;
  onStartInspectionForAsset: (centerId: string, generatorId: string) => void;
  currentUserRole?: UserRole;
}

export const MasterAssetModule: React.FC<MasterAssetModuleProps> = ({
  centers,
  generators,
  onSaveCenter,
  onDeleteCenter,
  onSaveGenerator,
  onDeleteGenerator,
  onBulkUpdateAssets,
  onStartInspectionForAsset,
  currentUserRole = 'Administrator',
}) => {
  const isAdmin =
    currentUserRole === 'Administrator' || currentUserRole === 'Chief Engineer';
  const canInspect =
    isAdmin || currentUserRole === 'Field Engineer';
  const [activeView, setActiveView] = useState<'centers' | 'generators'>('centers');
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [centerFilterForGen, setCenterFilterForGen] = useState<string>('ALL');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Center Modal State
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [editingCenterSector, setEditingCenterSector] = useState<string>('');
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);

  // Generator Modal State
  const [editingGenerator, setEditingGenerator] = useState<GeneratorAsset | null>(null);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);

  const filteredCenters = useMemo(() => {
    return centers.filter((c) => {
      if (regionFilter !== 'ALL' && c.region !== regionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.centerCode.toLowerCase().includes(q) ||
          c.centerName.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.contactPerson.toLowerCase().includes(q) ||
          c.contactPhone.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [centers, regionFilter, searchQuery]);

  const filteredGenerators = useMemo(() => {
    return generators.filter((g) => {
      if (centerFilterForGen !== 'ALL' && g.centerId !== centerFilterForGen) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          g.id.toLowerCase().includes(q) ||
          g.centerCode.toLowerCase().includes(q) ||
          g.kvaRating.toLowerCase().includes(q) ||
          g.gensetModel.toLowerCase().includes(q) ||
          g.gensetSerialNo.toLowerCase().includes(q) ||
          g.engineModel.toLowerCase().includes(q) ||
          g.engineSerialNo.toLowerCase().includes(q) ||
          g.alternatorModel.toLowerCase().includes(q) ||
          g.controllerModel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [generators, centerFilterForGen, searchQuery]);

  const openNewCenterModal = () => {
    const nextIdx = centers.length + 1;
    setEditingCenter({
      id: `CTR-${String(nextIdx).padStart(3, '0')}`,
      centerCode: '',
      centerName: '',
      address: '',
      township: 'Yangon',
      contactPerson: '',
      contactPhone: '',
      region: 'Yangon',
    });
    setEditingCenterSector(getActiveSectorDirectory()[0]?.sectorName || 'City Mall Sector');
    setIsCenterModalOpen(true);
  };

  const openEditCenterModal = (center: Center) => {
    setEditingCenter({ ...center });
    setEditingCenterSector(getSectorForCenter(center.centerCode).sectorName);
    setIsCenterModalOpen(true);
  };

  const openNewGeneratorModal = (preselectedCenterId?: string) => {
    const nextIdx = generators.length + 1;
    const targetCenter =
      centers.find((c) => c.id === preselectedCenterId) || centers[0];
    setEditingGenerator({
      id: `GEN-${String(nextIdx).padStart(3, '0')}`,
      centerId: targetCenter?.id || 'CTR-001',
      centerCode: targetCenter?.centerCode || 'CMLSPL',
      generatorLabel: `Genset #${
        generators.filter((g) => g.centerId === targetCenter?.id).length + 1
      } (500 KVA)`,
      kvaRating: '500 KVA',
      gensetModel: 'PM500CS',
      gensetSerialNo: '',
      engineModel: 'KTA-19G3A',
      engineSerialNo: '',
      alternatorModel: 'TAL-A47C J 6/4',
      alternatorSerialNo: '',
      controllerModel: 'DSE 7320 MK II',
      avrModel: 'R150',
      breakerType: 'MCCB',
      breakerPoles: '3P',
      breakerAmpRating: '800',
      status: 'Active',
    });
    setIsGeneratorModalOpen(true);
  };

  const openEditGeneratorModal = (gen: GeneratorAsset) => {
    setEditingGenerator({ ...gen });
    setIsGeneratorModalOpen(true);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseImportedAssetsFile(file, centers, generators);
      onBulkUpdateAssets(result.centers, result.generators);
      setImportFeedback(
        `Bulk Import Completed: ${result.importedCentersCount} Centers & ${result.importedGeneratorsCount} Generators processed.`
      );
      setTimeout(() => setImportFeedback(null), 5000);
    } catch {
      setImportFeedback('Failed to parse file. Please upload a valid .xlsx or .csv file.');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Bulk Import/Export Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Master Asset Management (Centers & Generators)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Scalable registry currently managing {centers.length} Centers and {generators.length} Generators with full nameplate serialization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileImport}
            className="hidden"
          />
          {isAdmin && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Bulk Import (.xlsx / .csv)
            </button>
          )}

          <button
            type="button"
            onClick={() => exportMasterAssetsToExcel(centers, generators, 'xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Export Assets (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => exportMasterAssetsToExcel(centers, generators, 'csv')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={openNewCenterModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Center
              </button>

              <button
                type="button"
                onClick={() => openNewGeneratorModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Generator
              </button>
            </>
          )}
        </div>
      </div>

      {importFeedback && (
        <div className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between">
          <span>{importFeedback}</span>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            className="text-slate-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Segmented View Toggle & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveView('centers')}
            className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'centers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Centers Directory ({centers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveView('generators')}
            className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'generators'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Generators Registry ({generators.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeView === 'centers' ? (
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Regions</option>
              <option value="Yangon">Yangon</option>
              <option value="Mandalay">Mandalay</option>
              <option value="Naypyitaw">Naypyitaw</option>
              <option value="Upper Myanmar">Upper Myanmar</option>
              <option value="Lower Myanmar">Lower Myanmar</option>
            </select>
          ) : (
            <select
              value={centerFilterForGen}
              onChange={(e) => setCenterFilterForGen(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Centers ({centers.length})</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.centerCode} — {c.centerName}
                </option>
              ))}
            </select>
          )}

          <div className="relative min-w-[250px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeView === 'centers'
                  ? 'Search CMLSPL, address, contact...'
                  : 'Search model, S/N, KTA-19G3A, DSE...'
              }
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
      </div>

      {/* VIEW 1: CENTERS TABLE */}
      {activeView === 'centers' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Center ID</th>
                  <th className="px-4 py-3 text-left">Center Code</th>
                  <th className="px-4 py-3 text-left">Center Name & Address</th>
                  <th className="px-4 py-3 text-left">Sector Name</th>
                  <th className="px-4 py-3 text-left">Region</th>
                  <th className="px-4 py-3 text-left">Contact Person</th>
                  <th className="px-4 py-3 text-left">Contact Phone</th>
                  <th className="px-4 py-3 text-right">Generators</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCenters.map((center) => {
                  const linkedGens = generators.filter((g) => g.centerId === center.id);
                  const secInfo = getSectorForCenter(center.centerCode);
                  return (
                    <tr key={center.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-500">{center.id}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {center.centerCode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{center.centerName}</div>
                        <div className="text-[11px] text-slate-500">{center.address}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium text-[11px]">
                          {secInfo.sectorName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{center.region}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {center.contactPerson}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{center.contactPhone}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setCenterFilterForGen(center.id);
                            setActiveView('generators');
                          }}
                          className="font-mono font-bold text-slate-900 hover:underline"
                        >
                          {linkedGens.length} Units
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openNewGeneratorModal(center.id)}
                                className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                              >
                                + Add Genset
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditCenterModal(center)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                title="Edit Center"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteCenter(center.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Center"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400">Read-Only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: GENERATORS TABLE */}
      {activeView === 'generators' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-3 text-left">Gen ID</th>
                  <th className="px-3 py-3 text-left">Center</th>
                  <th className="px-3 py-3 text-left">KVA / Genset Model & S/N</th>
                  <th className="px-3 py-3 text-left">Engine Model & S/N</th>
                  <th className="px-3 py-3 text-left">Alternator Model & S/N</th>
                  <th className="px-3 py-3 text-left">Controller / AVR</th>
                  <th className="px-3 py-3 text-left">Breaker Spec</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredGenerators.map((gen) => (
                  <tr key={gen.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-3 font-mono font-semibold text-slate-700">{gen.id}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono font-bold text-slate-900">{gen.centerCode}</span>
                      <div className="text-[10px] text-slate-500">{gen.generatorLabel}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono font-bold text-slate-900">
                        {gen.kvaRating} · {gen.gensetModel}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        S/N: {gen.gensetSerialNo}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono font-semibold text-slate-800">
                        {gen.engineModel}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        S/N: {gen.engineSerialNo}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono font-semibold text-slate-800">
                        {gen.alternatorModel}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        S/N: {gen.alternatorSerialNo}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-700">
                      <div>{gen.controllerModel}</div>
                      <div className="text-[11px] text-slate-500">AVR: {gen.avrModel}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-800">
                      {gen.breakerType} · {gen.breakerPoles} · {gen.breakerAmpRating}A
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {canInspect && (
                          <button
                            type="button"
                            onClick={() => onStartInspectionForAsset(gen.centerId, gen.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                            title="Inspect this Generator"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            Inspect
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditGeneratorModal(gen)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              title="Edit Generator"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteGenerator(gen.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Generator"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {!canInspect && !isAdmin && (
                          <span className="text-[11px] text-slate-400">Read-Only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CENTER */}
      {isCenterModalOpen && editingCenter && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {centers.some((c) => c.id === editingCenter.id)
                  ? `Edit Center (${editingCenter.centerCode})`
                  : 'Add New Center'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCenterModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Center Code (e.g., CMLSPL)
                </label>
                <input
                  type="text"
                  value={editingCenter.centerCode}
                  onChange={(e) =>
                    setEditingCenter({ ...editingCenter, centerCode: e.target.value.toUpperCase() })
                  }
                  placeholder="CMLSPL"
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Region</label>
                <select
                  value={editingCenter.region}
                  onChange={(e) =>
                    setEditingCenter({
                      ...editingCenter,
                      region: e.target.value as Center['region'],
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Yangon">Yangon</option>
                  <option value="Mandalay">Mandalay</option>
                  <option value="Naypyitaw">Naypyitaw</option>
                  <option value="Upper Myanmar">Upper Myanmar</option>
                  <option value="Lower Myanmar">Lower Myanmar</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Center Full Name (e.g., City Mall Shwe Pin Lone)
                </label>
                <input
                  type="text"
                  value={editingCenter.centerName}
                  onChange={(e) =>
                    setEditingCenter({ ...editingCenter, centerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Full Address</label>
                <input
                  type="text"
                  value={editingCenter.address}
                  onChange={(e) => setEditingCenter({ ...editingCenter, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Person (e.g., Ko Soe Nyein Oo)
                </label>
                <input
                  type="text"
                  value={editingCenter.contactPerson}
                  onChange={(e) =>
                    setEditingCenter({ ...editingCenter, contactPerson: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contact Phone (e.g., 09-777148178)
                </label>
                <input
                  type="text"
                  value={editingCenter.contactPhone}
                  onChange={(e) =>
                    setEditingCenter({ ...editingCenter, contactPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Sector Name (Select or Type Custom Sector Name)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={
                      getActiveSectorDirectory().some(
                        (s) => s.sectorName === editingCenterSector
                      )
                        ? editingCenterSector
                        : '__CUSTOM__'
                    }
                    onChange={(e) => {
                      if (e.target.value !== '__CUSTOM__') {
                        setEditingCenterSector(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {getActiveSectorDirectory().map((s) => (
                      <option key={s.sectorName} value={s.sectorName}>
                        {s.sectorName}
                      </option>
                    ))}
                    {!getActiveSectorDirectory().some(
                      (s) => s.sectorName === editingCenterSector
                    ) && <option value="__CUSTOM__">Custom: {editingCenterSector}</option>}
                  </select>
                  <input
                    type="text"
                    value={editingCenterSector}
                    onChange={(e) => setEditingCenterSector(e.target.value)}
                    placeholder="Type / Edit Sector Name..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-myanmar"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCenterModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingCenter.centerCode.trim()) return;
                  if (editingCenterSector.trim()) {
                    saveCenterSectorOverride(
                      editingCenter.centerCode.trim(),
                      editingCenterSector.trim()
                    );
                    const activeDir = getActiveSectorDirectory();
                    if (!activeDir.some((s) => s.sectorName === editingCenterSector.trim())) {
                      saveCustomSectorDirectory([
                        ...activeDir,
                        {
                          sectorName: editingCenterSector.trim(),
                          sectorLeadTitle: `${editingCenterSector.trim()} Engineering Lead`,
                          defaultRecipients:
                            'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
                        },
                      ]);
                    }
                  }
                  onSaveCenter(editingCenter);
                  setIsCenterModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Save Center
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT GENERATOR */}
      {isGeneratorModalOpen && editingGenerator && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {generators.some((g) => g.id === editingGenerator.id)
                  ? `Edit Generator (${editingGenerator.id})`
                  : 'Add & Link Generator Asset'}
              </h3>
              <button
                type="button"
                onClick={() => setIsGeneratorModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Linked Center</label>
                <select
                  value={editingGenerator.centerId}
                  onChange={(e) => {
                    const c = centers.find((ct) => ct.id === e.target.value);
                    setEditingGenerator({
                      ...editingGenerator,
                      centerId: e.target.value,
                      centerCode: c?.centerCode || editingGenerator.centerCode,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.centerCode} — {c.centerName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  KVA Rating (e.g., 500 KVA)
                </label>
                <input
                  type="text"
                  value={editingGenerator.kvaRating}
                  onChange={(e) =>
                    setEditingGenerator({ ...editingGenerator, kvaRating: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Genset Model (e.g., PM500CS)
                </label>
                <input
                  type="text"
                  value={editingGenerator.gensetModel}
                  onChange={(e) =>
                    setEditingGenerator({ ...editingGenerator, gensetModel: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Genset Serial No (e.g., PM500CS22010246)
                </label>
                <input
                  type="text"
                  value={editingGenerator.gensetSerialNo}
                  onChange={(e) =>
                    setEditingGenerator({ ...editingGenerator, gensetSerialNo: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Engine Model (e.g., KTA-19G3A)
                </label>
                <input
                  type="text"
                  value={editingGenerator.engineModel}
                  onChange={(e) =>
                    setEditingGenerator({ ...editingGenerator, engineModel: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Engine Serial No (e.g., 41326807)
                </label>
                <input
                  type="text"
                  value={editingGenerator.engineSerialNo}
                  onChange={(e) =>
                    setEditingGenerator({ ...editingGenerator, engineSerialNo: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alternator Model (e.g., TAL-A47C J 6/4)
                </label>
                <input
                  type="text"
                  value={editingGenerator.alternatorModel}
                  onChange={(e) =>
                    setEditingGenerator({ ...editingGenerator, alternatorModel: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Alternator Serial No (e.g., 772514002)
                </label>
                <input
                  type="text"
                  value={editingGenerator.alternatorSerialNo}
                  onChange={(e) =>
                    setEditingGenerator({
                      ...editingGenerator,
                      alternatorSerialNo: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Controller Model (e.g., DSE 7320 MK II)
                </label>
                <input
                  type="text"
                  value={editingGenerator.controllerModel}
                  onChange={(e) =>
                    setEditingGenerator({ ...editingGenerator, controllerModel: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  AVR Model (e.g., R150)
                </label>
                <input
                  type="text"
                  value={editingGenerator.avrModel}
                  onChange={(e) =>
                    setEditingGenerator({ ...editingGenerator, avrModel: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Breaker Type / Poles / Amp
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <select
                    value={editingGenerator.breakerType}
                    onChange={(e) =>
                      setEditingGenerator({
                        ...editingGenerator,
                        breakerType: e.target.value as BreakerType,
                      })
                    }
                    className="px-1.5 py-2 font-mono border border-slate-300 rounded bg-white"
                  >
                    <option value="MCCB">MCCB</option>
                    <option value="ACB">ACB</option>
                  </select>
                  <select
                    value={editingGenerator.breakerPoles}
                    onChange={(e) =>
                      setEditingGenerator({
                        ...editingGenerator,
                        breakerPoles: e.target.value as BreakerPoles,
                      })
                    }
                    className="px-1.5 py-2 font-mono border border-slate-300 rounded bg-white"
                  >
                    <option value="3P">3P</option>
                    <option value="4P">4P</option>
                  </select>
                  <input
                    type="text"
                    value={editingGenerator.breakerAmpRating}
                    onChange={(e) =>
                      setEditingGenerator({
                        ...editingGenerator,
                        breakerAmpRating: e.target.value,
                      })
                    }
                    placeholder="800"
                    className="px-2 py-2 font-mono border border-slate-300 rounded"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsGeneratorModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveGenerator(editingGenerator);
                  setIsGeneratorModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Save Generator Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
