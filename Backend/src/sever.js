import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDatabase } from "./config/db.js";
import { authRouter } from "./routes/authRoutes.js";
import { healthRouter } from "./routes/healthRoutes.js";
import { appointmentRouter } from "./routes/appointmentRoutes.js";
import { petRouter } from "./routes/petRoutes.js";
import { userRouter } from "./routes/userRoutes.js";
import { consultationRouter } from "./routes/consultationRoutes.js";
import { prescriptionRouter } from "./routes/prescriptionRoutes.js";
import { doctorScheduleRouter } from "./routes/doctorScheduleRoutes.js";
import { billingRouter } from "./routes/billingRoutes.js";
import { reportRouter } from "./routes/reportRoutes.js";
import { medicalRecordRouter } from "./routes/medicalRecordRoutes.js";
import { activityLogRouter } from "./routes/activityLogRoutes.js";
import { vaccinationRouter } from "./routes/vaccinationRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import { queueRouter } from "./routes/queueRoutes.js";

const app = express();
const port = Number(process.env.PORT) || 5000;
const host = process.env.HOST || "0.0.0.0";
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const knownCloudOrigins = [
  "https://pawever.koreacentral.cloudapp.azure.com",
  "https://pawever1.koreacentral.cloudapp.azure.com",
];
const allowedOrigins = [
  frontendUrl,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  ...knownCloudOrigins,
];
const dbRetryMs = Number(process.env.DB_RETRY_MS) || 10000;

function isLocalDevOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(String(origin || ""));
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      const corsError = new Error(`CORS blocked for origin: ${origin}`);
      corsError.status = 403;
      callback(corsError);
    },
  })
);
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/appointments", appointmentRouter);
app.use("/api/pets", petRouter);
app.use("/api/users", userRouter);
app.use("/api/consultations", consultationRouter);
app.use("/api/prescriptions", prescriptionRouter);
app.use("/api/doctor-schedule", doctorScheduleRouter);
app.use("/api/billing", billingRouter);
app.use("/api/reports", reportRouter);
app.use("/api/medical-records", medicalRecordRouter);
app.use("/api/activity-logs", activityLogRouter);
app.use("/api/vaccinations", vaccinationRouter);

app.use("/api/queue", queueRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function connectWithRetry() {
  while (true) {
    try {
      await connectDatabase();
      return;
    } catch (error) {
      console.error(
        `Failed to connect to PostgreSQL. Retrying in ${dbRetryMs}ms`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, dbRetryMs));
    }
  }
}

async function startServer() {
  await connectWithRetry();

  app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Fatal startup error", error);
  process.exit(1);
});
