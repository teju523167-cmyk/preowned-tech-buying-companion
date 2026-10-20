import crypto from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_AUTH_POSTS = new Set([
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/accept-invitation",
]);

export function csrfToken(req, res) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  req.session.save((error) => {
    if (error) return res.status(500).json({ success: false, message: "Could not create CSRF token" });
    return res.status(200).json({ success: true, csrfToken: req.session.csrfToken });
  });
}

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method) || PUBLIC_AUTH_POSTS.has(req.path)) return next();

  const supplied = req.get("x-csrf-token");
  const expected = req.session?.csrfToken;
  if (!supplied || !expected || supplied.length !== expected.length ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ success: false, message: "CSRF token missing or invalid. Fetch GET /api/auth/csrf-token and send the token in the x-csrf-token header." });
  }
  return next();
}
