# Chief Engineer Service Assignment & Shared Duty Calendar System

City Properties Generator Service, Inspection & Analytics System (Gen SOP-002)

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been aligned based on your interactive input and are embedded into this implementation plan:

- **Confirmed Decision 1 (Calendar Placement)**: The Engineer Assignment Calendar will be integrated in **both** the Executive Dashboard (alongside run-hour forecasts) and as a **dedicated Duty & Service Calendar module** accessible from the primary workspace navigation.
- **Confirmed Decision 2 (Task Completion Automation)**: Assigned duties will **automatically transition to `COMPLETED`** when the assigned Service Engineer submits the matching Regular Inspection or 300-Hour Servicing report, eliminating duplicate manual status updates.
- **Confirmed Decision 3 (Notifications & Alerts)**: Assigning an engineer will immediately trigger an **in-app notification** and dispatch a formatted **email notification** to the assigned Field Engineer with center address, contact person, and generator specifications.
- **Role Permission Boundary**:
  - **Chief Engineer** & **Administrator**: Full authority to create, reschedule, reassign, or cancel assignments, with an Engineer Workload Distribution balancer.
  - **Field Engineer**: View personalized "My Assigned Duties" queue, with a direct 1-click **"Start Assigned Inspection"** button that pre-populates center, generator, and inspector credentials.
  - **Viewer**: Read-only oversight across all centers, engineers, and schedule calendars.

---

## 1. Overview & Core Concept

### What It Does
Empowers the **Chief Engineer** (and Administrator) to systematically schedule and assign **Regular Inspections** and **300-Hour Preventive Maintenance Servicing** to specific Service Engineers across all 31 City Properties commercial centers and 62 generator units. 

Every scheduled task is visualized on an interactive, shared **Company Duty Calendar** (Day, Week, and Month views) accessible across all roles. When an assigned engineer completes their work and submits Form 1 (Regular Inspection) or Form 2 (300-Hr Servicing), the system automatically links the report, updates the assignment status to `COMPLETED`, and calculates duty fulfillment compliance.

### Target Audience & Persona
- **Chief Engineer (U Myo Min Oo)**: Schedules monthly routine inspections, tracks upcoming 300-Hr servicing deadlines, assigns field staff based on workload, and monitors team SLA fulfillment.
- **Field Engineers (Wai Phyo Kyaw, Kyaw Zin Hein, etc.)**: View personal daily/weekly duty rosters, receive instant alerts for new assignments, and launch pre-filled inspection forms directly from their schedule.
- **Viewers (Center Managers & Executives)**: Check when engineers are scheduled to visit specific centers and track completed visits.

### Key Value
- Replaces informal communication with a single, synchronized corporate duty calendar.
- Prevents overdue 300-hour servicing and missed monthly inspections through proactive advance scheduling.
- Provides immediate 1-click form launching that eliminates data entry discrepancies.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[Chief Engineer / Admin]
      │
      ├─► Opens Dedicated Duty Calendar or Dashboard Schedule
      ├─► Clicks "+ Assign Service Duty" or clicks any Calendar Day cell
      ├─► Modal: Selects Task Type (Regular Inspection / 300-Hr Servicing)
      │          Selects Center & Generator (auto-displays current run hours & urgency)
      │          Selects Assigned Engineer from User Directory
      │          Sets Scheduled Date & Priority (Routine / Urgent / Overdue)
      ├─► Confirms Assignment
      │          ├─► Saved to Firestore `/dutyAssignments` & IndexedDB
      │          └─► Dispatches In-App Notification & Email Alert to Engineer
      ▼
[Field Engineer]
      │
      ├─► Receives In-App Bell Alert & Email: "New Duty Assigned: [Center Name]"
      ├─► Opens "My Assigned Duties" on Duty Calendar or Mobile View
      ├─► Clicks "Start Assigned Inspection" (or "Start 300-Hr Servicing")
      │          └─► Auto-opens Form with Center, Generator, and Inspector pre-selected
      ├─► Submits Inspection Report
      │          └─► System detects matching Assignment ID / (Center + Gen + Date)
      ▼
[Automated Completion]
      │
      └─► Assignment marked "COMPLETED", linked to Report #, badge turns Emerald Green
```

### Visual Identity & Theme
- **Design Constitution Compliance**: Follows the strict zero-pill discipline and high-density SaaS dashboard patterns. No decorative pulsing dots or floating capsule islands.
- **Color Distribution (60-30-10 Rule)**:
  - **60% Neutral Canvas**: `#F8FAFC` (Slate-50) page background with `#FFFFFF` crisp card containers.
  - **30% Structural Elements**: `#0F172A` (Slate-900) header, `#E2E8F0` (Slate-200) hairline borders, `#64748B` (Slate-500) unboxed metadata with `·` separators.
  - **10% Semantic Accents**:
    - Emerald (`#059669`): Completed assignments & on-track statuses.
    - Amber (`#D97706`): Scheduled routine duties & approaching deadlines.
    - Crimson (`#DC2626`): Overdue assignments & high-priority emergency dispatches.
    - Navy / Blue (`#1E3A8A`): Regular Inspection task tags.
    - Purple (`#7C3AED`): 300-Hour Servicing task tags.
