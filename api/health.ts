import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || "unknown",
    region: process.env.VERCEL_REGION || "unknown",
  };

  console.log("Health check called", status);

  res.status(200).json(status);
}
