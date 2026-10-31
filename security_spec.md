# Security Specification — City Properties Generator Inspection & Analytics System

## 1. Data Invariants

1. **Zero-Trust Default Deny**: All collections not explicitly matched (`/users/{userId}`, `/reports/{reportId}`, `/notifications/{notificationId}`, `/notificationConfigs/{configId}`) are strictly denied (`allow read, write: if false;`).
2. **Firebase UID & Password Credential Integrity**: Every document in `/users/{userId}` must include a valid `uid` matching `userId` (`^[a-zA-Z0-9_\-]+$`, max 128 chars), a `password` between 4 and 128 characters, `email` (3..254 chars), `displayName` (1..120 chars), `role` (`Administrator`, `Chief Engineer`, `Field Engineer`, `Viewer`), `department` (1..120 chars), and server timestamp `updatedAt == request.time`.
3. **RBAC Role Escalation & Schema Enforcement**:
   - Only valid roles in `['Administrator', 'Chief Engineer', 'Field Engineer', 'Viewer']` are accepted.
   - Updates to `/users/{userId}` must preserve `incoming().uid == existing().uid` and only modify allowed keys `['displayName', 'email', 'department', 'role', 'password', 'updatedAt']`.
4. **Tiered Write & Validation Blueprints**:
   - Every `create` and `update` operation across `/users/{userId}`, `/reports/{reportId}`, `/notifications/{notificationId}`, and `/notificationConfigs/{configId}` invokes `isValid[Entity](incoming())` checking `keys().hasAll(...)`, `keys().hasOnly(...)`, string `.size()` bounds, regex ID validation (`isValidId()`), and server timestamp `request.time`.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Invalid Role Assignment on User Creation)**: User creates `/users/eng_user_1` with `role: "SuperRootHacker"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Short/Empty Password on User Creation)**: Admin or user creates `/users/eng_user_1` with `password: "12"` (< 4 chars). -> `PERMISSION_DENIED`
3. **Payload 3 (UID Mutation on User Update)**: Update on `/users/USR_ENG_01` attempting to mutate `uid` to `"USR_ADMIN_01"`. -> `PERMISSION_DENIED`
4. **Payload 4 (Shadow / Ghost Field Injection)**: Creating `/reports/REP_01` with an undeclared field `isVerifiedByHQ: true`. -> `PERMISSION_DENIED`
5. **Payload 5 (Mismatched Document ID on Report Creation)**: Creating `/reports/REP_02` with `id: "REP_999"`. -> `PERMISSION_DENIED`
6. **Payload 6 (Invalid Readiness Status Enum)**: Creating `/reports/REP_03` with `readinessStatus: "HackedStatus"`. -> `PERMISSION_DENIED`
7. **Payload 7 (Path ID Poisoning)**: Creating `/reports/INVALID ID WITH SPACES & $$$` violating `^[a-zA-Z0-9_\-]+$`. -> `PERMISSION_DENIED`
8. **Payload 8 (Denial-of-Wallet Oversized String)**: Creating `/notifications/NOTIF_01` with `message` exceeding `1000` characters. -> `PERMISSION_DENIED`
9. **Payload 9 (Shadow Key Injection on User Update)**: Updating `/users/USR_ENG_01` with undeclared key `isAdminBypass: true`. -> `PERMISSION_DENIED`
10. **Payload 10 (Client Timestamp Forgery)**: Creating `/reports/REP_04` with a forged past/future `updatedAt` timestamp instead of `request.time`. -> `PERMISSION_DENIED`
11. **Payload 11 (Oversized Recipients CSV on Notification Config)**: Updating `/notificationConfigs/CFG_01` with `recipientsCsv` > 1000 chars. -> `PERMISSION_DENIED`
12. **Payload 12 (Value Poisoning on Update)**: Updating `read` on `/notifications/NOTIF_01` with a string `"yes"` instead of a boolean. -> `PERMISSION_DENIED`
