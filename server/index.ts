import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { pool } from "./db";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

async function ensureSchemaUpdates() {
  try {
    // Add missing columns if they don't exist so the running app can work without manual DB migration
    await pool.query(`ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS created_by varchar;`);
    await pool.query(`ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS deleted_at timestamp;`);
    log("✓ Ensured expenses table columns");

    // Add invoice_items description column
    await pool.query(`ALTER TABLE IF EXISTS invoice_items ADD COLUMN IF NOT EXISTS description text;`);
    log("✓ Ensured invoice_items description column");

    // Add payment split columns to invoices
    await pool.query(`ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS cash_amount numeric(12, 2) DEFAULT 0 NOT NULL;`);
    await pool.query(`ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS card_amount numeric(12, 2) DEFAULT 0 NOT NULL;`);
    log("✓ Ensured invoices payment split columns");

    // Backfill existing invoices based on payment mode
    // Update Cash invoices
    const cashResult = await pool.query(`
      UPDATE invoices
      SET cash_amount = grand_total, card_amount = 0
      WHERE payment_mode = 'Cash' AND cash_amount = 0 AND card_amount = 0;
    `);
    
    // Update Online invoices
    const onlineResult = await pool.query(`
      UPDATE invoices
      SET cash_amount = 0, card_amount = grand_total
      WHERE payment_mode = 'Online' AND cash_amount = 0 AND card_amount = 0;
    `);
    
    const totalBackfilled = (cashResult.rowCount || 0) + (onlineResult.rowCount || 0);
    log(\`✓ Backfilled \${totalBackfilled} invoice payment amounts (\${cashResult.rowCount || 0} cash, \${onlineResult.rowCount || 0} online)\`);

    log("Schema updates completed successfully");
  } catch (err) {
    log("Failed to ensure schema updates: " + String(err));
  }
}

(async () => {
  await ensureSchemaUpdates();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const listenOptions: any = { port, host: "0.0.0.0" };
  if (process.platform !== 'win32') {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
