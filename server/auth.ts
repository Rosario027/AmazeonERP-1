import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET || "amazeon-erp-secret-key-change-in-production";

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  sessionId?: string;
  employeeId?: string; // For staff logins
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "6h" });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    
    // Verify session is still active (only if sessionId exists in token)
    if (payload.sessionId) {
      try {
        const session = await storage.getSession(payload.sessionId);
        if (!session || !session.isActive) {
          return res.status(401).json({ message: "Session has been terminated" });
        }
        // Update session activity (non-blocking, don't wait)
        storage.updateSessionActivity(payload.sessionId).catch(() => {});
      } catch (sessionError) {
        // If session check fails (e.g., table doesn't exist), continue anyway
        // This ensures backward compatibility
        console.warn("Session check failed:", sessionError);
      }
    }
    
    (req as any).user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}
