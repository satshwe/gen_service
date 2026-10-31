import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // In-memory authoritative server store for offline-to-online sync & email dispatch logs
  const serverReportsStore = new Map<string, any>();
  let systemSerialCounter = 2048;

  // Backend Rule-Based Engine for Center Name -> Auto Receipt Email Mapping
  const customCenterEmailOverrides = new Map<string, string>();

  function evaluateBackendCenterEmailRule(
    centerCodeRaw: string,
    centerNameRaw: string,
    regionRaw?: string
  ) {
    const code = (centerCodeRaw || 'CMLSPL').trim().toUpperCase();
    const name = (centerNameRaw || 'City Mall Shwe Pin Lone').trim();
    const region = (regionRaw || 'Yangon').trim();
    const slug = code.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Center-Specific Facility Manager / Duty Engineer Email
    const centerFacilityEmail = `${slug}.facility@cityproperties.com.mm`;

    // 2. Sector-Based Rule Evaluation
    let sectorName = 'Commercial & Corporate HQ Sector';
    let sectorEmail = 'commercial.hq@cityproperties.com.mm';
    let rulePrefix = 'RULE_SECTOR_HQ';

    if (code.startsWith('CML') || code.startsWith('CMS') || name.toLowerCase().includes('city mall')) {
      sectorName = 'City Mall Sector';
      sectorEmail = 'citymall.ops@cityproperties.com.mm';
      rulePrefix = 'RULE_CITYMALL';
    } else if (code.startsWith('OSC') || name.toLowerCase().includes('ocean')) {
      sectorName = 'Ocean Supercenter Sector';
      sectorEmail = 'ocean.facility@cityproperties.com.mm';
      rulePrefix = 'RULE_OCEAN';
    } else if (code.startsWith('MKP') || code.startsWith('MKT') || name.toLowerCase().includes('marketplace')) {
      sectorName = 'Marketplace & Retail Sector';
      sectorEmail = 'marketplace.ops@cityproperties.com.mm';
      rulePrefix = 'RULE_MARKETPLACE';
    } else if (code.startsWith('CMT') || name.toLowerCase().includes('city mart')) {
      sectorName = 'City Mart Retail Sector';
      sectorEmail = 'citymart.facility@cityproperties.com.mm';
      rulePrefix = 'RULE_CITYMART';
    } else if (code.startsWith('WH') || code.startsWith('DC') || name.toLowerCase().includes('logistics')) {
      sectorName = 'Logistics & Cold Storage Sector';
      sectorEmail = 'logistics.eng@cityproperties.com.mm';
      rulePrefix = 'RULE_LOGISTICS';
    }

    // 3. Regional Engineering Lead Rule Evaluation
    let regionalEmail = 'yangon.zone.eng@cityproperties.com.mm';
    if (
      region.toLowerCase().includes('mandalay') ||
      code.includes('MD') ||
      name.toLowerCase().includes('mandalay')
    ) {
      regionalEmail = 'mandalay.regional.eng@cityproperties.com.mm';
    } else if (
      region.toLowerCase().includes('naypyitaw') ||
      code.includes('NPT') ||
      name.toLowerCase().includes('naypyitaw')
    ) {
      regionalEmail = 'npt.regional.eng@cityproperties.com.mm';
    } else if (
      region.toLowerCase().includes('upper') ||
      region.toLowerCase().includes('lower')
    ) {
      regionalEmail = 'regional.ops.eng@cityproperties.com.mm';
    }

    // 4. Corporate Governance Mandatory Recipients
    const corporateEmails = [
      'chief.engineer@cityproperties.com.mm',
      'satshwe36@gmail.com',
    ];

    const override = customCenterEmailOverrides.get(code);
    const combinedEmails = override
      ? override
      : Array.from(
          new Set([
            centerFacilityEmail,
            sectorEmail,
            regionalEmail,
            ...corporateEmails,
          ])
        ).join(', ');

    const ruleId = `${rulePrefix}_${code}`;
    return {
      ruleId,
      centerCode: code,
      centerName: name,
      sectorName,
      region,
      autoReceiptEmails: combinedEmails,
      ruleDescription: `Backend Rule [${ruleId}]: Auto-routes ${name} (${code}) reports to Center Facility Lead (${centerFacilityEmail}), ${sectorName} (${sectorEmail}), Regional Lead (${regionalEmail}) & Chief Engineer.`,
    };
  }

  const emailDeliveryLogs: Array<{
    id: string;
    triggerType: string;
    severity: string;
    subject: string;
    body: string;
    recipients: string[];
    centerCode: string;
    reportNo: string;
    sentAt: string;
    status: 'DELIVERED';
  }> = [];

  // Health & Sync Status API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      syncedReportsCount: serverReportsStore.size,
      emailsSentCount: emailDeliveryLogs.length,
    });
  });

  // System Auto-Generated Report Serial No. Endpoint
  app.get('/api/reports/next-serial', (req, res) => {
    const clientMax = parseInt(String(req.query.clientMax || '2048'), 10);
    if (!isNaN(clientMax) && clientMax > systemSerialCounter) {
      systemSerialCounter = clientMax;
    }
    serverReportsStore.forEach((rep) => {
      const n = parseInt(String(rep.reportNo || '0'), 10);
      if (!isNaN(n) && n > systemSerialCounter) {
        systemSerialCounter = n;
      }
    });
    const nextSerial = String(systemSerialCounter + 1).padStart(6, '0');
    res.json({
      reportNo: nextSerial,
      generatedBy: 'SYSTEM_AUTO_SERIAL_ENGINE',
      timestamp: new Date().toISOString(),
    });
  });

  // Backend Rule-Based Center Name -> Auto Receipt Email Endpoint
  app.get('/api/rules/center-recipients', (req, res) => {
    const centerCode = String(req.query.centerCode || 'CMLSPL');
    const centerName = String(req.query.centerName || 'City Mall Shwe Pin Lone');
    const region = String(req.query.region || 'Yangon');
    const evaluation = evaluateBackendCenterEmailRule(centerCode, centerName, region);
    res.json(evaluation);
  });

  app.post('/api/rules/evaluate-center-emails', (req, res) => {
    const { centerCode, centerName, region, customEmails } = req.body || {};
    if (centerCode && typeof customEmails === 'string' && customEmails.trim()) {
      customCenterEmailOverrides.set(String(centerCode).toUpperCase(), customEmails.trim());
    }
    const evaluation = evaluateBackendCenterEmailRule(
      centerCode || 'CMLSPL',
      centerName || 'City Mall Shwe Pin Lone',
      region || 'Yangon'
    );
    res.json(evaluation);
  });

  // Authoritative Server Sync Endpoint with Version & Checksum Conflict Detection
  app.post('/api/sync/reports', (req, res) => {
    const { report, baseSyncVersion, checksum, forceOverwrite } = req.body || {};
    if (!report || !report.id) {
      res.status(400).json({ error: 'Invalid report payload' });
      return;
    }

    const existing = serverReportsStore.get(report.id);
    if (
      existing &&
      !forceOverwrite &&
      existing.syncVersion > (baseSyncVersion || 1) &&
      existing.checksum !== checksum
    ) {
      res.status(409).json({
        status: 'CONFLICT',
        message: 'Server has a newer version of this inspection report.',
        serverReport: existing,
      });
      return;
    }

    const nextVersion = Math.max(
      (baseSyncVersion || 1) + 1,
      existing ? existing.syncVersion + 1 : 2
    );

    const saved = {
      ...report,
      syncVersion: nextVersion,
      checksum,
      syncState: 'synced',
      serverSyncedAt: new Date().toISOString(),
    };

    serverReportsStore.set(report.id, saved);
    res.json({
      status: 'SYNCED',
      syncVersion: nextVersion,
      report: saved,
    });
  });

  // Simulate a server-side concurrent edit to test conflict resolution
  app.post('/api/sync/simulate-conflict', (req, res) => {
    const { report } = req.body || {};
    if (!report || !report.id) {
      res.status(400).json({ error: 'Missing report payload' });
      return;
    }
    const serverModified = {
      ...report,
      syncVersion: (report.syncVersion || 1) + 2,
      inspectorName: `${report.inspectorName} (HQ Remote Update)`,
      generalRemarks:
        'Updated remotely by HQ Engineering Supervisor while field tablet was offline.',
      parameters: {
        ...report.parameters,
        engineOilPressureBar: 4.85,
      },
      checksum: `SRV_${Date.now().toString(16).toUpperCase()}`,
      serverSyncedAt: new Date().toISOString(),
    };
    serverReportsStore.set(report.id, serverModified);
    res.json({
      status: 'SIMULATED',
      serverReport: serverModified,
    });
  });

  // Email Notification Dispatch Endpoint
  app.post('/api/notifications/send-email', (req, res) => {
    const { triggerType, severity, title, message, recipientsCsv, centerCode, reportNo } =
      req.body || {};

    const recipients = String(recipientsCsv || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const entry = {
      id: `EML_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      triggerType: triggerType || 'CRITICAL_READINESS',
      severity: severity || 'Critical',
      subject: `[City Properties Gen SOP-002] ${severity || 'Alert'}: ${title}`,
      body: message || '',
      recipients: recipients.length > 0 ? recipients : ['satshwe36@gmail.com'],
      centerCode: centerCode || 'CMLSPL',
      reportNo: reportNo || '002048',
      sentAt: new Date().toISOString(),
      status: 'DELIVERED' as const,
    };

    emailDeliveryLogs.unshift(entry);
    res.json({
      ok: true,
      receipt: entry,
    });
  });

  app.get('/api/notifications/email-logs', (_req, res) => {
    res.json({
      logs: emailDeliveryLogs.slice(0, 50),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`City Properties Generator Server running on http://localhost:${PORT}`);
  });
}

startServer();
