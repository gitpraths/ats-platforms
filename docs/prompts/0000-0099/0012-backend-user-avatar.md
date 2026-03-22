# Task - User Avatar Upload & Fetch

## Goal
Support uploading and retrieving user avatar images.
Store locally on disk (no AWS S3 — S3 can be added later as an enhancement).

## POST /api/users/:id/avatar — Upload Avatar

- `Content-Type: multipart/form-data`, field name: `avatar`
- Requires `requireAuth`
- Rules:
  - User can only upload their own avatar: `req.params.id === req.user.id`, else 403
  - Accept only: JPEG, PNG, WebP, GIF
  - Max file size: 5MB
  - Max dimensions: 1024x1024 px (use `sharp` to validate and resize)
  - Save to: `uploads/avatars/{user_id}.{ext}`
  - Update `users.avatar_url` in DB with path `/api/users/{user_id}/avatar`

## GET /api/users/:id/avatar — Fetch Avatar

- Requires `requireAuth`
- Returns the avatar image file
- Set headers:
  - `Content-Type`: image mime type
  - `Cache-Control: public, max-age=86400`
- Return 404 if no avatar found

## Dependencies
- `multer` for file upload handling
- `sharp` for image dimension validation and resizing

## Upload Directory
- Use env var `UPLOAD_DIR` (default: `uploads`)
- Create directory if it doesn't exist on startup
