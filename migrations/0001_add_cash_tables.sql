CREATE TABLE IF NOT EXISTS "cash_balances" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" varchar NOT NULL,
  "date" timestamp NOT NULL,
  "opening" numeric(12, 2) NOT NULL,
  "cash_total" numeric(12, 2) NOT NULL,
  "card_total" numeric(12, 2) NOT NULL,
  "closing" numeric(12, 2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "cash_balances_user_date_idx"
  ON "cash_balances" ("user_id", "date");

CREATE TABLE IF NOT EXISTS "cash_withdrawals" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "admin_id" varchar NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
