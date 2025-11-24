import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type SummaryResponse = {
  balances: Array<{
    id: number;
    userId: string;
    date: string;
    opening: string;
    cashTotal: string;
    cardTotal: string;
    closing: string;
  }>;
  withdrawals: Array<{
    id: number;
    adminId: string;
    amount: string;
    note: string | null;
    createdAt: string;
  }>;
  totals: {
    opening?: number;
    cashTotal?: number;
    cardTotal?: number;
    closing?: number;
    withdrawalTotal?: number;
  };
};

type UserSummary = {
  opening: number;
  cash: number;
  card: number;
  closing: number;
};

function formatCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return "0.00";
  const num = typeof value === "string" ? parseFloat(value || "0") : value;
  return Number.isNaN(num) ? "0.00" : num.toFixed(2);
}

export default function AdminFinance() {
  const { toast } = useToast();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState<string>(todayIso);
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawNote, setWithdrawNote] = useState<string>("");

  const summaryQuery = useQuery<SummaryResponse>({
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

  const userDirectoryQuery = useQuery<Array<{ id: string; username: string }>>({
    queryKey: ["finance:users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return await res.json();
    },
  });

  const directory = useMemo(() => {
    const map = new Map<string, string>();
    userDirectoryQuery.data?.forEach((user) => map.set(user.id, user.username));
    return map;
  }, [userDirectoryQuery.data]);

  const perUserTotals = useMemo(() => {
    const result = new Map<string, UserSummary>();
    summaryQuery.data?.balances.forEach((row) => {
      const key = row.userId;
      const existing = result.get(key) || { opening: 0, cash: 0, card: 0, closing: 0 };
      existing.opening += parseFloat(row.opening || "0");
      existing.cash += parseFloat(row.cashTotal || "0");
      existing.card += parseFloat(row.cardTotal || "0");
      existing.closing += parseFloat(row.closing || "0");
      result.set(key, existing);
    });
    return Array.from(result.entries()).map(([userId, totals]) => ({ userId, totals }));
  }, [summaryQuery.data]);

  const withdrawMutation = useMutation({
    mutationFn: async (payload: { amount: number; note?: string }) => {
      const res = await apiRequest("POST", "/api/finance/withdraw", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance:admin-summary"] });
      toast({ title: "Withdrawal recorded", description: "Cash withdrawal has been saved." });
      setWithdrawAmount("");
      setWithdrawNote("");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to record withdrawal",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    },
  });

  const handleWithdraw = () => {
    const numericAmount = Number(withdrawAmount || 0);
    if (!numericAmount || numericAmount <= 0) {
      toast({ variant: "destructive", title: "Enter a valid amount" });
      return;
    }
    withdrawMutation.mutate({ amount: numericAmount, note: withdrawNote || undefined });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Finance Overview</h1>
        <p className="text-muted-foreground">Admin tools for balancing store cash, tracking card totals, and logging withdrawals.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reporting Window</CardTitle>
            <CardDescription>Select the period you want to review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="finance-admin-start">Start Date</Label>
              <Input
                id="finance-admin-start"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => setStartDate(event.target.value)}
                data-testid="admin-finance-input-start"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="finance-admin-end">End Date</Label>
              <Input
                id="finance-admin-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                data-testid="admin-finance-input-end"
              />
            </div>

            <div className="pt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Opening (Σ)</span>
                <span className="font-semibold">₹{formatCurrency(summaryQuery.data?.totals?.opening)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Sales (Σ)</span>
                <span className="font-semibold">₹{formatCurrency(summaryQuery.data?.totals?.cashTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Card Sales (Σ)</span>
                <span className="font-semibold">₹{formatCurrency(summaryQuery.data?.totals?.cardTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Closing (Σ)</span>
                <span className="font-semibold">₹{formatCurrency(summaryQuery.data?.totals?.closing)}</span>
              </div>
              <div className="flex justify-between">
                <span>Withdrawals</span>
                <span className="font-semibold">₹{formatCurrency(summaryQuery.data?.totals?.withdrawalTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Record Withdrawal</CardTitle>
            <CardDescription>Track cash pulled out of the register for banking or expenses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="admin-withdraw-amount">Amount (₹)</Label>
                <Input
                  id="admin-withdraw-amount"
                  type="number"
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                  data-testid="admin-withdraw-input-amount"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-withdraw-note">Note</Label>
                <Input
                  id="admin-withdraw-note"
                  value={withdrawNote}
                  onChange={(event) => setWithdrawNote(event.target.value)}
                  placeholder="Reason or destination"
                  data-testid="admin-withdraw-input-note"
                />
              </div>
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              data-testid="admin-withdraw-button-submit"
            >
              {withdrawMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </span>
              ) : (
                "Record Cash Withdrawal"
              )}
            </Button>

            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Recent Withdrawals</h2>
              {summaryQuery.isLoading ? (
                <div className="text-muted-foreground text-sm">Loading withdrawals…</div>
              ) : summaryQuery.data?.withdrawals && summaryQuery.data.withdrawals.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-muted/20">
                  {summaryQuery.data.withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="p-2 border rounded bg-background/80">
                      <div className="flex justify-between text-sm font-medium">
                        <span>₹{formatCurrency(withdrawal.amount)}</span>
                        <span>{format(new Date(withdrawal.createdAt), "dd MMM yyyy • HH:mm")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        By {directory.get(withdrawal.adminId) || withdrawal.adminId}
                        {withdrawal.note ? ` • ${withdrawal.note}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">No withdrawals recorded in this window.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balances by User</CardTitle>
          <CardDescription>Breakdown of recorded balances for the selected window.</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryQuery.isLoading ? (
            <div className="py-10 text-center text-muted-foreground" data-testid="admin-finance-loading">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading balances…
              </span>
            </div>
          ) : summaryQuery.isError ? (
            <div className="py-10 text-center text-destructive" data-testid="admin-finance-error">
              Unable to load balances. Please try again.
            </div>
          ) : perUserTotals.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-full" data-testid="admin-finance-table">
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
                  {perUserTotals.map(({ userId, totals }) => (
                    <TableRow key={userId}>
                      <TableCell>{directory.get(userId) || userId}</TableCell>
                      <TableCell className="text-right">₹{totals.opening.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{totals.cash.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{totals.card.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{totals.closing.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground" data-testid="admin-finance-empty">
              No balances captured in this period yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
