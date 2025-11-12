import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Edit, Search } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  paymentMode: string;
  grandTotal: string;
  isEdited: boolean;
  createdAt: string;
}

export default function SalesOverview() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const buildQueryKey = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return params.toString() ? `/api/invoices?${params.toString()}` : "/api/invoices";
  };

  const { data: invoices = [], isLoading: loading, refetch } = useQuery<Invoice[]>({
    queryKey: [buildQueryKey()],
  });

  const handleSearch = () => {
    refetch();
  };

  const totalSales = invoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
  const cashSales = invoices
    .filter((inv) => inv.paymentMode === "Cash")
    .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
  const onlineSales = invoices
    .filter((inv) => inv.paymentMode === "Online")
    .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Sales Overview</h1>
        <p className="text-muted-foreground">View and manage all invoices</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="text-total-sales">₹{totalSales.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1">{invoices.length} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-chart-2" data-testid="text-cash-sales">₹{cashSales.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Online Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-chart-1" data-testid="text-online-sales">₹{onlineSales.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-lg font-medium">Invoices</CardTitle>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex gap-2">
                <div>
                  <Label htmlFor="startDate" className="text-xs">From</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate" className="text-xs">To</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10"
                    data-testid="input-end-date"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} data-testid="button-search">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No invoices found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Invoice No.</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Payment Mode</TableHead>
                    <TableHead className="font-semibold text-right">Amount</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover-elevate" data-testid={`row-invoice-${invoice.id}`}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{format(new Date(invoice.createdAt), "dd MMM yyyy")}</TableCell>
                      <TableCell>{invoice.customerName}</TableCell>
                      <TableCell>
                        <Badge variant={invoice.paymentMode === "Cash" ? "secondary" : "default"}>
                          {invoice.paymentMode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">₹{parseFloat(invoice.grandTotal).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        {invoice.isEdited && (
                          <Badge variant="outline" className="text-xs">Edited</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" data-testid={`button-edit-${invoice.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
