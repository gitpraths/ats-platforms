/**
 * File upload validation utilities
 */

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;  // 5 MB

/**
 * Multer file filter for resume uploads.
 * Rejects files that are not PDF or Word documents.
 */
export function resumeFileFilter(_req, file, cb) {
  if (ALLOWED_RESUME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF and Word documents are allowed."), false);
  }
}

/**
 * Multer file filter for avatar/image uploads.
 * Rejects files that are not JPEG, PNG, WebP, or GIF.
 */
export function imageFileFilter(_req, file, cb) {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed."), false);
  }
}

/**
 * Returns a Multer limits object for resume uploads.
 */
export function resumeLimits() {
  return { fileSize: MAX_RESUME_SIZE };
}

/**
 * Returns a Multer limits object for avatar uploads.
 */
export function avatarLimits() {
  return { fileSize: MAX_AVATAR_SIZE };
}

/**
 * Validates that an uploaded file exists on the request.
 * Throws a 400-style error object if no file was uploaded.
 */
export function requireFile(req) {
  if (!req.file) {
    const err = new Error("No file uploaded.");
    err.status = 400;
    throw err;
  }
}
