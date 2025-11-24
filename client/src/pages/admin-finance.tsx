import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminFinance() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawNote, setWithdrawNote] = useState<string>("");

  const { data: summary } = useQuery(["/api/finance/admin/summary", startDate, endDate], async () => {
    const res = await apiRequest("GET", `/api/finance/admin/summary?startDate=${startDate}&endDate=${endDate}`);
    return await res.json();
  }, { enabled: !!startDate && !!endDate });

  const withdrawMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/finance/withdraw", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/admin/summary"] });
      toast({ title: "Saved", description: "Withdrawal recorded" });
      setWithdrawAmount("");
      setWithdrawNote("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to record withdrawal" });
    },
  });

  const handleWithdraw = () => {
    if (!withdrawAmount) return toast({ variant: "destructive", title: "Validation", description: "Enter amount" });
    withdrawMutation.mutate({ amount: withdrawAmount, note: withdrawNote });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Finance (Admin)</h1>
        <p className="text-muted-foreground">View balances across users and record withdrawals</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Summary Range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Totals</Label>
              <div className="mt-2">
                <div>Opening: ₹{summary?.totals?.opening ? parseFloat(summary.totals.opening).toFixed(2) : "0.00"}</div>
                <div>Cash Total: ₹{summary?.totals?.cashTotal ? parseFloat(summary.totals.cashTotal).toFixed(2) : "0.00"}</div>
                <div>Card Total: ₹{summary?.totals?.cardTotal ? parseFloat(summary.totals.cardTotal).toFixed(2) : "0.00"}</div>
                <div>Closing: ₹{summary?.totals?.closing ? parseFloat(summary.totals.closing).toFixed(2) : "0.00"}</div>
                <div>Withdrawals: ₹{summary?.totals?.withdrawalTotal ? parseFloat(summary.totals.withdrawalTotal).toFixed(2) : "0.00"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Withdrawals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount</Label>
                <Input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              </div>
              <div>
                <Label>Note</Label>
                <Input value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleWithdraw} disabled={withdrawMutation.isPending}>{withdrawMutation.isPending ? "Saving..." : "Record Withdrawal"}</Button>
            </div>

            <div className="mt-4">
              {summary?.withdrawals && summary.withdrawals.length > 0 ? (
                <div className="space-y-2">
                  {summary.withdrawals.map((w: any) => (
                    <div key={w.id} className="p-2 border rounded">
                      <div className="flex justify-between">
                        <div>{new Date(w.createdAt).toLocaleString()}</div>
                        <div className="font-semibold">₹{parseFloat(w.amount).toFixed(2)}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">By: {w.adminId} • {w.note || ""}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">No withdrawals in range</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
