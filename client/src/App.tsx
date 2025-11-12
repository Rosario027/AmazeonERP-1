import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Login from "@/pages/login";
import CreateInvoice from "@/pages/create-invoice";
import SalesOverview from "@/pages/sales-overview";
import AdminDashboard from "@/pages/admin-dashboard";
import InventoryManagement from "@/pages/inventory-management";
import B2BInvoice from "@/pages/b2b-invoice";
import Reports from "@/pages/reports";
import Expenses from "@/pages/expenses";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any; adminOnly?: boolean }) {
  const { user } = useAuth();

  if (!user) {
    return <Redirect to="/" />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Redirect to="/create-invoice" />;
  }

  return <Component />;
}

function Router() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b h-16">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/create-invoice">
                {() => <ProtectedRoute component={CreateInvoice} />}
              </Route>
              <Route path="/sales-overview">
                {() => <ProtectedRoute component={SalesOverview} />}
              </Route>
              <Route path="/admin/dashboard">
                {() => <ProtectedRoute component={AdminDashboard} adminOnly />}
              </Route>
              <Route path="/admin/inventory">
                {() => <ProtectedRoute component={InventoryManagement} adminOnly />}
              </Route>
              <Route path="/admin/b2b-invoice">
                {() => <ProtectedRoute component={B2BInvoice} adminOnly />}
              </Route>
              <Route path="/admin/reports">
                {() => <ProtectedRoute component={Reports} adminOnly />}
              </Route>
              <Route path="/admin/expenses">
                {() => <ProtectedRoute component={Expenses} adminOnly />}
              </Route>
              <Route path="/">
                {() => user.role === "admin" ? <Redirect to="/admin/dashboard" /> : <Redirect to="/create-invoice" />}
              </Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
