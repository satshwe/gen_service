import React, { useState, useMemo, useRef } from 'react';
import {
  Settings,
  Building2,
  Cpu,
  Layers,
  Mail,
  Shield,
  Plus,
  Search,
  Edit3,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Send,
  Users,
  Key,
  X,
  FileSpreadsheet,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  Center,
  GeneratorAsset,
  BreakerType,
  BreakerPoles,
  UserProfile,
  UserRole,
  CenterRecipientPerson,
} from '../types';
import {
  DEFAULT_SECTOR_DIRECTORY,
  SectorInfo,
  getActiveSectorDirectory,
  saveCustomSectorDirectory,
  resetSectorDirectoryToDefault,
  getCenterSectorOverrides,
  saveCenterSectorOverride,
  getSectorForCenter,
  getSavedCenterEmailOverrides,
  getSavedCenterPeopleDirectory,
  getDefaultCenterPeopleList,
  saveCenterEmailOverride,
  evaluateCenterReceiptEmailRule,
  exportMasterAssetsToExcel,
  parseImportedAssetsFile,
} from '../utils/exportUtils';

interface SetupModuleProps {
  centers: Center[];
  generators: GeneratorAsset[];
  usersDirectory: UserProfile[];
  currentUser: UserProfile;
  onSaveCenter: (center: Center) => void;
  onDeleteCenter: (id: string) => void;
  onSaveGenerator: (generator: GeneratorAsset) => void;
  onDeleteGenerator: (id: string) => void;
  onBulkUpdateAssets: (centers: Center[], generators: GeneratorAsset[]) => void;
  onUpdateUserRole?: (uid: string, newRole: UserRole) => void;
  onUpdateUserPassword?: (uid: string, newPassword: string) => void;
  onAddDirectoryUser?: (user: UserProfile) => void;
  onDeleteDirectoryUser?: (uid: string) => void;
}

