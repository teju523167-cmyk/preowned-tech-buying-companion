import mongoose from "mongoose";
import crypto from "node:crypto";
import path from "node:path";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import Listing from "../models/listing.js";
import ListingEvidence from "../models/listingEvidence.js";

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const EVIDENCE_DIR = path.resolve(process.cwd(), "private-evidence");
const ALLOWED_TYPES = ["proof_of_purchase", "proof_of_ownership", "serial_number_photo", "repair_record", "other"];
const MIME_EXTENSIONS = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png" };

function validFileSignature(buffer, mimeType) {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return false;
}

function cleanFileName(value) {
  const base = path.basename(String(value || "evidence").replace(/\\/g, "/")).replace(/[\r\n\0]/g, "").trim();
  return base.slice(0, 200) || "evidence";
}

// Existing metadata-only submission remains available for records where a document cannot be uploaded.
export async function submitListingEvidence(req, res) {
  try {
    const { id } = req.params;
    const { evidenceType, fileName, notes = "" } = req.body ?? {};
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid listing ID" });
    if (!ALLOWED_TYPES.includes(evidenceType) || typeof fileName !== "string" || !fileName.trim() || fileName.trim().length > 200 || typeof notes !== "string" || notes.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Provide a valid evidence type, file name and notes" });
    }
    const listing = await Listing.findOne({ _id: id, seller: req.user._id, status: { $nin: ["removed", "sold"] } }).select("_id seller status");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found or you do not own it" });
    const evidence = await ListingEvidence.create({ listing: listing._id, seller: req.user._id, evidenceType, fileName: fileName.trim(), notes: notes.trim() });
    return res.status(201).json({ success: true, message: "Evidence metadata submitted for moderator review. It does not prove ownership by itself.", evidence: { id: evidence._id, listing: evidence.listing, evidenceType: evidence.evidenceType, fileName: evidence.fileName, notes: evidence.notes, reviewStatus: evidence.reviewStatus, createdAt: evidence.createdAt } });
  } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ success: false, message: error.message });
    console.error("Submit listing evidence error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to submit evidence metadata" });
  }
}

// Upload a private PDF/JPEG/PNG document. The route uses express.raw with a 5 MB limit.
export async function uploadListingEvidenceFile(req, res) {
  let savedPath;
  try {
    const { id } = req.params;
    const evidenceType = req.get("x-evidence-type");
    const notes = req.get("x-evidence-notes") || "";
    const mimeType = req.get("content-type")?.split(";")[0].trim().toLowerCase();
    const fileName = cleanFileName(req.get("x-file-name"));
    const noteText = typeof notes === "string" ? notes : "";

    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid listing ID" });
    if (!ALLOWED_TYPES.includes(evidenceType)) return res.status(400).json({ success: false, message: "Invalid x-evidence-type header" });
    if (!MIME_EXTENSIONS[mimeType]) return res.status(415).json({ success: false, message: "Only PDF, JPEG and PNG evidence files are supported" });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ success: false, message: "Upload a non-empty file as the raw request body" });
    if (req.body.length > MAX_EVIDENCE_BYTES) return res.status(413).json({ success: false, message: "Evidence file must be 5 MB or smaller" });
    if (!validFileSignature(req.body, mimeType)) return res.status(415).json({ success: false, message: "File content does not match the declared file type" });
    if (typeof noteText !== "string" || noteText.length > 500) return res.status(400).json({ success: false, message: "x-evidence-notes must be at most 500 characters" });

    const listing = await Listing.findOne({ _id: id, seller: req.user._id, status: { $nin: ["removed", "sold"] } }).select("_id seller");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found or you do not own it" });

    await mkdir(EVIDENCE_DIR, { recursive: true });
    const storedName = `${crypto.randomUUID()}${MIME_EXTENSIONS[mimeType]}`;
    savedPath = path.join(EVIDENCE_DIR, storedName);
    await writeFile(savedPath, req.body, { flag: "wx", mode: 0o600 });

    const evidence = await ListingEvidence.create({
      listing: listing._id,
      seller: req.user._id,
      evidenceType,
      fileName,
      notes: noteText,
      storagePath: savedPath,
      mimeType,
      sizeBytes: req.body.length,
    });

    return res.status(201).json({ success: true, message: "Private evidence file uploaded for moderator review. Upload does not establish authenticity or ownership.", evidence: { id: evidence._id, listing: evidence.listing, evidenceType: evidence.evidenceType, fileName: evidence.fileName, mimeType: evidence.mimeType, sizeBytes: evidence.sizeBytes, reviewStatus: evidence.reviewStatus, createdAt: evidence.createdAt } });
  } catch (error) {
    if (savedPath) await unlink(savedPath).catch(() => {});
    if (error.type === "entity.too.large") return res.status(413).json({ success: false, message: "Evidence file must be 5 MB or smaller" });
    console.error("Upload listing evidence error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to upload evidence file" });
  }
}

