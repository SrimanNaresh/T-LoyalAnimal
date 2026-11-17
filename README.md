# LoyalAnimal

Clinic + Pharmacy + Lab in one app (built from Ayush All In One). Database: `T_LoyalAnimal` only.

1. `backend/.env` from `backend/.env.example` (git-ignored).
2. `cd backend && npm ci && npm run init-db && npm run dev` → API on 5190
3. `npm run smoke` (in backend)
4. `cd frontend && npm ci && npm run dev` → http://localhost:5191

Deploy: `python scripts/deploy.py status` / `python scripts/deploy.py deploy`
(loyalanimal.thangaminfotech.com, PM2 `loyalanimal`, port 5190).
