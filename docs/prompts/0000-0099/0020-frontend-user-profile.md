# Task - Frontend User Profile Page

## Goal
Implement the User Profile page and top-nav profile menu.

## Top Navigation Profile Menu
- Show user avatar (or initials) top-right in the nav bar
- Clicking opens a dropdown with:
  - User name + email (non-clickable header)
  - "Profile" link → `/profile`
  - "Sign out" button

## Profile Page: `/profile`

### Sections

**Avatar**
- Display current avatar (or large initials fallback)
- "Upload Photo" button → file picker (JPEG, PNG, WebP, GIF, max 5MB)
- On select: call `POST /api/users/me/avatar` (multipart/form-data)
- Show preview before upload

**Personal Info**
- Name (editable text input)
- Email (read-only)
- Role (read-only badge)
- "Save Changes" button → `PUT /api/users/me`

**Session Info**
- Member since date
- Last login (future feature — show placeholder)

## Component Structure
```
pages/Profile.tsx
├── AvatarUpload.tsx
└── ProfileForm.tsx
```
