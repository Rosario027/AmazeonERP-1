import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
});

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  hsnCode: text("hsn_code").notNull(),
  category: text("category"),
  rate: decimal("rate", { precision: 10, scale: 2 }).notNull(),
  gstPercentage: decimal("gst_percentage", { precision: 5, scale: 2 }).notNull(),
  quantity: integer("quantity").default(0).notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const invoices = pgTable("invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  invoiceType: text("invoice_type").notNull(), // 'B2C' or 'B2B'
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerGst: text("customer_gst"), // Only for B2B
  paymentMode: text("payment_mode").notNull(), // 'Cash' or 'Online'
  gstMode: text("gst_mode").notNull().default('inclusive'), // 'inclusive' or 'exclusive' - GST mode used for this invoice
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull(),
  grandTotal: decimal("grand_total", { precision: 10, scale: 2 }).notNull(),
  cashAmount: decimal("cash_amount", { precision: 12, scale: 2 }).notNull().default(sql`0`),
  cardAmount: decimal("card_amount", { precision: 12, scale: 2 }).notNull().default(sql`0`),
  isEdited: boolean("is_edited").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Staff Management
export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeCode: text("employee_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  role: text("role").notNull().default("staff"),
  status: text("status").notNull().default("active"),
  dateJoined: date("date_joined"),
  dateLeft: date("date_left"),
  salary: numeric("salary", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const employeeAttendance = pgTable("employee_attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  status: text("status").notNull(),
  checkIn: timestamp("check_in", { withTimezone: true }),
  checkOut: timestamp("check_out", { withTimezone: true }),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqEmployeeDate: uniqueIndex("uniq_attendance_employee_date").on(table.employeeId, table.attendanceDate),
}));

export const employeePurchases = pgTable("employee_purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  purchaseDate: date("purchase_date").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  description: text("description"),
  recordedBy: uuid("recorded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type EmployeeAttendance = typeof employeeAttendance.$inferSelect;
export type NewEmployeeAttendance = typeof employeeAttendance.$inferInsert;
export type EmployeePurchase = typeof employeePurchases.$inferSelect;
export type NewEmployeePurchase = typeof employeePurchases.$inferInsert;

export const invoiceItems = pgTable("invoice_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  itemName: text("item_name").notNull(),
  description: text("description"),
  hsnCode: text("hsn_code").notNull(),
  rate: decimal("rate", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  gstPercentage: decimal("gst_percentage", { precision: 5, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull(),
  taxableValue: decimal("taxable_value", { precision: 10, scale: 2 }).notNull(),
  cgstPercentage: decimal("cgst_percentage", { precision: 5, scale: 2 }).notNull(),
  cgstAmount: decimal("cgst_amount", { precision: 10, scale: 2 }).notNull(),
  sgstPercentage: decimal("sgst_percentage", { precision: 5, scale: 2 }).notNull(),
  sgstAmount: decimal("sgst_amount", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
});

export const expenses = pgTable("expenses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category"),
  createdBy: varchar("created_by"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cashBalances = pgTable("cash_balances", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  date: timestamp("date").notNull(),
  opening: decimal("opening", { precision: 12, scale: 2 }).notNull(),
  cashTotal: decimal("cash_total", { precision: 12, scale: 2 }).notNull(),
  cardTotal: decimal("card_total", { precision: 12, scale: 2 }).notNull(),
  closing: decimal("closing", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userDateIdx: uniqueIndex("cash_balances_user_date_idx").on(table.userId, table.date),
}));

export const cashWithdrawals = pgTable("cash_withdrawals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  adminId: varchar("admin_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const invoicesRelations = relations(invoices, ({ many }) => ({
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  createdAt: true,
  deletedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems);

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  createdAt: true,
  deletedAt: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type CashBalance = typeof cashBalances.$inferSelect;
export type InsertCashBalance = typeof cashBalances.$inferInsert;

export type CashWithdrawal = typeof cashWithdrawals.$inferSelect;
export type InsertCashWithdrawal = typeof cashWithdrawals.$inferInsert;

// Extended types for frontend
export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
};

export type ProductWithQtySold = Product & {
  qtySold?: number;
};
