import React from "react";
import { useAuth } from "@/lib/auth-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  status: string;
};

export default function Staff() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: nextCode } = useQuery<{ employeeCode: string }>({
    queryKey: ["employeeNextCode"],
    queryFn: async () => {
      const res = await fetch("/api/staff/employees/next-code", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load next employee code");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { fullName: string; phone?: string; email?: string }) => {
      const res = await fetch("/api/staff/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to create employee");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employeeNextCode"] });
      toast({ title: "Employee added" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to add employee",
        description: error?.message || "Server error",
      });
    },
  });

  const { data: employees, isLoading, error } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/staff/employees", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);
  const selectedEmployee = employees?.find(e => e.id === selectedEmployeeId) || null;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Staff</h1>
      <p className="text-sm text-muted-foreground">
        Welcome, {user?.username}. You can add employees and view their attendance & purchases.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Add Employee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <EmployeeForm
            nextCode={nextCode?.employeeCode}
            onSubmit={(data) => createMutation.mutate(data)}
            isSubmitting={createMutation.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Loading...</p>}
          {error && <p className="text-sm text-red-600">Failed to load employees</p>}
          {!isLoading && employees && employees.length === 0 && (
            <p className="text-sm text-muted-foreground">No employees yet.</p>
          )}
          {!isLoading && employees && employees.length > 0 && (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr
                      key={e.id}
                      className={`border-b cursor-pointer ${selectedEmployeeId === e.id ? 'bg-muted/40' : ''}`}
                      onClick={() => setSelectedEmployeeId(e.id)}
                    >
                      <td className="py-2 pr-4 font-mono">{e.employeeCode}</td>
                      <td className="py-2 pr-4">{e.fullName}</td>
                      <td className="py-2 pr-4 capitalize">{e.role}</td>
                      <td className="py-2 pr-4 capitalize">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEmployee && (
        <div className="grid gap-6 md:grid-cols-2">
          <UserAttendance employee={selectedEmployee} />
          <UserPurchases employee={selectedEmployee} />
        </div>
      )}
    </div>
  );
}

function EmployeeForm({
  nextCode,
  onSubmit,
  isSubmitting,
}: {
  nextCode?: string;
  onSubmit: (data: { fullName: string; phone?: string; email?: string }) => void;
  isSubmitting?: boolean;
}) {
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");

  const phoneValid = phone.length === 0 || phone.length === 10;

  return (
    <form
      className="grid grid-cols-1 sm:grid-cols-4 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!fullName || !phoneValid) return;
        onSubmit({
          fullName,
          phone: phone || undefined,
          email: email || undefined,
        });
        setFullName("");
        setPhone("");
        setEmail("");
      }}
    >
      <Input placeholder="Employee Code (auto)" value={nextCode || ""} readOnly />
      <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Input
        placeholder="Phone (10 digits)"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
      />
      <Button type="submit" disabled={isSubmitting || !nextCode || !fullName || !phoneValid}>
        Add
      </Button>
      <div className="sm:col-span-4">
        <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
    </form>
  );
}

function UserAttendance({ employee }: { employee: Employee }) {
  const [startDate, setStartDate] = React.useState<string>(() => new Date(Date.now() - 6*24*60*60*1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const { data: rows, isLoading } = useQuery<any[]>({
    queryKey: ['attendance', employee.id, startDate, endDate],
    queryFn: async () => {
      const url = `/api/staff/attendance/${employee.id}?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { headers: authHeader() });
      if (!res.ok) throw new Error('Failed to load attendance');
      return res.json();
    }
  });
  return (
    <Card>
      <CardHeader><CardTitle>Attendance • {employee.fullName}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
        </div>
        {isLoading && <p>Loading...</p>}
        {!isLoading && rows && rows.length === 0 && <p className="text-muted-foreground">No records.</p>}
        {!isLoading && rows && rows.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b"><th className="py-1 pr-2 text-left">Date</th><th className="py-1 pr-2 text-left">Status</th><th className="py-1 pr-2 text-left">In</th><th className="py-1 pr-2 text-left">Out</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="py-1 pr-2">{r.attendanceDate}</td>
                  <td className="py-1 pr-2 capitalize">{r.status}</td>
                  <td className="py-1 pr-2">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                  <td className="py-1 pr-2">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function UserPurchases({ employee }: { employee: Employee }) {
  const [startDate, setStartDate] = React.useState<string>(() => new Date(Date.now() - 6*24*60*60*1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const { data: rows, isLoading } = useQuery<any[]>({
    queryKey: ['purchases', employee.id, startDate, endDate],
    queryFn: async () => {
      const url = `/api/staff/purchases/${employee.id}?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { headers: authHeader() });
      if (!res.ok) throw new Error('Failed to load purchases');
      return res.json();
    }
  });
  const total = (rows || []).reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
  return (
    <Card>
      <CardHeader><CardTitle>Purchases • {employee.fullName}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
          <span className="ml-auto font-medium">Total: ₹{total.toFixed(2)}</span>
        </div>
        {isLoading && <p>Loading...</p>}
        {!isLoading && rows && rows.length === 0 && <p className="text-muted-foreground">No purchases.</p>}
        {!isLoading && rows && rows.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b"><th className="py-1 pr-2 text-left">Date</th><th className="py-1 pr-2 text-left">Category</th><th className="py-1 pr-2 text-left">Amount</th><th className="py-1 pr-2 text-left">Mode</th><th className="py-1 pr-2 text-left">Desc</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="py-1 pr-2">{r.purchaseDate}</td>
                  <td className="py-1 pr-2 capitalize">{r.category}</td>
                  <td className="py-1 pr-2">₹{parseFloat(r.amount).toFixed(2)}</td>
                  <td className="py-1 pr-2 capitalize">{r.paymentMode}</td>
                  <td className="py-1 pr-2">{r.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function authHeader() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
