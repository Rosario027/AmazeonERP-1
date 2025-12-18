import React, { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { PlayCircle, StopCircle, Clock, ArrowLeft, ShoppingCart } from "lucide-react";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function StaffLoginPage() {
  const [match, params] = useRoute("/staff-login/:id");
  const employeeId = params?.id as string;
  const qc = useQueryClient();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    purchaseDate: new Date().toISOString().split('T')[0],
    category: "purchase",
    amount: "",
    paymentMode: "cash",
    description: "",
  });

  // Fetch employee details
  const employeeQuery = useQuery<any>({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/staff/employees/${employeeId}`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load employee");
      return res.json();
    },
    enabled: !!employeeId,
  });

  const employee = employeeQuery.data;

  // Get auth header for staff operations
  const getStaffAuthHeader = (): Record<string, string> => {
    const token = staffToken || localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Staff purchases list
  const purchasesQuery = useQuery<any[]>({
    queryKey: ["employee-purchases", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/staff/purchases/${employeeId}`, {
        headers: getStaffAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to load purchases");
      return res.json();
    },
    enabled: !!employeeId && loggedIn,
  });

  // Check if all required fields are filled
  const isFormValid = () => {
    return (
      purchaseForm.purchaseDate &&
      purchaseForm.category &&
      purchaseForm.amount &&
      Number(purchaseForm.amount) > 0 &&
      purchaseForm.description.trim() !== ""
    );
  };

  const createPurchase = useMutation({
    mutationFn: async () => {
      // For advance, payment mode is not applicable - set to 'advance'
      const paymentMode = purchaseForm.category === 'advance' ? 'advance' : purchaseForm.paymentMode;
      const payload = {
        employeeId,
        purchaseDate: purchaseForm.purchaseDate,
        category: purchaseForm.category,
        amount: Number(purchaseForm.amount || 0),
        paymentMode,
        description: purchaseForm.description,
      };
      const res = await fetch('/api/staff/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getStaffAuthHeader() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let data: any = {};
        try { data = await res.json(); } catch {}
        throw new Error(data.message || 'Failed to add purchase');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Purchase recorded successfully' });
      setShowPurchaseForm(false);
      setPurchaseForm({
        purchaseDate: new Date().toISOString().split('T')[0],
        category: 'purchase',
        amount: '',
        paymentMode: 'cash',
        description: '',
      });
      qc.invalidateQueries({ queryKey: ["employee-purchases", employeeId] });
    },
    onError: (e: any) => {
      toast({ title: e.message || 'Failed to add purchase', variant: 'destructive' });
    }
  });

  useEffect(() => {
    if (loggedIn) {
      fetchTodayAttendance();
    }
  }, [loggedIn]);

  const fetchTodayAttendance = async () => {
    try {
      const res = await fetch(`/api/staff/attendance/today/${employeeId}`, {
        headers: getStaffAuthHeader(),
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
      if (data.token) {
        setStaffToken(data.token);
      }
      toast({ title: `Welcome, ${data.employee.fullName}!` });
      setLoggedIn(true);
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleClockIn = async () => {
    if (isClockingIn) return;
    
    if (todayAttendance?.checkIn && !todayAttendance?.checkOut) {
      toast({ title: "Already clocked in for today", variant: "destructive" });
      return;
    }
    
    setIsClockingIn(true);
    try {
      const res = await fetch(`/api/staff/clock-in/${employeeId}`, {
        method: "POST",
        headers: getStaffAuthHeader(),
      });

      let data: any = {};
      try { const text = await res.text(); data = text ? JSON.parse(text) : {}; } catch {}
      
      if (!res.ok) {
        throw new Error(data.message || "Clock in failed");
      }

      toast({ title: "Clocked in successfully!" });
      await fetchTodayAttendance();
      qc.invalidateQueries({ queryKey: ["activeEmployees"] });
    } catch (error: any) {
      toast({ title: error.message || "Failed to clock in", variant: "destructive" });
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (isClockingOut) return;
    
    if (!todayAttendance?.checkIn) {
      toast({ title: "Please clock in first", variant: "destructive" });
      return;
    }
    if (todayAttendance?.checkOut) {
      toast({ title: "Already clocked out for today", variant: "destructive" });
      return;
    }
    
    setIsClockingOut(true);
    try {
      const res = await fetch(`/api/staff/clock-out/${employeeId}`, {
        method: "POST",
        headers: getStaffAuthHeader(),
      });
      
      let data: any = {};
      try { const text = await res.text(); data = text ? JSON.parse(text) : {}; } catch {}

      if (!res.ok) {
        throw new Error(data.message || "Clock out failed");
      }

      toast({ title: "Clocked out successfully!" });
      await fetchTodayAttendance();
      qc.invalidateQueries({ queryKey: ["activeEmployees"] });
    } catch (error: any) {
      toast({ title: error.message || "Failed to clock out", variant: "destructive" });
    } finally {
      setIsClockingOut(false);
    }
  };

  if (employeeQuery.isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6">
        <p className="text-destructive">Employee not found</p>
        <Link href="/staff"><Button variant="outline" className="mt-4">Back to Staff</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Login</h1>
          <p className="text-muted-foreground">{employee.fullName} ({employee.employeeCode})</p>
        </div>
        <Link href="/staff">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Staff
          </Button>
        </Link>
      </div>

      {!loggedIn ? (
        <Card>
          <CardHeader>
            <CardTitle>Enter Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Employee Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xl font-semibold">{employee.fullName}</p>
                <p className="text-muted-foreground">{employee.employeeCode}</p>
                <Badge variant="outline" className="mt-2">{employee.role}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Today's Attendance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {todayAttendance ? (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={todayAttendance.status === "present" ? "default" : "secondary"}>
                      {todayAttendance.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Clock In</p>
                    <p className="font-medium">
                      {todayAttendance.checkIn 
                        ? new Date(todayAttendance.checkIn).toLocaleTimeString() 
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Clock Out</p>
                    <p className="font-medium">
                      {todayAttendance.checkOut 
                        ? new Date(todayAttendance.checkOut).toLocaleTimeString() 
                        : "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">No attendance recorded today</p>
              )}

              <div className="flex gap-3">
                <Button 
                  className="flex-1" 
                  onClick={handleClockIn}
                  disabled={isClockingIn || (todayAttendance?.checkIn && !todayAttendance?.checkOut)}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {isClockingIn ? "Starting..." : "Start Work"}
                </Button>
                <Button 
                  className="flex-1" 
                  variant="secondary"
                  onClick={handleClockOut}
                  disabled={isClockingOut || !todayAttendance?.checkIn || todayAttendance?.checkOut}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  {isClockingOut ? "Ending..." : "End Work"}
                </Button>
              </div>

              {todayAttendance?.checkOut && (
                <p className="text-center text-sm text-muted-foreground">
                  Work completed for today. See you tomorrow!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Purchases Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  My Purchases / Advances
                </CardTitle>
                <Button onClick={() => setShowPurchaseForm(!showPurchaseForm)}>
                  {showPurchaseForm ? 'Cancel' : 'Purchase / Advance'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showPurchaseForm && (
                <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                  <h3 className="font-medium">New {purchaseForm.category === 'advance' ? 'Advance' : 'Purchase'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Date <span className="text-destructive">*</span></Label>
                      <Input 
                        type="date" 
                        value={purchaseForm.purchaseDate} 
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })} 
                        required
                      />
                    </div>
                    <div>
                      <Label>Category <span className="text-destructive">*</span></Label>
                      <Select 
                        value={purchaseForm.category} 
                        onValueChange={(v) => setPurchaseForm({ ...purchaseForm, category: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="purchase">Purchase</SelectItem>
                          <SelectItem value="advance">Advance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (₹) <span className="text-destructive">*</span></Label>
                      <Input 
                        type="number" 
                        placeholder="Enter amount" 
                        value={purchaseForm.amount} 
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, amount: e.target.value })} 
                        required
                      />
                    </div>
                    {purchaseForm.category !== 'advance' && (
                      <div>
                        <Label>Payment Mode <span className="text-destructive">*</span></Label>
                        <Select 
                          value={purchaseForm.paymentMode} 
                          onValueChange={(v) => setPurchaseForm({ ...purchaseForm, paymentMode: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="credit">Credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className={purchaseForm.category === 'advance' ? 'md:col-span-2' : 'md:col-span-2'}>
                      <Label>Description <span className="text-destructive">*</span></Label>
                      <Textarea 
                        rows={2} 
                        placeholder={purchaseForm.category === 'advance' ? 'Reason for advance' : 'Details about this purchase'}
                        value={purchaseForm.description} 
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })} 
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => createPurchase.mutate()} 
                      disabled={createPurchase.isPending || !isFormValid()}
                    >
                      {createPurchase.isPending 
                        ? 'Saving...' 
                        : purchaseForm.category === 'advance' 
                          ? 'Save Advance' 
                          : 'Save Purchase'
                      }
                    </Button>
                  </div>
                </div>
              )}

              {/* Purchases list */}
              {purchasesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading purchases...</p>
              ) : (purchasesQuery.data && purchasesQuery.data.length > 0) ? (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-left py-2 px-3">Category</th>
                        <th className="text-left py-2 px-3">Amount</th>
                        <th className="text-left py-2 px-3">Payment</th>
                        <th className="text-left py-2 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchasesQuery.data.map((p) => (
                        <tr key={p.id} className="border-b last:border-b-0">
                          <td className="py-2 px-3">{p.purchaseDate}</td>
                          <td className="py-2 px-3">{p.category}</td>
                          <td className="py-2 px-3">₹{Number(p.amount).toFixed(2)}</td>
                          <td className="py-2 px-3">
                            <Badge variant={p.paymentMode === 'credit' ? 'destructive' : 'outline'}>
                              {p.paymentMode}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{p.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No purchases recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