async function sendEvidenceFile(evidence, res) {
  const document = await ListingEvidence.findById(evidence._id).select("+storagePath fileName mimeType");
  if (!document?.storagePath || !document.mimeType) return res.status(404).json({ success: false, message: "No file is attached to this evidence record" });
  const content = await readFile(document.storagePath).catch(() => null);
  if (!content) return res.status(404).json({ success: false, message: "Stored evidence file is unavailable" });
  res.setHeader("Content-Type", document.mimeType);
  res.setHeader("Content-Length", content.length);
  res.setHeader("Content-Disposition", `attachment; filename="${cleanFileName(document.fileName).replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(content);
}

export async function downloadMyListingEvidenceFile(req, res) {
  try {
    const { id, evidenceId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(evidenceId)) return res.status(400).json({ success: false, message: "Invalid listing or evidence ID" });
    const evidence = await ListingEvidence.findOne({ _id: evidenceId, listing: id, seller: req.user._id });
    if (!evidence) return res.status(404).json({ success: false, message: "Evidence file not found for this listing" });
    return await sendEvidenceFile(evidence, res);
  } catch (error) {
    console.error("Download seller evidence error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to download evidence file" });
  }
}

export async function downloadEvidenceFileForModerator(req, res) {
  try {
    const { evidenceId } = req.params;
    if (!mongoose.isValidObjectId(evidenceId)) return res.status(400).json({ success: false, message: "Invalid evidence ID" });
    const evidence = await ListingEvidence.findById(evidenceId);
    if (!evidence) return res.status(404).json({ success: false, message: "Evidence record not found" });
    return await sendEvidenceFile(evidence, res);
  } catch (error) {
    console.error("Download moderator evidence error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to download evidence file" });
  }
}

export async function getMyListingEvidence(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid listing ID" });
    const listing = await Listing.findOne({ _id: id, seller: req.user._id }).select("_id");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found or you do not own it" });
    const evidence = await ListingEvidence.find({ listing: listing._id, seller: req.user._id })
      .select("_id listing seller evidenceType fileName notes mimeType sizeBytes reviewStatus moderatorNote reviewedAt reviewedBy createdAt updatedAt")
      .sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, count: evidence.length, evidence });
  } catch (error) {
    console.error("Get listing evidence error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve evidence records" });
  }
}


// Moderators can inspect evidence metadata for a listing without exposing it publicly.
export async function getListingEvidenceForModerator(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid listing ID" });
    const listing = await Listing.findById(id).select("_id");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });
    const evidence = await ListingEvidence.find({ listing: listing._id })
      .select("_id listing seller evidenceType fileName notes mimeType sizeBytes reviewStatus moderatorNote reviewedAt reviewedBy createdAt updatedAt")
      .populate("seller", "name")
      .sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, count: evidence.length, evidence });
  } catch (error) {
    console.error("Get moderator evidence error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to retrieve listing evidence" });
  }
}
