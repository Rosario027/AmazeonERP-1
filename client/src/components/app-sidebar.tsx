import { FileText, BarChart3, Package, FileSpreadsheet, TrendingUp, LogOut, DollarSign, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const userMenuItems = [
    {
      title: "Create Invoice",
      url: "/create-invoice",
      icon: FileText,
    },
    {
      title: "Sales Overview",
      url: "/sales-overview",
      icon: BarChart3,
    },
    {
      title: "Expenses",
      url: "/expenses",
      icon: DollarSign,
    },
    {
      title: "Finance",
      url: "/finance",
      icon: DollarSign,
    },
  ];

  const adminMenuItems = [
    {
      title: "Dashboard",
      url: "/admin/dashboard",
      icon: TrendingUp,
    },
    {
      title: "Sales Overview",
      url: "/sales-overview",
      icon: BarChart3,
    },
    {
      title: "Inventory Management",
      url: "/admin/inventory",
      icon: Package,
    },
    {
      title: "B2B Invoice",
      url: "/admin/b2b-invoice",
      icon: FileSpreadsheet,
    },
    {
      title: "Reports",
      url: "/admin/reports",
      icon: FileSpreadsheet,
    },
    {
      title: "Expenses",
      url: "/admin/expenses",
      icon: DollarSign,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings,
    },
    {
      title: "Finance",
      url: "/admin/finance",
      icon: DollarSign,
    },
  ];

  const items = user?.role === "admin" ? adminMenuItems : userMenuItems;

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-semibold">
            {user?.role === "admin" ? "Admin Panel" : "User Dashboard"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {user?.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
