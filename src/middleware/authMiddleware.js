import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required. Please log in." });

    const user = await User.findById(userId).select("-password +sessionVersion");
    if (!user) {
      return req.session.destroy(() => {
        res.clearCookie("preowned.sid", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        return res.status(401).json({ success: false, message: "User account no longer exists. Please log in again." });
      });
    }
    if (!user.isActive) {
      return req.session.destroy(() => {
        res.clearCookie("preowned.sid", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        return res.status(403).json({ success: false, message: "This account is inactive" });
      });
    }
    if ((req.session.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
      return req.session.destroy(() => {
        res.clearCookie("preowned.sid", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        return res.status(401).json({ success: false, message: "Your session has expired. Please log in again." });
      });
    }
    req.user = user;
    return next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    return res.status(500).json({ success: false, message: "Authentication failed due to a server error" });
  }
}
