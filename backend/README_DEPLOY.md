Deploying the backend (quick instructions)

Option A — Render (recommended for simplicity)
1. Push your `backend/` folder to GitHub (or use the repo root and set the root in Render).
2. In Render dashboard, create a new **Web Service** and connect the repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment: Node 18 or compatible
3. Add environment variables in Render Dashboard → Environment:
   - `PORT` (Render sets this automatically)
   - `NODE_ENV=production`
   - `JWT_SECRET` (set a secure value)
   - `SERVER_URL=https://your-backend-url` (use Render’s generated URL)
   - `FRONTEND_URL=https://apartmentmanagementsystem-smart-tenantsupport.netlify.app` (comma-separated if multiple)
4. Ensure `server.js` uses `process.env.PORT` (it already does) and reads `FRONTEND_URL` for CORS (already implemented).

Option B — Railway
1. Push your backend to GitHub and connect via Railway or use `railway init` and `railway up` (requires Railway account).
2. Set environment variables in Railway similar to Render.

Post-deploy steps
- Copy the publicly reachable backend URL and set it in Netlify as `REACT_APP_API_URL` in Site → Settings → Build & deploy → Environment.
- Trigger a Netlify redeploy (Deploys → Trigger deploy) so the frontend is rebuilt with the correct API URL.

Render manifest
- A `render.yaml` manifest has been added at the repo root to help Render create a Web Service automatically when you connect the repo:
  - File: `render.yaml`
  - It points Render to `backend/`, runs `npm install`, and starts with `npm start` on branch `main`.
  - After connecting the repo on Render, **add** the following env vars in the Render Dashboard and deploy the service:
    - `JWT_SECRET` (secure value)
    - `FRONTEND_URL=https://apartmentmanagementsystem-smart-tenantsupport.netlify.app`
    - (Optional) `SERVER_URL=https://<render-service>.onrender.com`

Deploy checklist (Render)
1. Connect GitHub repo → Render → it will detect `render.yaml` and suggest creating the `apartment-management-backend` service.
2. In Render Dashboard, go to Service → Environment and add the secure env vars listed above. Do NOT add secrets to the repo.
3. Deploy and copy the produced public URL (e.g., `https://your-backend.onrender.com`).

Netlify wiring (after backend deploy)
1. In Netlify, go to your site → Settings → Build & deploy → Environment.
2. Add `REACT_APP_API_URL` with the backend URL (e.g., `https://your-backend.onrender.com`).
3. Trigger a new deploy so the frontend rebuilds with the correct API URL.

Notes
- SQLite is not recommended for multi-instance production. Use Postgres if you expect concurrent instances or persistent DB.
- Rotate any credentials that were exposed in commits.
