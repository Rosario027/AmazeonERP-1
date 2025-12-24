// Helper function to parse date string (YYYY-MM-DD) as local date to avoid timezone issues
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

import {
  users,
  products,
  invoices,
  invoiceItems,
  expenses,
  settings,
  cashBalances,
  cashWithdrawals,
  sessions,
  customers,
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
  type Setting,
  type InsertSetting,
  type InvoiceWithItems,
  type CashBalance,
  type InsertCashBalance,
  type CashWithdrawal,
  type InsertCashWithdrawal,
  type Session,
  type InsertSession,
  type Customer,
  type InsertCustomer,
  type CustomerWithStats,
  employees,
  employeeAttendance,
  employeePurchases,
  staffAuditLog,
  type Employee,
  type NewEmployee,
  type EmployeeAttendance,
  type NewEmployeeAttendance,
  type EmployeePurchase,
  type NewEmployeePurchase,
  type StaffAuditLog,
  type NewStaffAuditLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, desc, isNull, max, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(userId: string, data: Partial<{ username: string; role: string }>): Promise<User | undefined>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  invalidateAllSessions(userId: string): Promise<void>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Invoices
  getInvoices(filters?: { startDate?: string; endDate?: string; includeDeleted?: boolean }): Promise<Invoice[]>;
  getInvoiceWithItems(id: number): Promise<InvoiceWithItems | undefined>;
  createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>, items?: InsertInvoiceItem[]): Promise<Invoice | undefined>;
  softDeleteInvoice(id: number): Promise<Invoice | undefined>;
  getNextInvoiceNumber(): Promise<string>;
  getInvoicePaymentSummary(filters?: { startDate?: string; endDate?: string }): Promise<{
    cashTotal: number;
    cardTotal: number;
    totalSales: number;
    invoiceCount: number;
  }>;
  
  // Settings
  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | null>;
  setSetting(key: string, value: string): Promise<Setting>;
  
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
    todayQuantity: number;
    weekQuantity: number;
    monthQuantity: number;
  }>;
  // Finance
  getCashBalance(userId: string, date: string): Promise<CashBalance | undefined>;
  upsertCashBalance(balance: InsertCashBalance): Promise<CashBalance>;
  getBalances(filters?: { userId?: string; startDate?: string; endDate?: string }): Promise<CashBalance[]>;
  createCashWithdrawal(withdrawal: InsertCashWithdrawal): Promise<CashWithdrawal>;
  updateCashWithdrawal(id: number, data: Partial<{ amount: string; note: string | null }>): Promise<CashWithdrawal | undefined>;
  deleteCashWithdrawal(id: number): Promise<boolean>;
  getCashWithdrawals(filters?: { startDate?: string; endDate?: string }): Promise<CashWithdrawal[]>;
  getCashWithdrawalsByUser(filters: { userId: string; startDate?: string; endDate?: string }): Promise<CashWithdrawal[]>;

  // Sessions
  createSession(session: InsertSession): Promise<Session>;
  getSession(sessionId: string): Promise<Session | undefined>;
  getAllActiveSessions(): Promise<(Session & { username: string; role: string })[]>;
  updateSessionActivity(sessionId: string): Promise<void>;
  terminateSession(sessionId: string): Promise<void>;
  terminateUserSessions(userId: string): Promise<void>;
  
  // Staff: Attendance
  listAttendance(employeeId: string, fromDate?: string, toDate?: string): Promise<EmployeeAttendance[]>;
  getAttendanceForExport(employeeIds: string[], fromDate: string, toDate: string): Promise<EmployeeAttendance[]>;

  // Customers
  getOrCreateCustomer(name: string, phone: string): Promise<Customer>;
  getCustomers(): Promise<CustomerWithStats[]>;
  getCustomersByPhone(phone: string): Promise<Customer[]>;
  getCustomer(id: number): Promise<CustomerWithStats | undefined>;
  getCustomerStats(startDate?: string, endDate?: string): Promise<CustomerWithStats[]>;
  getCustomerInvoices(customerId: number): Promise<Invoice[]>;
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(userId: string, data: Partial<{ username: string; role: string }>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: newPassword })
      .where(eq(users.id, userId));
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async invalidateAllSessions(userId: string): Promise<void> {
    // Increment tokenVersion to invalidate all JWT tokens issued before this moment
    // Since JWTs are stateless, we use this version counter in the token validation
    const [updated] = await db
      .update(users)
      .set({ 
        tokenVersion: sql`COALESCE(token_version, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updated) {
      throw new Error("User not found or update failed");
    }
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).where(isNull(products.deletedAt)).orderBy(desc(products.createdAt));
  }

  async getAllProducts(): Promise<Product[]> {
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
    const [updated] = await db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return !!updated;
  }

  async getInvoices(filters?: { startDate?: string; endDate?: string; includeDeleted?: boolean; limit?: number }): Promise<Invoice[]> {
    let query = db.select().from(invoices);

    const conditions = [];
    
    // Exclude deleted invoices by default
    if (!filters?.includeDeleted) {
      conditions.push(isNull(invoices.deletedAt));
    }
    
    // Use DATE() function in SQL to compare dates in database timezone
    if (filters?.startDate) {
      conditions.push(sql`DATE(${invoices.createdAt}) >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`DATE(${invoices.createdAt}) <= ${filters.endDate}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(invoices.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    return await query;
  }

  async getInvoiceWithItems(id: number): Promise<InvoiceWithItems | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!invoice) return undefined;

    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    return { ...invoice, items };
  }

  async createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice> {
    // Normalize undefined customerPhone to null and ensure gstMode is explicitly set
    const normalizedInvoice = {
      ...invoice,
      customerPhone: invoice.customerPhone ?? null,
      gstMode: invoice.gstMode ?? 'inclusive', // Explicitly include gstMode to override schema default
    };
    
    const [newInvoice] = await db.insert(invoices).values(normalizedInvoice).returning();

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
    // Normalize undefined customerPhone to null
    const normalizedInvoice = {
      ...invoice,
      customerPhone: invoice.customerPhone ?? null,
    };
    // CRITICAL: Remove gstMode from update to preserve historical data integrity.
    // Once an invoice is created with a specific GST mode (inclusive/exclusive),
    // it must never change - even if global settings are updated later.
    // This prevents mixed GST modes within a single invoice and ensures calculations remain consistent.
    delete normalizedInvoice.gstMode;
    
    const [updated] = await db
      .update(invoices)
      .set({ ...normalizedInvoice, isEdited: true, updatedAt: new Date() })
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

  async softDeleteInvoice(id: number): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated || undefined;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // Determine Financial Year (FY)
    // FY runs from April (month 3) to March (month 2)
    let fyStartYear: number;
    let fyEndYear: number;
    
    if (currentMonth >= 3) {
      // April to December: FY is current year to next year
      fyStartYear = currentYear;
      fyEndYear = currentYear + 1;
    } else {
      // January to March: FY is previous year to current year
      fyStartYear = currentYear - 1;
      fyEndYear = currentYear;
    }
    
    const fyString = `${String(fyStartYear).slice(-2)}-${String(fyEndYear).slice(-2)}`;
    const fyPrefix = `FY${fyString}/`;
    
    // Get invoice_series_start from settings (default: 1)
    const seriesStartSetting = await this.getSetting("invoice_series_start");
    const seriesStart = seriesStartSetting ? parseInt(seriesStartSetting.value, 10) : 1;
    
    // Count invoices with this FY prefix
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(sql`${invoices.invoiceNumber} LIKE ${fyPrefix + '%'}`);
    
    const count = Number(result[0]?.count || 0);
    const nextNum = seriesStart + count;
    
    return `${fyPrefix}${nextNum.toString().padStart(3, '0')}`;
  }

  async getInvoicePaymentSummary(filters?: { startDate?: string; endDate?: string }): Promise<{
    cashTotal: number;
    cardTotal: number;
    totalSales: number;
    invoiceCount: number;
  }> {
    try {
      const conditions: any[] = [isNull(invoices.deletedAt)];
      
      // Use DATE() function in SQL to compare dates in database timezone
      if (filters?.startDate) {
        conditions.push(sql`DATE(${invoices.createdAt}) >= ${filters.startDate}`);
      }
      
      if (filters?.endDate) {
        conditions.push(sql`DATE(${invoices.createdAt}) <= ${filters.endDate}`);
      }

      let query = db
        .select({
          cashTotal: sql<string>`COALESCE(SUM(CAST(${invoices.cashAmount} AS DECIMAL)), 0)`,
          cardTotal: sql<string>`COALESCE(SUM(CAST(${invoices.cardAmount} AS DECIMAL)), 0)`,
          grandTotal: sql<string>`COALESCE(SUM(CAST(${invoices.grandTotal} AS DECIMAL)), 0)`,
          invoiceCount: sql<number>`COUNT(*)`,
        })
        .from(invoices)
        .where(and(...conditions)) as any;

      const [row] = await query;
      
      const cashTotal = parseFloat(row?.cashTotal || "0");
      const cardTotal = parseFloat(row?.cardTotal || "0");
      const grandTotal = parseFloat(row?.grandTotal || "0");
      const invoiceCount = Number(row?.invoiceCount || 0);
      
      return {
        cashTotal: Number(cashTotal.toFixed(2)),
        cardTotal: Number(cardTotal.toFixed(2)),
        totalSales: Number((cashTotal + cardTotal).toFixed(2)),
        invoiceCount,
      };
    } catch (error) {
      console.error("[Storage] Error in getInvoicePaymentSummary:", error);
      return {
        cashTotal: 0,
        cardTotal: 0,
        totalSales: 0,
        invoiceCount: 0,
      };
    }
  }

  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Setting | null> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || null;
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const existing = await this.getSetting(key);
    
    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      const [newSetting] = await db
        .insert(settings)
        .values({ key, value })
        .returning();
      return newSetting;
    }
  }

  async getExpenses(filters?: { startDate?: string; endDate?: string }, userId?: string, adminView?: boolean): Promise<Expense[]> {
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

    // Exclude deleted expenses by default
    conditions.push(isNull(expenses.deletedAt));

    // If the caller is not admin, only return expenses created by that user
    if (userId && !adminView) {
      conditions.push(eq(expenses.createdBy, userId));
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
    // Soft-delete the expense so dashboards/statistics can exclude it
    const [updated] = await db
      .update(expenses)
      .set({ deletedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    return !!updated;
  }

  async getSalesStats(): Promise<{
    todaySales: number;
    weekSales: number;
    monthSales: number;
    todayExpenses: number;
    weekExpenses: number;
    monthExpenses: number;
    todayQuantity: number;
    weekQuantity: number;
    monthQuantity: number;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todaySalesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)` })
      .from(invoices)
      .where(and(gte(invoices.createdAt, todayStart), isNull(invoices.deletedAt)));

    const [weekSalesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)` })
      .from(invoices)
      .where(and(gte(invoices.createdAt, weekStart), isNull(invoices.deletedAt)));

    const [monthSalesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)` })
      .from(invoices)
      .where(and(gte(invoices.createdAt, monthStart), isNull(invoices.deletedAt)));

    const [todayExpensesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(gte(expenses.createdAt, todayStart), isNull(expenses.deletedAt)));

    const [weekExpensesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(gte(expenses.createdAt, weekStart), isNull(expenses.deletedAt)));

    const [monthExpensesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(gte(expenses.createdAt, monthStart), isNull(expenses.deletedAt)));

    // Quantity sold stats - join invoice_items with invoices
    const [todayQuantityResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoiceItems.quantity}), 0)` })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(and(gte(invoices.createdAt, todayStart), isNull(invoices.deletedAt)));

    const [weekQuantityResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoiceItems.quantity}), 0)` })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(and(gte(invoices.createdAt, weekStart), isNull(invoices.deletedAt)));

    const [monthQuantityResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoiceItems.quantity}), 0)` })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(and(gte(invoices.createdAt, monthStart), isNull(invoices.deletedAt)));

    return {
      todaySales: parseFloat(todaySalesResult?.total || "0"),
      weekSales: parseFloat(weekSalesResult?.total || "0"),
      monthSales: parseFloat(monthSalesResult?.total || "0"),
      todayExpenses: parseFloat(todayExpensesResult?.total || "0"),
      weekExpenses: parseFloat(weekExpensesResult?.total || "0"),
      monthExpenses: parseFloat(monthExpensesResult?.total || "0"),
      todayQuantity: parseInt(todayQuantityResult?.total || "0", 10),
      weekQuantity: parseInt(weekQuantityResult?.total || "0", 10),
      monthQuantity: parseInt(monthQuantityResult?.total || "0", 10),
    };
  }

  // Finance
  async getCashBalance(userId: string, date: string): Promise<CashBalance | undefined> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const [balance] = await db.select().from(cashBalances).where(and(eq(cashBalances.userId, userId), eq(cashBalances.date, dayStart)));
    return balance || undefined;
  }

  async upsertCashBalance(balance: InsertCashBalance): Promise<CashBalance> {
    // If an entry exists for the user and date, update it; otherwise insert
    const dayStart = new Date(balance.date as unknown as string);
    dayStart.setHours(0, 0, 0, 0);

    const existing = await db.select().from(cashBalances).where(and(eq(cashBalances.userId, balance.userId), eq(cashBalances.date, dayStart)));
    if (existing && existing.length > 0) {
      const [updated] = await db
        .update(cashBalances)
        .set({
          opening: balance.opening,
          cashTotal: balance.cashTotal,
          cardTotal: balance.cardTotal,
          closing: balance.closing,
        })
        .where(and(eq(cashBalances.userId, balance.userId), eq(cashBalances.date, dayStart)))
        .returning();
      return updated;
    } else {
      const [inserted] = await db.insert(cashBalances).values({
        userId: balance.userId,
        date: dayStart,
        opening: balance.opening,
        cashTotal: balance.cashTotal,
        cardTotal: balance.cardTotal,
        closing: balance.closing,
      }).returning();
      return inserted;
    }
  }

  async getBalances(filters?: { userId?: string; startDate?: string; endDate?: string }): Promise<CashBalance[]> {
    let query = db.select().from(cashBalances);
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(cashBalances.userId, filters.userId));
    if (filters?.startDate) {
      conditions.push(sql`DATE(${cashBalances.date}) >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`DATE(${cashBalances.date}) <= ${filters.endDate}`);
    }
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    return await query.orderBy(desc(cashBalances.date));
  }

  async createCashWithdrawal(withdrawal: InsertCashWithdrawal): Promise<CashWithdrawal> {
    const [row] = await db.insert(cashWithdrawals).values(withdrawal).returning();
    return row;
  }

  async updateCashWithdrawal(id: number, data: Partial<{ amount: string; note: string | null }>): Promise<CashWithdrawal | undefined> {
    const [updated] = await db
      .update(cashWithdrawals)
      .set(data)
      .where(eq(cashWithdrawals.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCashWithdrawal(id: number): Promise<boolean> {
    const result = await db
      .delete(cashWithdrawals)
      .where(eq(cashWithdrawals.id, id))
      .returning();
    return result.length > 0;
  }

  async getCashWithdrawals(filters?: { startDate?: string; endDate?: string }): Promise<CashWithdrawal[]> {
    let query = db.select().from(cashWithdrawals);
    const conditions: any[] = [];
    if (filters?.startDate) {
      conditions.push(sql`DATE(${cashWithdrawals.createdAt}) >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`DATE(${cashWithdrawals.createdAt}) <= ${filters.endDate}`);
    }
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    return await query.orderBy(desc(cashWithdrawals.createdAt));
  }

  async getCashWithdrawalsByUser(filters: { userId: string; startDate?: string; endDate?: string }): Promise<CashWithdrawal[]> {
    let query = db.select().from(cashWithdrawals);
    const conditions: any[] = [eq(cashWithdrawals.adminId, filters.userId)];
    
    if (filters.startDate) {
      conditions.push(sql`DATE(${cashWithdrawals.createdAt}) >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`DATE(${cashWithdrawals.createdAt}) <= ${filters.endDate}`);
    }
    
    query = query.where(and(...conditions)) as any;
    return await query.orderBy(desc(cashWithdrawals.createdAt));
  }

  // Staff: Employees
  async listEmployees(): Promise<Employee[]> {
    return await db.select().from(employees).orderBy(desc(employees.createdAt));
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [row] = await db.select().from(employees).where(eq(employees.id, id));
    return row || undefined;
  }

  async getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
    const [row] = await db.select().from(employees).where(eq(employees.userId, userId));
    return row || undefined;
  }

  // Auto-generate next employee code: EMP-1, EMP-2, etc.
  async getNextEmployeeCode(): Promise<string> {
    const result = await db
      .select({ code: employees.employeeCode })
      .from(employees)
      .orderBy(desc(employees.createdAt));
    
    let maxNum = 0;
    for (const row of result) {
      const match = row.code?.match(/^EMP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `EMP-${maxNum + 1}`;
  }

  async createEmployee(payload: NewEmployee): Promise<Employee> {
    const [row] = await db.insert(employees).values(payload).returning();
    if (!row) {
      throw new Error("Failed to create employee - no record returned");
    }
    return row;
  }

  async updateEmployee(id: string, payload: Partial<NewEmployee>): Promise<Employee | undefined> {
    const updateData = { ...payload, updatedAt: new Date() };
    const [row] = await db.update(employees).set(updateData).where(eq(employees.id, id)).returning();
    return row || undefined;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await db.delete(employees).where(eq(employees.id, id)).returning();
    return result.length > 0;
  }

  // Staff Audit Log
  async createAuditLog(payload: NewStaffAuditLog): Promise<StaffAuditLog> {
    const [row] = await db.insert(staffAuditLog).values(payload).returning();
    if (!row) {
      throw new Error("Failed to create audit log - no record returned");
    }
    return row;
  }

  async getAuditLogs(employeeId?: string, limit?: number): Promise<StaffAuditLog[]> {
    let query = db.select().from(staffAuditLog);
    if (employeeId) {
      query = query.where(eq(staffAuditLog.employeeId, employeeId)) as any;
    }
    query = query.orderBy(desc(staffAuditLog.createdAt)) as any;
    if (limit) {
      query = query.limit(limit) as any;
    }
    return await query;
  }

  // Staff: Attendance
  async getAttendanceForExport(employeeIds: string[], fromDate: string, toDate: string): Promise<EmployeeAttendance[]> {
    const conditions: any[] = [inArray(employeeAttendance.employeeId, employeeIds)];
    if (fromDate) conditions.push(sql`DATE(${employeeAttendance.attendanceDate}) >= ${fromDate}`);
    if (toDate) conditions.push(sql`DATE(${employeeAttendance.attendanceDate}) <= ${toDate}`);
    return await db.select().from(employeeAttendance).where(and(...conditions)).orderBy(desc(employeeAttendance.attendanceDate));
  }

  async listAttendance(employeeId: string, fromDate?: string, toDate?: string): Promise<EmployeeAttendance[]> {
    const conditions: any[] = [eq(employeeAttendance.employeeId, employeeId)];
    if (fromDate) conditions.push(sql`DATE(${employeeAttendance.attendanceDate}) >= ${fromDate}`);
    if (toDate) conditions.push(sql`DATE(${employeeAttendance.attendanceDate}) <= ${toDate}`);
    return await db.select().from(employeeAttendance).where(and(...conditions)).orderBy(desc(employeeAttendance.attendanceDate));
  }

  async upsertAttendance(payload: NewEmployeeAttendance): Promise<EmployeeAttendance> {
    const [row] = await db
      .insert(employeeAttendance)
      .values(payload)
      .onConflictDoUpdate({
        target: [employeeAttendance.employeeId, employeeAttendance.attendanceDate],
        set: {
          status: payload.status,
          checkIn: payload.checkIn ?? null,
          checkOut: payload.checkOut ?? null,
          notes: payload.notes ?? null,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return row;
  }

  async deleteAttendance(id: string): Promise<boolean> {
    const result = await db.delete(employeeAttendance).where(eq(employeeAttendance.id, id)).returning();
    return result.length > 0;
  }

  // Staff: Purchases
  async listEmployeePurchases(employeeId: string, fromDate?: string, toDate?: string): Promise<EmployeePurchase[]> {
    const conditions: any[] = [eq(employeePurchases.employeeId, employeeId)];
    if (fromDate) conditions.push(sql`DATE(${employeePurchases.purchaseDate}) >= ${fromDate}`);
    if (toDate) conditions.push(sql`DATE(${employeePurchases.purchaseDate}) <= ${toDate}`);
    return await db.select().from(employeePurchases).where(and(...conditions)).orderBy(desc(employeePurchases.purchaseDate));
  }

  async createEmployeePurchase(payload: NewEmployeePurchase): Promise<EmployeePurchase> {
    const [row] = await db.insert(employeePurchases).values(payload).returning();
    return row;
  }

  async updateEmployeePurchase(id: string, payload: Partial<NewEmployeePurchase>): Promise<EmployeePurchase | undefined> {
    const [row] = await db.update(employeePurchases).set(payload).where(eq(employeePurchases.id, id)).returning();
    return row || undefined;
  }

  async deleteEmployeePurchase(id: string): Promise<boolean> {
    const result = await db.delete(employeePurchases).where(eq(employeePurchases.id, id)).returning();
    return result.length > 0;
  }

  // Get today's attendance for an employee (for clock in/out)
  async getTodayAttendance(employeeId: string): Promise<EmployeeAttendance | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [row] = await db
      .select()
      .from(employeeAttendance)
      .where(and(
        eq(employeeAttendance.employeeId, employeeId),
        sql`DATE(${employeeAttendance.attendanceDate}) = ${today}`
      ));
    return row || undefined;
  }

  // Clock in for today
  async clockIn(employeeId: string): Promise<EmployeeAttendance> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    const existing = await this.getTodayAttendance(employeeId);
    if (existing) {
      // Update existing record with check-in time
      const [row] = await db
        .update(employeeAttendance)
        .set({ checkIn: now, status: 'present', updatedAt: now })
        .where(eq(employeeAttendance.id, existing.id))
        .returning();
      return row;
    } else {
      // Create new attendance record
      const [row] = await db
        .insert(employeeAttendance)
        .values({
          employeeId,
          attendanceDate: today,
          status: 'present',
          checkIn: now,
        })
        .returning();
      return row;
    }
  }

  // Clock out for today
  async clockOut(employeeId: string): Promise<EmployeeAttendance | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    const existing = await this.getTodayAttendance(employeeId);
    if (!existing || !existing.checkIn) {
      return undefined; // Can't clock out without clocking in first
    }
    
    const [row] = await db
      .update(employeeAttendance)
      .set({ checkOut: now, updatedAt: now })
      .where(eq(employeeAttendance.id, existing.id))
      .returning();
    return row;
  }

  // Get all employees currently clocked in (for live working time display)
  async getActiveEmployees(): Promise<(Employee & { attendance: EmployeeAttendance })[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const results = await db
      .select({
        employee: employees,
        attendance: employeeAttendance,
      })
      .from(employees)
      .innerJoin(
        employeeAttendance,
        and(
          eq(employees.id, employeeAttendance.employeeId),
          sql`DATE(${employeeAttendance.attendanceDate}) = ${today}`
        )
      )
      .where(and(
        sql`${employeeAttendance.checkIn} IS NOT NULL`,
        sql`${employeeAttendance.checkOut} IS NULL`
      ));
    
    return results.map(r => ({ ...r.employee, attendance: r.attendance }));
  }

  // Session Management
  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db.insert(sessions).values({
      ...session,
      loginAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
    }).returning();
    return newSession;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    return session || undefined;
  }

  async getAllActiveSessions(): Promise<(Session & { username: string; role: string })[]> {
    // Get all active sessions ordered by last activity
    const allResults = await db
      .select({
        session: sessions,
        username: users.username,
        role: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.isActive, true))
      .orderBy(desc(sessions.lastActivityAt));
    
    // If more than 10 sessions, terminate the older ones (beyond the first 10)
    if (allResults.length > 10) {
      const sessionsToTerminate = allResults.slice(10);
      const idsToTerminate = sessionsToTerminate.map(r => r.session.id);
      
      // Terminate sessions beyond the 10 most recent
      await db
        .update(sessions)
        .set({ isActive: false })
        .where(inArray(sessions.id, idsToTerminate));
      
      console.log(`Automatically terminated ${idsToTerminate.length} old sessions`);
    }
    
    // Return only the 10 most recent sessions
    const recentResults = allResults.slice(0, 10);
    return recentResults.map(r => ({
      ...r.session,
      username: r.username,
      role: r.role,
    }));
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await db
      .update(sessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async terminateSession(sessionId: string): Promise<void> {
    await db
      .update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.id, sessionId));
  }

  async terminateUserSessions(userId: string): Promise<void> {
    await db
      .update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.userId, userId));
  }

  // Customer Management
  async getOrCreateCustomer(name: string, phone: string): Promise<Customer> {
    // Try to find existing customer by name and phone
    const [existing] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.name, name), eq(customers.phone, phone)));

    if (existing) {
      return existing;
    }

    // Generate customer code (CUST-0001, CUST-0002, etc.)
    const [maxResult] = await db
      .select({ maxId: max(customers.id) })
      .from(customers);
    const nextId = (maxResult?.maxId || 0) + 1;
    const customerCode = `CUST-${String(nextId).padStart(4, '0')}`;

    // Create new customer
    const [customer] = await db
      .insert(customers)
      .values({
        customerCode,
        name,
        phone,
      })
      .returning();

    return customer;
  }

  async getCustomersByPhone(phone: string): Promise<Customer[]> {
    // Search for customers by phone number
    const matchingCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, phone))
      .orderBy(desc(customers.createdAt));

    return matchingCustomers;
  }

  async getCustomers(): Promise<CustomerWithStats[]> {
    const allCustomers = await db.select().from(customers).orderBy(desc(customers.createdAt));
    
    const result: CustomerWithStats[] = [];
    
    for (const customer of allCustomers) {
      const customerInvoices = await db
        .select()
        .from(invoices)
        .where(and(
          eq(invoices.customerId, customer.id),
          isNull(invoices.deletedAt)
        ));

      const totalPurchases = customerInvoices.length;
      const totalSpent = customerInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal || '0'), 0);
      const lastPurchase = customerInvoices.length > 0 
        ? customerInvoices.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0].createdAt
        : null;

      result.push({
        ...customer,
        totalPurchases,
        totalSpent,
        lastPurchase,
      });
    }

    return result;
  }

  async getCustomer(id: number): Promise<CustomerWithStats | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    if (!customer) return undefined;

    const customerInvoices = await db
      .select()
      .from(invoices)
      .where(and(
        eq(invoices.customerId, customer.id),
        isNull(invoices.deletedAt)
      ));

    const totalPurchases = customerInvoices.length;
    const totalSpent = customerInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal || '0'), 0);
    const lastPurchase = customerInvoices.length > 0 
      ? customerInvoices.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0].createdAt
      : null;

    return {
      ...customer,
      totalPurchases,
      totalSpent,
      lastPurchase,
    };
  }

  async getCustomerStats(startDate?: string, endDate?: string): Promise<CustomerWithStats[]> {
    // Get all customers with their invoice statistics
    const allCustomers = await this.getCustomers();
    
    const stats: CustomerWithStats[] = [];
    
    for (const customer of allCustomers) {
      const conditions: any[] = [
        eq(invoices.customerId, customer.id),
        isNull(invoices.deletedAt),
      ];
      
      if (startDate) {
        conditions.push(sql`DATE(${invoices.createdAt}) >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`DATE(${invoices.createdAt}) <= ${endDate}`);
      }

      const customerInvoices = await db
        .select()
        .from(invoices)
        .where(and(...conditions));

      const totalPurchases = customerInvoices.length;
      const totalSpent = customerInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal || '0'), 0);
      const lastPurchase = customerInvoices.length > 0 
        ? customerInvoices.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0].createdAt
        : null;

      stats.push({
        ...customer,
        totalPurchases,
        totalSpent,
        lastPurchase,
      });
    }

    return stats;
  }

  async getCustomerInvoices(customerId: number): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(and(
        eq(invoices.customerId, customerId),
        isNull(invoices.deletedAt)
      ))
      .orderBy(desc(invoices.createdAt));
  }
}

export const storage = new DatabaseStorage();
