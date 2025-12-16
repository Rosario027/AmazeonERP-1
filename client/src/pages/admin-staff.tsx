import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { 
  UserPlus, Users, Clock, Eye, Edit, Trash2, Upload, X, 
  Calendar, CheckCircle, XCircle, PlayCircle, StopCircle,
  FileText, Image, Download
} from "lucide-react";

// Types
interface IdProofFile {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
}

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string | null;
  alternatePhone?: string | null;
  address?: string | null;
  email?: string | null;
  userId?: string | null;
  idProofFiles?: string | null;
  role: string;
  status: string;
  dateJoined?: string | null;
  salary?: string | null;
  createdBy?: string | null;
  isLocked: boolean;
  createdAt: string;
}

interface EmployeeWithAttendance extends Employee {
  attendance: {
    id: string;
    checkIn: string;
    checkOut?: string;
  };
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminStaff() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("employees");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Fetch employees
  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/staff/employees", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
  });

  // Fetch active employees (currently working)
  const { data: activeEmployees } = useQuery<EmployeeWithAttendance[]>({
    queryKey: ["activeEmployees"],
    queryFn: async () => {
      const res = await fetch("/api/staff/active", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load active employees");
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowViewDialog(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditDialog(true);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Manage employees, attendance, and purchases</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Live Working Time Display */}
      {activeEmployees && activeEmployees.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Currently Working
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeEmployees.map((emp) => (
                <LiveWorkingTimer key={emp.id} employee={emp} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-2" />
            Staff List
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <Calendar className="h-4 w-4 mr-2" />
            Attendance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <StaffList 
            employees={employees || []}
            isLoading={isLoading}
            onView={handleViewEmployee}
            onEdit={handleEditEmployee}
          />
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <AttendanceCalendar employees={employees || []} />
        </TabsContent>
      </Tabs>

      {/* Add Staff Dialog */}
      <AddStaffDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["employees"] });
          setShowAddDialog(false);
        }}
      />

      {/* Edit Staff Dialog */}
      {selectedEmployee && (
        <EditStaffDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          employee={selectedEmployee}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["employees"] });
            setShowEditDialog(false);
            setSelectedEmployee(null);
          }}
        />
      )}

      {/* View Staff Dialog */}
      {selectedEmployee && (
        <ViewStaffDialog
          open={showViewDialog}
          onOpenChange={setShowViewDialog}
          employee={selectedEmployee}
        />
      )}
    </div>
  );
}

