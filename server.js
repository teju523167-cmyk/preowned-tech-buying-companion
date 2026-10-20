import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = Number(process.env.PORT || 4000);

async function startServer() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error("PORT must be a valid TCP port");
  await connectDB();
  const server = app.listen(PORT, () => console.log(`Preowned Tech API running on port ${PORT}`));
  const shutdown = (signal) => {
    console.log(`${signal} received; shutting down server`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
