Mini-ERP-CRM

A full-stack inventory/sales management system with role-based access control — built with a Node/Express/TypeScript backend, Prisma/PostgreSQL, and a React/Vite frontend.

Live Links
Frontend (Vercel): <https://vercel.com/api-31d2/mini-erp-crm>
Backend API (Render): <https://mini-erp-crm-o6k9.onrender.com>
GitHub Repo: <PASTE_REPO_URL_HERE>

Architecture

The backend is a Node.js/Express API written in TypeScript, using Prisma as the ORM against a PostgreSQL database (hosted on Neon). Authentication is handled via JWT — on login, the server issues a signed token containing the user's role, which is validated on protected routes via middleware to enforce role-based access control (admin, sales, warehouse, accounts). The frontend is a React app built with Vite, communicating with the backend over REST endpoints for customers, products (including stock movements), and challans (create/confirm/cancel workflows). The backend is deployed on Render, the frontend on Vercel, and the database on Neon.

How the Server Was Set Up
Backend scaffolded with Node.js + Express + TypeScript.
Prisma initialized and connected to a Neon-hosted PostgreSQL instance; schema defined and migrated via prisma migrate.
JWT-based authentication implemented, with role-based middleware guarding routes by user role.
REST endpoints built for auth (login), customers (CRUD), products (CRUD + stock-movement), and challans (create/confirm/cancel).
Backend deployed to Render, connected to the same Neon database via DATABASE_URL.
Frontend built with React + Vite, deployed to Vercel, configured to call the Render backend URL.
Environment Variables

Environment variables are managed via .env files (not committed to the repo — see .gitignore) locally, and via each platform's environment variable settings in production (Render for the backend, Vercel for the frontend if applicable).

Backend (backend/.env):

Variable	Description
DATABASE_URL	PostgreSQL connection string (Neon) used by Prisma
JWT_SECRET	Secret key used to sign and verify JWT auth tokens

Actual values are never committed to the repository. On Render, these are set under the service's Environment tab.

Running Locally
Prerequisites
Node.js (v18+ recommended)
A PostgreSQL database or local Postgres
Backend
bash
cd backend
npm install
# create a .env file with DATABASE_URL and JWT_SECRET
npx prisma migrate dev
npm run dev

The backend will start on its configured port (check backend/src or .env for PORT, default likely 3000/5000).

Frontend
bash
cd frontend
npm install
# create a .env file pointing VITE_API_URL (or equivalent) at the backend URL,
# e.g. http://localhost:5000
npm run dev

The frontend will start on Vite's default port (5173) and proxy/call the backend API.

Deployment
Database: Hosted on Neon. Created a project, copied the connection string into DATABASE_URL.
Backend: Deployed to Render as a Web Service, pointed at the backend directory, with DATABASE_URL and JWT_SECRET set as environment variables in the Render dashboard. Build command: npm install && npx prisma generate && npm run build (adjust to match actual scripts); start command: npm start.
Frontend: Deployed to Vercel, pointed at the frontend directory, with the API base URL set as an environment variable so the deployed frontend calls the deployed Render backend rather than localhost.
Test Login Credentials
Role	Email	Password
Admin	admin@test.com	password123
Sales	sales@test.com	password123
Warehouse	warehouse@test.com	password123
Accounts	accounts@test.com	password123
API Testing

A Postman collection covering all tested endpoints (login, customers CRUD, products CRUD + stock-movement, challans create/confirm/cancel) is included in this repo: <POSTMAN_COLLECTION_FILENAME>. Requests are configured against the live Render URL.

Known Limitations
No pagination UI on list views (customers/products/challans render full lists).
No image upload support for products.
No invoice/challan PDF export.
Minimal styling — functionality-first UI, not a polished design pass.
[Add any others specific to your implementation, e.g. no automated tests, no rate limiting, no soft-delete/audit trail, etc.]
Tech Stack Summary
Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT
Frontend: React, Vite
Database hosting: Neon
Deployment: Render (backend), Vercel (frontend)
