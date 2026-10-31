import React, { useState } from 'react';
import { Printer, ArrowLeft, FileSpreadsheet, Image as ImageIcon, CheckSquare, Square, Download, Mail } from 'lucide-react';
import { InspectionReport } from '../types';
import { CHECKLIST_DEFINITIONS } from '../data/checklistConfig';
import {
  formatDateDDMMYYYY,
  formatDateDotDDMMYYYY,
  exportInspectionsToExcel,
  downloadReportAsPdfFile,
  getSectorForCenter,
  getEngineerEmailByName,
} from '../utils/exportUtils';

interface OfficialReportPrintViewProps {
  report: InspectionReport;
  onBack?: () => void;
  onEdit?: (report: InspectionReport) => void;
}

export const OfficialReportPrintView: React.FC<OfficialReportPrintViewProps> = ({
  report,
  onBack,
  onEdit,
}) => {
  const [showOriginalScans, setShowOriginalScans] = useState(false);

  const sectorInfo = getSectorForCenter(report.centerCode);
  const sectorLabel = report.sectorName || sectorInfo.sectorName;
  const fieldEngineerEmail =
    report.inspectorEmail || getEngineerEmailByName(report.inspectorName);
  const receiptMailList = report.recipientEmails || sectorInfo.defaultRecipients;

  const handlePrint = () => {
    window.print();
  };

  // Ensure at least 6 rows in Replacement Parts table to match official form
  const paddedParts = [...report.replacementParts];
  while (paddedParts.length < 6) {
    paddedParts.push({
      id: `empty-${paddedParts.length}`,
      sr: 0,
      partsNo: '',
      partsDescription: '',
      qty: '',
      remarks: '',
    });
  }

  return (
    <div className="space-y-6">
      {/* Screen-only toolbar */}
      <div className="no-print bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Reports
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Official 2-Page Service & Checklist Report #{report.reportNo}
              </h2>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs font-mono text-slate-600">{report.centerCode} ({report.kvaRating})</span>
            </div>
            <p className="text-xs text-slate-500">
              Page 1: Job Request & Service Report Form · Page 2: 25-Point Generator Checklist (Gen SOP-002)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOriginalScans(!showOriginalScans)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showOriginalScans
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {showOriginalScans ? 'Hide Original Paper Scans' : 'Compare Original Paper Scans'}
          </button>

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(report)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Edit Inspection
            </button>
          )}

          <button
            type="button"
            onClick={() => exportInspectionsToExcel([report], 'xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Single Excel
          </button>

          <button
            type="button"
            onClick={() => downloadReportAsPdfFile(report)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF File (.pdf)
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            Print 2-Page Report
          </button>
        </div>
      </div>

      {/* Optional Reference Scans Viewer */}
      {showOriginalScans && (
        <div className="no-print bg-slate-100 border border-slate-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-700">
              Original Field Paper Forms Reference (Report #002048 — CMLSPL 500 KVA)
            </h3>
            <span className="text-xs text-slate-500">Attached Reference Assets</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-2 rounded border border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">Page 1 Scan: Job Request and Service Report Form</p>
              <img
                src="/assets/aistudio/Media__26__31d64a5a.jfif"
                alt="Original Service Report Scan"
                referrerPolicy="no-referrer"
                className="w-full h-auto rounded border border-slate-100"
              />
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">Page 2 Scan: Generator Service / Inspection Checklist</p>
              <img
                src="/assets/aistudio/Media__27__34b91f2b.jfif"
                alt="Original Checklist Scan"
                referrerPolicy="no-referrer"
                className="w-full h-auto rounded border border-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile viewport note */}
      <div className="no-print block md:hidden bg-slate-100 border border-slate-200 text-slate-700 p-2.5 rounded-lg text-[11px] text-center font-myanmar">
        စမတ်ဖုန်းများတွင် A4 Print Sheet အား ဘေးသို့ ပွတ်ဆွဲ၍ ကြည့်ရှုနိုင်ပြီး၊ အပေါ်ရှိ <strong>Download PDF (.pdf)</strong> ခလုတ်ဖြင့်လည်း တိုက်ရိုက်ဒေါင်းလုဒ်ရယူနိုင်ပါသည်။
      </div>

      <div className="overflow-x-auto pb-4">
        {/* =====================================================================
            PAGE 1: JOB REQUEST AND SERVICE REPORT FORM
           ===================================================================== */}
        <div className="bg-white border border-slate-300 shadow-xs mx-auto min-w-[760px] max-w-[920px] p-6 sm:p-8 text-slate-900 print:shadow-none print:border-none print:p-0 print:max-w-none print:min-w-0 print-page-break">
        {/* Official Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
          {/* City Properties Official Logo */}
          <div className="flex items-center shrink-0">
            <img
              src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
              alt="City Properties Company Logo"
              className="h-14 sm:h-16 w-auto object-contain rounded shadow-2xs"
            />
          </div>

          {/* Center Company Address */}
          <div className="text-center px-2">
            <h1 className="text-base sm:text-lg font-bold tracking-wide text-slate-900 uppercase">
              CITY PROPERTIES CO., LTD
            </h1>
            <p className="text-xs font-medium text-slate-800">
              No. 73 - 76, Waizayantar Road. Thingangyun Township, Yangon,
            </p>
            <p className="text-xs font-medium text-slate-800">
              Union of Myanmar. Tel: (95) 01 3560402, 3565487
            </p>
          </div>

          {/* Right Serial Stamp */}
          <div className="text-right shrink-0 pt-2">
            <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-slate-900 tabular-nums">
              {report.reportNo}
            </span>
          </div>
        </div>

        <div className="text-center mb-3">
          <h2 className="text-base font-bold underline underline-offset-4 text-slate-900">
            {report.formCategory === 'REGULAR_SERVICING_300HR'
              ? 'Job Request and Service Report Form — 300-Hour Regular Servicing (PM)'
              : report.formCategory === 'BREAKDOWN_REPORT'
              ? 'Job Request and Service Report Form — Emergency Breakdown & Repair Report'
              : 'Job Request and Service Report Form — Regular Inspection'}
          </h2>
        </div>

        {/* Nameplate & Customer Header Grid */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse border border-slate-900 text-xs">
            <tbody>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold w-[16%] bg-slate-50/50">
                  Company Name
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-bold text-sm w-[36%]" colSpan={2}>
                  {report.centerCode}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold text-center w-[22%] bg-slate-50/50">
                  Model
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold text-center w-[26%] bg-slate-50/50">
                  Serial No;
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold bg-slate-50/50">
                  Contact Person
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium w-[22%]">
                  {report.contactPerson}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold w-[14%] bg-slate-50/50">
                  Generator
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.gensetModel}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.gensetSerialNo}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold bg-slate-50/50">
                  Contact Phone
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono">
                  {report.contactPhone}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold bg-slate-50/50">
                  Engine
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.engineModel}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.engineSerialNo}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 align-top bg-slate-50/50" colSpan={2} rowSpan={2}>
                  <span className="font-semibold">Address : </span>
                  <span className="font-medium">{report.address}</span>
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold bg-slate-50/50">
                  Alternator
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.alternatorModel}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.alternatorSerialNo}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-semibold bg-slate-50/50">
                  Genset Power:
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-bold text-center">
                  {report.kvaRating}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono">
                  <span className="font-sans font-semibold">Date: </span>
                  {formatDateDDMMYYYY(report.inspectionDate)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Job Request Type, Corrected Actions, Remarks */}
        <div className="space-y-2.5 text-xs mb-4">
          <div className="flex items-baseline gap-2 border-b border-slate-400 pb-1">
            <span className="font-semibold shrink-0">Customer Job Request Type :</span>
            <span className="font-medium text-slate-900">{report.jobRequestType}</span>
          </div>

          <div className="border-b border-slate-400 pb-1.5">
            <span className="font-semibold mr-2">Corrected Actions :</span>
            <span className="font-medium leading-relaxed text-slate-900 font-myanmar">
              {report.correctedActions}
            </span>
          </div>

          <div className="flex items-baseline gap-2 border-b border-slate-400 pb-1">
            <span className="font-semibold shrink-0">Remarks :</span>
            <span className="font-medium text-slate-900 font-myanmar">{report.generalRemarks || '—'}</span>
          </div>
        </div>

        {/* 300-Hour Running Hour Servicing Interval & Overhaul Summary Table (Shown for Form 2) */}
        {report.formCategory === 'REGULAR_SERVICING_300HR' && report.servicing300Hr && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full border-collapse border border-slate-900 text-[11px] font-myanmar">
              <thead>
                <tr className="bg-slate-100">
                  <th colSpan={5} className="border border-slate-900 py-1 text-center font-bold">
                    300-Hour Generator Running Hour Servicing Summary & Overhaul Checklist
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50/70 font-mono text-[10px]">
                  <td className="border border-slate-900 px-2 py-1">
                    Last Svc Hrs: <strong>{report.servicing300Hr.lastServiceRunningHours}</strong>
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    Current Run Hrs: <strong>{report.parameters.runningHours}</strong>
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    Elapsed Run Hrs: <strong>{report.servicing300Hr.hoursSinceLastService} / 300 hrs</strong>
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    Next 300-Hr Due: <strong>{report.servicing300Hr.nextServiceDueHours} hrs</strong>
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    Oil / Coolant: <strong>{report.servicing300Hr.oilLitersRefilled} / {report.servicing300Hr.coolantLitersRefilled}</strong>
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold text-center">
                  <td className="border border-slate-900 px-1.5 py-0.5 w-[6%]">Sr</td>
                  <td className="border border-slate-900 px-2 py-0.5 w-[44%]">300-Hr Servicing Task Description</td>
                  <td className="border border-slate-900 px-2 py-0.5 w-[20%]">Action Status</td>
                  <td className="border border-slate-900 px-2 py-0.5 w-[14%]">Qty / Part No</td>
                  <td className="border border-slate-900 px-2 py-0.5 w-[16%]">Remark</td>
                </tr>
                {report.servicing300Hr.servicingTasks.map((t) => (
                  <tr key={t.taskNo}>
                    <td className="border border-slate-900 px-1.5 py-0.5 text-center font-mono">
                      {t.taskNo}
                    </td>
                    <td className="border border-slate-900 px-2 py-0.5">{t.description}</td>
                    <td className="border border-slate-900 px-2 py-0.5 text-center font-semibold">
                      {t.status}
                    </td>
                    <td className="border border-slate-900 px-2 py-0.5 text-center font-mono text-[10px]">
                      {t.quantityOrValue} {t.partNumberUsed ? `(${t.partNumberUsed})` : ''}
                    </td>
                    <td className="border border-slate-900 px-2 py-0.5 text-[10px]">{t.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Breakdown Incident, Root Cause & Downtime Summary Table (Shown for Form 3) */}
        {report.formCategory === 'BREAKDOWN_REPORT' && report.breakdownDetails && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full border-collapse border border-slate-900 text-[11px] font-myanmar">
              <thead>
                <tr className="bg-slate-100">
                  <th colSpan={4} className="border border-slate-900 py-1 text-center font-bold">
                    Emergency Breakdown Incident, Downtime & Root Cause Analysis Report
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50/70 font-mono text-[10px]">
                  <td className="border border-slate-900 px-2 py-1">
                    Breakdown Time: <strong>{report.breakdownDetails.breakdownDateTime.replace('T', ' ')}</strong>
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    Engineer Arrival: <strong>{report.breakdownDetails.arrivalDateTime.replace('T', ' ')}</strong>
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    Rectified Time: <strong>{report.breakdownDetails.rectifiedDateTime.replace('T', ' ')}</strong>
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    Total Downtime: <strong>{report.breakdownDetails.totalDowntimeHours} Hours</strong>
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-semibold bg-slate-50 w-[22%]">
                    Fault System Category
                  </td>
                  <td className="border border-slate-900 px-2 py-1 font-bold w-[28%]">
                    {report.breakdownDetails.faultCategory}
                  </td>
                  <td className="border border-slate-900 px-2 py-1 font-semibold bg-slate-50 w-[20%]">
                    Post-Repair Status
                  </td>
                  <td className="border border-slate-900 px-2 py-1 font-bold w-[30%]">
                    {report.breakdownDetails.postRepairStatus}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-semibold bg-slate-50">
                    Controller Alarm / Trip
                  </td>
                  <td colSpan={3} className="border border-slate-900 px-2 py-1 font-mono font-semibold">
                    {report.breakdownDetails.alarmCodeOrTrip}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-semibold bg-slate-50">
                    Symptoms Reported
                  </td>
                  <td colSpan={3} className="border border-slate-900 px-2 py-1">
                    {report.breakdownDetails.symptomsReported}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-semibold bg-slate-50">
                    Root Cause Analysis
                  </td>
                  <td colSpan={3} className="border border-slate-900 px-2 py-1">
                    {report.breakdownDetails.rootCauseAnalysis}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-semibold bg-slate-50">
                    Immediate Rectification
                  </td>
                  <td colSpan={3} className="border border-slate-900 px-2 py-1">
                    {report.breakdownDetails.immediateRectification}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-semibold bg-slate-50">
                    Preventive Action
                  </td>
                  <td colSpan={3} className="border border-slate-900 px-2 py-1">
                    {report.breakdownDetails.preventiveRecommendation}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Operating Parameters Table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr>
                <th colSpan={6} className="border border-slate-900 py-1 text-center font-bold bg-slate-50">
                  Parameters
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium w-[18%]">Running Hours</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center w-[18%]">
                  {report.parameters.runningHours}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium w-[20%]">Frequency</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center w-[16%]">
                  {report.parameters.frequencyHz} Hz
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium w-[12%]">L1 (A)</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center w-[16%]">
                  {report.parameters.currentL1A}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">Engine Speed</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.engineSpeedRpm} RPM
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">Generator Vtg ( L1-L2)</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.voltageL1L2} V
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">L2 (A)</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.currentL2A}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">Engine Oil Pressure</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.engineOilPressureBar} bar
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">Generator Vtg ( L1-L3)</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.voltageL1L3} V
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">L3 (A)</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.currentL3A}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">Engine Oil Temp</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.engineOilTempC} °C
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">Generator Vtg ( L2-L3)</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.voltageL2L3} V
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">KW</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.activePowerKw}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">Battery Capacity</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.batteryCapacity}
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">Charging Voltage</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.chargingVoltageV} V
                </td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-medium">KVA</td>
                <td className="border border-slate-900 px-2.5 py-1.5 font-mono font-semibold text-center">
                  {report.parameters.apparentPowerKva}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Replacement Parts Table */}
        <div className="overflow-x-auto mb-5">
          <table className="w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr>
                <th colSpan={5} className="border border-slate-900 py-1 text-center font-bold bg-slate-50">
                  Replacement Parts
                </th>
              </tr>
              <tr className="bg-slate-50/60">
                <th className="border border-slate-900 px-2 py-1 text-center w-[7%]">Sr</th>
                <th className="border border-slate-900 px-2 py-1 text-center w-[25%]">Parts No:</th>
                <th className="border border-slate-900 px-2 py-1 text-center w-[38%]">Parts Descriptions</th>
                <th className="border border-slate-900 px-2 py-1 text-center w-[10%]">Qty</th>
                <th className="border border-slate-900 px-2 py-1 text-center w-[20%]">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {paddedParts.map((part, idx) => (
                <tr key={part.id || idx} className="h-6">
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono">
                    {part.partsNo || part.partsDescription ? idx + 1 : ''}
                  </td>
                  <td className="border border-slate-900 px-2 py-1 font-mono">{part.partsNo}</td>
                  <td className="border border-slate-900 px-2 py-1">{part.partsDescription}</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono">{part.qty}</td>
                  <td className="border border-slate-900 px-2 py-1">{part.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4 text-xs">
          {/* Service Engineer Box */}
          <div className="border border-slate-900 p-3">
            <div className="text-center font-bold mb-2">Service Engineer</div>
            <div className="flex items-end gap-2 mb-2">
              <span className="font-semibold w-12 shrink-0">Sign</span>
              <div className="flex-1 border-b border-slate-800 h-12 flex items-center justify-center">
                {report.engineerSignatureDataUrl && (
                  <img
                    src={report.engineerSignatureDataUrl}
                    alt="Engineer Signature"
                    className="max-h-11 object-contain"
                  />
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-semibold w-12 shrink-0">Name</span>
              <div className="flex-1 border-b border-slate-800 pb-0.5 font-semibold">
                {report.inspectorName}
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-semibold w-12 shrink-0">Email</span>
              <div className="flex-1 border-b border-slate-800 pb-0.5 font-mono text-[11px] text-slate-900">
                {fieldEngineerEmail}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold w-12 shrink-0">Date</span>
              <div className="flex-1 border-b border-slate-800 pb-0.5 font-mono">
                {formatDateDDMMYYYY(report.engineerSignDate || report.inspectionDate)}
              </div>
            </div>
          </div>

          {/* Customer Box */}
          <div className="border border-slate-900 p-3">
            <div className="text-center font-bold mb-2">Customer</div>
            <div className="flex items-end gap-2 mb-2">
              <span className="font-semibold w-12 shrink-0">Sign</span>
              <div className="flex-1 border-b border-slate-800 h-12 flex items-center justify-center">
                {report.customerSignatureDataUrl && (
                  <img
                    src={report.customerSignatureDataUrl}
                    alt="Customer Signature"
                    className="max-h-11 object-contain"
                  />
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-semibold w-12 shrink-0">Name</span>
              <div className="flex-1 border-b border-slate-800 pb-0.5 font-semibold">
                {report.customerSignName || report.customerName}
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-semibold w-12 shrink-0">Sector</span>
              <div className="flex-1 border-b border-slate-800 pb-0.5 text-[11px] font-medium">
                {sectorLabel}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold w-12 shrink-0">Date</span>
              <div className="flex-1 border-b border-slate-800 pb-0.5 font-mono">
                {formatDateDotDDMMYYYY(report.customerSignDate || report.inspectionDate)}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Comment */}
        <div className="flex items-baseline gap-2 text-xs pt-1 mb-2">
          <span className="font-semibold shrink-0">Customer Comment :</span>
          <div className="flex-1 border-b border-slate-800 pb-1 font-myanmar">
            {report.customerComment}
          </div>
        </div>

        {/* Sector & Receipt Mail Distribution Footer */}
        <div className="border border-slate-800 bg-slate-50/70 px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-900">Field Engineer Email: </span>
            <span className="font-mono text-slate-800">{fieldEngineerEmail}</span>
          </div>
          <div className="flex-1 min-w-[240px]">
            <span className="font-bold text-slate-900">
              Receipt Mail (သက်ဆိုင်ရာ တာဝန်ရှိသူများ — {sectorLabel}):{' '}
            </span>
            <span className="font-mono text-slate-800">{receiptMailList}</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PAGE 2: 25-POINT GENERATOR SERVICE / INSPECTION CHECKLIST (Gen SOP-002)
         ===================================================================== */}
      <div className="bg-white border border-slate-300 shadow-xs mx-auto min-w-[760px] max-w-[920px] p-6 sm:p-8 text-slate-900 print:shadow-none print:border-none print:p-0 print:max-w-none print:min-w-0 mt-6">
        {/* Page 2 Official Sub-header with Logo */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <img
              src="/assets/aistudio/cp_logo_cb60fbe9.jfif"
              alt="City Properties Logo"
              className="h-8 sm:h-9 w-auto object-contain rounded"
            />
            <span className="font-bold text-xs tracking-tight text-slate-900 uppercase">
              City Properties Co., Ltd
            </span>
          </div>
          <div className="text-right text-[10px] font-mono text-slate-500">
            Gen SOP - 002 / Version - 02 / 24/07/2025
          </div>
        </div>

        <div className="text-center mb-3">
          <h2 className="text-base sm:text-lg font-bold underline underline-offset-4 text-slate-900">
            Generator Service / Inspection Checklist
          </h2>
        </div>

        {/* Checklist Top Header & 25 Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-900 text-[11px] font-myanmar">
            <tbody>
              {/* Header Row 1 */}
              <tr>
                <td className="border border-slate-900 px-2 py-1 font-bold" colSpan={2}>
                  CENTER NAME : <span className="font-mono text-xs">{report.centerCode}</span>
                </td>
                <td className="border border-slate-900 px-2 py-1 font-bold">
                  GENSET : <span className="font-mono text-xs">{report.kvaRating}</span>
                </td>
                <td className="border border-slate-900 px-2 py-1 font-bold" colSpan={2}>
                  SERVICE / INSPECTION DATE :{' '}
                  <span className="font-mono text-xs">{formatDateDotDDMMYYYY(report.inspectionDate)}</span>
                </td>
              </tr>

              {/* Header Row 2 */}
              <tr>
                <td className="border border-slate-900 px-2 py-1 font-bold" colSpan={2}>
                  AVR : <span className="font-mono text-xs">{report.avrModel}</span>
                </td>
                <td className="border border-slate-900 px-2 py-1 font-bold">
                  CONTROLLER : <span className="font-mono text-xs">{report.controllerModel}</span>
                </td>
                <td className="border border-slate-900 px-2 py-1 font-bold" colSpan={2}>
                  INSPECTOR NAME : <span className="text-xs">{report.inspectorName}</span>
                </td>
              </tr>

              {/* Header Row 3 */}
              <tr>
                <td className="border border-slate-900 px-2 py-1 font-bold" colSpan={3}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-3">
                      <span className={report.breakerType === 'ACB' ? 'underline font-extrabold' : 'text-slate-500'}>
                        {report.breakerType === 'ACB' ? '✓ ACB' : 'ACB'}
                      </span>
                      <span className={report.breakerType === 'MCCB' ? 'underline font-extrabold' : 'text-slate-500'}>
                        {report.breakerType === 'MCCB' ? '✓ MCCB' : 'MCCB'}
                      </span>
                    </span>
                    <span>|</span>
                    <span className="inline-flex items-center gap-3">
                      <span className={report.breakerPoles === '3P' ? 'underline font-extrabold' : 'text-slate-500'}>
                        {report.breakerPoles === '3P' ? '✓ 3 P' : '3 P'}
                      </span>
                      <span className={report.breakerPoles === '4P' ? 'underline font-extrabold' : 'text-slate-500'}>
                        {report.breakerPoles === '4P' ? '✓ 4 P' : '4 P'}
                      </span>
                    </span>
                    <span>|</span>
                    <span>
                      In (Size): <strong className="font-mono underline">{report.breakerAmpRating}</strong> Amp
                    </span>
                  </div>
                </td>
                <td className="border border-slate-900 px-2 py-1 font-bold" colSpan={2}>
                  CUSTOMER NAME : <span className="text-xs">{report.customerName}</span>
                </td>
              </tr>

              {/* Column Headers */}
              <tr className="bg-slate-100 font-bold text-center">
                <td className="border border-slate-900 px-1.5 py-1 w-[5%]">N</td>
                <td className="border border-slate-900 px-2 py-1 w-[43%]" colSpan={2}>
                  Description
                </td>
                <td className="border border-slate-900 px-2 py-1 w-[34%]">Action</td>
                <td className="border border-slate-900 px-2 py-1 w-[18%]">Remark</td>
              </tr>

              {/* 25 Items */}
              {CHECKLIST_DEFINITIONS.map((def) => {
                const item = report.checklist[def.itemNo];
                const selected = item?.selectedOption || '';
                const remark = item?.remark || '';

                return (
                  <tr key={def.itemNo}>
                    <td className="border border-slate-900 px-1.5 py-1 text-center font-mono font-bold">
                      {def.itemNo}
                    </td>
                    <td className="border border-slate-900 px-2 py-1 whitespace-pre-line font-medium" colSpan={2}>
                      {def.description}
                    </td>

                    {/* Action Column */}
                    <td className="border border-slate-900 px-2 py-1">
                      {def.type === 'custom_9' && (
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                          <div>
                            Date <strong className="underline">{report.customInputs.batteryDate1}</strong>
                          </div>
                          <div>
                            Date <strong className="underline">{report.customInputs.batteryDate2}</strong>
                          </div>
                          <div>
                            <strong className="underline">{report.customInputs.batteryNos}</strong> Nos
                          </div>
                        </div>
                      )}

                      {def.type === 'custom_10' && (
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center">
                          <div>
                            <strong className="underline">{report.customInputs.batteryVolt}</strong> Volt
                          </div>
                          <div>
                            <strong className="underline">{report.customInputs.batteryAh}</strong> Ah
                          </div>
                          <div>
                            <strong className="underline">{report.customInputs.batteryCca}</strong> CCA
                          </div>
                        </div>
                      )}

                      {def.type === 'custom_11' && (
                        <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
                          {report.customInputs.batterySlots.map((slot, sIdx) => (
                            <div key={sIdx} className="border-r last:border-r-0 border-slate-300 pr-1">
                              <div>1. {slot.soc || '___'} SOC</div>
                              <div>2. {slot.soh || '___'} SOH</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {def.type === 'custom_19' && (
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                          <div>
                            Charge Altr V : <strong className="underline">{report.customInputs.chargeAltrV}</strong>
                          </div>
                          <div>
                            Battery V : <strong className="underline">{report.customInputs.controllerBatteryV}</strong>
                          </div>
                        </div>
                      )}

                      {(def.type === 'segmented' || def.type === 'segmented_photo_24') && def.options && (
                        <div className="flex flex-wrap items-center justify-around gap-2">
                          {def.options.map((opt) => {
                            const isChecked = selected === opt;
                            return (
                              <span
                                key={opt}
                                className={`inline-flex items-center gap-1 ${
                                  isChecked ? 'font-bold text-slate-900' : 'text-slate-600'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                <span>{opt}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Remark Column */}
                    <td className="border border-slate-900 px-2 py-1 text-[10px]">
                      {remark ? (
                        <span className="font-semibold text-slate-900">{remark}</span>
                      ) : def.remarkHint ? (
                        <span className="text-slate-400 italic">{def.remarkHint}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Errors (တွေ့ရှိချက်များ) Section */}
        <div className="mt-3 text-xs font-myanmar">
          <div className="font-bold mb-1">Errors (တွေ့ရှိချက်များ) :</div>
          <div className="border-b border-slate-700 min-h-[24px] py-1 font-medium">
            {report.errorsFound || 'No abnormal errors detected during inspection and test run.'}
          </div>
          <div className="border-b border-slate-700 min-h-[18px]" />
        </div>

        {/* Page 2 End-of-Form Field Engineer Email & Receipt Mail Footer */}
        <div className="mt-3 border border-slate-800 bg-slate-50/70 px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-900">
              Service Engineer: {report.inspectorName} · Email:{' '}
            </span>
            <span className="font-mono font-semibold text-slate-900">{fieldEngineerEmail}</span>
          </div>
          <div>
            <span className="font-bold text-slate-900">Receipt Mail ({sectorLabel}): </span>
            <span className="font-mono text-slate-800">{receiptMailList}</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
