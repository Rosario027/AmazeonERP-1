import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { 
  UserPlus, Upload, X, Calendar, ChevronDown, ChevronRight,
  FileText, Image, LogIn, Eye
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
  userId?: string | null;
  idProofFiles?: string | null;
  role: string;
  status: string;
  dateJoined?: string | null;
  salary?: string | null;
  createdBy?: string | null;
  isLocked: boolean;
}

interface Attendance {
  id: string;
  attendanceDate: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function Staff() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Fetch employees
  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/staff/employees", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
  });

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Welcome, {user?.username}. View and manage staff.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <StaffListWithAttendance 
        employees={employees || []}
        isLoading={isLoading}
      />

      {/* Add Staff Dialog - User can add but record gets locked after save */}
      <AddStaffDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["employees"] });
          setShowAddDialog(false);
        }}
      />
    </div>
  );
}

// Staff List with Expandable Attendance inside each row
function StaffListWithAttendance({ 
  employees, 
  isLoading
}: { 
  employees: Employee[];
  isLoading: boolean;
}) {
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [, navigate] = useLocation();

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
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground px-2">
            <span></span>
            <span>Employee ID</span>
            <span>Name</span>
            <span>Phone</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div>
            {employees.map((emp) => (
              <EmployeeRowWithAttendance
                key={emp.id}
                employee={emp}
                isExpanded={expandedEmployee === emp.id}
                onToggle={() => setExpandedEmployee(expandedEmployee === emp.id ? null : emp.id)}
                onLogin={() => navigate(`/staff-login/${emp.id}`)}
                onView={() => setViewEmployee(emp)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View Employee Dialog */}
      {viewEmployee && (
        <ViewEmployeeDialog
          open={!!viewEmployee}
          onOpenChange={(open) => !open && setViewEmployee(null)}
          employee={viewEmployee}
        />
      )}
    </>
  );
}

// Individual Employee Row with Expandable Attendance
function EmployeeRowWithAttendance({
  employee,
  isExpanded,
  onToggle,
  onLogin,
  onView
}: {
  employee: Employee;
  isExpanded: boolean;
  onToggle: () => void;
  onLogin: () => void;
  onView: () => void;
}) {
  const [startDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [endDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Fetch attendance for this employee when expanded
  const { data: attendance, isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ["attendance", employee.id, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/staff/attendance/${employee.id}?startDate=${startDate}&endDate=${endDate}`,
        { headers: authHeader() }
      );
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: isExpanded,
  });

  return (
    <div className="border-b last:border-b-0">
      {/* Main Row */}
      <div className="flex items-center p-3 hover:bg-muted/30">
        <button onClick={onToggle} className="mr-2 p-1 hover:bg-muted rounded">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        
        <div className="flex-1 grid grid-cols-5 gap-4 items-center">
          <span className="font-mono text-sm">{employee.employeeCode}</span>
          <span className="font-medium">{employee.fullName}</span>
          <span className="text-sm text-muted-foreground">{employee.phone || "-"}</span>
          <Badge variant={employee.status === "active" ? "default" : "secondary"}>
            {employee.status}
          </Badge>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onView} title="View Details">
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onLogin} title="Staff Login">
              <LogIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Attendance Section */}
      {isExpanded && (
        <div className="px-4 py-3 bg-muted/20 border-t ml-8">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Recent Attendance (Last 7 days)</span>
          </div>

          {attendanceLoading ? (
            <p className="text-sm text-muted-foreground">Loading attendance...</p>
          ) : attendance && attendance.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Clock In</th>
                    <th className="text-left py-2 px-3">Clock Out</th>
                    <th className="text-left py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0">
                      <td className="py-2 px-3">{a.attendanceDate}</td>
                      <td className="py-2 px-3">
                        <Badge 
                          variant={a.status === "present" ? "default" : a.status === "absent" ? "destructive" : "secondary"}
                        >
                          {a.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        {a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                      </td>
                      <td className="py-2 px-3">
                        {a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{a.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No attendance records found for the last 7 days.</p>
          )}
        </div>
      )}
    </div>
  );
}

// View Employee Dialog
function ViewEmployeeDialog({
  open,
  onOpenChange,
  employee
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}) {
  let idProofFiles: IdProofFile[] = [];
  try {
    idProofFiles = employee.idProofFiles ? JSON.parse(employee.idProofFiles) : [];
  } catch (e) {
    idProofFiles = [];
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Employee Details: {employee.employeeCode}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
              <p>{employee.phone || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Alternate Phone</Label>
              <p>{employee.alternatePhone || "-"}</p>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Address</Label>
            <p>{employee.address || "-"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Role</Label>
              <Badge variant="outline">{employee.role}</Badge>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Status</Label>
              <Badge variant={employee.status === "active" ? "default" : "secondary"}>
                {employee.status}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Date Joined</Label>
              <p>{employee.dateJoined || "-"}</p>
            </div>
          </div>

          {idProofFiles.length > 0 && (
            <div>
              <Label className="text-muted-foreground text-xs">ID Proof Documents</Label>
              <div className="mt-2 space-y-2">
                {idProofFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-muted rounded hover:bg-muted/80 text-sm"
                  >
                    {file.mimetype?.includes("image") ? (
                      <Image className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="truncate">{file.originalName}</span>
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

// Add Staff Dialog for Users (record gets locked after save)
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
      
      // Try to parse response, but don't fail if it's empty
      let data;
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      
      if (!res.ok) {
        throw new Error(data.message || "Failed to create employee");
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Employee added successfully", description: "Note: This record is now locked for editing." });
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
    });
    setUploadedFiles([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedFiles.length + files.length > 5) {
      toast({ title: "Maximum 5 files allowed", variant: "destructive" });
      return;
    }

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

        {/* Warning about locking */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <strong>Note:</strong> Once you save this record, you won't be able to edit it. 
          Only an admin can make changes after saving.
        </div>

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
                  id="id-proof-upload-user"
                  disabled={isUploading || uploadedFiles.length >= 5}
                />
                <label htmlFor="id-proof-upload-user" className="cursor-pointer">
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
                        {file.mimetype?.includes("image") ? (
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
