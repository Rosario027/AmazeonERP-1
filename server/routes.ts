import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { invoices, invoiceItems, products, insertUserSchema } from "@shared/schema";
import { eq, and, gte, lte, sql, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateToken, authMiddleware, adminMiddleware } from "./auth";
import ExcelJS from "exceljs";
import { fileUploadRouter, staffUploadRouter } from "./fileUpload";

function normalizePaymentSplit(
  paymentMode: string,
  grandTotal: number,
  cashAmount?: number,
  cardAmount?: number,
) {
  let cash = Number.isFinite(cashAmount) ? Number(cashAmount) : 0;
  let card = Number.isFinite(cardAmount) ? Number(cardAmount) : 0;

  if (paymentMode === "Cash") {
    cash = grandTotal;
    card = 0;
  } else if (paymentMode === "Online") {
    cash = 0;
    card = grandTotal;
  } else if (paymentMode === "Cash+Card") {
    const combined = cash + card;
    if (combined === 0) {
      cash = grandTotal;
      card = 0;
    } else {
      const delta = grandTotal - combined;
      if (Math.abs(delta) > 0.5) {
        card = grandTotal - cash;
      } else if (delta !== 0) {
        card += delta;
      }
    }
    if (cash < 0) cash = 0;
    if (card < 0) card = 0;
  } else {
    if (cash === 0 && card === 0) {
      cash = grandTotal;
    }
  }

  const normalizedCash = Number(Math.max(cash, 0).toFixed(2));
  const normalizedCard = Number(Math.max(card, 0).toFixed(2));
  return {
    cash: normalizedCash,
    card: normalizedCard,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // File upload routes
  app.use("/api/files", fileUploadRouter);
  app.use("/api/staff/files", staffUploadRouter);

  // Authentication
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create a new session
      const userAgent = req.headers['user-agent'] || 'Unknown Browser';
      const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'Unknown';
      
      // Parse user agent for display
      let deviceInfo = 'Unknown Browser';
      if (userAgent.includes('Chrome')) deviceInfo = 'Chrome Browser';
      else if (userAgent.includes('Firefox')) deviceInfo = 'Firefox Browser';
      else if (userAgent.includes('Safari')) deviceInfo = 'Safari Browser';
      else if (userAgent.includes('Edge')) deviceInfo = 'Edge Browser';
      else if (userAgent.includes('Opera')) deviceInfo = 'Opera Browser';
      else deviceInfo = userAgent.substring(0, 50);

      const session = await storage.createSession({
        userId: user.id,
        deviceInfo,
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : ipAddress,
        userAgent,
      });

      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        sessionId: session.id,
      });

      res.json({
        user: { id: user.id, username: user.username, role: user.role },
        token,
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get active sessions (admin only)
  app.get("/api/admin/sessions", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const activeSessions = await storage.getAllActiveSessions();
      res.json(activeSessions);
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Terminate a specific session (admin only)
  app.delete("/api/admin/sessions/:sessionId/terminate", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { sessionId } = req.params;
      await storage.terminateSession(sessionId);
      res.json({ message: "Session terminated successfully" });
    } catch (error) {
      console.error("Terminate session error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Logout all sessions (admin only) - one-time security feature for lost/sold devices
  app.post("/api/auth/logout-all-sessions", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // This endpoint invalidates all existing JWT tokens by incrementing a version counter
      // In a stateless JWT system, we store a "token version" for each user
      // Incrementing it effectively logs out all sessions
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Update user's token version to invalidate all existing tokens
      // This requires tracking token versions in the users table
      await storage.invalidateAllSessions(userId);
      
      // Also terminate all sessions in the sessions table
      await storage.terminateUserSessions(userId);

      res.json({
        message: "All sessions have been logged out successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Logout all sessions error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Products (protected routes)
  app.get("/api/products", authMiddleware, async (req, res) => {
    try {
      const productsData = await storage.getProducts();
      res.json(productsData);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products/all", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/products", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { name, hsnCode, category, rate, gstPercentage, comments } = req.body;
      
      if (!name || !hsnCode || !rate || !gstPercentage) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const product = await storage.createProduct({
        name,
        hsnCode,
        category: category || null,
        rate,
        gstPercentage,
        comments: comments || null,
      });

      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/products/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, hsnCode, category, rate, gstPercentage, comments } = req.body;

      const product = await storage.updateProduct(id, {
        name,
        hsnCode,
        category: category || null,
        rate,
        gstPercentage,
        comments: comments || null,
      });

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/products/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === "Cannot delete product that has been used in invoices") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Invoices (protected routes)
  app.get("/api/invoices/next-number", authMiddleware, async (req, res) => {
    try {
      const invoiceNumber = await storage.getNextInvoiceNumber();
      res.json({ invoiceNumber });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/invoices", authMiddleware, async (req, res) => {
    try {
      const { startDate, endDate, includeDeleted } = req.query;
      const invoices = await storage.getInvoices({
        startDate: startDate as string,
        endDate: endDate as string,
        includeDeleted: includeDeleted === "true",
      });
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/invoices/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getInvoiceWithItems(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/invoices", authMiddleware, async (req, res) => {
    try {
      const { invoiceType, customerName, customerPhone, customerGst, paymentMode, gstMode, items } = req.body;

      if (!invoiceType || !customerName || !paymentMode || !gstMode || !items || items.length === 0) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const invoiceNumber = await storage.getNextInvoiceNumber();

      // Calculate totals from new CGST/SGST structure
      let subtotal = 0;
      let totalGst = 0;

      const invoiceItems = items.map((item: any) => {
        const taxableValue = parseFloat(item.taxableValue) || 0;
        const cgstAmount = parseFloat(item.cgstAmount) || 0;
        const sgstAmount = parseFloat(item.sgstAmount) || 0;
        const itemTotal = parseFloat(item.total) || 0;
        const gstPercentage = parseFloat(item.gstPercentage) || 0;
        const gstAmount = parseFloat(item.gstAmount) || 0;

        subtotal += taxableValue;
        totalGst += (cgstAmount + sgstAmount);

        return {
          productId: item.productId ? parseInt(item.productId) : null,
          itemName: item.itemName,
          description: item.description || null,
          hsnCode: item.hsnCode,
          rate: parseFloat(item.rate).toString(),
          quantity: item.quantity,
          gstPercentage: gstPercentage.toString(),
          gstAmount: gstAmount.toString(),
          taxableValue: taxableValue.toString(),
          cgstPercentage: parseFloat(item.cgstPercentage).toString(),
          cgstAmount: cgstAmount.toString(),
          sgstPercentage: parseFloat(item.sgstPercentage).toString(),
          sgstAmount: sgstAmount.toString(),
          total: itemTotal.toString(),
        };
      });

      const grandTotal = subtotal + totalGst;
      const roundedGrandTotal = Math.round(grandTotal);

      const { cash: normalizedCashAmount, card: normalizedCardAmount } = normalizePaymentSplit(
        paymentMode,
        roundedGrandTotal,
        Number(req.body.cashAmount ?? 0),
        Number(req.body.cardAmount ?? 0),
      );

      // Get or create customer for tracking
      let customerId: number | null = null;
      if (customerName && customerPhone) {
        try {
          const customer = await storage.getOrCreateCustomer(customerName, customerPhone);
          customerId = customer.id;
        } catch (err) {
          console.log("Could not create/get customer:", err);
        }
      }

      const invoice = await storage.createInvoice(
        {
          invoiceNumber,
          invoiceType,
          customerName,
          customerPhone: customerPhone || null,
          customerGst: customerGst || null,
          paymentMode,
          gstMode,
          subtotal: subtotal.toString(),
          gstAmount: totalGst.toString(),
          // Store the rounded grand total (nearest rupee)
          grandTotal: roundedGrandTotal.toString(),
          cashAmount: normalizedCashAmount.toFixed(2),
          cardAmount: normalizedCardAmount.toFixed(2),
          customerId,
        },
        invoiceItems
      );

      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/invoices/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { customerName, customerPhone, customerGst, paymentMode, items } = req.body;

      // Recalculate totals if items are provided
      let updateData: any = {};

      if (items) {
        let subtotal = 0;
        let totalGst = 0;

        const invoiceItems = items.map((item: any) => {
          const taxableValue = parseFloat(item.taxableValue) || 0;
          const cgstAmount = parseFloat(item.cgstAmount) || 0;
          const sgstAmount = parseFloat(item.sgstAmount) || 0;
          const itemTotal = parseFloat(item.total) || 0;
          const gstPercentage = parseFloat(item.gstPercentage) || 0;
          const gstAmount = parseFloat(item.gstAmount) || 0;

          subtotal += taxableValue;
          totalGst += (cgstAmount + sgstAmount);

          return {
            productId: item.productId ? parseInt(item.productId) : null,
            itemName: item.itemName,
            description: item.description || null,
            hsnCode: item.hsnCode,
            rate: parseFloat(item.rate).toString(),
            quantity: item.quantity,
            gstPercentage: gstPercentage.toString(),
            gstAmount: gstAmount.toString(),
            taxableValue: taxableValue.toString(),
            cgstPercentage: parseFloat(item.cgstPercentage).toString(),
            cgstAmount: cgstAmount.toString(),
            sgstPercentage: parseFloat(item.sgstPercentage).toString(),
            sgstAmount: sgstAmount.toString(),
            total: itemTotal.toString(),
          };
        });

        const grandTotal = subtotal + totalGst;
        const roundedGrandTotal = Math.round(grandTotal);

        const { cash: normalizedCashAmount, card: normalizedCardAmount } = normalizePaymentSplit(
          paymentMode || "Cash",
          roundedGrandTotal,
          Number(req.body.cashAmount ?? 0),
          Number(req.body.cardAmount ?? 0),
        );

        updateData = {
          customerName,
          customerPhone: customerPhone || null,
          customerGst: customerGst || null,
          paymentMode,
          subtotal: subtotal.toString(),
          gstAmount: totalGst.toString(),
          // Store the rounded grand total (nearest rupee)
          grandTotal: roundedGrandTotal.toString(),
          cashAmount: normalizedCashAmount.toFixed(2),
          cardAmount: normalizedCardAmount.toFixed(2),
        };

        const invoice = await storage.updateInvoice(id, updateData, invoiceItems);

        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        res.json(invoice);
      } else {
        updateData = { customerName, customerPhone: customerPhone || null, customerGst, paymentMode };
        const invoice = await storage.updateInvoice(id, updateData);

        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        res.json(invoice);
      }
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/invoices/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.softDeleteInvoice(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Expenses
  // GET: authenticated users see only their own expenses; admins see all
  app.get("/api/expenses", authMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const user = (req as any).user;
      const expenses = await storage.getExpenses({
        startDate: startDate as string,
        endDate: endDate as string,
      }, user?.userId, user?.role === "admin");
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // POST: any authenticated user can add an expense; createdBy will be set to the creator
  app.post("/api/expenses", authMiddleware, async (req, res) => {
    try {
      const { description, amount, category } = req.body;
      const user = (req as any).user;

      if (!description || !amount) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const expense = await storage.createExpense({
        description,
        amount: amount.toString(),
        category: category || null,
        createdBy: user?.userId || null,
      } as any);

      res.status(201).json(expense);
    } catch (error) {
      // Log full error for diagnostics and return a helpful message
      console.error("Error creating expense:", error instanceof Error ? error.stack || error.message : error);
      res.status(500).json({ message: "Failed to create expense. Check server logs for details." });
    }
  });

  // PATCH: only admin can update expenses
  app.patch("/api/expenses/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { description, amount, category } = req.body;

      const expense = await storage.updateExpense(id, {
        description,
        amount: amount?.toString(),
        category: category || null,
      });

      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      res.json(expense);
    } catch (error) {
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  // DELETE: only admin can delete
  app.delete("/api/expenses/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteExpense(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin Stats (admin only)
  app.get("/api/admin/stats", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const stats = await storage.getSalesStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Sales Report (admin only)
  app.get("/api/reports/sales", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Missing date range" });
      }

      const invoiceHeaders = await storage.getInvoices({
        startDate: startDate as string,
        endDate: endDate as string,
      });

      // Fetch invoices with items
      const invoices = await Promise.all(
        invoiceHeaders.map(inv => storage.getInvoiceWithItems(inv.id))
      );
      const invoicesWithItems = invoices.filter((inv): inv is NonNullable<typeof inv> => inv !== undefined);

      // Calculate summary data
      const totalSales = invoicesWithItems.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
      const b2bSales = invoicesWithItems
        .filter((inv) => inv.invoiceType === "B2B")
        .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
      const b2cSales = invoicesWithItems
        .filter((inv) => inv.invoiceType === "B2C")
        .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
      const cashSales = invoicesWithItems
        .filter((inv) => inv.paymentMode === "Cash")
        .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
      const onlineSales = invoicesWithItems
        .filter((inv) => inv.paymentMode === "Online")
        .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      // Add title
      worksheet.mergeCells("A1:O1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `Sales Report (${startDate} to ${endDate})`;
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: "center" };

      // Add summary section
      worksheet.addRow([]);
      worksheet.addRow(["Summary"]);
      worksheet.addRow(["Total Sales", totalSales.toFixed(2)]);
      worksheet.addRow(["B2B Sales", b2bSales.toFixed(2)]);
      worksheet.addRow(["B2C Sales", b2cSales.toFixed(2)]);
      worksheet.addRow(["Cash Sales", cashSales.toFixed(2)]);
      worksheet.addRow(["Online Sales", onlineSales.toFixed(2)]);
      worksheet.addRow(["Total Invoices", invoicesWithItems.length]);

      // Add invoice details section
      worksheet.addRow([]);
      const headerRow = worksheet.addRow([
        "Invoice Number",
        "Date",
        "Customer",
        "Type",
        "Payment Mode",
        "Item Name",
        "HSN Code",
        "Qty",
        "Rate",
        "Taxable Value",
        "CGST %",
        "CGST Amount",
        "SGST %",
        "SGST Amount",
        "Total",
      ]);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add invoice data with line items
      invoicesWithItems.forEach((inv) => {
        if (inv.items && inv.items.length > 0) {
          inv.items.forEach((item: any, index: number) => {
            worksheet.addRow([
              index === 0 ? inv.invoiceNumber : "",
              index === 0 ? new Date(inv.createdAt).toLocaleDateString("en-IN") : "",
              index === 0 ? inv.customerName : "",
              index === 0 ? inv.invoiceType : "",
              index === 0 ? inv.paymentMode : "",
              item.itemName || "",
              item.hsnCode || "",
              item.quantity || 0,
              parseFloat(item.rate || 0).toFixed(2),
              parseFloat(item.taxableValue || 0).toFixed(2),
              parseFloat(item.cgstPercentage || 0).toFixed(2),
              parseFloat(item.cgstAmount || 0).toFixed(2),
              parseFloat(item.sgstPercentage || 0).toFixed(2),
              parseFloat(item.sgstAmount || 0).toFixed(2),
              parseFloat(item.total || 0).toFixed(2),
            ]);
          });
        } else {
          worksheet.addRow([
            inv.invoiceNumber,
            new Date(inv.createdAt).toLocaleDateString("en-IN"),
            inv.customerName,
            inv.invoiceType,
            inv.paymentMode,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            parseFloat(inv.grandTotal).toFixed(2),
          ]);
        }
      });

      // Auto-fit columns
      if (worksheet.columns) {
        worksheet.columns.forEach((column) => {
          if (column && column.eachCell) {
            let maxLength = 0;
            column.eachCell({ includeEmpty: false }, (cell) => {
              const cellValue = cell.value ? cell.value.toString() : "";
              maxLength = Math.max(maxLength, cellValue.length);
            });
            column.width = Math.min(Math.max(maxLength + 2, 12), 40);
          }
        });
      }

      // Generate buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=sales-report-${startDate}-to-${endDate}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Expenses Report (admin only)
  app.get("/api/reports/expenses", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Missing date range" });
      }

      const expenses = await storage.getExpenses({
        startDate: startDate as string,
        endDate: endDate as string,
      });

      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      
      const categoryTotals: Record<string, number> = {};
      expenses.forEach((exp) => {
        const category = exp.category || "Uncategorized";
        categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(exp.amount);
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Expenses Report");

      worksheet.mergeCells("A1:E1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `Expenses Report (${startDate} to ${endDate})`;
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: "center" };

      worksheet.addRow([]);
      worksheet.addRow(["Summary"]);
      worksheet.addRow(["Total Expenses", totalExpenses.toFixed(2)]);
      worksheet.addRow(["Total Records", expenses.length]);

      worksheet.addRow([]);
      worksheet.addRow(["Category Breakdown"]);
      Object.entries(categoryTotals).forEach(([category, total]) => {
        worksheet.addRow([category, total.toFixed(2)]);
      });

      worksheet.addRow([]);
      worksheet.addRow([]);
      const headerRow = worksheet.addRow([
        "Date",
        "Description",
        "Category",
        "Amount",
      ]);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      expenses.forEach((exp) => {
        worksheet.addRow([
          new Date(exp.createdAt).toLocaleDateString("en-IN"),
          exp.description,
          exp.category || "Uncategorized",
          parseFloat(exp.amount).toFixed(2),
        ]);
      });

      if (worksheet.columns) {
        worksheet.columns.forEach((column) => {
          if (column && column.eachCell) {
            let maxLength = 0;
            column.eachCell({ includeEmpty: false }, (cell) => {
              const cellValue = cell.value ? cell.value.toString() : "";
              maxLength = Math.max(maxLength, cellValue.length);
            });
            column.width = Math.min(Math.max(maxLength + 2, 12), 40);
          }
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=expenses-report-${startDate}-to-${endDate}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Withdrawals Report (admin only)
  app.get("/api/reports/withdrawals", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Missing date range" });
      }

      const withdrawals = await storage.getCashWithdrawals({
        startDate: startDate as string,
        endDate: endDate as string,
      });

      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u.username]));

      const totalWithdrawals = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Withdrawals Report");

      worksheet.mergeCells("A1:E1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `Cash Withdrawals Report (${startDate} to ${endDate})`;
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: "center" };

      worksheet.addRow([]);
      worksheet.addRow(["Summary"]);
      worksheet.addRow(["Total Withdrawals", totalWithdrawals.toFixed(2)]);
      worksheet.addRow(["Total Records", withdrawals.length]);

      worksheet.addRow([]);
      worksheet.addRow([]);
      const headerRow = worksheet.addRow([
        "Date & Time",
        "Amount (₹)",
        "Admin User",
        "Note",
      ]);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      withdrawals.forEach((withdrawal) => {
        const date = new Date(withdrawal.createdAt);
        worksheet.addRow([
          date.toLocaleString("en-IN"),
          parseFloat(withdrawal.amount).toFixed(2),
          userMap.get(withdrawal.adminId) || withdrawal.adminId,
          withdrawal.note || "—",
        ]);
      });

      if (worksheet.columns) {
        worksheet.columns.forEach((column) => {
          if (column && column.eachCell) {
            let maxLength = 0;
            column.eachCell({ includeEmpty: false }, (cell) => {
              const cellValue = cell.value ? cell.value.toString() : "";
              maxLength = Math.max(maxLength, cellValue.length);
            });
            column.width = Math.min(Math.max(maxLength + 2, 12), 50);
          }
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=withdrawals-report-${startDate}-to-${endDate}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Error generating withdrawals report:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Settings - read by any authenticated user; updates remain admin-only
  app.get("/api/settings", authMiddleware, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/settings", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { key, value } = req.body;
      const setting = await storage.setSetting(key, value);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // User management - admin only
  app.get("/api/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role })));
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const validated = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(validated.password, 10);
      const user = await storage.createUser({ ...validated, password: hashedPassword });
      res.json({ id: user.id, username: user.username, role: user.role });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const updateSchema = z.object({
        username: z.string().trim().min(1, "Username cannot be empty").optional(),
        role: z.enum(["admin", "user"]).optional(),
      }).refine(data => data.username !== undefined || data.role !== undefined, {
        message: "At least one field (username or role) must be provided"
      });
      const validated = updateSchema.parse(req.body);
      
      // Only update fields that are provided
      const updateData: { username?: string; role?: string } = {};
      if (validated.username !== undefined) updateData.username = validated.username;
      if (validated.role !== undefined) updateData.role = validated.role;
      
      const updated = await storage.updateUser(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: updated.id, username: updated.username, role: updated.role });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation error" });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/users/:id/password", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(req.params.id, hashedPassword);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Finance endpoints
  // Admin: record cash withdrawal
  app.post("/api/finance/withdraw", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { amount, note } = req.body;
      if (!amount) return res.status(400).json({ message: "Missing amount" });

      const withdrawal = await storage.createCashWithdrawal({
        adminId: user.userId,
        amount: amount.toString(),
        note: note || null,
      } as any);

      res.status(201).json(withdrawal);
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update withdrawal
  app.patch("/api/finance/withdraw/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, note } = req.body;
      
      const updated = await storage.updateCashWithdrawal(parseInt(id), {
        amount: amount?.toString(),
        note: note,
      });
      
      if (!updated) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Delete withdrawal
  app.delete("/api/finance/withdraw/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCashWithdrawal(parseInt(id));
      
      if (!deleted) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }
      
      res.json({ success: true, message: "Withdrawal deleted" });
    } catch (error) {
      console.error("Error deleting withdrawal:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // User: submit closing cash for a day (upsert)
  app.post("/api/finance/closing", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { date, opening, cashTotal, cardTotal, closing } = req.body;
      if (opening === undefined || cashTotal === undefined || cardTotal === undefined || closing === undefined) {
        return res.status(400).json({ message: "Missing required balance fields" });
      }

      // Parse date correctly to avoid timezone issues
      let day: Date;
      if (date) {
        const [year, month, dayNum] = date.split('-').map(Number);
        day = new Date(year, month - 1, dayNum, 0, 0, 0, 0);
      } else {
        day = new Date();
        day.setHours(0, 0, 0, 0);
      }

      const result = await storage.upsertCashBalance({
        userId: user.userId,
        date: day as any,
        opening: opening.toString(),
        cashTotal: cashTotal.toString(),
        cardTotal: cardTotal.toString(),
        closing: closing.toString(),
      } as any);

      res.json(result);
    } catch (error) {
      console.error("Error upserting cash balance:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // User: fetch own balances (date range optional)
  app.get("/api/finance/user/balances", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { startDate, endDate } = req.query;
      const balances = await storage.getBalances({ 
        userId: user.userId, 
        startDate: startDate as string, 
        endDate: endDate as string 
      });
      res.json(balances);
    } catch (error) {
      console.error("[Finance API] Error fetching user balances:", error);
      res.status(500).json({ message: "Server error", error: String(error) });
    }
  });

  // Get invoice payment summary (cash/card totals) for date or date range
  app.get("/api/finance/sales-summary", authMiddleware, async (req, res) => {
    try {
      const { date, startDate, endDate } = req.query;

      if (!date && !startDate && !endDate) {
        return res.status(400).json({ 
          message: "Provide either 'date' or 'startDate'/'endDate'",
          cashTotal: 0,
          cardTotal: 0,
          totalSales: 0,
          invoiceCount: 0
        });
      }

      // Pass date strings directly - storage layer uses SQL DATE() for comparison
      let rangeStart: string;
      let rangeEnd: string;

      if (date) {
        rangeStart = date as string;
        rangeEnd = date as string;
      } else {
        rangeStart = (startDate as string) || '1970-01-01';
        rangeEnd = (endDate as string) || new Date().toISOString().split('T')[0];
      }

      const summary = await storage.getInvoicePaymentSummary({ 
        startDate: rangeStart, 
        endDate: rangeEnd 
      });
      
      res.json(summary);
    } catch (error) {
      console.error("[Finance API] Error in sales-summary:", error);
      res.status(500).json({ 
        message: "Failed to fetch sales summary",
        cashTotal: 0,
        cardTotal: 0,
        totalSales: 0,
        invoiceCount: 0
      });
    }
  });

  // Admin: fetch balances across users and withdrawals summary
  // Get withdrawals with date filter
  // Get cumulative cash in shop (all-time cash sales - all-time withdrawals)
  app.get("/api/finance/cash-in-shop", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // Get all-time cash sales
      const allTimeSales = await storage.getInvoicePaymentSummary({});
      
      // Get all-time withdrawals
      const allTimeWithdrawals = await storage.getCashWithdrawals({});
      const totalWithdrawals = allTimeWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount || "0"), 0);
      
      const cashInShop = allTimeSales.cashTotal - totalWithdrawals;
      
      res.json({
        totalCashSales: allTimeSales.cashTotal,
        totalWithdrawals: totalWithdrawals,
        cashInShop: Number(cashInShop.toFixed(2)),
      });
    } catch (error) {
      console.error("Error calculating cash in shop:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get current user's withdrawals only
  app.get("/api/finance/my-withdrawals", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { startDate, endDate } = req.query;
      const withdrawals = await storage.getCashWithdrawalsByUser({
        userId: user.userId,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching user withdrawals:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get all withdrawals (admin only)
  app.get("/api/finance/withdrawals", authMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const withdrawals = await storage.getCashWithdrawals({ 
        startDate: startDate as string, 
        endDate: endDate as string 
      });
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/finance/admin/summary", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const balances = await storage.getBalances({ startDate: startDate as string, endDate: endDate as string });
      const withdrawals = await storage.getCashWithdrawals({ startDate: startDate as string, endDate: endDate as string });

      // Aggregate totals
      const totals = balances.reduce((acc: any, b: any) => {
        acc.opening = (acc.opening || 0) + parseFloat(b.opening as any || 0);
        acc.cashTotal = (acc.cashTotal || 0) + parseFloat(b.cashTotal as any || 0);
        acc.cardTotal = (acc.cardTotal || 0) + parseFloat(b.cardTotal as any || 0);
        acc.closing = (acc.closing || 0) + parseFloat(b.closing as any || 0);
        return acc;
      }, {});

      const withdrawalTotal = withdrawals.reduce((s: number, w: any) => s + parseFloat(w.amount || 0), 0);

      res.json({ balances, withdrawals, totals: { ...totals, withdrawalTotal } });
    } catch (error) {
      console.error("Error fetching admin finance summary:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get opening balance (previous day's closing) for a user
  app.get("/api/finance/opening", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { date } = req.query;
      
      const currentDate = date ? date as string : new Date().toISOString().split('T')[0];
      
      // Calculate previous day (simple string math for YYYY-MM-DD)
      const [year, month, day] = currentDate.split('-').map(Number);
      const current = new Date(year, month - 1, day);
      current.setDate(current.getDate() - 1);
      const previousDayStr = current.toISOString().split('T')[0];

      const balances = await storage.getBalances({ 
        userId: user.userId, 
        startDate: previousDayStr, 
        endDate: previousDayStr 
      });
      
      const opening = balances.length > 0 ? parseFloat(String(balances[0].closing || 0)) : 0;
      
      res.json({ opening: Number(opening.toFixed(2)) });
    } catch (error) {
      console.error("[Finance API] Error fetching opening balance:", error);
      res.status(500).json({ opening: 0, message: "Failed to fetch opening balance" });
    }
  });

  // Debug endpoint to check invoice payment data and schema
  app.get("/api/debug/invoices", authMiddleware, async (req, res) => {
    try {
      // Check if columns exist
      const schemaCheck = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name IN ('cash_amount', 'card_amount', 'payment_mode', 'grand_total')
        ORDER BY column_name;
      `);
      
      const invoices = await storage.getInvoices({ limit: 10 });
      const summary = invoices.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        paymentMode: inv.paymentMode,
        grandTotal: inv.grandTotal,
        cashAmount: inv.cashAmount,
        cardAmount: inv.cardAmount,
        createdAt: inv.createdAt,
      }));
      
      res.json({ 
        schemaColumns: schemaCheck.rows,
        invoiceCount: invoices.length,
        invoices: summary,
        message: "Schema and recent invoices check"
      });
    } catch (error) {
      console.error("Error in debug endpoint:", error);
      res.status(500).json({ message: "Server error", error: String(error) });
    }
  });

  // Staff Management - Enhanced with role-based access
  
  // Get next employee code (for auto-generation)
  app.get("/api/staff/next-code", authMiddleware, async (req, res) => {
    try {
      const code = await storage.getNextEmployeeCode();
      res.json({ code });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // List employees (accessible by all authenticated users)
  app.get("/api/staff/employees", authMiddleware, async (req, res) => {
    try {
      const rows = await storage.listEmployees();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get single employee details
  app.get("/api/staff/employees/:id", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await storage.getEmployee(id);
      if (!employee) return res.status(404).json({ message: "Employee not found" });
      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create employee (Admin & User can add, but User's employees get locked after save)
  app.post("/api/staff/employees", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const isAdmin = user?.role === 'admin';
      
      const { 
        firstName, lastName, phone, alternatePhone, address, 
        userId, password, idProofFiles, role, status, dateJoined, salary 
      } = req.body;
      
      // Validation
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      
      // Phone validation (10 digits)
      if (phone && !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ message: "Phone number must be 10 digits" });
      }
      if (alternatePhone && !/^\d{10}$/.test(alternatePhone)) {
        return res.status(400).json({ message: "Alternate phone must be 10 digits" });
      }
      
      // Auto-generate employee code
      const employeeCode = await storage.getNextEmployeeCode();
      const fullName = `${firstName} ${lastName}`;
      
      // Hash password if provided
      let hashedPassword = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }
      
      const employee = await storage.createEmployee({
        employeeCode,
        firstName,
        lastName,
        fullName,
        phone: phone || null,
        alternatePhone: alternatePhone || null,
        address: address || null,
        userId: userId || null,
        password: hashedPassword,
        idProofFiles: idProofFiles ? JSON.stringify(idProofFiles) : null,
        role: role || "staff",
        status: status || "active",
        dateJoined: dateJoined || new Date().toISOString().split('T')[0],
        salary: salary || null,
        createdBy: user?.userId || null,
        isLocked: !isAdmin, // Lock immediately for non-admin users
      } as any);
      
      // Create audit log (non-blocking - don't fail the request if logging fails)
      try {
        await storage.createAuditLog({
          employeeId: employee.id,
          action: 'create',
          changedBy: user?.userId || 'unknown',
          changedByRole: user?.role || 'unknown',
          newData: JSON.stringify(employee),
          ipAddress: req.ip || null,
        });
      } catch (auditError: any) {
        console.error("Audit log creation failed (non-critical):", auditError.message);
      }
      
      res.status(201).json(employee);
    } catch (error: any) {
      console.error("Create employee error:", error);
      if (error?.code === '23505') { // Unique violation
        return res.status(400).json({ message: "User ID already exists" });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update employee (Admin can always edit, User cannot edit locked records)
  app.patch("/api/staff/employees/:id", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const isAdmin = user?.role === 'admin';
      
      const existing = await storage.getEmployee(id);
      if (!existing) return res.status(404).json({ message: "Employee not found" });
      
      // Check access control
      if (!isAdmin && existing.isLocked) {
        return res.status(403).json({ message: "You cannot edit this employee record" });
      }
      
      const { firstName, lastName, phone, alternatePhone, address, userId, password, idProofFiles, fullName, salary, role, status, ...rest } = req.body;
      
      // Phone validation
      if (phone && !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ message: "Phone number must be 10 digits" });
      }
      if (alternatePhone && !/^\d{10}$/.test(alternatePhone)) {
        return res.status(400).json({ message: "Alternate phone must be 10 digits" });
      }
      
      const updateData: any = { ...rest };
      
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (firstName || lastName) {
        updateData.fullName = `${firstName || existing.firstName} ${lastName || existing.lastName}`;
      }
      // If fullName is directly provided (from admin edit), use it
      if (fullName !== undefined && !firstName && !lastName) {
        updateData.fullName = fullName;
      }
      if (phone !== undefined) updateData.phone = phone;
      if (alternatePhone !== undefined) updateData.alternatePhone = alternatePhone;
      if (address !== undefined) updateData.address = address;
      if (userId !== undefined) updateData.userId = userId;
      if (role !== undefined) updateData.role = role;
      if (status !== undefined) updateData.status = status;
      // Convert salary to string for numeric column
      if (salary !== undefined) {
        updateData.salary = salary !== null ? String(salary) : null;
      }
      if (idProofFiles !== undefined) {
        updateData.idProofFiles = JSON.stringify(idProofFiles);
      }
      
      // Hash new password if provided
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      
      const employee = await storage.updateEmployee(id, updateData);
      if (!employee) return res.status(404).json({ message: "Employee not found" });
      
      // Create audit log (non-blocking - don't fail the request if logging fails)
      try {
        await storage.createAuditLog({
          employeeId: id,
          action: 'update',
          changedBy: user?.userId || 'unknown',
          changedByRole: user?.role || 'unknown',
          previousData: JSON.stringify(existing),
          newData: JSON.stringify(employee),
          ipAddress: req.ip || null,
        });
      } catch (auditError: any) {
        // Log the error but don't fail the request
        console.error("Audit log creation failed (non-critical):", auditError.message);
      }
      
      res.json(employee);
    } catch (error: any) {
      console.error("Update employee error:", error);
      if (error?.code === '23505') {
        return res.status(400).json({ message: "User ID already exists" });
      }
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  // Delete employee (Admin only)
  app.delete("/api/staff/employees/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      const existing = await storage.getEmployee(id);
      if (!existing) return res.status(404).json({ message: "Employee not found" });
      
      // Delete employee (audit log will be deleted via CASCADE, which is expected)
      const ok = await storage.deleteEmployee(id);
      if (!ok) return res.status(404).json({ message: "Employee not found" });
      
      // Log to console for audit trail (since DB audit log is deleted with CASCADE)
      console.log(`[AUDIT] Employee deleted: ${existing.employeeCode} (${existing.fullName}) by ${user?.userId || 'unknown'} at ${new Date().toISOString()}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Staff login (for employees to login with their userId/password)
  app.post("/api/staff/login", async (req, res) => {
    try {
      const { userId, password } = req.body;
      
      if (!userId || !password) {
        return res.status(400).json({ message: "User ID and password are required" });
      }
      
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      if (!employee.password) {
        return res.status(401).json({ message: "No password set for this account" });
      }
      
      const isValid = await bcrypt.compare(password, employee.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Generate a token for the staff member
      const token = generateToken({
        userId: employee.id,
        username: employee.fullName,
        role: 'staff',
        employeeId: employee.id,
      });
      
      res.json({
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          role: employee.role,
        },
        token,
      });
    } catch (error) {
      console.error("Staff login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Clock in (for staff)
  app.post("/api/staff/clock-in/:employeeId", authMiddleware, async (req, res) => {
    try {
      const { employeeId } = req.params;
      
      // Check if already clocked in today
      const existing = await storage.getTodayAttendance(employeeId);
      if (existing?.checkIn && !existing?.checkOut) {
        return res.status(400).json({ message: "Already clocked in for today" });
      }
      if (existing?.checkOut) {
        return res.status(400).json({ message: "Already completed work for today" });
      }
      
      const attendance = await storage.clockIn(employeeId);
      
      // Create audit log (non-blocking - don't fail the request if logging fails)
      try {
        await storage.createAuditLog({
          employeeId,
          action: 'clock_in',
          changedBy: (req as any).user?.userId || employeeId,
          changedByRole: (req as any).user?.role || 'staff',
          newData: JSON.stringify({ checkIn: attendance.checkIn }),
          ipAddress: req.ip || null,
        });
      } catch (auditError: any) {
        console.error("Audit log creation failed (non-critical):", auditError.message);
      }
      
      res.json(attendance);
    } catch (error) {
      console.error("Clock in error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Clock out (for staff)
  app.post("/api/staff/clock-out/:employeeId", authMiddleware, async (req, res) => {
    try {
      const { employeeId } = req.params;
      
      const attendance = await storage.clockOut(employeeId);
      if (!attendance) {
        return res.status(400).json({ message: "Must clock in before clocking out" });
      }
      
      // Create audit log (non-blocking - don't fail the request if logging fails)
      try {
        await storage.createAuditLog({
          employeeId,
          action: 'clock_out',
          changedBy: (req as any).user?.userId || employeeId,
          changedByRole: (req as any).user?.role || 'staff',
          newData: JSON.stringify({ checkOut: attendance.checkOut }),
          ipAddress: req.ip || null,
        });
      } catch (auditError: any) {
        console.error("Audit log creation failed (non-critical):", auditError.message);
      }
      
      res.json(attendance);
    } catch (error) {
      console.error("Clock out error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get active employees (currently working - for live timer display)
  app.get("/api/staff/active", authMiddleware, async (req, res) => {
    try {
      const activeEmployees = await storage.getActiveEmployees();
      res.json(activeEmployees);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get today's attendance for an employee
  app.get("/api/staff/attendance/today/:employeeId", authMiddleware, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const attendance = await storage.getTodayAttendance(employeeId);
      res.json(attendance || null);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get audit logs for an employee (Admin only)
  app.get("/api/staff/audit-logs/:employeeId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const logs = await storage.getAuditLogs(employeeId, 100);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Attendance: upsert by admin; listing by authenticated
  app.get("/api/staff/attendance/:employeeId", authMiddleware, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;
      const rows = await storage.listAttendance(employeeId, startDate as string, endDate as string);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/staff/attendance", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { employeeId, attendanceDate, status, checkIn, checkOut, notes } = req.body;
      if (!employeeId || !attendanceDate || !status) return res.status(400).json({ message: "Missing required fields" });
      const row = await storage.upsertAttendance({
        employeeId,
        attendanceDate,
        status,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        notes: notes || null,
        createdBy: (req as any).user?.userId || null,
      } as any);
      res.status(201).json(row);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/staff/attendance/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const ok = await storage.deleteAttendance(id);
      if (!ok) return res.status(404).json({ message: "Attendance not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/staff/attendance/export", authMiddleware, async (req, res) => {
    try {
      const { employeeIds, startDate, endDate } = req.body;
      if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0 || !startDate || !endDate) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // 1. Get Employees
      const allEmployees = await storage.listEmployees();
      const selectedEmployees = allEmployees.filter(e => employeeIds.includes(e.id));

      if (selectedEmployees.length === 0) {
        return res.status(404).json({ message: "No employees found" });
      }

      // 2. Get Attendance Data
      const attendanceRecords = await storage.getAttendanceForExport(employeeIds, startDate, endDate);

      // 3. Generate Excel
      const workbook = new ExcelJS.Workbook();

      for (const employee of selectedEmployees) {
        const sheetName = employee.fullName.replace(/[\\/*[\]:?]/g, '_').substring(0, 30);
        const sheet = workbook.addWorksheet(sheetName || "Sheet");
        
        // Header
        sheet.addRow(["Attendance Report"]);
        sheet.addRow(["Employee Name:", employee.fullName]);
        sheet.addRow(["Employee Code:", employee.employeeCode]);
        sheet.addRow(["Period:", `${startDate} to ${endDate}`]);
        sheet.addRow([]); // Spacer

        // Filter attendance for this employee
        const empAttendance = attendanceRecords.filter(a => a.employeeId === employee.id);

        // Summary
        const totalPresent = empAttendance.filter(a => a.status === 'present').length;
        const totalHalfDay = empAttendance.filter(a => a.status === 'half-day').length;
        const totalAbsent = empAttendance.filter(a => a.status === 'absent').length;

        sheet.addRow(["Overall Summary"]);
        sheet.addRow(["Total Present", totalPresent]);
        sheet.addRow(["Total Half Days", totalHalfDay]);
        sheet.addRow(["Total Absent", totalAbsent]);
        sheet.addRow([]); // Spacer

        // Detailed Month-wise Breakdown
        sheet.addRow(["Month-wise Details"]);
        sheet.addRow(["Month", "Present", "Half Day", "Absent", "Total Days Recorded"]);

        // Group by Month
        const monthlyStats = new Map<string, { present: number, half: number, absent: number }>();
        
        empAttendance.forEach(a => {
            // attendanceDate is YYYY-MM-DD string
            const monthKey = a.attendanceDate.substring(0, 7); // YYYY-MM
            if (!monthlyStats.has(monthKey)) {
                monthlyStats.set(monthKey, { present: 0, half: 0, absent: 0 });
            }
            const stats = monthlyStats.get(monthKey)!;
            if (a.status === 'present') stats.present++;
            else if (a.status === 'half-day') stats.half++;
            else if (a.status === 'absent') stats.absent++;
        });

        // Sort months
        const months = Array.from(monthlyStats.keys()).sort();

        months.forEach(month => {
            const stats = monthlyStats.get(month)!;
            const total = stats.present + stats.half + stats.absent;
            sheet.addRow([month, stats.present, stats.half, stats.absent, total]);
        });

        // Styling
        sheet.getColumn(1).width = 20;
        sheet.getColumn(2).width = 15;
        sheet.getColumn(3).width = 15;
        sheet.getColumn(4).width = 15;
        sheet.getColumn(5).width = 20;
        
        // Bold headers
        sheet.getRow(1).font = { bold: true, size: 14 };
        sheet.getRow(7).font = { bold: true }; // Overall Summary
        sheet.getRow(13).font = { bold: true }; // Month-wise Details
        sheet.getRow(14).font = { bold: true }; // Table Header
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Attendance_Report.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error("Export attendance error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Employee purchases: record/list (admin write; authenticated list)
  app.get("/api/staff/purchases/:employeeId", authMiddleware, async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;
      const rows = await storage.listEmployeePurchases(employeeId, startDate as string, endDate as string);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/staff/purchases", authMiddleware, async (req, res) => {
    try {
      const requester = (req as any).user;
      const isAdmin = requester?.role === "admin";
      const isStaff = requester?.role === "staff";

      let { employeeId, purchaseDate, category, amount, paymentMode, description } = req.body;

      // If staff, restrict creation to their own employeeId
      if (isStaff) {
        employeeId = requester?.employeeId;
      }

      if (!employeeId || !purchaseDate || !category || amount === undefined) {
        console.log("Missing fields:", { employeeId, purchaseDate, category, amount, requester });
        return res.status(400).json({ message: "Missing required fields: employeeId, purchaseDate, category, amount are required" });
      }

      // Only admins or the staff themselves can create
      if (!isAdmin && !isStaff) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const normalizedMode = (paymentMode || "cash").toString().trim().toLowerCase();
      const row = await storage.createEmployeePurchase({
        employeeId,
        purchaseDate,
        category,
        amount: String(amount),
        paymentMode: normalizedMode,
        description: description || null,
        recordedBy: requester?.userId || requester?.employeeId || null,
      } as any);
      res.status(201).json(row);
    } catch (error: any) {
      console.error("Create purchase error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  app.patch("/api/staff/purchases/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const row = await storage.updateEmployeePurchase(id, req.body);
      if (!row) return res.status(404).json({ message: "Purchase not found" });
      res.json(row);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/staff/purchases/:id/payment-status", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;
      
      if (!paymentStatus || !['paid', 'unpaid'].includes(paymentStatus)) {
        return res.status(400).json({ message: "Invalid payment status. Must be 'paid' or 'unpaid'" });
      }

      const row = await storage.updateEmployeePurchase(id, { 
        paymentStatus,
        updatedAt: new Date()
      });
      
      if (!row) return res.status(404).json({ message: "Purchase not found" });
      res.json(row);
    } catch (error: any) {
      console.error("Update payment status error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  app.delete("/api/staff/purchases/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const ok = await storage.deleteEmployeePurchase(id);
      if (!ok) return res.status(404).json({ message: "Purchase not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Finance routes (Admin only)
  app.get("/api/finance/admin/summary", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Get balances for the date range (handle undefined parameters gracefully)
      const balances = await storage.getBalances({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      // Get withdrawals for the date range
      const withdrawals = await storage.getCashWithdrawals({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });

      // Calculate totals (safely handle null/undefined values)
      const totals = balances.reduce((acc, balance) => ({
        opening: acc.opening + parseFloat(balance.opening?.toString() || "0"),
        cashTotal: acc.cashTotal + parseFloat(balance.cashTotal?.toString() || "0"),
        cardTotal: acc.cardTotal + parseFloat(balance.cardTotal?.toString() || "0"),
        closing: acc.closing + parseFloat(balance.closing?.toString() || "0"),
        withdrawalTotal: acc.withdrawalTotal, // Will be calculated separately
      }), { opening: 0, cashTotal: 0, cardTotal: 0, closing: 0, withdrawalTotal: 0 });

      totals.withdrawalTotal = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount?.toString() || "0"), 0);

      res.json({
        balances,
        withdrawals,
        totals,
      });
    } catch (error) {
      console.error("Finance summary error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/finance/withdrawals", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const withdrawals = await storage.getCashWithdrawals({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      res.json(withdrawals);
    } catch (error) {
      console.error("Get withdrawals error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/finance/cash-in-shop", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // Get all-time cash sales (empty filters = all time)
      const allTimeSales = await storage.getInvoicePaymentSummary({});
      const totalCashSales = allTimeSales.cashTotal;

      // Get all-time withdrawals (empty filters = all time)
      const allWithdrawals = await storage.getCashWithdrawals({});
      const totalWithdrawals = allWithdrawals.reduce((sum, w) => sum + parseFloat(w.amount?.toString() || "0"), 0);

      // Calculate available cash in shop
      const cashInShop = totalCashSales - totalWithdrawals;

      res.json({
        totalCashSales,
        totalWithdrawals,
        cashInShop,
      });
    } catch (error) {
      console.error("Cash in shop error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/finance/withdraw", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { amount, note } = req.body;
      const user = (req as any).user;

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ message: "Invalid withdrawal amount" });
      }

      const withdrawal = await storage.createCashWithdrawal({
        adminId: user.userId,
        amount: Number(amount).toFixed(2), // Ensure proper decimal formatting
        note: note || null,
      });

      res.status(201).json(withdrawal);
    } catch (error) {
      console.error("Create withdrawal error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/finance/withdraw/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, note } = req.body;

      if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
        return res.status(400).json({ message: "Invalid withdrawal amount" });
      }

      const updateData: any = {};
      if (amount !== undefined) updateData.amount = Number(amount).toFixed(2);
      if (note !== undefined) updateData.note = note || null;

      const withdrawal = await storage.updateCashWithdrawal(Number(id), updateData);
      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      res.json(withdrawal);
    } catch (error) {
      console.error("Update withdrawal error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/finance/withdraw/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCashWithdrawal(Number(id));
      if (!deleted) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete withdrawal error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ============ Customer Management Routes ============
  
  // Get all customers
  app.get("/api/customers", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Get customers error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get customer statistics with optional date filters
  app.get("/api/customers/stats", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await storage.getCustomerStats(
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(stats);
    } catch (error) {
      console.error("Get customer stats error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get single customer
  app.get("/api/customers/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(Number(id));
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Get customer error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get customer invoices
  app.get("/api/customers/:id/invoices", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const customerInvoices = await storage.getCustomerInvoices(Number(id));
      res.json(customerInvoices);
    } catch (error) {
      console.error("Get customer invoices error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
