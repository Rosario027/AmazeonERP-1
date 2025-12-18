import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EmployeeFile() {
  const [match, params] = useRoute("/admin/employee-file/:id");
  const employeeId = params?.id as string;

  const employeeQuery = useQuery<any>({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/staff/employees/${employeeId}`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load employee");
      return res.json();
    },
    enabled: !!employeeId,
  });

  // Attendance summary for current month
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const attendanceQuery = useQuery<any[]>({
    queryKey: ["attendance", employeeId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/staff/attendance/${employeeId}?startDate=${startDate}&endDate=${endDate}`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load attendance");
      return res.json();
    },
    enabled: !!employeeId,
  });

  const purchasesQuery = useQuery<any[]>({
    queryKey: ["employee-purchases", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/staff/purchases/${employeeId}`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load purchases");
      return res.json();
    },
    enabled: !!employeeId,
  });

  const employee = employeeQuery.data;
  const attendance = attendanceQuery.data || [];
  const purchases = purchasesQuery.data || [];
  const creditPurchases = purchases.filter((p) => (p.paymentMode || '').toLowerCase() === 'credit');
  const creditTotal = creditPurchases.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const presentDays = attendance.filter((a) => a.status === 'present').length;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee File</h1>
          <p className="text-muted-foreground">Detailed employee information and records</p>
        </div>
        <Link href="/admin/staff"><Button variant="outline">Back to Staff</Button></Link>
      </div>

      {employeeQuery.isLoading ? (
        <p className="text-muted-foreground">Loading employee...</p>
      ) : employee ? (
        <>
          {/* Employee Details */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Full Name</Label>
                  <p className="font-medium">{employee.fullName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Employee Code</Label>
                  <p className="font-mono">{employee.employeeCode}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p>{employee.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Alternate Phone</Label>
                  <p>{employee.alternatePhone || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Address</Label>
                <p>{employee.address || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Role</Label>
                  <Badge variant="outline">{employee.role}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>{employee.status}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Date Joined</Label>
                  <p>{employee.dateJoined || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Salary</Label>
                  <p>{employee.salary ? `₹${employee.salary}` : '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pay Details */}
          <Card>
            <CardHeader>
              <CardTitle>Pay Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Monthly Salary</Label>
                  <p className="font-medium">{employee.salary ? `₹${employee.salary}` : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Present Days (this month)</Label>
                  <p className="font-medium">{attendanceQuery.isLoading ? '...' : presentDays}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Attendance window: {startDate} to {endDate}</p>
            </CardContent>
          </Card>

          {/* Credit Purchases */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">All purchases recorded with payment mode = Credit</p>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total Outstanding</div>
                  <div className="text-lg font-semibold">₹{creditTotal.toFixed(2)}</div>
                </div>
              </div>
              {purchasesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading purchases...</p>
              ) : creditPurchases.length > 0 ? (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-left py-2 px-3">Category</th>
                        <th className="text-left py-2 px-3">Amount</th>
                        <th className="text-left py-2 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditPurchases.map((p: any) => (
                        <tr key={p.id} className="border-b last:border-b-0">
                          <td className="py-2 px-3">{p.purchaseDate}</td>
                          <td className="py-2 px-3">{p.category}</td>
                          <td className="py-2 px-3">₹{Number(p.amount).toFixed(2)}</td>
                          <td className="py-2 px-3 text-muted-foreground">{p.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No credit purchases recorded.</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-destructive">Employee not found</p>
      )}
    </div>
  );
}
