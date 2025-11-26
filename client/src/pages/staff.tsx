import { useAuth } from "@/lib/auth-context";

export default function Staff() {
  const { user } = useAuth();
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Staff</h1>
      <p className="text-sm text-muted-foreground">Welcome, {user?.username}. Staff features will appear here.</p>
    </div>
  );
}
