import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, TrendingDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type BalanceRow = {
  id: number;
  userId: string;
  date: string;
  opening: string;
  cashTotal: string;
  cardTotal: string;
  closing: string;
};

type SalesSummary = {
  cashTotal: number;
  cardTotal: number;
  totalSales: number;
  invoiceCount: number;
};

type Withdrawal = {
  id: number;
  adminId: string;
  amount: string;
  note: string | null;
  createdAt: string;
};

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  const num = typeof value === "string" ? parseFloat(value || "0") : value;
  return Number.isNaN(num) ? "0.00" : num.toFixed(2);
}

function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function Finance() {
  const { toast } = useToast();
  
  // Selected date for closing entry
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateString(new Date()));
  
  // Form fields
  const [opening, setOpening] = useState<string>("0");
  const [cashTotal, setCashTotal] = useState<string>("0");
  const [cardTotal, setCardTotal] = useState<string>("0");
  const [closing, setClosing] = useState<string>("0");
  
  // Track if user manually edited values (to prevent auto-fill override)
  const [manuallyEdited, setManuallyEdited] = useState({
    cash: false,
    card: false,
    closing: false,
  });

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawNote, setWithdrawNote] = useState<string>("");

  // Calculate date range for last 7 days
  const rangeStart = useMemo(() => {
    const date = new Date(selectedDate);
    const start = addDays(date, -6);
    return toDateString(start);
  }, [selectedDate]);

  // Reset manual edit flags when date changes
  useEffect(() => {
    setManuallyEdited({ cash: false, card: false, closing: false });
  }, [selectedDate]);

  // Fetch opening balance (previous day's closing)
  const openingQuery = useQuery<{ opening: number }>({
    queryKey: ["finance:opening", selectedDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/finance/opening?date=${selectedDate}`);
      return await res.json();
    },
  });

  // Fetch last 7 days of balance history
  const balancesQuery = useQuery<BalanceRow[]>({
    queryKey: ["finance:balances", rangeStart, selectedDate],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/finance/user/balances?startDate=${rangeStart}&endDate=${selectedDate}`,
      );
      return await res.json();
    },
  });

  // Fetch sales summary for selected date
  const salesSummaryQuery = useQuery<SalesSummary>({
    queryKey: ["finance:sales-summary", selectedDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/finance/sales-summary?date=${selectedDate}`);
      return await res.json();
    },
  });

  // Fetch user's own withdrawals for selected date only
  const withdrawalsQuery = useQuery<Withdrawal[]>({
    queryKey: ["finance:user-withdrawals", selectedDate],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/finance/my-withdrawals?startDate=${selectedDate}&endDate=${selectedDate}`,
      );
      return await res.json();
    },
  });

  // Find if there's already a balance entry for today
  const existingBalance = useMemo(() => {
    if (!balancesQuery.data) return undefined;
    return balancesQuery.data.find((row) => row.date.startsWith(selectedDate));
  }, [balancesQuery.data, selectedDate]);

  // Auto-fill opening balance when data loads
  useEffect(() => {
    if (openingQuery.data?.opening !== undefined) {
      setOpening(formatCurrency(openingQuery.data.opening));
    }
  }, [openingQuery.data]);

  // Load existing balance if present, otherwise auto-fill from sales
  useEffect(() => {
    if (existingBalance) {
      // Load saved balance
      setCashTotal(formatCurrency(existingBalance.cashTotal));
      setCardTotal(formatCurrency(existingBalance.cardTotal));
      setClosing(formatCurrency(existingBalance.closing));
      setManuallyEdited({ cash: true, card: true, closing: true });
    } else if (salesSummaryQuery.data) {
      // Auto-fill from sales (only if not manually edited)
      if (!manuallyEdited.cash) {
        setCashTotal(formatCurrency(salesSummaryQuery.data.cashTotal));
      }
      if (!manuallyEdited.card) {
        setCardTotal(formatCurrency(salesSummaryQuery.data.cardTotal));
      }
    }
  }, [existingBalance, salesSummaryQuery.data, manuallyEdited]);

  // Calculate expected closing automatically
  const expectedClosing = useMemo(() => {
    const op = parseFloat(opening || "0");
    const cash = parseFloat(cashTotal || "0");
    const card = parseFloat(cardTotal || "0");
    return op + cash + card;
  }, [opening, cashTotal, cardTotal]);

  // Auto-update closing unless manually edited
  useEffect(() => {
    if (!existingBalance && !manuallyEdited.closing) {
      setClosing(expectedClosing.toFixed(2));
    }
  }, [expectedClosing, existingBalance, manuallyEdited.closing]);

  // Calculate variance
  const variance = useMemo(() => {
    const exp = expectedClosing;
    const act = parseFloat(closing || "0");
    return exp - act;
  }, [expectedClosing, closing]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      date: string;
      opening: number;
      cashTotal: number;
      cardTotal: number;
      closing: number;
    }) => {
      const res = await apiRequest("POST", "/api/finance/closing", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance:balances"] });
      queryClient.invalidateQueries({ queryKey: ["finance:opening"] });
      toast({ 
        title: "Saved Successfully", 
        description: `Closing balance for ${format(new Date(selectedDate), "dd MMM yyyy")} has been recorded.` 
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save closing balance",
      });
    },
  });

  // Withdrawal mutation
  const withdrawMutation = useMutation({
    mutationFn: async (payload: { amount: number; note?: string }) => {
      const res = await apiRequest("POST", "/api/finance/withdraw", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance:user-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["finance:withdrawals"] });
      toast({
        title: "Withdrawal Recorded",
        description: `₹${withdrawAmount} has been logged successfully.`,
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

  const handleSave = () => {
    const payload = {
      date: selectedDate,
      opening: parseFloat(opening || "0"),
      cashTotal: parseFloat(cashTotal || "0"),
      cardTotal: parseFloat(cardTotal || "0"),
      closing: parseFloat(closing || "0"),
    };

    if (payload.opening < 0 || payload.cashTotal < 0 || payload.cardTotal < 0 || payload.closing < 0) {
      toast({
        variant: "destructive",
        title: "Invalid Values",
        description: "All amounts must be positive numbers",
      });
      return;
    }

    saveMutation.mutate(payload);
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount || "0");

    if (!amount || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount",
      });
      return;
    }

    withdrawMutation.mutate({
      amount,
      note: withdrawNote.trim() || undefined,
    });
  };

  const isLoading = openingQuery.isLoading || balancesQuery.isLoading;
  const hasError = openingQuery.isError || balancesQuery.isError;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Finance</h1>
        <p className="text-muted-foreground">Record your daily closing cash and review the last 7 days.</p>
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
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Daily Closing Form</CardTitle>
            <CardDescription>
              Enter closing cash for {format(new Date(selectedDate), "EEEE, dd MMM yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="finance-date">Date</Label>
                <Input
                  id="finance-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={toDateString(new Date())}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finance-opening">Opening Balance (₹)</Label>
                <Input
                  id="finance-opening"
                  type="number"
                  step="0.01"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  disabled={openingQuery.isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finance-cash">
                  Cash Sales (₹)
                  {salesSummaryQuery.data && !manuallyEdited.cash && (
                    <span className="text-xs text-muted-foreground ml-2">(auto-filled)</span>
                  )}
                </Label>
                <Input
                  id="finance-cash"
                  type="number"
                  step="0.01"
                  value={cashTotal}
                  onChange={(e) => {
                    setCashTotal(e.target.value);
                    setManuallyEdited((prev) => ({ ...prev, cash: true }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finance-card">
                  Card / UPI Sales (₹)
                  {salesSummaryQuery.data && !manuallyEdited.card && (
                    <span className="text-xs text-muted-foreground ml-2">(auto-filled)</span>
                  )}
                </Label>
                <Input
                  id="finance-card"
                  type="number"
                  step="0.01"
                  value={cardTotal}
                  onChange={(e) => {
                    setCardTotal(e.target.value);
                    setManuallyEdited((prev) => ({ ...prev, card: true }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finance-closing">Closing Cash (₹)</Label>
                <Input
                  id="finance-closing"
                  type="number"
                  step="0.01"
                  value={closing}
                  onChange={(e) => {
                    setClosing(e.target.value);
                    setManuallyEdited((prev) => ({ ...prev, closing: true }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Variance</Label>
                <div
                  className={`h-10 px-3 flex items-center rounded-md border font-medium ${
                    Math.abs(variance) < 0.01
                      ? "border-muted-foreground/30 text-green-600"
                      : variance > 0
                        ? "border-amber-500 text-amber-600"
                        : "border-red-500 text-red-600"
                  }`}
                >
                  {Math.abs(variance) < 0.01 ? "Balanced" : `${variance > 0 ? "+" : ""}₹${variance.toFixed(2)}`}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending || isLoading}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Closing"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Key figures for {format(new Date(selectedDate), "dd MMM")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Invoices Today</span>
              <span className="font-semibold">
                {salesSummaryQuery.isLoading ? "..." : salesSummaryQuery.data?.invoiceCount ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Detected Cash Sales</span>
              <span className="font-semibold">
                {salesSummaryQuery.isLoading ? "..." : `₹${formatCurrency(salesSummaryQuery.data?.cashTotal)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Detected Card Sales</span>
              <span className="font-semibold">
                {salesSummaryQuery.isLoading ? "..." : `₹${formatCurrency(salesSummaryQuery.data?.cardTotal)}`}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span>Opening Balance</span>
              <span className="font-semibold">₹{formatCurrency(opening)}</span>
            </div>
            <div className="flex justify-between">
              <span>Expected Closing</span>
              <span className="font-semibold">₹{expectedClosing.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Recorded Closing</span>
              <span className="font-semibold">₹{formatCurrency(closing)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span>Variance</span>
              <span
                className={`font-semibold ${
                  Math.abs(variance) < 0.01 ? "text-green-600" : variance > 0 ? "text-amber-600" : "text-red-600"
                }`}
              >
                {Math.abs(variance) < 0.01 ? "Balanced" : `₹${Math.abs(variance).toFixed(2)}`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 7 Days</CardTitle>
          <CardDescription>Your recent balance entries for reference</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading balances...
            </div>
          ) : balancesQuery.data && balancesQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">Card</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balancesQuery.data.map((row) => {
                    const isSelected = row.date.startsWith(selectedDate);
                    return (
                      <TableRow key={row.id} className={isSelected ? "bg-muted/40" : undefined}>
                        <TableCell>{format(new Date(row.date), "EEE, dd MMM")}</TableCell>
                        <TableCell className="text-right">₹{formatCurrency(row.opening)}</TableCell>
                        <TableCell className="text-right">₹{formatCurrency(row.cashTotal)}</TableCell>
                        <TableCell className="text-right">₹{formatCurrency(row.cardTotal)}</TableCell>
                        <TableCell className="text-right font-medium">₹{formatCurrency(row.closing)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              No balance entries yet. Submit today's closing to start tracking.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Withdrawals Section */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Withdrawals</CardTitle>
          <CardDescription>Record cash removed from register for banking, expenses, or other purposes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="user-withdraw-amount">Amount (₹)</Label>
              <Input
                id="user-withdraw-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="user-withdraw-note">Note (Optional)</Label>
              <Input
                id="user-withdraw-note"
                placeholder="e.g., Bank deposit, Petty cash, Personal use"
                value={withdrawNote}
                onChange={(e) => setWithdrawNote(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleWithdraw}
            disabled={withdrawMutation.isPending || !withdrawAmount}
          >
            {withdrawMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 mr-2" />
                Record Withdrawal
              </>
            )}
          </Button>

          {/* Today's Withdrawals */}
          {withdrawalsQuery.data && withdrawalsQuery.data.length > 0 && (
            <div className="pt-4 space-y-2 border-t">
              <h3 className="text-sm font-medium">Today's Withdrawals</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {withdrawalsQuery.data.map((withdrawal) => (
                  <div key={withdrawal.id} className="p-3 border rounded-md bg-muted/20">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="text-lg font-semibold text-red-600">
                          -₹{formatCurrency(withdrawal.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(withdrawal.createdAt), "dd MMM yyyy, HH:mm")}
                        </div>
                        {withdrawal.note && (
                          <div className="text-sm">{withdrawal.note}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm font-medium">
                  <span>Total Withdrawn Today:</span>
                  <span className="text-red-600">
                    -₹{formatCurrency(
                      withdrawalsQuery.data.reduce((sum, w) => sum + parseFloat(w.amount || "0"), 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
