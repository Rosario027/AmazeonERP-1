import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type BalanceRow = {
  id: number;
  userId: string;
  date: string;
  opening: string;
  cashTotal: string;
  cardTotal: string;
  closing: string;
};

type OpeningResponse = {
  opening: number;
};

function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  const num = typeof value === "string" ? parseFloat(value || "0") : value;
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
}

export default function Finance() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(() => toISODate(new Date()));
  const [opening, setOpening] = useState<string>("0");
  const [cashTotal, setCashTotal] = useState<string>("0");
  const [cardTotal, setCardTotal] = useState<string>("0");
  const [closing, setClosing] = useState<string>("0");

  const rangeStart = useMemo(() => toISODate(addDays(new Date(selectedDate), -6)), [selectedDate]);

  const openingQuery = useQuery<OpeningResponse>({
    queryKey: ["finance:opening", selectedDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/finance/opening?date=${selectedDate}`);
      return await res.json();
    },
  });

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

  const todaysBalance = useMemo(() => {
    if (!balancesQuery.data) return undefined;
    return balancesQuery.data.find((row) => toISODate(new Date(row.date)) === selectedDate);
  }, [balancesQuery.data, selectedDate]);

  useEffect(() => {
    if (openingQuery.data && openingQuery.data.opening !== undefined && openingQuery.data.opening !== null) {
      setOpening(formatCurrency(openingQuery.data.opening));
    }
  }, [openingQuery.data]);

  useEffect(() => {
    if (todaysBalance) {
      setCashTotal(formatCurrency(todaysBalance.cashTotal));
      setCardTotal(formatCurrency(todaysBalance.cardTotal));
      setClosing(formatCurrency(todaysBalance.closing));
    } else {
      setCashTotal("0");
      setCardTotal("0");
      setClosing("0");
    }
  }, [todaysBalance]);

  const expectedClosing = useMemo(() => {
    const op = Number(opening || 0);
    const cash = Number(cashTotal || 0);
    const card = Number(cardTotal || 0);
    return op + cash + card;
  }, [opening, cashTotal, cardTotal]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/finance/closing", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance:balances"] });
      toast({ title: "Saved", description: "Closing cash saved successfully." });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Could not save closing cash",
      });
    },
  });

  const handleSave = () => {
    const payload = {
      date: selectedDate,
      opening: Number(opening || 0),
      cashTotal: Number(cashTotal || 0),
      cardTotal: Number(cardTotal || 0),
      closing: Number(closing || 0),
    };

    saveMutation.mutate(payload);
  };

  const variance = useMemo(() => {
    const close = Number(closing || 0);
    return expectedClosing - close;
  }, [expectedClosing, closing]);

  const isLoading = openingQuery.isLoading || balancesQuery.isLoading;
  const hasError = openingQuery.isError || balancesQuery.isError;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Finance</h1>
        <p className="text-muted-foreground">Capture your daily closing cash and review the last 7 days.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Daily Closing Form</CardTitle>
            <CardDescription>
              Enter totals for {format(parseISO(selectedDate), "EEEE, dd MMM yyyy")}. You can update the values until
              the end of day.
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
                  onChange={(event) => setSelectedDate(event.target.value)}
                  data-testid="finance-input-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finance-opening">Opening Balance</Label>
                <Input
                  id="finance-opening"
                  type="number"
                  inputMode="decimal"
                  value={opening}
                  onChange={(event) => setOpening(event.target.value)}
                  data-testid="finance-input-opening"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finance-cash">Cash Sales (₹)</Label>
                <Input
                  id="finance-cash"
                  type="number"
                  inputMode="decimal"
                  value={cashTotal}
                  onChange={(event) => setCashTotal(event.target.value)}
                  data-testid="finance-input-cash"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finance-card">Card / UPI Sales (₹)</Label>
                <Input
                  id="finance-card"
                  type="number"
                  inputMode="decimal"
                  value={cardTotal}
                  onChange={(event) => setCardTotal(event.target.value)}
                  data-testid="finance-input-card"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finance-closing">Closing Cash (₹)</Label>
                <Input
                  id="finance-closing"
                  type="number"
                  inputMode="decimal"
                  value={closing}
                  onChange={(event) => setClosing(event.target.value)}
                  data-testid="finance-input-closing"
                />
              </div>

              <div className="space-y-2">
                <Label>Variance</Label>
                <div
                  className={`h-10 px-3 inline-flex items-center rounded border ${variance === 0 ? "border-muted-foreground/30 text-muted-foreground" : variance > 0 ? "border-amber-500 text-amber-600" : "border-red-500 text-red-600"}`}
                  data-testid="finance-text-variance"
                >
                  {variance === 0 ? "Balanced" : `${variance > 0 ? "+" : ""}${variance.toFixed(2)}`}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="finance-button-save">
                {saveMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </span>
                ) : (
                  "Save Closing"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>At a Glance</CardTitle>
            <CardDescription>Key figures for the selected day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Expected Closing</span>
              <span className="font-semibold">₹{expectedClosing.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Recorded Closing</span>
              <span className="font-semibold">₹{Number(closing || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Variance</span>
              <span className={`font-semibold ${variance === 0 ? "text-muted-foreground" : variance > 0 ? "text-amber-600" : "text-red-600"}`}>
                {variance === 0 ? "₹0.00" : `₹${variance.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Opening Balance</span>
              <span className="font-semibold">₹{Number(opening || 0).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 7 Days</CardTitle>
          <CardDescription>Review your previous submissions for context and auditing.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center text-muted-foreground" data-testid="finance-loading">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading balances…
              </span>
            </div>
          ) : hasError ? (
            <div className="py-10 text-center text-destructive" data-testid="finance-error">
              Unable to load balances. Please retry in a moment.
            </div>
          ) : balancesQuery.data && balancesQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-full">
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
                  {balancesQuery.data.map((row) => (
                    <TableRow key={`${row.id}-${row.date}`} className={todaysBalance?.id === row.id ? "bg-muted/40" : undefined}>
                      <TableCell>{format(new Date(row.date), "EEE, dd MMM")}</TableCell>
                      <TableCell className="text-right">₹{formatCurrency(row.opening)}</TableCell>
                      <TableCell className="text-right">₹{formatCurrency(row.cashTotal)}</TableCell>
                      <TableCell className="text-right">₹{formatCurrency(row.cardTotal)}</TableCell>
                      <TableCell className="text-right">₹{formatCurrency(row.closing)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground" data-testid="finance-empty">
              No finance entries found yet. Submit today’s closing to start the log.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
