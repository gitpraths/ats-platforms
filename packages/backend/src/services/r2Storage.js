import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import logger from "../config/logger.js";

function getR2Config() {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucketName = (process.env.R2_BUCKET_NAME || "").trim();
  const endpoint = (process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).trim();

  return { accountId, accessKeyId, secretAccessKey, bucketName, endpoint };
}

let cachedClient = null;

function getS3Client() {
  if (cachedClient) return cachedClient;

  const { accessKeyId, secretAccessKey, endpoint } = getR2Config();
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    return null;
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedClient;
}

export function isR2Configured() {
  const { accessKeyId, secretAccessKey, bucketName, endpoint } = getR2Config();
  return Boolean(accessKeyId && secretAccessKey && bucketName && endpoint);
}

export function normalizeR2Key(rawPath) {
  if (!rawPath) return "";
  let clean = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean.startsWith("uploads/")) {
    clean = `uploads/${clean}`;
  }
  return clean;
}

export async function uploadToR2({ key, filePath, buffer, contentType }) {
  if (!isR2Configured()) {
    return { success: false, skipped: true, reason: "R2 is not configured" };
  }

  const s3 = getS3Client();
  const { bucketName } = getR2Config();
  const r2Key = normalizeR2Key(key);

  try {
    let body = buffer;
    if (!body && filePath) {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Local file not found: ${filePath}` };
      }
      body = fs.readFileSync(filePath);
    }

    if (!body) {
      return { success: false, error: "No content or file provided for R2 upload" };
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    });

    await s3.send(command);
    logger.info(`[R2] Uploaded: ${r2Key} to bucket ${bucketName}`);
    return { success: true, key: r2Key, bucket: bucketName };
  } catch (err) {
    logger.error(`[R2] Upload failed for ${r2Key}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export async function getFromR2({ key }) {
  if (!isR2Configured()) return null;

  const s3 = getS3Client();
  const { bucketName } = getR2Config();
  const r2Key = normalizeR2Key(key);

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
    });

    const response = await s3.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength,
      key: r2Key,
    };
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    logger.error(`[R2] Get failed for ${r2Key}: ${err.message}`);
    return null;
  }
}

export async function deleteFromR2({ key }) {
  if (!isR2Configured()) return { success: false, skipped: true };

  const s3 = getS3Client();
  const { bucketName } = getR2Config();
  const r2Key = normalizeR2Key(key);

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
    });

    await s3.send(command);
    logger.info(`[R2] Deleted: ${r2Key} from bucket ${bucketName}`);
    return { success: true };
  } catch (err) {
    logger.error(`[R2] Delete failed for ${r2Key}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export async function streamR2ToFile(r2Stream, destinationPath) {
  try {
    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const writeStream = fs.createWriteStream(destinationPath);
    await pipeline(r2Stream, writeStream);
    logger.info(`[R2] Cached R2 file to local persistent disk: ${destinationPath}`);
    return true;
  } catch (err) {
    logger.error(`[R2] Failed to cache file to local disk: ${err.message}`);
    return false;
  }
}