// Live Working Timer Component
function LiveWorkingTimer({ employee }: { employee: EmployeeWithAttendance }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const checkIn = new Date(employee.attendance.checkIn);
    
    const updateTimer = () => {
      const now = new Date();
      const diff = now.getTime() - checkIn.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setElapsed(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [employee.attendance.checkIn]);

  return (
    <div className="flex items-center justify-between p-2 bg-white rounded border">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="font-medium">{employee.fullName}</span>
        <Badge variant="outline">{employee.employeeCode}</Badge>
      </div>
      <span className="text-green-600 font-mono font-medium">Working {elapsed}</span>
    </div>
  );
}

// Staff List Component
function StaffList({ 
  employees, 
  isLoading, 
  onView, 
  onEdit 
}: { 
  employees: Employee[];
  isLoading: boolean;
  onView: (e: Employee) => void;
  onEdit: (e: Employee) => void;
}) {
  const qc = useQueryClient();
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/staff/employees/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Employee deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No employees yet. Click "Add Staff" to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3">Employee ID</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Working Since</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-mono">{emp.employeeCode}</td>
                  <td className="p-3">{emp.fullName}</td>
                  <td className="p-3">{emp.phone || "-"}</td>
                  <td className="p-3">
                    <Badge variant={emp.status === "active" ? "default" : "secondary"}>
                      {emp.status}
                    </Badge>
                  </td>
                  <td className="p-3">{emp.dateJoined || "-"}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onView(emp)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onEdit(emp)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this employee?")) {
                            deleteMutation.mutate(emp.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// Add Staff Dialog with Steps
function AddStaffDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    alternatePhone: "",
    address: "",
    userId: "",
    password: "",
    confirmPassword: "",
    role: "staff",
    status: "active",
    salary: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState<IdProofFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        idProofFiles: uploadedFiles,
      };
      const res = await fetch("/api/staff/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create employee");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Employee added successfully" });
      resetForm();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setStep(1);
    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      alternatePhone: "",
      address: "",
      userId: "",
      password: "",
      confirmPassword: "",
      role: "staff",
      status: "active",
      salary: "",
    });
    setUploadedFiles([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check total files limit
    if (uploadedFiles.length + files.length > 5) {
      toast({ title: "Maximum 5 files allowed", variant: "destructive" });
      return;
    }

    // Check total size
    const totalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0) + 
      Array.from(files).reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 5 * 1024 * 1024) {
      toast({ title: "Total file size must not exceed 5MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const formDataUpload = new FormData();
    Array.from(files).forEach(f => formDataUpload.append("files", f));

    try {
      const res = await fetch("/api/staff/files/upload", {
        method: "POST",
        headers: authHeader(),
        body: formDataUpload,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadedFiles(prev => [...prev, ...data.files]);
      toast({ title: "Files uploaded" });
    } catch (error) {
      toast({ title: "Failed to upload files", variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeFile = async (filename: string) => {
    try {
      await fetch(`/api/staff/files/${filename}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      setUploadedFiles(prev => prev.filter(f => f.filename !== filename));
    } catch (error) {
      // File might already be deleted, just remove from UI
      setUploadedFiles(prev => prev.filter(f => f.filename !== filename));
    }
  };

  const validateStep1 = () => {
    if (!formData.firstName.trim()) {
      toast({ title: "First name is required", variant: "destructive" });
      return false;
    }
    if (!formData.lastName.trim()) {
      toast({ title: "Last name is required", variant: "destructive" });
      return false;
    }
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      toast({ title: "Phone must be 10 digits", variant: "destructive" });
      return false;
    }
    if (formData.alternatePhone && !/^\d{10}$/.test(formData.alternatePhone)) {
      toast({ title: "Alternate phone must be 10 digits", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateStep2()) return;
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-primary text-white" : "bg-muted"}`}>1</div>
            <span className="text-sm font-medium">Employee Details</span>
          </div>
          <div className="flex-1 h-0.5 bg-muted" />
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-primary text-white" : "bg-muted"}`}>2</div>
            <span className="text-sm font-medium">Credentials</span>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  placeholder="10-digit phone number"
                />
              </div>
              <div>
                <Label>Alternate Phone</Label>
                <Input
                  value={formData.alternatePhone}
                  onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  placeholder="10-digit alternate phone"
                />
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Salary</Label>
                <Input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  placeholder="Monthly salary"
                />
              </div>
            </div>

            {/* ID Proof Upload */}
            <div>
              <Label>Upload ID Proof (Aadhar)</Label>
              <p className="text-xs text-muted-foreground mb-2">Max 5 files, 5MB total. Allowed: PDF, JPG, PNG, DOCX</p>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="id-proof-upload"
                  disabled={isUploading || uploadedFiles.length >= 5}
                />
                <label htmlFor="id-proof-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isUploading ? "Uploading..." : "Click to upload files"}
                  </p>
                </label>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        {file.mimetype.includes("image") ? (
                          <Image className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span className="text-sm truncate max-w-[200px]">{file.originalName}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeFile(file.filename)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => { if (validateStep1()) setStep(2); }}>
                Next: Credentials
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>User ID (for staff login)</Label>
              <Input
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                placeholder="Enter user ID for login"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
              <div>
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save Employee"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Edit Staff Dialog
function EditStaffDialog({ 
  open, 
  onOpenChange, 
  employee, 
  onSuccess 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    firstName: employee.firstName || "",
    lastName: employee.lastName || "",
    phone: employee.phone || "",
    alternatePhone: employee.alternatePhone || "",
    address: employee.address || "",
    userId: employee.userId || "",
    password: "",
    role: employee.role,
    status: employee.status,
    salary: employee.salary || "",
  });

  useEffect(() => {
    setFormData({
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      phone: employee.phone || "",
      alternatePhone: employee.alternatePhone || "",
      address: employee.address || "",
      userId: employee.userId || "",
      password: "",
      role: employee.role,
      status: employee.status,
      salary: employee.salary || "",
    });
  }, [employee]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password;
      
      const res = await fetch(`/api/staff/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Employee updated" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Employee: {employee.employeeCode}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name</Label>
              <Input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              />
            </div>
            <div>
              <Label>Alternate Phone</Label>
              <Input
                value={formData.alternatePhone}
                onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              />
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>User ID</Label>
              <Input
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              />
            </div>
            <div>
              <Label>New Password (leave empty to keep current)</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// View Staff Dialog
function ViewStaffDialog({ 
  open, 
  onOpenChange, 
  employee 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}) {
  const idProofFiles: IdProofFile[] = employee.idProofFiles ? JSON.parse(employee.idProofFiles) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Employee Details: {employee.employeeCode}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Full Name</Label>
              <p className="font-medium">{employee.fullName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Employee Code</Label>
              <p className="font-mono">{employee.employeeCode}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Phone</Label>
              <p>{employee.phone || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Alternate Phone</Label>
              <p>{employee.alternatePhone || "-"}</p>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Address</Label>
            <p>{employee.address || "-"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Role</Label>
              <Badge variant="outline">{employee.role}</Badge>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <Badge variant={employee.status === "active" ? "default" : "secondary"}>
                {employee.status}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">User ID (Login)</Label>
              <p>{employee.userId || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Date Joined</Label>
              <p>{employee.dateJoined || "-"}</p>
            </div>
          </div>

          {idProofFiles.length > 0 && (
            <div>
              <Label className="text-muted-foreground">ID Proof Documents</Label>
              <div className="mt-2 space-y-2">
                {idProofFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 bg-muted rounded hover:bg-muted/80"
                  >
                    <div className="flex items-center gap-2">
                      {file.mimetype.includes("image") ? (
                        <Image className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      <span className="text-sm">{file.originalName}</span>
                    </div>
                    <Download className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Attendance Calendar Component
function AttendanceCalendar({ employees }: { employees: Employee[] }) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: attendance } = useQuery({
    queryKey: ["attendance", selectedEmployee?.id, currentMonth.toISOString()],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];
      const res = await fetch(
        `/api/staff/attendance/${selectedEmployee.id}?startDate=${startDate}&endDate=${endDate}`,
        { headers: authHeader() }
      );
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!selectedEmployee,
  });

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDay };
  };

  const getAttendanceForDay = (day: number) => {
    if (!attendance) return null;
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendance.find((a: any) => a.attendanceDate === dateStr);
  };

  const { daysInMonth, firstDay } = getDaysInMonth();
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Attendance Calendar</CardTitle>
          <Select 
            value={selectedEmployee?.id || ""} 
            onValueChange={(id) => setSelectedEmployee(employees.find(e => e.id === id) || null)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedEmployee ? (
          <p className="text-muted-foreground text-center py-8">Select an employee to view attendance</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              >
                Previous
              </Button>
              <span className="font-medium">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              >
                Next
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-sm font-medium text-muted-foreground">{day}</div>
              ))}
              {days.map((day, idx) => {
                const att = day ? getAttendanceForDay(day) : null;
                return (
                  <div
                    key={idx}
                    className={`p-2 text-sm rounded ${
                      !day ? '' :
                      att?.status === 'present' ? 'bg-green-100 text-green-800' :
                      att?.status === 'absent' ? 'bg-red-100 text-red-800' :
                      att?.status === 'half-day' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-muted/30'
                    }`}
                  >
                    {day && (
                      <div>
                        <span className="font-medium">{day}</span>
                        {att && (
                          <div className="text-xs mt-1">
                            {att.checkIn && new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-100 rounded" />
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-100 rounded" />
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-yellow-100 rounded" />
                <span>Half Day</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-muted/30 rounded" />
                <span>No Entry</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
