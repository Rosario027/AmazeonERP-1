import React from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  status: string;
  phone?: string | null;
  email?: string | null;
  salary?: string | null;
};

export default function AdminStaff() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: employees, isLoading, error } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/staff/employees", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);
  const selectedEmployee = employees?.find((e) => e.id === selectedEmployeeId) || null;

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
      if (!res.ok) {
        throw new Error(data?.message || "Failed to create employee");
      }

      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employeeNextCode"] });
      if (data?.id) setSelectedEmployeeId(data.id);
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

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Employee> & { id: string }) => {
      const { id, ...rest } = payload;
      const res = await fetch(`/api/staff/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(rest),
      });
      if (!res.ok) throw new Error("Failed to update employee");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Employee updated" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/staff/employees/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed to delete employee");
      return res.json();
    },
    onSuccess: () => {
      if (selectedEmployeeId) setSelectedEmployeeId(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Employee deleted" });
    }
  });

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Admin • Staff Management</h1>
      <p className="text-sm text-muted-foreground">Hello {user?.username}. Manage employees below.</p>

      <div className="grid gap-6 md:grid-cols-2">
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
        {selectedEmployee && (
          <Card>
            <CardHeader>
              <CardTitle>Edit Employee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <EditEmployeeForm
                employee={selectedEmployee}
                isSubmitting={updateMutation.isPending || deleteMutation.isPending}
                onSave={(data) => updateMutation.mutate({ id: selectedEmployee.id, ...data })}
                onDelete={() => deleteMutation.mutate(selectedEmployee.id)}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Loading...</p>}
          {error && <p className="text-sm text-red-600">Failed to load employees</p>}
          {!isLoading && employees && employees.length === 0 && (
            <p className="text-sm text-muted-foreground">No employees yet. Add one above.</p>
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
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className={`border-b cursor-pointer ${selectedEmployeeId === e.id ? 'bg-muted/40' : ''}`} onClick={() => setSelectedEmployeeId(e.id)}>
                      <td className="py-2 pr-4 font-mono">{e.employeeCode}</td>
                      <td className="py-2 pr-4">{e.fullName}</td>
                      <td className="py-2 pr-4 capitalize">{e.role}</td>
                      <td className="py-2 pr-4 capitalize">{e.status}</td>
                      <td className="py-2 pr-4">
                        <Button variant="outline" size="sm" onClick={(ev) => { ev.stopPropagation(); setSelectedEmployeeId(e.id); }}>Edit</Button>
                      </td>
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
          <AttendancePanel employee={selectedEmployee} />
          <PurchasesPanel employee={selectedEmployee} />
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

function EditEmployeeForm({ employee, onSave, onDelete, isSubmitting }: { employee: Employee; onSave: (data: Partial<Employee>) => void; onDelete: () => void; isSubmitting?: boolean }) {
  const [fullName, setFullName] = React.useState(employee.fullName);
  const [role, setRole] = React.useState(employee.role);
  const [status, setStatus] = React.useState(employee.status);
  const [phone, setPhone] = React.useState(employee.phone || "");
  const [email, setEmail] = React.useState(employee.email || "");
  const [salary, setSalary] = React.useState(employee.salary || "");

  React.useEffect(() => {
    setFullName(employee.fullName);
    setRole(employee.role);
    setStatus(employee.status);
    setPhone(employee.phone || "");
    setEmail(employee.email || "");
    setSalary(employee.salary || "");
  }, [employee.id]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ fullName, role, status, phone, email, salary });
      }}
    >
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Salary" value={salary} onChange={(e) => setSalary(e.target.value)} />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>Save</Button>
        <Button type="button" variant="destructive" disabled={isSubmitting} onClick={onDelete}>Delete</Button>
      </div>
    </form>
  );
}

function authHeader() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Attendance Panel
function AttendancePanel({ employee }: { employee: Employee }) {
  const qc = useQueryClient();
  const [startDate, setStartDate] = React.useState<string>(() => new Date(Date.now() - 6*24*60*60*1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [attendanceDate, setAttendanceDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = React.useState<string>('present');
  const [checkIn, setCheckIn] = React.useState<string>('');
  const [checkOut, setCheckOut] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');

  const { data: rows, isLoading } = useQuery<any[]>({
    queryKey: ['attendance', employee.id, startDate, endDate],
    queryFn: async () => {
      const url = `/api/staff/attendance/${employee.id}?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { headers: authHeader() });
      if (!res.ok) throw new Error('Failed to load attendance');
      return res.json();
    }
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        employeeId: employee.id,
        attendanceDate,
        status,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        notes: notes || null,
      };
      const res = await fetch('/api/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save attendance');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', employee.id] });
      toast({ title: 'Attendance saved' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/staff/attendance/${id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error('Failed to delete attendance');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', employee.id] });
      toast({ title: 'Attendance deleted' });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance • {employee.fullName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 text-sm"
          onSubmit={(e) => { e.preventDefault(); upsertMutation.mutate(); }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1">Date</label>
              <Input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half-day">Half-day</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Check-in (HH:MM)" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
            <Input placeholder="Check-out (HH:MM)" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
          </div>
            <Textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <Button type="submit" disabled={upsertMutation.isPending}>Save</Button>
        </form>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
          </div>
          {isLoading && <p className="text-xs">Loading...</p>}
          {!isLoading && rows && rows.length === 0 && <p className="text-xs text-muted-foreground">No attendance records in range.</p>}
          {!isLoading && rows && rows.length > 0 && (
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2 text-left">Date</th>
                  <th className="py-1 pr-2 text-left">Status</th>
                  <th className="py-1 pr-2 text-left">In</th>
                  <th className="py-1 pr-2 text-left">Out</th>
                  <th className="py-1 pr-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="py-1 pr-2">{r.attendanceDate}</td>
                    <td className="py-1 pr-2 capitalize">{r.status}</td>
                    <td className="py-1 pr-2">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                    <td className="py-1 pr-2">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                    <td className="py-1 pr-2">
                      <Button variant="outline" size="xs" onClick={() => deleteMutation.mutate(r.id)}>Del</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Purchases Panel
function PurchasesPanel({ employee }: { employee: Employee }) {
  const qc = useQueryClient();
  const [startDate, setStartDate] = React.useState<string>(() => new Date(Date.now() - 6*24*60*60*1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [purchaseDate, setPurchaseDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = React.useState<string>('shop-purchase');
  const [amount, setAmount] = React.useState<string>('');
  const [paymentMode, setPaymentMode] = React.useState<string>('cash');
  const [description, setDescription] = React.useState<string>('');

  const { data: rows, isLoading } = useQuery<any[]>({
    queryKey: ['purchases', employee.id, startDate, endDate],
    queryFn: async () => {
      const url = `/api/staff/purchases/${employee.id}?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { headers: authHeader() });
      if (!res.ok) throw new Error('Failed to load purchases');
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        employeeId: employee.id,
        purchaseDate,
        category,
        amount: amount || '0',
        paymentMode,
        description: description || null,
      };
      const res = await fetch('/api/staff/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create purchase');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases', employee.id] });
      toast({ title: 'Purchase recorded' });
      setAmount('');
      setDescription('');
    }
  });

  const total = (rows || []).reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchases • {employee.fullName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 text-sm"
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1">Date</label>
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shop-purchase">Shop Purchase</SelectItem>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="reimbursement">Reimbursement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" step="0.01" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger>
                <SelectValue placeholder="Payment Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="salary-deduction">Salary Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
          <Button type="submit" disabled={createMutation.isPending}>Add</Button>
        </form>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
            <span className="ml-auto text-xs font-medium">Total: ₹{total.toFixed(2)}</span>
          </div>
          {isLoading && <p className="text-xs">Loading...</p>}
          {!isLoading && rows && rows.length === 0 && <p className="text-xs text-muted-foreground">No purchases in range.</p>}
          {!isLoading && rows && rows.length > 0 && (
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2 text-left">Date</th>
                  <th className="py-1 pr-2 text-left">Category</th>
                  <th className="py-1 pr-2 text-left">Amount</th>
                  <th className="py-1 pr-2 text-left">Mode</th>
                  <th className="py-1 pr-2 text-left">Desc</th>
                </tr>
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
        </div>
      </CardContent>
    </Card>
  );
}
