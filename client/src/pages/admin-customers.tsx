import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, TrendingUp, Search, X } from "lucide-react";

type Customer = {
  id: number;
  customerCode: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpend: string;
  createdAt: string;
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  grandTotal: string;
  createdAt: string;
  customerName: string;
};

type CustomerStats = {
  totalNewCustomers: number;
  topInvoices: Array<{
    id: number;
    invoiceNumber: string;
    customerName: string;
    grandTotal: string;
    createdAt: string;
  }>;
};

export default function AdminCustomers() {
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "month">("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();

    if (timePeriod === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timePeriod === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timePeriod === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
    };
  };

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { startDate, endDate } = getDateRange();
  const { data: stats, isLoading: statsLoading } = useQuery<CustomerStats>({
    queryKey: [`/api/customers/stats?startDate=${startDate}&endDate=${endDate}`],
  });

  const { data: selectedCustomer } = useQuery<Customer>({
    queryKey: [`/api/customers/${selectedCustomerId}`],
    enabled: !!selectedCustomerId,
  });

  const { data: customerInvoices = [] } = useQuery<Invoice[]>({
    queryKey: [`/api/customers/${selectedCustomerId}/invoices`],
    enabled: !!selectedCustomerId,
  });

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.customerCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInvoiceClick = (invoiceId: number) => {
    window.open(`/print-invoice/${invoiceId}`, "_blank");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <p className="text-muted-foreground">Track and manage your customer base</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Period</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={timePeriod} onValueChange={(value: any) => setTimePeriod(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total New Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.totalNewCustomers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {timePeriod === "today" && "Today"}
              {timePeriod === "week" && "This week"}
              {timePeriod === "month" && "This month"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top 3 Invoices (30 Days)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : stats?.topInvoices && stats.topInvoices.length > 0 ? (
                stats.topInvoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    onClick={() => handleInvoiceClick(invoice.id)}
                    className="w-full text-left text-sm hover:bg-muted p-1 rounded transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-blue-600 hover:underline">
                        {invoice.invoiceNumber}
                      </span>
                      <span className="font-semibold">₹{parseFloat(invoice.grandTotal).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{invoice.customerName}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No invoices</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Directory</CardTitle>
          <CardDescription>Search and view all customers</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or customer code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {customersLoading ? (
            <div className="text-center py-8">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No customers found matching your search" : "No customers yet"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead className="text-right">Total Orders</TableHead>
                  <TableHead className="text-right">Total Spend</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer hover:bg-muted">
                    <TableCell className="font-mono">{customer.customerCode}</TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="text-right">{customer.totalOrders}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ₹{parseFloat(customer.totalSpend).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCustomerId} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer Code</p>
                  <p className="font-mono font-medium">{selectedCustomer.customerCode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedCustomer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="font-medium">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Lifetime Spend</p>
                  <p className="text-2xl font-bold">
                    ₹{parseFloat(selectedCustomer.totalSpend).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Purchase History</h3>
                {customerInvoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No invoices found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                          <TableCell>
                            {new Date(invoice.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ₹{parseFloat(invoice.grandTotal).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInvoiceClick(invoice.id)}
                            >
                              View Invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