- **Typography & Numerical Integrity**:
  - Headings: `Plus Jakarta Sans` / `Outfit` font weights.
  - Body & Form Controls: `DM Sans` / `Plus Jakarta Sans`.
  - Telemetry & Dates: Tabular numerals with `font-mono tabular-nums` for timestamps, dates (`YYYY-MM-DD`), and run hours.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Shared Calendar Visibility vs. Privacy
- **Chosen Approach**: Transparent shared schedule visible to all authenticated roles, with role-based action gating (Chief Engineer/Admin can edit; Field Engineers can launch forms; Viewers have read-only visibility).
- **Rationale**: Center managers (Viewers) need to know which engineer is visiting their mall; Field Engineers need team visibility to coordinate toolkits and travel routes.

### Decision 2: Automatic Report Matching & Completion Logic
- **Chosen Approach**: Two-tier matching:
  1. Direct Link: When launching from an assignment card, `assignmentId` is embedded directly into the report metadata.
  2. Fallback Heuristic: If an engineer opens the form manually and completes an inspection for that same Center, Generator, and Scheduled Date, the system automatically detects and closes the pending assignment.
- **Rationale**: Eliminates human error where engineers complete the inspection report but forget to manually update the assignment status.

### Decision 3: Workload Balancer Widget
- **Chosen Approach**: Incorporate a compact "Engineer Workload Distribution" summary strip at the top of the Duty Calendar, showing total assignments per engineer (e.g., `Wai Phyo Kyaw: 4 scheduled, 2 completed`).
- **Rationale**: Prevents Chief Engineer from inadvertently overloading a single engineer while leaving others underutilized.

---

## 4. Technical Architecture & Data Strategy

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PRIMARY WORKSPACE                                │
│                                                                             │
│   Top Navigation: [Dashboard] [Duty Calendar] [Activities] [Reports & PDF]  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  ExecutiveDashboardModule    │              │     DutyCalendarModule       │
│  (Integrated Duty Section)   │              │  (Full Interactive Hub)      │
│  • 300-Hr Prediction Matrix  │              │  • Month / Week / Day Grid   │
│  • Mini Duty Schedule Strip  │              │  • Chief Eng "+ Assign Duty" │
│  • Urgency Alerts & Filter   │              │  • "My Assigned Duties" Tab  │
│  • Quick Link to Duty Hub    │              │  • Engineer Workload Matrix  │
└───────────────┬──────────────┘              └───────────────┬──────────────┘
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA & STATE LAYER                                │
│                                                                             │
│  State: dutyAssignments: DutyAssignment[]                                   │
│                                                                             │
│  ┌────────────────────────┐                   ┌──────────────────────────┐  │
│  │    Cloud Firestore     │◄─────────────────►│   Local IndexedDB Cache  │  │
│  │   /dutyAssignments     │ (Real-time sync)  │   STORES.ASSIGNMENTS     │  │
│  └────────────────────────┘                   └──────────────────────────┘  │
│                                                                             │
│  Notification Dispatch:                                                     │
│  • In-App Notification Center: AlertNotification (/notifications)           │
│  • Email Dispatch Log: dispatchNotificationAndEmail()                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Entities & Schema

```typescript
export type DutyTaskType = 'REGULAR_INSPECTION' | 'REGULAR_SERVICING_300HR';
export type DutyPriority = 'Routine' | 'High' | 'Overdue';
export type DutyStatus = 'SCHEDULED' | 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface DutyAssignment {
  id: string; // e.g., "DUTY-202611-001"
  taskType: DutyTaskType;
  centerId: string;
  centerCode: string;
  centerName: string;
  generatorId: string;
  generatorLabel: string;
  assignedEngineerUid: string;
  assignedEngineerName: string;
  assignedEngineerEmail: string;
  assignedByUid: string;
  assignedByName: string;
  scheduledDate: string; // YYYY-MM-DD
  priority: DutyPriority;
  notes?: string;
  status: DutyStatus;
  completedReportId?: string;
  completedReportNo?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Execution Steps Breakdown
1. **Types & Storage Schema** (`src/types/index.ts` & `src/utils/indexedDbSync.ts`):
   - Add `DutyAssignment` interface and related union types.
   - Register `STORES.DUTY_ASSIGNMENTS = 'duty_assignments'` in IndexedDB with sync helpers.
   - Seed initial duty assignments for October/November 2026 for seamless out-of-the-box demonstration.
2. **Duty Calendar Module** (`src/components/DutyCalendarModule.tsx`):
   - Interactive Month, Week, and List views.
   - Role-aware "+ Assign Duty" modal for Chief Engineer & Administrator.
   - "My Duties Only" filter toggle for Field Engineers.
   - "Start Inspection" direct form launch action.
   - Engineer Workload Balance summary strip.
3. **Dashboard Integration** (`src/components/ExecutiveDashboardModule.tsx`):
   - Expand the 04. Maintenance Calendar section to cross-reference scheduled engineer assignments alongside 300-hour run-hour deadlines.
4. **Report Submission Auto-Completion** (`src/App.tsx` & `src/components/InspectionFormModule.tsx`):
   - Update report save handler to automatically check for matching pending assignments and mark them `COMPLETED`.
   - Dispatch notification to Chief Engineer upon task completion.
5. **Verification & Testing**:
   - Run `lint_applet` (`tsc --noEmit`) and `compile_applet` (`npm run build`).
