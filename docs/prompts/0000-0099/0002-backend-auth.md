# Task - Backend Authentication

## Goal
Implement JWT-based authentication (no SiteMinder, no SSO, no OAuth).

## Auth Service (`src/services/auth.js`)
- `loginUser(email, password)` — query user from DB, verify bcrypt hash, return JWT + user object
- `hashPassword(password)` — bcrypt hash with salt rounds 10

## Auth Middleware (`src/middleware/auth.js`)
- `requireAuth(req, res, next)` — validate `Authorization: Bearer <token>` header, attach decoded user to `req.user`
- `requireRole(...roles)` — check `req.user.role` is in allowed roles list, return 403 if not

## Auth Routes (`src/routes/auth.js`)
- `POST /api/auth/login` — body: `{ email, password }`, returns `{ token, user }`
- `POST /api/auth/logout` — stateless, just returns `{ success: true }`

## Rules
- JWT payload: `{ id, email, role }`
- Expiry from `process.env.JWT_EXPIRES_IN` (default 8h)
- Secret from `process.env.JWT_SECRET`
- Return 401 for invalid credentials — do NOT specify whether email or password was wrong
- All response shapes: `{ success: true, data: {...} }` or `{ success: false, error: "..." }`
