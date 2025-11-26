import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type BalanceEntry = {
  id: number;
  userId: string;
  date: string;
  opening: string;
  cashTotal: string;
  cardTotal: string;
  closing: string;
};

type Withdrawal = {
  id: number;
  adminId: string;
  amount: string;
  note: string | null;
  createdAt: string;
};

type AdminSummaryResponse = {
  balances: BalanceEntry[];
  withdrawals: Withdrawal[];
  totals: {
    opening: number;
    cashTotal: number;
    cardTotal: number;
    closing: number;
    withdrawalTotal: number;
  };
};

type SalesSummary = {
  cashTotal: number;
  cardTotal: number;
  totalSales: number;
  invoiceCount: number;
};

type User = {
  id: string;
  username: string;
};

function formatCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return "0.00";
  const num = typeof value === "string" ? parseFloat(value || "0") : value;
  return Number.isNaN(num) ? "0.00" : num.toFixed(2);
}

function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function AdminFinance() {
  const { toast } = useToast();
  const today = toDateString(new Date());
  
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawNote, setWithdrawNote] = useState<string>("");
  const [editingWithdrawal, setEditingWithdrawal] = useState<Withdrawal | null>(null);
  const [withdrawalFilterStart, setWithdrawalFilterStart] = useState<string>(today);
  const [withdrawalFilterEnd, setWithdrawalFilterEnd] = useState<string>(today);

  // Fetch admin summary (balances only - for balance table)
  const summaryQuery = useQuery<AdminSummaryResponse>({
    queryKey: ["finance:admin-summary", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/finance/admin/summary?startDate=${startDate}&endDate=${endDate}`,
      );
      return await res.json();
    },
    enabled: Boolean(startDate && endDate),
  });

  // Fetch withdrawals separately with their own date filter
  const withdrawalsQuery = useQuery<Withdrawal[]>({
    queryKey: ["finance:withdrawals", withdrawalFilterStart, withdrawalFilterEnd],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/finance/withdrawals?startDate=${withdrawalFilterStart}&endDate=${withdrawalFilterEnd}`,
      );
      return await res.json();
    },
    enabled: Boolean(withdrawalFilterStart && withdrawalFilterEnd),
  });

  // Fetch invoice sales for the period
  const salesQuery = useQuery<SalesSummary>({
    queryKey: ["finance:admin-sales", startDate, endDate],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/finance/sales-summary?startDate=${startDate}&endDate=${endDate}`,
      );
      return await res.json();
    },
    enabled: Boolean(startDate && endDate),
  });

  // Fetch cumulative cash in shop (all time cash sales - all time withdrawals)
  const cashInShopQuery = useQuery<{ totalCashSales: number; totalWithdrawals: number; cashInShop: number }>({
    queryKey: ["finance:cash-in-shop"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/finance/cash-in-shop");
      return await res.json();
    },
  });

  // Fetch users for name display
  const usersQuery = useQuery<User[]>({
    queryKey: ["finance:users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return await res.json();
    },
  });

  // Create user directory for quick lookup
  const userDirectory = useMemo(() => {
    const map = new Map<string, string>();
    usersQuery.data?.forEach((user) => map.set(user.id, user.username));
    return map;
  }, [usersQuery.data]);

  // Aggregate balances per user
  const perUserTotals = useMemo(() => {
    if (!summaryQuery.data?.balances) return [];
    
    const userMap = new Map<string, {
      userId: string;
      username: string;
      opening: number;
      cash: number;
      card: number;
      closing: number;
    }>();

    summaryQuery.data.balances.forEach((entry) => {
      const userId = entry.userId;
      const existing = userMap.get(userId) || {
        userId,
        username: userDirectory.get(userId) || userId,
        opening: 0,
        cash: 0,
        card: 0,
        closing: 0,
      };

      existing.opening += parseFloat(entry.opening || "0");
      existing.cash += parseFloat(entry.cashTotal || "0");
      existing.card += parseFloat(entry.cardTotal || "0");
      existing.closing += parseFloat(entry.closing || "0");

      userMap.set(userId, existing);
    });

    return Array.from(userMap.values());
  }, [summaryQuery.data, userDirectory]);

  // Calculate total withdrawals from separate query
  const totalWithdrawals = useMemo(() => {
    if (!withdrawalsQuery.data) return 0;
    return withdrawalsQuery.data.reduce((sum, w) => sum + parseFloat(w.amount || "0"), 0);
  }, [withdrawalsQuery.data]);

  // Calculate net cash after withdrawals
  const netCashAfterWithdrawals = useMemo(() => {
    const invoiceCash = salesQuery.data?.cashTotal ?? 0;
    return invoiceCash - totalWithdrawals;
  }, [salesQuery.data, totalWithdrawals]);

  // Record withdrawal mutation
  const withdrawMutation = useMutation({
    mutationFn: async (payload: { amount: number; note?: string }) => {
      const res = await apiRequest("POST", "/api/finance/withdraw", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance:admin-summary"] });
      queryClient.invalidateQueries({ queryKey: ["finance:admin-sales"] });
      queryClient.invalidateQueries({ queryKey: ["finance:withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["finance:cash-in-shop"] });
      toast({ 
        title: "Withdrawal Recorded", 
        description: `₹${withdrawAmount} has been logged successfully.` 
      });
      setWithdrawAmount("");
      setWithdrawNote("");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to Record Withdrawal",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    },
  });

  // Update withdrawal mutation
  const updateWithdrawalMutation = useMutation({
    mutationFn: async ({ id, amount, note }: { id: number; amount: number; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/finance/withdraw/${id}`, { amount, note });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance:admin-summary"] });
      queryClient.invalidateQueries({ queryKey: ["finance:withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["finance:cash-in-shop"] });
      toast({ title: "Withdrawal Updated", description: "Changes saved successfully." });
      setEditingWithdrawal(null);
      setWithdrawAmount("");
      setWithdrawNote("");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    },
  });

  // Delete withdrawal mutation
  const deleteWithdrawalMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/finance/withdraw/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance:admin-summary"] });
      queryClient.invalidateQueries({ queryKey: ["finance:withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["finance:cash-in-shop"] });
      toast({ title: "Withdrawal Deleted", description: "Entry removed successfully." });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount || "0");
    
    if (!amount || amount <= 0) {
      toast({ 
        variant: "destructive", 
        title: "Invalid Amount", 
        description: "Please enter a valid withdrawal amount" 
      });
      return;
    }

    if (editingWithdrawal) {
      updateWithdrawalMutation.mutate({ 
        id: editingWithdrawal.id, 
        amount, 
        note: withdrawNote.trim() || undefined 
      });
    } else {
      withdrawMutation.mutate({ 
        amount, 
        note: withdrawNote.trim() || undefined 
      });
    }
  };

  const handleEditWithdrawal = (withdrawal: Withdrawal) => {
    setEditingWithdrawal(withdrawal);
    setWithdrawAmount(withdrawal.amount);
    setWithdrawNote(withdrawal.note || "");
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingWithdrawal(null);
    setWithdrawAmount("");
    setWithdrawNote("");
  };

  const handleDeleteWithdrawal = (id: number) => {
    if (confirm("Are you sure you want to delete this withdrawal entry?")) {
      deleteWithdrawalMutation.mutate(id);
    }
  };

  const isLoading = summaryQuery.isLoading || salesQuery.isLoading;
  const hasError = summaryQuery.isError || salesQuery.isError;
  
  // Log any errors for debugging
  if (summaryQuery.isError) console.error("Summary query error:", summaryQuery.error);
  if (salesQuery.isError) console.error("Sales query error:", salesQuery.error);
  if (withdrawalsQuery.isError) console.error("Withdrawals query error:", withdrawalsQuery.error);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Finance Overview</h1>
        <p className="text-muted-foreground">
          Admin view for monitoring cash flow, balances, and withdrawals across all users.
        </p>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load financial data. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Reporting Window & Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Reporting Period</CardTitle>
            <CardDescription>Select date range to analyze</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-start-date">Start Date</Label>
              <Input
                id="admin-start-date"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-end-date">End Date</Label>
              <Input
                id="admin-end-date"
                type="date"
                value={endDate}
                min={startDate}
                max={today}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t space-y-2 text-sm">
              <div className="font-medium text-base mb-3">Invoice Sales</div>
              <div className="flex justify-between">
                <span>Total Invoices</span>
                <span className="font-semibold">
                  {isLoading ? "..." : salesQuery.data?.invoiceCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cash Sales</span>
                <span className="font-semibold text-green-600">
                  {isLoading ? "..." : `₹${formatCurrency(salesQuery.data?.cashTotal)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Card/UPI Sales</span>
                <span className="font-semibold text-blue-600">
                  {isLoading ? "..." : `₹${formatCurrency(salesQuery.data?.cardTotal)}`}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t font-medium">
                <span>Total Sales</span>
                <span>{isLoading ? "..." : `₹${formatCurrency(salesQuery.data?.totalSales)}`}</span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2 text-sm">
              <div className="font-medium text-base mb-3">Cash Flow (Selected Period)</div>
              <div className="flex justify-between">
                <span>Cash from Invoices</span>
                <span className="font-semibold text-green-600">
                  +₹{isLoading ? "..." : formatCurrency(salesQuery.data?.cashTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Withdrawals</span>
                <span className="font-semibold text-red-600">
                  -₹{withdrawalsQuery.isLoading ? "..." : formatCurrency(totalWithdrawals)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t font-medium text-base">
                <span>Net Cash (Period)</span>
                <span className={netCashAfterWithdrawals >= 0 ? "text-green-600" : "text-red-600"}>
                  {isLoading ? "..." : `₹${formatCurrency(netCashAfterWithdrawals)}`}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2 text-sm">
              <div className="font-medium text-base mb-3 flex items-center gap-2">
                💰 Cash in Shop (Cumulative)
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>All-time Cash Sales</span>
                <span className="font-medium">
                  +₹{cashInShopQuery.isLoading ? "..." : formatCurrency(cashInShopQuery.data?.totalCashSales)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>All-time Withdrawals</span>
                <span className="font-medium">
                  -₹{cashInShopQuery.isLoading ? "..." : formatCurrency(cashInShopQuery.data?.totalWithdrawals)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold text-lg">
                <span>Available Cash in Shop</span>
                <span className="text-green-600">
                  {cashInShopQuery.isLoading ? "..." : `₹${formatCurrency(cashInShopQuery.data?.cashInShop)}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                This is the cumulative cash available in your shop from all cash sales minus all withdrawals.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Withdrawals */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Cash Withdrawals</CardTitle>
            <CardDescription>
              {editingWithdrawal 
                ? `Editing withdrawal #${editingWithdrawal.id}` 
                : "Record cash removed from register for banking or expenses"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Amount (₹)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdraw-note">Note (Optional)</Label>
                <Input
                  id="withdraw-note"
                  placeholder="e.g., Bank deposit, Petty cash"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending || updateWithdrawalMutation.isPending || !withdrawAmount}
              >
                {(withdrawMutation.isPending || updateWithdrawalMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingWithdrawal ? "Updating..." : "Recording..."}
                  </>
                ) : editingWithdrawal ? (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    Update Withdrawal
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Record Withdrawal
                  </>
                )}
              </Button>
              {editingWithdrawal && (
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              )}
            </div>

            {/* Recent Withdrawals */}
            <div className="pt-4 space-y-3">
              <h3 className="text-sm font-medium">Withdrawal History</h3>
              
              {/* Date Filter for Withdrawals */}
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/20">
                <div className="space-y-1">
                  <Label htmlFor="withdrawal-start" className="text-xs">From</Label>
                  <Input
                    id="withdrawal-start"
                    type="date"
                    value={withdrawalFilterStart}
                    max={withdrawalFilterEnd}
                    onChange={(e) => setWithdrawalFilterStart(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="withdrawal-end" className="text-xs">To</Label>
                  <Input
                    id="withdrawal-end"
                    type="date"
                    value={withdrawalFilterEnd}
                    min={withdrawalFilterStart}
                    max={today}
                    onChange={(e) => setWithdrawalFilterEnd(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {withdrawalsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading withdrawals...</div>
              ) : withdrawalsQuery.isError ? (
                <div className="text-sm text-red-600 py-4 text-center border rounded-lg">
                  Error loading withdrawals. Check console for details.
                </div>
              ) : withdrawalsQuery.data && withdrawalsQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/20">
                  {withdrawalsQuery.data.map((withdrawal) => (
                    <div key={withdrawal.id} className="p-3 border rounded-md bg-background">
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="text-lg font-semibold text-red-600">
                            -₹{formatCurrency(withdrawal.amount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            By {userDirectory.get(withdrawal.adminId) || withdrawal.adminId}
                            {" • "}
                            {format(new Date(withdrawal.createdAt), "dd MMM yyyy, HH:mm")}
                          </div>
                          {withdrawal.note && (
                            <div className="text-sm">{withdrawal.note}</div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditWithdrawal(withdrawal)}
                            disabled={deleteWithdrawalMutation.isPending}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteWithdrawal(withdrawal.id)}
                            disabled={deleteWithdrawalMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  No withdrawals in this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Balance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Entries by User</CardTitle>
          <CardDescription>
            Aggregated balance entries for {startDate} to {endDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading user balances...
            </div>
          ) : perUserTotals.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Opening (Σ)</TableHead>
                    <TableHead className="text-right">Cash (Σ)</TableHead>
                    <TableHead className="text-right">Card (Σ)</TableHead>
                    <TableHead className="text-right">Closing (Σ)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perUserTotals.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="text-right">₹{user.opening.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-green-600">₹{user.cash.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-blue-600">₹{user.card.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{user.closing.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals Row */}
                  {perUserTotals.length > 1 && (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        ₹{perUserTotals.reduce((sum, u) => sum + u.opening, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ₹{perUserTotals.reduce((sum, u) => sum + u.cash, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        ₹{perUserTotals.reduce((sum, u) => sum + u.card, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{perUserTotals.reduce((sum, u) => sum + u.closing, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              No balance entries found for this period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
