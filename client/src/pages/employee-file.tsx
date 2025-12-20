import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Edit, Save, X, Filter, ArrowUpDown } from "lucide-react";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EmployeeFile() {
  const [match, params] = useRoute("/admin/employee-file/:id");
  const employeeId = params?.id as string;
  const qc = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    alternatePhone: "",
    address: "",
    role: "",
    status: "",
    salary: "",
  });
  
  // Filter and sort state for Credit Purchases / Advances
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const employeeQuery = useQuery<any>({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/staff/employees/${employeeId}`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load employee");
      return res.json();
    },
    enabled: !!employeeId,
  });

  // Update edit form when employee data is loaded
  useEffect(() => {
    if (employeeQuery.data) {
      const emp = employeeQuery.data;
      setEditForm({
        fullName: emp.fullName || "",
        phone: emp.phone || "",
        alternatePhone: emp.alternatePhone || "",
        address: emp.address || "",
        role: emp.role || "staff",
        status: emp.status || "active",
        salary: emp.salary?.toString() || "",
      });
    }
  }, [employeeQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/staff/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          fullName: editForm.fullName,
          phone: editForm.phone || null,
          alternatePhone: editForm.alternatePhone || null,
          address: editForm.address || null,
          role: editForm.role,
          status: editForm.status,
          salary: editForm.salary ? Number(editForm.salary) : null,
        }),
      });
      if (!res.ok) {
        let data: any = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.message || "Failed to update employee");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Employee updated successfully" });
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["employee", employeeId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Failed to update", variant: "destructive" });
    },
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ purchaseId, paymentStatus }: { purchaseId: string; paymentStatus: string }) => {
      const res = await fetch(`/api/staff/purchases/${purchaseId}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ paymentStatus }),
      });
      if (!res.ok) {
        let data: any = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.message || "Failed to update payment status");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment status updated" });
      qc.invalidateQueries({ queryKey: ["employee-purchases", employeeId] });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Failed to update payment status", variant: "destructive" });
    },
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
  
  // Filter for credit purchases and advances
  const creditAndAdvances = purchases.filter((p) => {
    const paymentMode = (p.paymentMode || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    return paymentMode === 'credit' || category === 'advance';
  });
  
  // Apply category filter
  const filteredPurchases = creditAndAdvances.filter((p) => {
    if (filterCategory === "all") return true;
    if (filterCategory === "credit") return (p.paymentMode || '').toLowerCase() === 'credit' && (p.category || '').toLowerCase() !== 'advance';
    if (filterCategory === "advance") return (p.category || '').toLowerCase() === 'advance';
    return true;
  });
  
  // Apply sorting
  const sortedPurchases = [...filteredPurchases].sort((a, b) => {
    let comparison = 0;
    if (sortField === "date") {
      comparison = new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
    } else if (sortField === "amount") {
      comparison = Number(a.amount) - Number(b.amount);
    } else if (sortField === "category") {
      comparison = (a.category || '').localeCompare(b.category || '');
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });
  
  // Calculate total outstanding (only unpaid items)
  const unpaidPurchases = creditAndAdvances.filter((p) => (p.paymentStatus || 'unpaid') === 'unpaid');
  const creditTotal = unpaidPurchases.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const paidCount = creditAndAdvances.filter((p) => p.paymentStatus === 'paid').length;
  const unpaidCount = unpaidPurchases.length;
  const presentDays = attendance.filter((a) => a.status === 'present').length;

  const handleCancel = () => {
    if (employee) {
      setEditForm({
        fullName: employee.fullName || "",
        phone: employee.phone || "",
        alternatePhone: employee.alternatePhone || "",
        address: employee.address || "",
        role: employee.role || "staff",
        status: employee.status || "active",
        salary: employee.salary?.toString() || "",
      });
    }
    setIsEditing(false);
  };

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
              <div className="flex items-center justify-between">
                <CardTitle>Employee Details</CardTitle>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancel}
                      disabled={updateMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => updateMutation.mutate()}
                      disabled={updateMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                // Edit mode
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input 
                        value={editForm.fullName} 
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Employee Code</Label>
                      <p className="font-mono py-2">{employee.employeeCode}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Phone</Label>
                      <Input 
                        value={editForm.phone} 
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label>Alternate Phone</Label>
                      <Input 
                        value={editForm.alternatePhone} 
                        onChange={(e) => setEditForm({ ...editForm, alternatePhone: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Textarea 
                      rows={2}
                      value={editForm.address} 
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Role</Label>
                      <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="cashier">Cashier</SelectItem>
                          <SelectItem value="accountant">Accountant</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Date Joined</Label>
                      <p className="py-2">{employee.dateJoined || '-'}</p>
                    </div>
                    <div>
                      <Label>Salary (₹)</Label>
                      <Input 
                        type="number"
                        placeholder="Monthly salary"
                        value={editForm.salary} 
                        onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="space-y-3">
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
                      <p className="font-semibold">{employee.salary ? `₹${employee.salary}` : '-'}</p>
                    </div>
                  </div>
                </div>
              )}
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

          {/* Staff Compensation / Salary */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Compensation / Salary</CardTitle>
              <p className="text-sm text-muted-foreground">
                Salary calculation based on attendance and pay details
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!employee.salary ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No salary information available for this employee.</p>
                  <p className="text-xs mt-1">Please set the monthly salary in the employee details above.</p>
                </div>
              ) : (
                <>
                  {/* Calculation Summary */}
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-medium mb-3">Monthly Salary Calculation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Monthly Salary:</span>
                          <span className="font-medium">₹{Number(employee.salary).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Days in Month:</span>
                          <span className="font-medium">{new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Daily Salary:</span>
                          <span className="font-medium">₹{(Number(employee.salary) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Present Days:</span>
                          <span className="font-medium text-green-600">{presentDays}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Absent Days:</span>
                          <span className="font-medium text-red-600">
                            {new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - presentDays}
                          </span>
                        </div>
                        <div className="flex justify-between text-base font-semibold border-t pt-2">
                          <span>Payable Salary:</span>
                          <span className="text-green-600">
                            ₹{((Number(employee.salary) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * presentDays).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deduction Details */}
                  {presentDays < new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-orange-600">Deductions</h4>
                      <div className="bg-orange-50 border border-orange-200 p-3 rounded text-sm">
                        <div className="flex justify-between">
                          <span>Absent Days Deduction:</span>
                          <span className="font-medium text-red-600">
                            -₹{((Number(employee.salary) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * (new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - presentDays)).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ({new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - presentDays} absent days × ₹{(Number(employee.salary) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).toFixed(2)} per day)
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Month Info */}
                  <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                    <p><strong>Calculation Period:</strong> {startDate} to {endDate} ({new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} days total)</p>
                    <p><strong>Last Updated:</strong> {new Date().toLocaleString()}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Credit Purchases / Advances */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Purchases / Advances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">All credit purchases and salary advances</p>
                  <div className="flex gap-3 mt-1 text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-green-600">{paidCount}</span> paid
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-medium text-orange-600">{unpaidCount}</span> unpaid
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total Outstanding</div>
                  <div className="text-lg font-semibold text-orange-600">₹{creditTotal.toFixed(2)}</div>
                </div>
              </div>
              
              {/* Filters and Sort */}
              <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Filter:</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="credit">Credit Only</SelectItem>
                      <SelectItem value="advance">Advances Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Sort by:</Label>
                  <Select value={sortField} onValueChange={setSortField}>
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 px-2"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
                  </Button>
                </div>
              </div>
              
              {purchasesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : sortedPurchases.length > 0 ? (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-left py-2 px-3">Type</th>
                        <th className="text-left py-2 px-3">Category</th>
                        <th className="text-left py-2 px-3">Amount</th>
                        <th className="text-left py-2 px-3">Description</th>
                        <th className="text-center py-2 px-3">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPurchases.map((p: any) => {
                        const isAdvance = (p.category || '').toLowerCase() === 'advance';
                        const isPaid = (p.paymentStatus || 'unpaid') === 'paid';
                        return (
                          <tr key={p.id} className="border-b last:border-b-0">
                            <td className="py-2 px-3">{p.purchaseDate}</td>
                            <td className="py-2 px-3">
                              <Badge variant={isAdvance ? 'secondary' : 'destructive'}>
                                {isAdvance ? 'Advance' : 'Credit'}
                              </Badge>
                            </td>
                            <td className="py-2 px-3">{p.category}</td>
                            <td className="py-2 px-3 font-medium">₹{Number(p.amount).toFixed(2)}</td>
                            <td className="py-2 px-3 text-muted-foreground">{p.description || '-'}</td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Checkbox 
                                  checked={isPaid}
                                  onCheckedChange={(checked) => {
                                    updatePaymentStatusMutation.mutate({
                                      purchaseId: p.id,
                                      paymentStatus: checked ? 'paid' : 'unpaid'
                                    });
                                  }}
                                  disabled={updatePaymentStatusMutation.isPending}
                                />
                                <span className={`text-xs ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                                  {isPaid ? 'Paid' : 'Unpaid'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Showing {sortedPurchases.length} of {creditAndAdvances.length} records
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No credit purchases or advances recorded.</p>
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
