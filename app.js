import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import { csrfProtection } from "./middleware/csrfProtection.js";
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import moderatorRoutes from "./routes/moderatorRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import buyerChatRoutes from "./routes/buyerChatRoutes.js";
import viewingRoutes from "./routes/viewingRoutes.js";
import preferenceRoutes from "./routes/preferenceRoutes.js";
import devEmailRoutes from "./routes/devEmailRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

const app = express();
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from .env");

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token", "Idempotency-Key"],
}));
app.use(express.json({ limit: "50kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

app.use(session({
  name: "preowned.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions",
    ttl: 30 * 60,
    autoRemove: "native",
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60 * 1000,
    path: "/",
  },
}));
app.use(csrfProtection);

app.get("/", (_req, res) => res.status(200).json({ success: true, message: "Welcome to Preowned Tech API" }));
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/moderator", moderatorRoutes);
app.use("/api/shortlists", wishlistRoutes);
app.use("/api/preferences", preferenceRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/viewings", viewingRoutes);
app.use("/api/buyer-chat", buyerChatRoutes);
app.use("/api/dev-email-inbox", devEmailRoutes);
app.use("/api", aiRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ success: false, message: "Request body is too large" });
  if (error?.type === "entity.parse.failed") return res.status(400).json({ success: false, message: "Invalid JSON request body" });
  if (error?.message === "Origin is not allowed by CORS") return res.status(403).json({ success: false, message: "Origin is not allowed" });
  console.error("Unhandled request error:", error?.message || error);
  return res.status(500).json({ success: false, message: "Unexpected server error" });
});

export default app;
