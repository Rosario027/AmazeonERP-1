import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: number;
  name: string;
  hsnCode: string;
  category: string | null;
  rate: string;
  gstPercentage: string;
  quantity: number;
  comments: string | null;
}

export default function StockReport() {
  const { toast } = useToast();
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const lowStockThreshold = 10;
  const lowStockProducts = products.filter(p => p.quantity <= lowStockThreshold);

  const handleExport = async () => {
    if (products.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No products found to export",
      });
      return;
    }

    try {
      const response = await fetch("/api/reports/stock", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]
        : `stock-report-${new Date().toISOString().split("T")[0]}.xlsx`;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Stock report exported successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export stock report",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Report</h1>
          <p className="text-muted-foreground mt-1">View current inventory levels and stock status</p>
        </div>
        <Button onClick={handleExport} data-testid="button-export-stock">
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {lowStockProducts.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {lowStockProducts.length} {lowStockProducts.length === 1 ? "product has" : "products have"} low stock (≤{lowStockThreshold} units)
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Inventory Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading stock data...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No products found in inventory.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Product Name</TableHead>
                    <TableHead className="font-semibold">HSN Code</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold text-right">Rate (₹)</TableHead>
                    <TableHead className="font-semibold text-center">GST %</TableHead>
                    <TableHead className="font-semibold text-center">Stock Qty</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const quantity = product.quantity || 0;
                    const status = quantity === 0 ? "out" : quantity <= lowStockThreshold ? "low" : "ok";

                    return (
                      <TableRow key={product.id} className="hover-elevate" data-testid={`row-stock-${product.id}`}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.hsnCode}</TableCell>
                        <TableCell>
                          {product.category ? (
                            <span className="text-sm">{product.category}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">₹{parseFloat(product.rate).toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{product.gstPercentage}%</Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold" data-testid={`text-quantity-${product.id}`}>
                          {quantity}
                        </TableCell>
                        <TableCell className="text-center">
                          {status === "out" ? (
                            <Badge variant="destructive" data-testid={`badge-status-${product.id}`}>
                              Out of Stock
                            </Badge>
                          ) : status === "low" ? (
                            <Badge className="bg-yellow-500 hover:bg-yellow-600" data-testid={`badge-status-${product.id}`}>
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-600" data-testid={`badge-status-${product.id}`}>
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
