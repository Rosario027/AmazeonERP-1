import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Key, Trash2, Pencil, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

// Logout All Sessions Button Component
function LogoutAllSessionsButton() {
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const logoutAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout-all-sessions", {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All sessions have been logged out successfully. You will need to login again.",
      });
      setShowConfirmDialog(false);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout all sessions. Please try again.",
      });
    },
  });

  return (
    <>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout All Sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will logout your account from all devices. You will need to login again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => logoutAllMutation.mutate()}>
              Logout All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant="destructive"
        onClick={() => setShowConfirmDialog(true)}
        disabled={logoutAllMutation.isPending}
        data-testid="button-logout-all-sessions"
      >
        <LogOut className="h-4 w-4 mr-2" />
        {logoutAllMutation.isPending ? "Logging out..." : "Logout All Sessions"}
      </Button>
    </>
  );
}

export default function Settings() {
  const { toast } = useToast();
  
  // User Management State
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: "",
    password: "",
    role: "user" as "admin" | "user",
  });
  const [editUserFormData, setEditUserFormData] = useState({
    username: "",
    role: "user" as "admin" | "user",
  });
  const [newPassword, setNewPassword] = useState("");
  
  // Invoice Series Configuration State
  const [startingInvoiceNumber, setStartingInvoiceNumber] = useState("");
  
  // GST Calculation Mode State
  const [cashGstMode, setCashGstMode] = useState<"inclusive" | "exclusive">("inclusive");
  const [onlineGstMode, setOnlineGstMode] = useState<"inclusive" | "exclusive">("exclusive");

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch invoice series configuration
  const { data: settings = [] } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ["/api/settings"],
  });

  // Extract settings from configuration
  useEffect(() => {
    if (settings && settings.length > 0) {
      const invoiceSeriesSetting = settings.find(s => s.key === "invoice_series_start");
      if (invoiceSeriesSetting) {
        setStartingInvoiceNumber(invoiceSeriesSetting.value ?? "");
      }
      
      const cashGstModeSetting = settings.find(s => s.key === "cash_gst_mode");
      if (cashGstModeSetting) {
        setCashGstMode(cashGstModeSetting.value as "inclusive" | "exclusive");
      }
      
      const onlineGstModeSetting = settings.find(s => s.key === "online_gst_mode");
      if (onlineGstModeSetting) {
        setOnlineGstMode(onlineGstModeSetting.value as "inclusive" | "exclusive");
      }
    }
  }, [settings]);

  // Calculate Financial Year
  const financialYear = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    
    // Financial year starts in April (month 3)
    if (currentMonth >= 3) {
      // April onwards: current year to next year
      const fy1 = currentYear.toString().slice(-2);
      const fy2 = (currentYear + 1).toString().slice(-2);
      return `FY${fy1}-${fy2}`;
    } else {
      // Jan-March: previous year to current year
      const fy1 = (currentYear - 1).toString().slice(-2);
      const fy2 = currentYear.toString().slice(-2);
      return `FY${fy1}-${fy2}`;
    }
  }, []);

  // Preview next invoice number
  const previewInvoiceNumber = useMemo(() => {
    if (!startingInvoiceNumber || isNaN(Number(startingInvoiceNumber))) {
      return `${financialYear}/XXX`;
    }
    const paddedNumber = String(startingInvoiceNumber).padStart(3, '0');
    return `${financialYear}/${paddedNumber}`;
  }, [financialYear, startingInvoiceNumber]);

  // Add User Mutation
  const addUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string }) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User added successfully",
      });
      setIsAddUserDialogOpen(false);
      setUserFormData({ username: "", password: "", role: "user" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add user",
      });
    },
  });

  // Edit User Mutation
  const editUserMutation = useMutation({
    mutationFn: async (data: { id: string; username: string; role: string }) => {
      return await apiRequest("PATCH", `/api/users/${data.id}`, { username: data.username, role: data.role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
      setEditUserFormData({ username: "", role: "user" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user",
      });
    },
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      return await apiRequest("PATCH", `/api/users/${id}/password`, { password });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset successfully",
      });
      setIsResetPasswordDialogOpen(false);
      setSelectedUser(null);
      setNewPassword("");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset password",
      });
    },
  });

  // Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setDeleteUserId(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete user",
      });
    },
  });

  // Save Invoice Series Configuration Mutation
  const saveInvoiceSeriesMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      return await apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "Invoice series configuration saved successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save configuration",
      });
    },
  });

  // Save GST Mode Configuration Mutation
  const saveGstModesMutation = useMutation({
    mutationFn: async (data: Array<{ key: string; value: string }>) => {
      const promises = data.map(setting => 
        apiRequest("POST", "/api/settings", setting)
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "GST calculation modes saved successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save GST modes",
      });
    },
  });

  const handleAddUser = () => {
    if (!userFormData.username || !userFormData.password) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }
    addUserMutation.mutate(userFormData);
  };

  const handleEditUser = () => {
    if (!selectedUser || !editUserFormData.username) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }
    editUserMutation.mutate({
      id: selectedUser.id,
      username: editUserFormData.username,
      role: editUserFormData.role,
    });
  };

  const handleResetPassword = () => {
    if (!selectedUser || !newPassword) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter a new password",
      });
      return;
    }
    resetPasswordMutation.mutate({ id: selectedUser.id, password: newPassword });
  };

  const handleDeleteUser = () => {
    if (deleteUserId) {
      deleteUserMutation.mutate(deleteUserId);
    }
  };

  const handleSaveInvoiceSeries = () => {
    if (!startingInvoiceNumber || isNaN(Number(startingInvoiceNumber))) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter a valid starting invoice number",
      });
      return;
    }
    saveInvoiceSeriesMutation.mutate({
      key: "invoice_series_start",
      value: startingInvoiceNumber,
    });
  };

  const handleSaveGstModes = () => {
    saveGstModesMutation.mutate([
      { key: "cash_gst_mode", value: cashGstMode },
      { key: "online_gst_mode", value: onlineGstMode },
    ]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage users and system configuration</p>
      </div>

      {/* User Management Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">User Management</CardTitle>
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-user">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username <span className="text-destructive">*</span></Label>
                    <Input
                      id="username"
                      value={userFormData.username}
                      onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                      placeholder="Enter username"
                      data-testid="input-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                    <Input
                      id="password"
                      type="password"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      placeholder="Enter password"
                      data-testid="input-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role <span className="text-destructive">*</span></Label>
                    <Select
                      value={userFormData.role}
                      onValueChange={(value: "admin" | "user") => setUserFormData({ ...userFormData, role: value })}
                    >
                      <SelectTrigger id="role" data-testid="select-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user" data-testid="option-role-user">User</SelectItem>
                        <SelectItem value="admin" data-testid="option-role-admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleAddUser} 
                    disabled={addUserMutation.isPending}
                    data-testid="button-submit-user"
                  >
                    {addUserMutation.isPending ? "Adding..." : "Add User"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Username</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="hover-elevate" data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {user.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>
                        {user.username}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} data-testid={`badge-role-${user.id}`}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditUserFormData({ username: user.username, role: user.role as "admin" | "user" });
                              setIsEditUserDialogOpen(true);
                            }}
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsResetPasswordDialogOpen(true);
                            }}
                            data-testid={`button-reset-password-${user.id}`}
                          >
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteUserId(user.id)}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Management Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Session Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Logout all active sessions across all devices. This is a one-time action useful when you've sold or lost a device with active login.
          </p>
          <LogoutAllSessionsButton />
        </CardContent>
      </Card>

      {/* Invoice Series Configuration Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Invoice Series Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Current Financial Year</Label>
            <p className="text-2xl font-semibold mt-1" data-testid="text-financial-year">{financialYear}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="startingNumber">Starting Invoice Number <span className="text-destructive">*</span></Label>
            <Input
              id="startingNumber"
              type="number"
              min="1"
              value={startingInvoiceNumber}
              onChange={(e) => setStartingInvoiceNumber(e.target.value)}
              placeholder="Enter starting number (e.g., 1)"
              data-testid="input-starting-invoice-number"
            />
            <p className="text-xs text-muted-foreground">
              This will set the starting number for new invoices in the current financial year
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <Label className="text-sm font-medium text-muted-foreground">Preview</Label>
            <p className="text-lg font-semibold mt-1" data-testid="text-invoice-preview">
              Next invoice will be: {previewInvoiceNumber}
            </p>
          </div>

          <Button 
            onClick={handleSaveInvoiceSeries} 
            disabled={saveInvoiceSeriesMutation.isPending}
            data-testid="button-save-configuration"
          >
            {saveInvoiceSeriesMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </CardContent>
      </Card>

      {/* GST Calculation Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">GST Calculation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="cashGstMode">Cash Payment GST Mode</Label>
            <Select
              value={cashGstMode}
              onValueChange={(value: "inclusive" | "exclusive") => setCashGstMode(value)}
            >
              <SelectTrigger id="cashGstMode" data-testid="select-cash-gst-mode">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusive" data-testid="option-cash-inclusive">
                  Inclusive
                </SelectItem>
                <SelectItem value="exclusive" data-testid="option-cash-exclusive">
                  Exclusive
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Inclusive:</span> GST is already included in the rate (taxable value = rate ÷ (1 + GST%))
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Exclusive:</span> GST is added on top of the rate (taxable value = rate, GST added separately)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onlineGstMode">Online Payment GST Mode</Label>
            <Select
              value={onlineGstMode}
              onValueChange={(value: "inclusive" | "exclusive") => setOnlineGstMode(value)}
            >
              <SelectTrigger id="onlineGstMode" data-testid="select-online-gst-mode">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusive" data-testid="option-online-inclusive">
                  Inclusive
                </SelectItem>
                <SelectItem value="exclusive" data-testid="option-online-exclusive">
                  Exclusive
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Inclusive:</span> GST is already included in the rate (taxable value = rate ÷ (1 + GST%))
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Exclusive:</span> GST is added on top of the rate (taxable value = rate, GST added separately)
            </p>
          </div>

          <Button 
            onClick={handleSaveGstModes} 
            disabled={saveGstModesMutation.isPending}
            data-testid="button-save-gst-modes"
          >
            {saveGstModesMutation.isPending ? "Saving..." : "Save GST Modes"}
          </Button>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editUsername">Username <span className="text-destructive">*</span></Label>
              <Input
                id="editUsername"
                value={editUserFormData.username}
                onChange={(e) => setEditUserFormData({ ...editUserFormData, username: e.target.value })}
                placeholder="Enter username"
                data-testid="input-edit-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Role <span className="text-destructive">*</span></Label>
              <Select
                value={editUserFormData.role}
                onValueChange={(value: "admin" | "user") => setEditUserFormData({ ...editUserFormData, role: value })}
              >
                <SelectTrigger id="editRole" data-testid="select-edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user" data-testid="option-edit-role-user">User</SelectItem>
                  <SelectItem value="admin" data-testid="option-edit-role-admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full" 
              onClick={handleEditUser} 
              disabled={editUserMutation.isPending}
              data-testid="button-submit-edit-user"
            >
              {editUserMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reset password for user: <span className="font-semibold">{selectedUser?.username}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password <span className="text-destructive">*</span></Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                data-testid="input-new-password"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleResetPassword} 
              disabled={resetPasswordMutation.isPending}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
