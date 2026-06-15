import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 is S3-compatible — just point endpoint at your account
export const r2 = process.env.R2_ACCOUNT_ID
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID     || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
    })
  : null;

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "";

/**
 * Upload a file buffer to R2.
 * Returns the R2 object key (e.g. "candidates/uuid/1234-cv.pdf").
 */
export async function uploadToR2({ key, body, contentType }) {
  if (!r2) throw new Error("R2 not configured");
  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }));
  return key;
}

/**
 * Generate a presigned URL for viewing or downloading a file from R2.
 * expiresIn: seconds (default 15 minutes)
 */
export async function getR2PresignedUrl(key, { expiresIn = 900, download = false, fileName = "" } = {}) {
  if (!r2) throw new Error("R2 not configured");
  const params = {
    Bucket: R2_BUCKET,
    Key:    key,
  };
  if (download && fileName) {
    params.ResponseContentDisposition = `attachment; filename="${fileName}"`;
  }
  const cmd = new GetObjectCommand(params);
  return getSignedUrl(r2, cmd, { expiresIn });
}

/**
 * Delete an object from R2.
 */
export async function deleteFromR2(key) {
  if (!r2) return; // no-op if not configured
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

/**
 * Returns true if the stored file_path is an R2 key (not a legacy local path).
 */
export function isR2Key(filePath) {
  return filePath && !filePath.startsWith("/uploads/");
}
