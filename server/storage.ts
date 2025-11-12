import {
  users,
  products,
  invoices,
  invoiceItems,
  expenses,
  type User,
  type InsertUser,
  type Product,
  type InsertProduct,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type Expense,
  type InsertExpense,
  type InvoiceWithItems,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Invoices
  getInvoices(filters?: { startDate?: string; endDate?: string }): Promise<Invoice[]>;
  getInvoiceWithItems(id: number): Promise<InvoiceWithItems | undefined>;
  createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>, items?: InsertInvoiceItem[]): Promise<Invoice | undefined>;
  getNextInvoiceNumber(type: "B2C" | "B2B"): Promise<string>;
  
  // Expenses
  getExpenses(filters?: { startDate?: string; endDate?: string }): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<boolean>;
  
  // Analytics
  getSalesStats(): Promise<{
    todaySales: number;
    weekSales: number;
    monthSales: number;
    todayExpenses: number;
    weekExpenses: number;
    monthExpenses: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    try {
      await db.delete(products).where(eq(products.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting product:", error);
      throw new Error("Cannot delete product that is referenced in invoices");
    }
  }

  async getInvoices(filters?: { startDate?: string; endDate?: string }): Promise<Invoice[]> {
    let query = db.select().from(invoices);

    const conditions = [];
    if (filters?.startDate) {
      conditions.push(gte(invoices.createdAt, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(invoices.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(invoices.createdAt));
  }

  async getInvoiceWithItems(id: number): Promise<InvoiceWithItems | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!invoice) return undefined;

    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    return { ...invoice, items };
  }

  async createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();

    if (items.length > 0) {
      const itemsWithInvoiceId = items.map((item: InsertInvoiceItem) => ({
        ...item,
        invoiceId: newInvoice.id,
      }) satisfies typeof invoiceItems.$inferInsert);

      await db.insert(invoiceItems).values(itemsWithInvoiceId);
    }

    return newInvoice;
  }

  async updateInvoice(id: number, invoice: Partial<InsertInvoice>, items?: InsertInvoiceItem[]): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ ...invoice, isEdited: true, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();

    if (!updated) return undefined;

    if (items && items.length > 0) {
      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      const itemsWithInvoiceId = items.map((item: InsertInvoiceItem) => ({
        ...item,
        invoiceId: id,
      }) satisfies typeof invoiceItems.$inferInsert);
      await db.insert(invoiceItems).values(itemsWithInvoiceId);
    }

    return updated;
  }

  async getNextInvoiceNumber(type: "B2C" | "B2B"): Promise<string> {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear()).slice(-2);
    const prefix = type === "B2C" ? "AZC" : "AZB";

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.invoiceType, type),
          gte(invoices.createdAt, startOfMonth),
          lte(invoices.createdAt, endOfMonth)
        )
      );

    const count = Number(result[0]?.count || 0);
    const nextNumber = String(count + 1).padStart(4, "0");

    return `${prefix}${month}${year}${nextNumber}`;
  }

  async getExpenses(filters?: { startDate?: string; endDate?: string }): Promise<Expense[]> {
    let query = db.select().from(expenses);

    const conditions = [];
    if (filters?.startDate) {
      conditions.push(gte(expenses.createdAt, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(expenses.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(expenses.createdAt));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  async updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [updated] = await db
      .update(expenses)
      .set(expense)
      .where(eq(expenses.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExpense(id: number): Promise<boolean> {
    await db.delete(expenses).where(eq(expenses.id, id));
    return true;
  }

  async getSalesStats(): Promise<{
    todaySales: number;
    weekSales: number;
    monthSales: number;
    todayExpenses: number;
    weekExpenses: number;
    monthExpenses: number;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todaySalesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)` })
      .from(invoices)
      .where(gte(invoices.createdAt, todayStart));

    const [weekSalesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)` })
      .from(invoices)
      .where(gte(invoices.createdAt, weekStart));

    const [monthSalesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)` })
      .from(invoices)
      .where(gte(invoices.createdAt, monthStart));

    const [todayExpensesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(gte(expenses.createdAt, todayStart));

    const [weekExpensesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(gte(expenses.createdAt, weekStart));

    const [monthExpensesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(gte(expenses.createdAt, monthStart));

    return {
      todaySales: parseFloat(todaySalesResult?.total || "0"),
      weekSales: parseFloat(weekSalesResult?.total || "0"),
      monthSales: parseFloat(monthSalesResult?.total || "0"),
      todayExpenses: parseFloat(todayExpensesResult?.total || "0"),
      weekExpenses: parseFloat(weekExpensesResult?.total || "0"),
      monthExpenses: parseFloat(monthExpensesResult?.total || "0"),
    };
  }
}

export const storage = new DatabaseStorage();
