import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  status: string;
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

  const createMutation = useMutation({
    mutationFn: async (payload: { employeeCode: string; fullName: string }) => {
      const res = await fetch("/api/staff/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create employee");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Admin • Staff Management</h1>
      <p className="text-sm text-muted-foreground">Hello {user?.username}. Manage employees below.</p>

      <Card>
        <CardHeader>
          <CardTitle>Add Employee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <EmployeeForm onSubmit={(data) => createMutation.mutate(data)} isSubmitting={createMutation.isPending} />
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
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-2 pr-4">{e.employeeCode}</td>
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
    </div>
  );
}

function EmployeeForm({ onSubmit, isSubmitting }: { onSubmit: (data: { employeeCode: string; fullName: string }) => void; isSubmitting?: boolean }) {
  const [code, setCode] = (React as any).useState("");
  const [name, setName] = (React as any).useState("");
  return (
    <form
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!code || !name) return;
        onSubmit({ employeeCode: code, fullName: name });
        setCode("");
        setName("");
      }}
    >
      <Input placeholder="Employee Code" value={code} onChange={(e) => setCode(e.target.value)} />
      <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" disabled={isSubmitting}>Add</Button>
    </form>
  );
}

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
