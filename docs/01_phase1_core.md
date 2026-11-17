# Phase 1 — All In One copied as LoyalAnimal (2026-11-17)

Start method **A**: every All In One screen (Clinic, Pharmacy, Lab, Billing,
Reports, Configuration) copied from `ALL IN ONE` at commit `cc6a51b`
(read-only reference, same code as tayush.thangaminfotech.com). Only the
project identifiers were changed.

| | |
|---|---|
| Database | T_LoyalAnimal on 147.93.155.21 (`init-db` refuses any other DB_NAME) |
| API | port 5190 (`npm run dev` in backend) |
| Web | port 5191 (`npm run dev` in frontend, proxies /api to 5190) |
| Doc code | CLINIC_CODE=LA (LA-S0001 ...) |
| Server | 156.67.104.242, /opt/projects/loyalanimal, PM2 `loyalanimal`, nginx `loyalanimal.conf`, loyalanimal.thangaminfotech.com |

## Renamed
`Ayush All In One` / `Ayush Pro` → LoyalAnimal; `Ayush Lab` → LoyalAnimal Lab;
5160 → 5190; 5174 → 5191; T_AyushNew → T_LoyalAnimal; CLINIC_CODE TA → LA;
PM2 `ayushallinone` → `loyalanimal`; nginx tayush → loyalanimal.
`scripts/deploy.py` rewritten: only `status` and `deploy`, touches only LoyalAnimal's
folder, PM2 process, port and nginx site (no tayush cut-over / rollback).

## Differences from All In One
- `core.js` adds `AppUser.LinkedPatientId` with `IF COL_LENGTH ... IS NULL` (the
  table was first made by a Core-only start earlier the same day).
- `scripts/linkChecks.js`: prescriptions take Lab Test Master ids (since the
  reference's menu rework); the old check still sent Clinic test ids.

## Result
- `npm run init-db`: core, lab, pharmacy, clinic ready; re-run safe.
- `npm run smoke`: core 27, lab 55, pharmacy 30, clinic 47, links 12 — all passed.
- Frontend build OK.
- Admin login: `Admin` (password set by the owner).

Before go-live run `backend/scripts/resetTestData.sql` against T_LoyalAnimal only,
so real documents start at 0001.
