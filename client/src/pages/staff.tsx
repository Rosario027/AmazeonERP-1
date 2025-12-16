import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { 
  UserPlus, Users, Clock, Eye, Upload, X, Calendar,
  FileText, Image, PlayCircle, StopCircle, LogIn
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

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function Staff() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("employees");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
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
            onStaffLogin={(emp) => {
              setSelectedEmployee(emp);
              setShowLoginDialog(true);
            }}
          />
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <AttendanceView employees={employees || []} />
        </TabsContent>
      </Tabs>

      {/* Add Staff Dialog - User can add but record gets locked after save */}
      <AddStaffDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["employees"] });
          setShowAddDialog(false);
        }}
      />

      {/* Staff Login Dialog */}
      {selectedEmployee && (
        <StaffLoginDialog
          open={showLoginDialog}
          onOpenChange={setShowLoginDialog}
          employee={selectedEmployee}
        />
      )}
    </div>
  );
}

// Staff List Component (View Only for Users)
function StaffList({ 
  employees, 
  isLoading,
  onStaffLogin
}: { 
  employees: Employee[];
  isLoading: boolean;
  onStaffLogin: (emp: Employee) => void;
}) {
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
                  <td className="p-3">
                    <button 
                      onClick={() => onStaffLogin(emp)}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      {emp.fullName}
                    </button>
                  </td>
                  <td className="p-3">{emp.phone || "-"}</td>
                  <td className="p-3">
                    <Badge variant={emp.status === "active" ? "default" : "secondary"}>
                      {emp.status}
                    </Badge>
                  </td>
                  <td className="p-3">{emp.dateJoined || "-"}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => onStaffLogin(emp)}>
                      <LogIn className="h-4 w-4 mr-1" />
                      Login
                    </Button>
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
      salary: "",
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

// Staff Login Dialog
function StaffLoginDialog({ 
  open, 
  onOpenChange, 
  employee 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (open && loggedIn) {
      // Fetch today's attendance
      fetchTodayAttendance();
    }
  }, [open, loggedIn]);

  const fetchTodayAttendance = async () => {
    try {
      const res = await fetch(`/api/staff/attendance/today/${employee.id}`, {
        headers: authHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setTodayAttendance(data);
      }
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
    }
  };

  const handleLogin = async () => {
    if (!userId || !password) {
      toast({ title: "Please enter User ID and Password", variant: "destructive" });
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await res.json();
      toast({ title: `Welcome, ${data.employee.fullName}!` });
      setLoggedIn(true);
      fetchTodayAttendance();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleClockIn = async () => {
    try {
      const res = await fetch(`/api/staff/clock-in/${employee.id}`, {
        method: "POST",
        headers: authHeader(),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Clock in failed");
      }

      toast({ title: "Clocked in successfully!" });
      fetchTodayAttendance();
      qc.invalidateQueries({ queryKey: ["activeEmployees"] });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleClockOut = async () => {
    try {
      const res = await fetch(`/api/staff/clock-out/${employee.id}`, {
        method: "POST",
        headers: authHeader(),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Clock out failed");
      }

      toast({ title: "Clocked out successfully!" });
      fetchTodayAttendance();
      qc.invalidateQueries({ queryKey: ["activeEmployees"] });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleClose = () => {
    setUserId("");
    setPassword("");
    setLoggedIn(false);
    setTodayAttendance(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Staff Login: {employee.fullName}</DialogTitle>
        </DialogHeader>

        {!loggedIn ? (
          <div className="space-y-4">
            <div>
              <Label>User ID</Label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your user ID"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button className="w-full" onClick={handleLogin} disabled={isLoggingIn}>
              {isLoggingIn ? "Logging in..." : "Login"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-lg font-medium">{employee.fullName}</p>
              <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
            </div>

            {/* Today's Status */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Today's Attendance</h3>
              {todayAttendance ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge variant={todayAttendance.status === "present" ? "default" : "secondary"}>
                      {todayAttendance.status}
                    </Badge>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Clock In:</span>{" "}
                    {todayAttendance.checkIn 
                      ? new Date(todayAttendance.checkIn).toLocaleTimeString() 
                      : "-"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Clock Out:</span>{" "}
                    {todayAttendance.checkOut 
                      ? new Date(todayAttendance.checkOut).toLocaleTimeString() 
                      : "-"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attendance recorded today</p>
              )}
            </div>

            {/* Clock In/Out Buttons */}
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={handleClockIn}
                disabled={todayAttendance?.checkIn && !todayAttendance?.checkOut === false}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Work
              </Button>
              <Button 
                className="flex-1" 
                variant="secondary"
                onClick={handleClockOut}
                disabled={!todayAttendance?.checkIn || todayAttendance?.checkOut}
              >
                <StopCircle className="h-4 w-4 mr-2" />
                End Work
              </Button>
            </div>

            {todayAttendance?.checkOut && (
              <p className="text-center text-sm text-muted-foreground">
                Work completed for today. See you tomorrow!
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Attendance View Component for Users
function AttendanceView({ employees }: { employees: Employee[] }) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance", selectedEmployee?.id, startDate, endDate],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      const res = await fetch(
        `/api/staff/attendance/${selectedEmployee.id}?startDate=${startDate}&endDate=${endDate}`,
        { headers: authHeader() }
      );
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!selectedEmployee,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>View Attendance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
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

          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-40"
            />
            <span className="text-muted-foreground">to</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-40"
            />
          </div>
        </div>

        {!selectedEmployee ? (
          <p className="text-muted-foreground text-center py-8">Select an employee to view attendance</p>
        ) : isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : attendance && attendance.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2 pr-4">Clock In</th>
                  <th className="text-left py-2 pr-4">Clock Out</th>
                  <th className="text-left py-2 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a: any) => (
                  <tr key={a.id} className="border-b">
                    <td className="py-2 pr-4">{a.attendanceDate}</td>
                    <td className="py-2 pr-4">
                      <Badge 
                        variant={a.status === "present" ? "default" : a.status === "absent" ? "destructive" : "secondary"}
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      {a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </td>
                    <td className="py-2 pr-4">
                      {a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </td>
                    <td className="py-2 pr-4">{a.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">No attendance records found</p>
        )}
      </CardContent>
    </Card>
  );
}
