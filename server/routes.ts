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

export async function registerRoutes(app: Express): Promise<Server> {
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

      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      res.json({
        user: { id: user.id, username: user.username, role: user.role },
        token,
      });
    } catch (error) {
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
          grandTotal: grandTotal.toString(),
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

        updateData = {
          customerName,
          customerPhone: customerPhone || null,
          customerGst: customerGst || null,
          paymentMode,
          subtotal: subtotal.toString(),
          gstAmount: totalGst.toString(),
          grandTotal: grandTotal.toString(),
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

  // Settings - admin only
  app.get("/api/settings", authMiddleware, adminMiddleware, async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
