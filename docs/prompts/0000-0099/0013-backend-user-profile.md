# Task - User Profile API

## Goal
Allow users to view and update their own profile.

## GET /api/users/me — Load Profile
- Requires `requireAuth`
- Returns: `{ id, name, email, role, avatar_url, created_at }`

## PUT /api/users/me — Update Profile
- Requires `requireAuth`
- Body: `{ name: string }`
- Only `name` is editable — email and role are not self-editable
- Returns: updated user object

## GET /api/users — List Users (admin only)
- Requires `requireAuth` + `requireRole('admin', 'recruiter_admin')`
- Optional query: `?role=recruiter&q=searchterm`
- Returns: `[{ id, name, email, role, avatar_url, created_at }]`

## POST /api/users — Create User (admin only)
- Requires `requireAuth` + `requireRole('admin')`
- Body: `{ name, email, password, role }`
- Hash password with bcrypt
- Return 409 if email already exists
- Returns: `{ id, name, email, role, created_at }`
