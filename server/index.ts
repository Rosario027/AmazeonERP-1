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
    log(`✓ Backfilled ${totalBackfilled} invoice payment amounts (${cashResult.rowCount || 0} cash, ${onlineResult.rowCount || 0} online)`);

    log("Schema updates completed successfully");
  } catch (err) {
    log("Failed to ensure schema updates: " + String(err));
  }
}

// Minimal idempotent creation of staff management tables if migrations not run
async function ensureStaffSchema() {
  try {
    // Extensions
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Employees
    await pool.query(`CREATE TABLE IF NOT EXISTS employees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_code text UNIQUE NOT NULL,
      full_name text NOT NULL,
      phone text,
      email text,
      role text NOT NULL DEFAULT 'staff',
      status text NOT NULL DEFAULT 'active',
      date_joined date,
      date_left date,
      salary numeric(12,2),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_employees_name_trgm ON employees USING gin(full_name gin_trgm_ops);`);

    // Attendance
    await pool.query(`CREATE TABLE IF NOT EXISTS employee_attendance (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      attendance_date date NOT NULL,
      status text NOT NULL,
      check_in timestamptz,
      check_out timestamptz,
      notes text,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(employee_id, attendance_date)
    );`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON employee_attendance(employee_id, attendance_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON employee_attendance(attendance_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_status ON employee_attendance(status);`);

    // Purchases
    await pool.query(`CREATE TABLE IF NOT EXISTS employee_purchases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      purchase_date date NOT NULL,
      category text NOT NULL,
      amount numeric(12,2) NOT NULL CHECK (amount >= 0),
      payment_mode text NOT NULL DEFAULT 'cash',
      description text,
      recorded_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_emp_purchases_employee_date ON employee_purchases(employee_id, purchase_date);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_emp_purchases_category ON employee_purchases(category);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_emp_purchases_payment_mode ON employee_purchases(payment_mode);`);

    // Constraints (safe add via DO blocks)
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_employees_role') THEN
        ALTER TABLE employees ADD CONSTRAINT chk_employees_role CHECK (role IN ('staff','manager','admin'));
      END IF;
    END $$;`);
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_employees_status') THEN
        ALTER TABLE employees ADD CONSTRAINT chk_employees_status CHECK (status IN ('active','inactive'));
      END IF;
    END $$;`);
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_attendance_status') THEN
        ALTER TABLE employee_attendance ADD CONSTRAINT chk_attendance_status CHECK (status IN ('present','absent','half-day','leave'));
      END IF;
    END $$;`);
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_purchases_category') THEN
        ALTER TABLE employee_purchases ADD CONSTRAINT chk_emp_purchases_category CHECK (category IN ('shop-purchase','advance','reimbursement'));
      END IF;
    END $$;`);
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_purchases_payment_mode') THEN
        ALTER TABLE employee_purchases ADD CONSTRAINT chk_emp_purchases_payment_mode CHECK (payment_mode IN ('cash','card','online','salary-deduction'));
      END IF;
    END $$;`);

    // Updated_at trigger function
    await pool.query(`CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;`);
    // Triggers (ignore duplicate_object via DO blocks)
    await pool.query(`DO $$ BEGIN
      CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await pool.query(`DO $$ BEGIN
      CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON employee_attendance
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await pool.query(`DO $$ BEGIN
      CREATE TRIGGER trg_emp_purchases_updated BEFORE UPDATE ON employee_purchases
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    log('✓ Staff schema ensured');
  } catch (err) {
    log('Failed to ensure staff schema: ' + String(err));
  }
}

(async () => {
  try {
    await ensureSchemaUpdates();
    await ensureStaffSchema();
  } catch (initErr) {
    log('FATAL: Schema initialization failed: ' + String(initErr));
    process.exit(1);
  }

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
})().catch(err => {
  log('FATAL: Server startup failed: ' + String(err));
  process.exit(1);
});
