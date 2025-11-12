import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Reports() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const downloadMutation = useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
      return await apiRequest("GET", `/api/reports/sales?startDate=${startDate}&endDate=${endDate}`);
    },
    onSuccess: async (response, variables) => {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-report-${variables.startDate}-to-${variables.endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Sales report downloaded successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate sales report",
      });
    },
  });

  const handleDownload = async () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select both start and end dates",
      });
      return;
    }

    downloadMutation.mutate({ startDate, endDate });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Reports</h1>
        <p className="text-muted-foreground">Download and analyze business reports</p>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="sales" data-testid="tab-sales-report">Sales Report</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Generate Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-medium">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-12"
                data-testid="input-report-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-medium">
                End Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-12"
                data-testid="input-report-end-date"
              />
            </div>
          </div>

          <div className="bg-muted p-6 rounded-md space-y-2">
            <h3 className="font-semibold text-sm mb-3">Report Includes:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Total Sales (Revenue)</li>
              <li>• Category-wise Sales Breakdown (%)</li>
              <li>• Product-wise Sales Analysis</li>
              <li>• Total B2B vs B2C Sales Comparison</li>
              <li>• Payment Mode Distribution (Cash vs Online)</li>
              <li>• Invoice Count and Average Order Value</li>
            </ul>
          </div>

          <Button
            className="w-full h-12"
            onClick={handleDownload}
            disabled={downloadMutation.isPending}
            data-testid="button-download-report"
          >
            <Download className="h-4 w-4 mr-2" />
            {downloadMutation.isPending ? "Generating Report..." : "Download Excel Report"}
          </Button>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
