import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Finance() {
  const { toast } = useToast();
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [opening, setOpening] = useState<string>("");
  const [cashTotal, setCashTotal] = useState<string>("");
  const [cardTotal, setCardTotal] = useState<string>("");
  const [closing, setClosing] = useState<string>("");

  const { data: openingData } = useQuery(["/api/finance/opening", date], async () => {
    const res = await apiRequest("GET", `/api/finance/opening?date=${date}`);
    return await res.json();
  });

  const { data: balances } = useQuery(["/api/finance/user/balances", date], async () => {
    const res = await apiRequest("GET", `/api/finance/user/balances?startDate=${date}&endDate=${date}`);
    return await res.json();
  });

  useEffect(() => {
    if (openingData) setOpening(String(openingData.opening || "0"));
  }, [openingData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/finance/closing", payload);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/user/balances"] });
      toast({ title: "Saved", description: "Closing cash saved" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save closing cash" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ date, opening, cashTotal, cardTotal, closing });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Finance (User)</h1>
        <p className="text-muted-foreground">Submit today's closing cash and view recent balances</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Closing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Opening Balance</Label>
              <Input value={opening} onChange={(e) => setOpening(e.target.value)} />
            </div>
            <div>
              <Label>Cash Total</Label>
              <Input value={cashTotal} onChange={(e) => setCashTotal(e.target.value)} />
            </div>
            <div>
              <Label>Card Total</Label>
              <Input value={cardTotal} onChange={(e) => setCardTotal(e.target.value)} />
            </div>
            <div>
              <Label>Closing</Label>
              <Input value={closing} onChange={(e) => setClosing(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Closing"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Balances</CardTitle>
          </CardHeader>
          <CardContent>
            {balances && balances.length > 0 ? (
              <div className="space-y-2">
                {balances.map((b: any) => (
                  <div key={b.id} className="p-3 border rounded">
                    <div className="flex justify-between">
                      <div>{new Date(b.date).toLocaleDateString()}</div>
                      <div className="font-semibold">Closing: ₹{parseFloat(b.closing).toFixed(2)}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">Cash: ₹{parseFloat(b.cashTotal).toFixed(2)} • Card: ₹{parseFloat(b.cardTotal).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground">No balances found for selected date</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