export const SetupModule: React.FC<SetupModuleProps> = ({
  centers,
  generators,
  usersDirectory,
  currentUser,
  onSaveCenter,
  onDeleteCenter,
  onSaveGenerator,
  onDeleteGenerator,
  onBulkUpdateAssets,
  onUpdateUserRole,
  onUpdateUserPassword,
  onAddDirectoryUser,
  onDeleteDirectoryUser,
}) => {
  const isAdmin = currentUser.role === 'Administrator';
  const isChiefOrAdmin = isAdmin || currentUser.role === 'Chief Engineer';

  // Sub-tabs: Sectors, Centers, Generators, Email Routing, Users
  const [setupTab, setSetupTab] = useState<'sectors' | 'centers' | 'generators' | 'emails' | 'users'>(
    'sectors'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showStatus = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // =========================================================================
  // 1. SECTORS MANAGEMENT STATE
  // =========================================================================
  const [sectorsList, setSectorsList] = useState<SectorInfo[]>(() =>
    getActiveSectorDirectory().map((s) => ({ ...s }))
  );
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [editingSectorIdx, setEditingSectorIdx] = useState<number | null>(null);
  const [sectorDraft, setSectorDraft] = useState<SectorInfo>({
    sectorName: '',
    sectorLeadTitle: '',
    defaultRecipients: 'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
  });

  const handleOpenNewSectorModal = () => {
    setEditingSectorIdx(null);
    setSectorDraft({
      sectorName: '',
      sectorLeadTitle: 'Sector Engineering Lead',
      defaultRecipients: 'chief.engineer@cityproperties.com.mm, satshwe36@gmail.com',
    });
    setIsSectorModalOpen(true);
  };

  const handleOpenEditSectorModal = (index: number) => {
    setEditingSectorIdx(index);
    setSectorDraft({ ...sectorsList[index] });
    setIsSectorModalOpen(true);
  };

  const handleSaveSector = () => {
    if (!sectorDraft.sectorName.trim()) {
      showStatus('Sector Name is required.', 'error');
      return;
    }
    const updated = [...sectorsList];
    if (editingSectorIdx !== null) {
      updated[editingSectorIdx] = { ...sectorDraft };
    } else {
      updated.push({ ...sectorDraft });
    }
    saveCustomSectorDirectory(updated);
    setSectorsList(updated);
    setIsSectorModalOpen(false);
    showStatus(`Sector "${sectorDraft.sectorName}" saved successfully.`);
  };

  const handleDeleteSector = (index: number) => {
    if (sectorsList.length <= 1) {
      showStatus('Cannot delete the last remaining sector.', 'error');
      return;
    }
    const target = sectorsList[index];
    if (window.confirm(`Are you sure you want to remove Sector "${target.sectorName}"?`)) {
      const updated = sectorsList.filter((_, idx) => idx !== index);
      saveCustomSectorDirectory(updated);
      setSectorsList(updated);
      showStatus(`Sector "${target.sectorName}" deleted.`);
    }
  };

  const handleResetSectors = () => {
    if (window.confirm('Reset all Sectors back to corporate defaults?')) {
      const restored = resetSectorDirectoryToDefault();
      setSectorsList(restored);
      showStatus('Sectors reset to corporate defaults.');
    }
  };

  // Compute stats per sector
  const sectorStats = useMemo(() => {
    const overrides = getCenterSectorOverrides();
    const stats: Record<string, { centersCount: number; gensetsCount: number }> = {};
    sectorsList.forEach((s) => {
      stats[s.sectorName] = { centersCount: 0, gensetsCount: 0 };
    });

    centers.forEach((c) => {
      const s = getSectorForCenter(c.centerCode);
      if (!stats[s.sectorName]) {
        stats[s.sectorName] = { centersCount: 0, gensetsCount: 0 };
      }
      stats[s.sectorName].centersCount += 1;
      const gens = generators.filter((g) => g.centerId === c.id);
      stats[s.sectorName].gensetsCount += gens.length;
    });

    return stats;
  }, [sectorsList, centers, generators]);

  // =========================================================================
  // 2. COMMERCIAL CENTERS MANAGEMENT STATE
  // =========================================================================
  const [centerFilterRegion, setCenterFilterRegion] = useState<string>('ALL');
  const [centerFilterSector, setCenterFilterSector] = useState<string>('ALL');
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [editingCenterSector, setEditingCenterSector] = useState<string>('');
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredCenters = useMemo(() => {
    return centers.filter((c) => {
      if (centerFilterRegion !== 'ALL' && c.region !== centerFilterRegion) return false;
      const assignedSec = getSectorForCenter(c.centerCode).sectorName;
      if (centerFilterSector !== 'ALL' && assignedSec !== centerFilterSector) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.centerCode.toLowerCase().includes(q) ||
          c.centerName.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.township.toLowerCase().includes(q) ||
          c.contactPerson.toLowerCase().includes(q) ||
          c.contactPhone.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [centers, centerFilterRegion, centerFilterSector, searchQuery]);

  const handleOpenAddCenterModal = () => {
    const newId = `CTR-${String(centers.length + 1).padStart(3, '0')}`;
    setEditingCenter({
      id: newId,
      centerCode: '',
      centerName: '',
      address: '',
      township: 'Yangon',
      contactPerson: '',
      contactPhone: '09-',
      region: 'Yangon',
    });
    setEditingCenterSector(sectorsList[0]?.sectorName || 'City Mall Sector');
    setIsCenterModalOpen(true);
  };

  const handleOpenEditCenterModal = (c: Center) => {
    setEditingCenter({ ...c });
    const sec = getSectorForCenter(c.centerCode);
    setEditingCenterSector(sec.sectorName);
    setIsCenterModalOpen(true);
  };

  const handleSaveCenterSubmit = () => {
    if (!editingCenter || !editingCenter.centerCode.trim() || !editingCenter.centerName.trim()) {
      showStatus('Center Code and Center Name are required.', 'error');
      return;
    }
    onSaveCenter(editingCenter);
    if (editingCenterSector) {
      saveCenterSectorOverride(editingCenter.centerCode, editingCenterSector);
    }
    setIsCenterModalOpen(false);
    showStatus(`Center ${editingCenter.centerCode} saved successfully.`);
  };

  // =========================================================================
  // 3. GENERATORS FLEET MANAGEMENT STATE
  // =========================================================================
  const [genFilterCenter, setGenFilterCenter] = useState<string>('ALL');
  const [editingGen, setEditingGen] = useState<GeneratorAsset | null>(null);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);

  const filteredGenerators = useMemo(() => {
    return generators.filter((g) => {
      if (genFilterCenter !== 'ALL' && g.centerId !== genFilterCenter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          g.id.toLowerCase().includes(q) ||
          g.centerCode.toLowerCase().includes(q) ||
          g.generatorLabel.toLowerCase().includes(q) ||
          g.kvaRating.toLowerCase().includes(q) ||
          g.gensetModel.toLowerCase().includes(q) ||
          g.gensetSerialNo.toLowerCase().includes(q) ||
          g.engineModel.toLowerCase().includes(q) ||
          g.engineSerialNo.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [generators, genFilterCenter, searchQuery]);

  const handleOpenAddGenModal = () => {
    const defaultCenter = centers.find((c) => c.id === genFilterCenter) || centers[0];
    const newId = `GEN-${String(generators.length + 1).padStart(3, '0')}`;
    setEditingGen({
      id: newId,
      centerId: defaultCenter ? defaultCenter.id : 'CTR-001',
      centerCode: defaultCenter ? defaultCenter.centerCode : 'CMLSPL',
      generatorLabel: `Genset #${generators.filter((g) => g.centerId === defaultCenter?.id).length + 1} (Standby)`,
      kvaRating: '500 KVA',
      gensetModel: 'PM500CS',
      gensetSerialNo: '',
      engineModel: 'KTA-19G3A',
      engineSerialNo: '',
      alternatorModel: 'TAL-A47C J 6/4',
      alternatorSerialNo: '',
      controllerModel: 'DSE 7320 MK II',
      avrModel: 'R150',
      breakerType: 'ACB',
      breakerPoles: '3P',
      breakerAmpRating: '800',
      status: 'Active',
    });
    setIsGenModalOpen(true);
  };

  const handleOpenEditGenModal = (g: GeneratorAsset) => {
    setEditingGen({ ...g });
    setIsGenModalOpen(true);
  };

  const handleSaveGenSubmit = () => {
    if (!editingGen || !editingGen.kvaRating.trim() || !editingGen.generatorLabel.trim()) {
      showStatus('Rating (kVA) and Generator Label are required.', 'error');
      return;
    }
    const matchedCenter = centers.find((c) => c.id === editingGen.centerId);
    const updatedGen: GeneratorAsset = {
      ...editingGen,
      centerCode: matchedCenter ? matchedCenter.centerCode : editingGen.centerCode,
    };
    onSaveGenerator(updatedGen);
    setIsGenModalOpen(false);
    showStatus(`Generator ${updatedGen.id} (${updatedGen.generatorLabel}) saved.`);
  };

  // =========================================================================
  // 4. CENTER EMAIL & ALERT ROUTING MANAGEMENT STATE
  // =========================================================================
  const [selectedEmailCenterCode, setSelectedEmailCenterCode] = useState<string>(
    centers[0]?.centerCode || 'CMLSPL'
  );
  const [centerEmailDraft, setCenterEmailDraft] = useState<string>('');
  const [centerPeopleDraft, setCenterPeopleDraft] = useState<CenterRecipientPerson[]>([]);
  const [isEmailSaving, setIsEmailSaving] = useState(false);

  // Sync email draft whenever selectedEmailCenterCode changes
  React.useEffect(() => {
    const c = centers.find((item) => item.centerCode === selectedEmailCenterCode) || centers[0];
    if (c) {
      const rule = evaluateCenterReceiptEmailRule(c.centerCode, c.centerName, c.region);
      setCenterEmailDraft(rule.autoReceiptEmails);
      const people = getDefaultCenterPeopleList(c.centerCode, c.centerName, c.contactPerson, c.region);
      setCenterPeopleDraft(people);
    }
  }, [selectedEmailCenterCode, centers]);

  const handleSaveCenterEmailConfig = async () => {
    const c = centers.find((item) => item.centerCode === selectedEmailCenterCode);
    if (!c) return;
    setIsEmailSaving(true);
    try {
      await saveCenterEmailOverride(
        c.centerCode,
        c.centerName,
        c.region,
        centerEmailDraft,
        centerPeopleDraft
      );
      showStatus(`Email routing for ${c.centerCode} (${c.centerName}) saved successfully.`);
    } catch {
      showStatus('Failed to save email override.', 'error');
    } finally {
      setIsEmailSaving(false);
    }
  };

  const handleAddCenterRecipient = () => {
    const newPerson: CenterRecipientPerson = {
      id: `PER_${selectedEmailCenterCode}_${Date.now()}`,
      name: 'Operations Officer',
      roleTitle: 'Center Operations',
      email: `${selectedEmailCenterCode.toLowerCase()}.ops@cityproperties.com.mm`,
    };
    setCenterPeopleDraft((prev) => [...prev, newPerson]);
    // Also append to draft CSV
    setCenterEmailDraft((prev) => {
      const parts = prev.split(',').map((p) => p.trim()).filter(Boolean);
      if (!parts.includes(newPerson.email)) parts.push(newPerson.email);
      return parts.join(', ');
    });
  };

  const handleRemoveCenterRecipient = (id: string, email: string) => {
    setCenterPeopleDraft((prev) => prev.filter((p) => p.id !== id));
    setCenterEmailDraft((prev) => {
      const parts = prev.split(',').map((p) => p.trim()).filter(Boolean);
      return parts.filter((e) => e !== email).join(', ');
    });
  };

  // =========================================================================
  // 5. USER DIRECTORY & ACCESS CONTROL STATE
  // =========================================================================
  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [newUserDraft, setNewUserDraft] = useState<UserProfile>({
    uid: '',
    password: '',
    email: '',
    displayName: '',
    role: 'Field Engineer',
    department: 'Engineering Department',
  });

  const handleSavePasswordChange = (uid: string) => {
    if (!newPasswordInput.trim() || newPasswordInput.length < 6) {
      showStatus('Password must be at least 6 characters.', 'error');
      return;
    }
    if (onUpdateUserPassword) {
      onUpdateUserPassword(uid, newPasswordInput);
      setEditingUserUid(null);
      setNewPasswordInput('');
      showStatus(`Password updated for user ${uid}.`);
    }
  };

  const handleAddUserSubmit = () => {
    if (!newUserDraft.uid.trim() || !newUserDraft.displayName.trim()) {
      showStatus('UID and Display Name are required.', 'error');
      return;
    }
    if (onAddDirectoryUser) {
      onAddDirectoryUser({
        ...newUserDraft,
        uid: newUserDraft.uid.trim().toUpperCase(),
        email: newUserDraft.email.trim() || `${newUserDraft.uid.toLowerCase()}@cityproperties.com.mm`,
        password: newUserDraft.password?.trim() || 'City@2026',
        updatedAt: new Date().toISOString(),
      });
      setNewUserModalOpen(false);
      showStatus(`User ${newUserDraft.uid} created successfully.`);
    }
  };

  // =========================================================================
  // BULK EXCEL EXPORT & IMPORT
  // =========================================================================
  const handleExportMasterAssets = () => {
    exportMasterAssetsToExcel(centers, generators);
    showStatus('Master Assets Directory exported to Excel.');
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseImportedAssetsFile(file, centers, generators);
      if (parsed.centers.length === 0 && parsed.generators.length === 0) {
        showStatus('No valid centers or generators found in the file.', 'error');
        return;
      }
      onBulkUpdateAssets(parsed.centers, parsed.generators);
      showStatus(
        `Imported ${parsed.centers.length} Centers and ${parsed.generators.length} Generators from ${file.name}.`
      );
    } catch {
      showStatus('Failed to parse uploaded Excel/CSV file.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white rounded-xl p-5 sm:p-6 border border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-teal-400">
            <Settings className="w-4 h-4" />
            <span>Unified System Administration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            Master Setup &amp; Asset Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-myanmar">
            Master Assets၊ Sectors၊ Centers၊ Generators နှင့် Center အလိုက် Email ပေးပို့ခြင်းများကို တစ်နေရာတည်းမှ စီမံခန့်ခွဲသည့်ဗဟိုစနစ်
          </p>
        </div>

        {/* Global Master Asset Excel Actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportMasterAssets}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
              title="Export all Centers & Gensets to Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Master</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg shadow-xs transition-colors"
              title="Import Excel or CSV Master Assets"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Master</span>
            </button>
          </div>
        )}
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-3 rounded-lg text-xs font-semibold flex items-center justify-between border ${
            statusMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : statusMessage.type === 'info'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-xs flex items-center gap-1 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setSetupTab('sectors');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
            setupTab === 'sectors'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-teal-400" />
          <span>1. Sectors ({sectorsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSetupTab('centers');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
            setupTab === 'centers'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-blue-400" />
          <span>2. Centers ({centers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSetupTab('generators');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
            setupTab === 'generators'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>3. Generators Fleet ({generators.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSetupTab('emails');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
            setupTab === 'emails'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Mail className="w-4 h-4 text-amber-400" />
          <span>4. Center Email Routing</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setSetupTab('users');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
              setupTab === 'users'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 text-purple-400" />
            <span>5. User Security ({usersDirectory.length})</span>
          </button>
        )}
      </div>

      {/* =====================================================================
          TAB 1: SECTORS MANAGEMENT
         ===================================================================== */}
      {setupTab === 'sectors' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sectors &amp; Regional Cluster Directory</h2>
              <p className="text-xs text-slate-500 font-myanmar">
                လုပ်ငန်းခွဲ/ဇုန်အလိုက် စုဖွဲ့ထားသော Sectors များ၊ တာဝန်ခံခေါင်းဆောင်များနှင့် Default Email စာရင်း
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetSectors}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewSectorModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Sector</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectorsList.map((sec, idx) => {
              const stats = sectorStats[sec.sectorName] || { centersCount: 0, gensetsCount: 0 };
              return (
                <div
                  key={sec.sectorName}
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-sm text-slate-900">{sec.sectorName}</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                        {stats.centersCount} Centers / {stats.gensetsCount} Gensets
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">{sec.sectorLeadTitle}</div>
                    <div className="text-[11px] text-slate-500 font-mono break-all line-clamp-2">
                      <span className="font-semibold text-slate-700">Recipients: </span>
                      {sec.defaultRecipients}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditSectorModal(idx)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs inline-flex items-center gap-1 font-semibold"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSector(idx)}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded text-xs inline-flex items-center gap-1 font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: COMMERCIAL CENTERS MANAGEMENT
         ===================================================================== */}
      {setupTab === 'centers' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Commercial Centers Directory</h2>
              <p className="text-xs text-slate-500 font-myanmar">
                City Properties ၏ ကုန်တိုက်၊ စူပါစင်တာနှင့် စက်ရုံ/ဂိုဒေါင် စုစုပေါင်း ({centers.length}) ခု၏ အချက်အလက်များ
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddCenterModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Commercial Center</span>
              </button>
            )}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search center code, name, township..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <select
                value={centerFilterSector}
                onChange={(e) => setCenterFilterSector(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All Sectors</option>
                {sectorsList.map((s) => (
                  <option key={s.sectorName} value={s.sectorName}>
                    {s.sectorName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={centerFilterRegion}
                onChange={(e) => setCenterFilterRegion(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All Regions</option>
                <option value="Yangon">Yangon</option>
                <option value="Mandalay">Mandalay</option>
                <option value="Naypyitaw">Naypyitaw</option>
                <option value="Upper Myanmar">Upper Myanmar</option>
                <option value="Lower Myanmar">Lower Myanmar</option>
              </select>
            </div>
          </div>

          {/* Centers Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Center Code</th>
                  <th className="py-2.5 px-3">Center Name</th>
                  <th className="py-2.5 px-3">Assigned Sector</th>
                  <th className="py-2.5 px-3">Township / Region</th>
                  <th className="py-2.5 px-3">Contact Person &amp; Phone</th>
                  <th className="py-2.5 px-3 text-center">GenSets</th>
                  {isAdmin && <th className="py-2.5 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCenters.map((c) => {
                  const sec = getSectorForCenter(c.centerCode);
                  const gensCount = generators.filter((g) => g.centerId === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{c.centerCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{c.centerName}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                          {sec.sectorName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {c.township} ({c.region})
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        <div>{c.contactPerson}</div>
                        <div className="font-mono text-[11px] text-slate-500">{c.contactPhone}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-900">
                        {gensCount}
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCenterModal(c)}
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded"
                            title="Edit Center"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete Center ${c.centerCode} (${c.centerName})?`)) {
                                onDeleteCenter(c.id);
                                showStatus(`Center ${c.centerCode} deleted.`);
                              }
                            }}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded ml-1"
                            title="Delete Center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: GENERATORS FLEET MANAGEMENT
         ===================================================================== */}
      {setupTab === 'generators' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Generators Fleet Directory</h2>
              <p className="text-xs text-slate-500 font-myanmar">
                စင်တာ ၃၁ ခုတွင် တပ်ဆင်ထားသော မီးစက်ကြီး ({generators.length}) လုံး၏ စက်ပိုင်းဆိုင်ရာ သတ်မှတ်ချက်များ
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddGenModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Generator Asset</span>
              </button>
            )}
          </div>

          {/* Search & Center Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search generator label, kVA, model, serial..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <select
                value={genFilterCenter}
                onChange={(e) => setGenFilterCenter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All Centers ({centers.length})</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.centerCode} — {c.centerName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Generators Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Asset ID / Center</th>
                  <th className="py-2.5 px-3">Label &amp; Rating</th>
                  <th className="py-2.5 px-3">Engine &amp; Serial</th>
                  <th className="py-2.5 px-3">Alternator &amp; Controller</th>
                  <th className="py-2.5 px-3">Breaker (CB)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  {isAdmin && <th className="py-2.5 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredGenerators.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">{g.id}</div>
                      <div className="text-[11px] text-slate-500 font-semibold">{g.centerCode}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{g.generatorLabel}</div>
                      <div className="font-mono text-teal-700 font-semibold">{g.kvaRating}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <div>{g.engineModel}</div>
                      <div className="font-mono text-[11px] text-slate-500">SN: {g.engineSerialNo || '-'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <div>{g.alternatorModel}</div>
                      <div className="font-mono text-[11px] text-slate-500">Ctrl: {g.controllerModel}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {g.breakerType} {g.breakerPoles} {g.breakerAmpRating}A
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          g.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : g.status === 'Standby'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEditGenModal(g)}
                          className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded"
                          title="Edit Generator"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete Generator ${g.id} (${g.generatorLabel})?`)) {
                              onDeleteGenerator(g.id);
                              showStatus(`Generator ${g.id} deleted.`);
                            }
                          }}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded ml-1"
                          title="Delete Generator"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: CENTER EMAIL & ALERT ROUTING MANAGEMENT
         ===================================================================== */}
      {setupTab === 'emails' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Center-Wise Email Notification Routing</h2>
              <p className="text-xs text-slate-500 font-myanmar">
                Center အလိုက် Inspection/Servicing အစီရင်ခံစာများ အလိုအလျောက် ပေးပို့မည့် Email လိပ်စာများကို စီမံခန့်ခွဲခြင်း
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveCenterEmailConfig}
                disabled={isEmailSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isEmailSaving ? 'Saving...' : 'Save Email Routing'}</span>
              </button>
            </div>
          </div>

          {/* Center Selector for Email */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Select Target Commercial Center (စင်တာ ရွေးချယ်ပါ)
                </label>
                <p className="text-[11px] text-slate-500">
                  Select any center to configure its dedicated recipient email list &amp; routing rules
                </p>
              </div>
              <div className="sm:w-80">
                <select
                  value={selectedEmailCenterCode}
                  onChange={(e) => setSelectedEmailCenterCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  {centers.map((c) => (
                    <option key={c.centerCode} value={c.centerCode}>
                      {c.centerCode} — {c.centerName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Email Recipients CSV */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Email Recipients (ကော်မာခြား၍ ရေးသွင်းနိုင်ပါသည်)
              </label>
              <textarea
                rows={2}
                value={centerEmailDraft}
                onChange={(e) => setCenterEmailDraft(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 bg-white"
                placeholder="e.g. center.facility@cityproperties.com.mm, chief.engineer@cityproperties.com.mm"
              />
            </div>
          </div>

          {/* Key Stakeholders & Duty Person List for this Center */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Assigned Center Stakeholders &amp; Recipients Directory
              </h3>
              <button
                type="button"
                onClick={handleAddCenterRecipient}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Person</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Role / Designation</th>
                    <th className="py-2 px-3">Email Address</th>
                    <th className="py-2 px-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {centerPeopleDraft.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-2 px-3 text-slate-600">{p.roleTitle}</td>
                      <td className="py-2 px-3 font-mono text-slate-800">{p.email}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveCenterRecipient(p.id, p.email)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {centerPeopleDraft.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        No specific individual contacts assigned yet. Default sector emails will be used.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: USER SECURITY & ACCESS CONTROL
         ===================================================================== */}
      {setupTab === 'users' && isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">User Access Control &amp; Role Security</h2>
              <p className="text-xs text-slate-500 font-myanmar">
                စနစ်သုံး အကောင့်များ (Administrator, Chief Engineer, Field Engineer, Viewer) နှင့် လျှို့ဝှက်နံပါတ် စီမံခန့်ခွဲမှု
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewUserDraft({
                  uid: `USR_ENG_${String(usersDirectory.length + 1).padStart(2, '0')}`,
                  password: 'Eng@2026',
                  email: '',
                  displayName: '',
                  role: 'Field Engineer',
                  department: 'Engineering Department',
                });
                setNewUserModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Authorized User</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">User UID</th>
                  <th className="py-2.5 px-3">Display Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Assigned Role</th>
                  <th className="py-2.5 px-3">Password / Security</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usersDirectory.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{u.uid}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{u.displayName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{u.email}</td>
                    <td className="py-2.5 px-3">
                      {onUpdateUserRole ? (
                        <select
                          value={u.role}
                          onChange={(e) => onUpdateUserRole(u.uid, e.target.value as UserRole)}
                          className="px-2 py-1 text-xs border border-slate-300 rounded font-semibold bg-white"
                        >
                          <option value="Administrator">Administrator</option>
                          <option value="Chief Engineer">Chief Engineer</option>
                          <option value="Field Engineer">Field Engineer</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className="font-semibold text-slate-800">{u.role}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {editingUserUid === u.uid ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="New password (min 6)"
                            className="px-2 py-1 text-xs border border-slate-300 rounded font-mono w-36"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePasswordChange(u.uid)}
                            className="px-2 py-1 bg-slate-900 text-white rounded text-xs font-semibold"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUserUid(null)}
                            className="px-1.5 py-1 text-slate-500 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserUid(u.uid);
                            setNewPasswordInput('');
                          }}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Reset Password</span>
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {u.uid !== 'USR_ADMIN_01' && onDeleteDirectoryUser && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete user ${u.uid} (${u.displayName})?`)) {
                              onDeleteDirectoryUser(u.uid);
                              showStatus(`User ${u.uid} deleted.`);
                            }
                          }}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTOR EDIT / ADD MODAL
         ===================================================================== */}
      {isSectorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingSectorIdx !== null ? 'Edit Sector' : 'Add New Sector'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSectorModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Sector Name *</label>
                <input
                  type="text"
                  value={sectorDraft.sectorName}
                  onChange={(e) => setSectorDraft({ ...sectorDraft, sectorName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. City Mall Sector"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sector Lead / Supervisor Title *</label>
                <input
                  type="text"
                  value={sectorDraft.sectorLeadTitle}
                  onChange={(e) => setSectorDraft({ ...sectorDraft, sectorLeadTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
                  placeholder="e.g. City Mall Sector Engineering Lead"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Default Email Distribution (Comma separated) *
                </label>
                <textarea
                  rows={3}
                  value={sectorDraft.defaultRecipients}
                  onChange={(e) => setSectorDraft({ ...sectorDraft, defaultRecipients: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-slate-900"
                  placeholder="chief.engineer@cityproperties.com.mm, satshwe36@gmail.com"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSectorModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSector}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Save Sector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CENTER EDIT / ADD MODAL
         ===================================================================== */}
      {isCenterModalOpen && editingCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCenter.id.startsWith('CTR-') ? 'Edit Commercial Center' : 'Add Commercial Center'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCenterModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Center Code *</label>
                  <input
                    type="text"
                    value={editingCenter.centerCode}
                    onChange={(e) =>
                      setEditingCenter({ ...editingCenter, centerCode: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    placeholder="e.g. CMLSPL"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Region *</label>
                  <select
                    value={editingCenter.region}
                    onChange={(e) =>
                      setEditingCenter({ ...editingCenter, region: e.target.value as Center['region'] })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Yangon">Yangon</option>
                    <option value="Mandalay">Mandalay</option>
                    <option value="Naypyitaw">Naypyitaw</option>
                    <option value="Upper Myanmar">Upper Myanmar</option>
                    <option value="Lower Myanmar">Lower Myanmar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Center Name *</label>
                <input
                  type="text"
                  value={editingCenter.centerName}
                  onChange={(e) => setEditingCenter({ ...editingCenter, centerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  placeholder="e.g. City Mall Shwe Pin Lone"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Sector *</label>
                <select
                  value={editingCenterSector}
                  onChange={(e) => setEditingCenterSector(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                >
                  {sectorsList.map((s) => (
                    <option key={s.sectorName} value={s.sectorName}>
                      {s.sectorName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Township</label>
                  <input
                    type="text"
                    value={editingCenter.township}
                    onChange={(e) => setEditingCenter({ ...editingCenter, township: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. North Dagon"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editingCenter.contactPhone}
                    onChange={(e) => setEditingCenter({ ...editingCenter, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="09-777148178"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Person (Center Manager)</label>
                <input
                  type="text"
                  value={editingCenter.contactPerson}
                  onChange={(e) => setEditingCenter({ ...editingCenter, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Ko Soe Nyein Oo"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editingCenter.address}
                  onChange={(e) => setEditingCenter({ ...editingCenter, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Full street address"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCenterModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCenterSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Save Center
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          GENERATOR EDIT / ADD MODAL
         ===================================================================== */}
      {isGenModalOpen && editingGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingGen.id ? `Edit Generator (${editingGen.id})` : 'Add Generator Asset'}
              </h3>
              <button
                type="button"
                onClick={() => setIsGenModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Center Association *</label>
                  <select
                    value={editingGen.centerId}
                    onChange={(e) => {
                      const matched = centers.find((c) => c.id === e.target.value);
                      setEditingGen({
                        ...editingGen,
                        centerId: e.target.value,
                        centerCode: matched ? matched.centerCode : editingGen.centerCode,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.centerCode} — {c.centerName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status *</label>
                  <select
                    value={editingGen.status}
                    onChange={(e) =>
                      setEditingGen({ ...editingGen, status: e.target.value as GeneratorAsset['status'] })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="Active">Active (Duty/Main)</option>
                    <option value="Standby">Standby</option>
                    <option value="Maintenance">Maintenance / Offline</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Generator Label *</label>
                  <input
                    type="text"
                    value={editingGen.generatorLabel}
                    onChange={(e) => setEditingGen({ ...editingGen, generatorLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                    placeholder="e.g. Genset #1 (Main)"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Power Rating (kVA) *</label>
                  <input
                    type="text"
                    value={editingGen.kvaRating}
                    onChange={(e) => setEditingGen({ ...editingGen, kvaRating: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    placeholder="e.g. 500 KVA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Genset Model</label>
                  <input
                    type="text"
                    value={editingGen.gensetModel}
                    onChange={(e) => setEditingGen({ ...editingGen, gensetModel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. PM500CS"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Genset Serial No.</label>
                  <input
                    type="text"
                    value={editingGen.gensetSerialNo}
                    onChange={(e) => setEditingGen({ ...editingGen, gensetSerialNo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="e.g. PM500CS22010246"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Engine Model</label>
                  <input
                    type="text"
                    value={editingGen.engineModel}
                    onChange={(e) => setEditingGen({ ...editingGen, engineModel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. KTA-19G3A"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Engine Serial No.</label>
                  <input
                    type="text"
                    value={editingGen.engineSerialNo}
                    onChange={(e) => setEditingGen({ ...editingGen, engineSerialNo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="e.g. 41326807"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alternator Model</label>
                  <input
                    type="text"
                    value={editingGen.alternatorModel}
                    onChange={(e) => setEditingGen({ ...editingGen, alternatorModel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. TAL-A47C"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Controller Model</label>
                  <input
                    type="text"
                    value={editingGen.controllerModel}
                    onChange={(e) => setEditingGen({ ...editingGen, controllerModel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="e.g. DSE 7320 MK II"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Breaker Type</label>
                  <select
                    value={editingGen.breakerType}
                    onChange={(e) => setEditingGen({ ...editingGen, breakerType: e.target.value as BreakerType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="ACB">ACB</option>
                    <option value="MCCB">MCCB</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Breaker Poles</label>
                  <select
                    value={editingGen.breakerPoles}
                    onChange={(e) => setEditingGen({ ...editingGen, breakerPoles: e.target.value as BreakerPoles })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="3P">3P</option>
                    <option value="4P">4P</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Breaker Amp (A)</label>
                  <input
                    type="text"
                    value={editingGen.breakerAmpRating}
                    onChange={(e) => setEditingGen({ ...editingGen, breakerAmpRating: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    placeholder="800"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGenModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGenSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Save Generator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD AUTHORIZED USER MODAL
         ===================================================================== */}
      {newUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Authorized User</h3>
              <button
                type="button"
                onClick={() => setNewUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">User UID *</label>
                <input
                  type="text"
                  value={newUserDraft.uid}
                  onChange={(e) => setNewUserDraft({ ...newUserDraft, uid: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  placeholder="e.g. USR_ENG_05"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  value={newUserDraft.displayName}
                  onChange={(e) => setNewUserDraft({ ...newUserDraft, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  placeholder="e.g. Min Thu Aung"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">System Role *</label>
                <select
                  value={newUserDraft.role}
                  onChange={(e) => setNewUserDraft({ ...newUserDraft, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Chief Engineer">Chief Engineer</option>
                  <option value="Field Engineer">Field Engineer</option>
                  <option value="Viewer">Viewer (Commercial Center Manager)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Password *</label>
                <input
                  type="text"
                  value={newUserDraft.password}
                  onChange={(e) => setNewUserDraft({ ...newUserDraft, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={newUserDraft.email}
                  onChange={(e) => setNewUserDraft({ ...newUserDraft, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="user@cityproperties.com.mm"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewUserModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddUserSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
