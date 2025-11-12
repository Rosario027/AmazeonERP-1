import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
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
});

export const invoices = pgTable("invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  invoiceType: text("invoice_type").notNull(), // 'B2C' or 'B2B'
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerGst: text("customer_gst"), // Only for B2B
  paymentMode: text("payment_mode").notNull(), // 'Cash' or 'Online'
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).notNull(),
  grandTotal: decimal("grand_total", { precision: 10, scale: 2 }).notNull(),
  isEdited: boolean("is_edited").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  itemName: text("item_name").notNull(),
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
  id: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
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

// Extended types for frontend
export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
};
