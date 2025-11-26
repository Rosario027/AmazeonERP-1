import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";

type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  status: string;
};

export default function Staff() {
  const { user } = useAuth();
  const { data: employees, isLoading, error } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/staff/employees", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Staff</h1>
      <p className="text-sm text-muted-foreground">Welcome, {user?.username}.</p>

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
    </div>
  );
}

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
