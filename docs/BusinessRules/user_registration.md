# User Registration

- Users are registered by an admin in the platform (no self-registration for now)

- Authentication flow uses JWT — no SSO, no SiteMinder, no third-party auth provider

## Registration Flow

1. **Authentication: Login request**
   - User POSTs `email` + `password` to `POST /api/auth/login`
   - Backend validates credentials with bcrypt

2. **Authentication: Issue JWT token**
   - On success, backend returns a signed JWT token
   - Token contains: `{ id, email, role }`
   - Token expiry defined by `JWT_EXPIRES_IN` env var (default: 8h)

3. **Session validation on protected routes**
   - All protected routes require `Authorization: Bearer <token>` header
   - The `requireAuth` middleware validates and decodes the token
   - Decoded user is attached to `req.user`

## Default Roles on Registration

- New users created by admin are assigned `recruiter` role by default
- Admin must explicitly upgrade role to `hiring_manager`, `recruiter_admin`, or `admin`
