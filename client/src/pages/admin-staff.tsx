import { useAuth } from "@/lib/auth-context";

export default function AdminStaff() {
  const { user } = useAuth();
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Admin • Staff Management</h1>
      <p className="text-sm text-muted-foreground">Hello {user?.username}. Manage employees, attendance, and purchases here.</p>
    </div>
  );
}
