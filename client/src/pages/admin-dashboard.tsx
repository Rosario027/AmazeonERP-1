import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Package, ShoppingCart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  todayExpenses: number;
  weekExpenses: number;
  monthExpenses: number;
  todayQuantity: number;
  weekQuantity: number;
  monthQuantity: number;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: loading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
  });

  const salesCards = [
    {
      title: "Today's Sales",
      value: stats?.todaySales ?? 0,
      icon: DollarSign,
      color: "text-chart-1",
      isCurrency: true,
    },
    {
      title: "Week Sales",
      value: stats?.weekSales ?? 0,
      icon: TrendingUp,
      color: "text-chart-3",
      isCurrency: true,
    },
    {
      title: "Month Sales",
      value: stats?.monthSales ?? 0,
      icon: Calendar,
      color: "text-chart-2",
      isCurrency: true,
    },
  ];

  const quantityCards = [
    {
      title: "Today's Qty Sold",
      value: stats?.todayQuantity ?? 0,
      icon: ShoppingCart,
      color: "text-blue-500",
      isCurrency: false,
    },
    {
      title: "Week Qty Sold",
      value: stats?.weekQuantity ?? 0,
      icon: Package,
      color: "text-blue-600",
      isCurrency: false,
    },
    {
      title: "Month Qty Sold",
      value: stats?.monthQuantity ?? 0,
      icon: Package,
      color: "text-blue-700",
      isCurrency: false,
    },
  ];

  const expenseCards = [
    {
      title: "Today's Expenses",
      value: stats?.todayExpenses ?? 0,
      icon: TrendingDown,
      color: "text-destructive",
      isCurrency: true,
    },
    {
      title: "Week Expenses",
      value: stats?.weekExpenses ?? 0,
      icon: TrendingDown,
      color: "text-destructive",
      isCurrency: true,
    },
    {
      title: "Month Expenses",
      value: stats?.monthExpenses ?? 0,
      icon: TrendingDown,
      color: "text-destructive",
      isCurrency: true,
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of sales and expenses</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading statistics...</div>
      ) : (
        <div className="space-y-8">
          {/* Sales Section */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-chart-1" />
              Sales Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {salesCards.map((card) => (
                <Card key={card.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </CardTitle>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${card.color}`} data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      ₹{card.value.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Quantity Sold Section */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              Quantity Sold
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quantityCards.map((card) => (
                <Card key={card.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </CardTitle>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${card.color}`} data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      {card.value.toLocaleString()} units
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Expenses Section */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Expenses Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {expenseCards.map((card) => (
                <Card key={card.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </CardTitle>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${card.color}`} data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      ₹{card.value.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
