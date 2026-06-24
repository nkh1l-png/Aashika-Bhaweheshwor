# Deployment Guide — StockFlow (free hosting)

This guide gets the app online for **free**, with permanent data and **instant** performance, accessible from any phone.

**The stack:** Render (runs the app) + MongoDB Atlas (stores data) + UptimeRobot (keeps it instant). All free.

---

## What changed (why this is now safe to host publicly)

The app was hardened before deploying:
- ✅ Real login tokens + **server-side** permission checks (strangers can't touch your data)
- ✅ Passwords are **hashed** (no more plain text)
- ✅ The **server** owns stock math, so two staff acting at once can't overwrite each other
- ✅ Optional **MongoDB** storage so data survives on Render
- ✅ Bug fixes (timezone, negative quantities, XSS) + Excel export + undo

---

## Step 1 — Put the code on GitHub

If it isn't already:
```bash
cd "path/to/Aashika-Bhaweheshwor"
git add .
git commit -m "Harden + add Mongo/Excel for deploy"
git push
```
(`db.json` and `.env` are gitignored, so no secrets/passwords are uploaded.)

---

## Step 2 — Create the database (MongoDB Atlas, free)

1. Go to **https://www.mongodb.com/cloud/atlas/register** and sign up.
2. Create a **free M0 cluster** (pick any provider/region near you).
3. **Database Access** → *Add New Database User* → username + password (save these).
4. **Network Access** → *Add IP Address* → **Allow Access from Anywhere** (`0.0.0.0/0`).
   (Render's IPs change, so this is needed. Your data is still protected by the username/password.)
5. **Database → Connect → Drivers** → copy the **connection string**. It looks like:
   ```
   mongodb+srv://USER:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with the real password from step 3.

---

## Step 3 — Deploy the app (Render, free)

1. Go to **https://render.com** and sign up with GitHub.
2. **New → Web Service** → pick this repository.
3. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. **Environment Variables** (click *Advanced* / *Add Environment Variable*):
   | Key | Value |
   |-----|-------|
   | `MONGODB_URI` | the connection string from Step 2 |
   | `MONGODB_DB` | `stockflow` |
   | `SESSION_SECRET` | any long random text (e.g. mash the keyboard 40+ chars) |
5. Click **Create Web Service**. Wait for it to build and go live.
6. You get a free URL like `https://stockflow-xyz.onrender.com`. Open it — log in with `admin` / `admin123`.

> 🔐 **First thing after logging in:** go to **Admin Panel → User Management** and change every default password.

---

## Step 4 — Make it instant (UptimeRobot, free)

Render's free plan sleeps after ~15 min idle (slow first load). A free pinger keeps it awake:

1. Go to **https://uptimerobot.com** and sign up.
2. **Add New Monitor**:
   - **Type:** HTTP(s)
   - **URL:** your Render URL (e.g. `https://stockflow-xyz.onrender.com`)
   - **Interval:** 5 minutes
3. Save. Done — the app now stays warm and loads instantly.

---

## Done ✅

- **App:** your Render URL — open on any phone, from anywhere
- **Data:** safe and permanent in MongoDB Atlas (auto-backed-up)
- **Speed:** instant (UptimeRobot keeps it awake)
- **Cost:** $0/month

### Optional: custom domain
In Render → your service → **Settings → Custom Domains**, add your domain and follow the DNS steps. Render gives free HTTPS. In Nepal you can get a free `.com.np` at register.com.np.

---

## Running locally (development)

```bash
npm install
npm start          # uses db.json (local file) — no setup needed
```
To test with MongoDB locally, copy `.env.example` to `.env` and fill in `MONGODB_URI`.

## Troubleshooting

- **Build fails / app won't start:** confirm Start Command is `npm start` and Node version is 18+.
- **"Not authorized" right after deploy:** you changed `SESSION_SECRET` after logging in — just log in again.
- **Data didn't persist after redeploy:** `MONGODB_URI` isn't set, so it used the temporary disk. Add the env var.
- **Can't connect to Mongo:** check Network Access allows `0.0.0.0/0` and the `<password>` in the URI is correct.
