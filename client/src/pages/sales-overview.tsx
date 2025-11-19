import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Edit, Search, Printer, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  paymentMode: string;
  grandTotal: string;
  isEdited: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export default function SalesOverview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchParams, setSearchParams] = useState<{ startDate: string; endDate: string } | null>(null);

  const getQueryKey = () => {
    const filters: { startDate?: string; endDate?: string; includeDeleted: boolean } = {
      includeDeleted: true
    };
    
    if (searchParams) {
      filters.startDate = searchParams.startDate;
      filters.endDate = searchParams.endDate;
    }
    
    return ["/api/invoices", filters];
  };

  const { data: invoices = [], isLoading: loading } = useQuery<Invoice[]>({
    queryKey: getQueryKey(),
    queryFn: async ({ queryKey }) => {
      const [baseUrl, filters] = queryKey as [string, { startDate?: string; endDate?: string; includeDeleted: boolean }];
      const params = new URLSearchParams();
      
      if (filters.startDate) {
        params.append("startDate", filters.startDate);
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate);
      }
      if (filters.includeDeleted) {
        params.append("includeDeleted", "true");
      }
      
      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }
      
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      return apiRequest("DELETE", `/api/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Invoice Deleted",
        description: "The invoice has been marked as deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete invoice.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    const today = new Date().toISOString().split('T')[0];
    setSearchParams({
      startDate: startDate || today,
      endDate: endDate || today,
    });
  };

  const handleDelete = (invoiceId: number) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      deleteMutation.mutate(invoiceId);
    }
  };

  const totalSales = invoices
    .filter((inv) => !inv.deletedAt)
    .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
  const cashSales = invoices
    .filter((inv) => !inv.deletedAt && inv.paymentMode === "Cash")
    .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
  const onlineSales = invoices
    .filter((inv) => !inv.deletedAt && inv.paymentMode === "Online")
    .reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Sales Overview</h1>
        <p className="text-muted-foreground">View and manage all invoices</p>
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
                    <TableRow 
                      key={invoice.id} 
                      className={`hover-elevate ${invoice.deletedAt ? "opacity-50" : ""}`}
                      data-testid={`row-invoice-${invoice.id}`}
                    >
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
                        <div className="flex flex-col gap-1 items-center">
                          {invoice.deletedAt && (
                            <Badge variant="destructive" className="text-xs">Deleted</Badge>
                          )}
                          {invoice.isEdited && (
                            <Badge variant="outline" className="text-xs">Edited</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => window.open(`/print-invoice/${invoice.id}`, '_blank')}
                            data-testid={`button-print-${invoice.id}`}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          {user?.role === "admin" && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setLocation(`/create-invoice?edit=${invoice.id}`)}
                                data-testid={`button-edit-${invoice.id}`}
                                disabled={!!invoice.deletedAt}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDelete(invoice.id)}
                                disabled={!!invoice.deletedAt || deleteMutation.isPending}
                                data-testid={`button-delete-${invoice.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {searchParams && invoices.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Payment Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <p className="text-sm text-muted-foreground mt-1">
                  {invoices.filter(inv => inv.paymentMode === "Cash").length} invoices
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Online Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-chart-1" data-testid="text-online-sales">₹{onlineSales.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {invoices.filter(inv => inv.paymentMode === "Online").length} invoices
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
