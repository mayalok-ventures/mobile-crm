"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Shield,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Plus,
  Send,
} from "lucide-react";

const PLAN_OPTIONS = ["free", "starter", "growth", "pro"];
const PLAN_COLORS = {
  free: "#94a3b8",
  starter: "#6366f1",
  growth: "#f59e0b",
  pro: "#22c55e",
};

export default function AdminPage() {
  const router = useRouter();
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [promptPassword, setPromptPassword] = useState("");
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("users"); // 'users', 'coupons', 'alerts', 'abuse'

  // Users tab state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  // Coupons tab state
  const [coupons, setCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    plan: "starter",
    maxUses: 1,
    expiresAt: "",
    discountPercent: 0,
  });
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  // Alerts tab state
  const [alertForm, setAlertForm] = useState({
    targetUserId: "all",
    message: "",
  });
  const [sendingAlert, setSendingAlert] = useState(false);

  // Abuse Logs state
  const [abuseLogs, setAbuseLogs] = useState([]);
  const [loadingAbuse, setLoadingAbuse] = useState(false);
  const [abusePage, setAbusePage] = useState(1);
  const [abuseTotalPages, setAbuseTotalPages] = useState(1);
  const [abuseTotalCount, setAbuseTotalCount] = useState(0);

  // Payments tab state
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

  // Suspension modal state
  const [suspensionModalUser, setSuspensionModalUser] = useState(null);
  const [suspensionForm, setSuspensionForm] = useState({
    isSuspended: false,
    level: 1,
    reason: "",
  });

  // Verify stored admin status on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.isAdmin) {
          setIsAdminVerified(true);
        }
      }
    } catch {}
  }, []);

  // Fetch users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (planFilter) params.plan = planFilter;
      const { data } = await api.get("/admin/users", { params });
      setUsers(data.users);
      setPagination(data);
    } catch (e) {
      if (e.response?.status === 403) {
        setIsAdminVerified(false);
      } else {
        toast.error("Access denied");
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch coupons
  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const { data } = await api.get("/admin/coupons");
      setCoupons(data);
    } catch {
      toast.error("Failed to load coupons");
    } finally {
      setLoadingCoupons(false);
    }
  };

  // Fetch abuse logs
  const fetchAbuseLogs = async (p = abusePage) => {
    setLoadingAbuse(true);
    try {
      const { data } = await api.get(`/admin/abuse-logs?page=${p}&limit=50`);
      setAbuseLogs(data.logs);
      setAbuseTotalPages(data.pages);
      setAbusePage(data.page);
      setAbuseTotalCount(data.total);
    } catch {
      toast.error("Failed to load abuse logs");
    } finally {
      setLoadingAbuse(false);
    }
  };

  // Save suspension settings
  const handleSaveSuspension = async (e) => {
    e.preventDefault();
    if (!suspensionModalUser) return;
    try {
      await api.post(`/admin/users/${suspensionModalUser._id}/suspend`, suspensionForm);
      toast.success("User suspension status updated successfully!");
      setSuspensionModalUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update suspension");
    }
  };

  useEffect(() => {
    if (!isAdminVerified) return;
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "coupons") {
      fetchCoupons();
    } else if (activeTab === "abuse") {
      fetchAbuseLogs(1);
    } else if (activeTab === "payments") {
      fetchPayments();
    }
  }, [search, planFilter, page, activeTab, isAdminVerified]);

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const { data } = await api.get('/payments/admin');
      setPayments(data);
    } catch {
      toast.error("Failed to load payment requests");
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleApprovePayment = async (paymentId) => {
    if (!confirm("Approve this payment request and activate user plan?")) return;
    try {
      await api.put(`/payments/admin/${paymentId}/approve`);
      toast.success("Payment request approved! Plan activated.");
      fetchPayments();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to approve payment");
    }
  };

  const handleRejectPayment = async (paymentId) => {
    if (!confirm("Reject this payment request?")) return;
    try {
      await api.put(`/payments/admin/${paymentId}/reject`);
      toast.success("Payment request rejected.");
      fetchPayments();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to reject payment");
    }
  };

  const assignPlan = async (userId, plan) => {
    let durationDays = null;
    let expiryDate = null;
    if (plan !== 'free') {
      const res = prompt(`Assigning "${plan.toUpperCase()}" plan. Enter duration in days (e.g. 30) or custom expiry date (YYYY-MM-DD):`, "30");
      if (res === null) return;
      if (res.trim().includes('-')) {
        expiryDate = res.trim();
      } else {
        durationDays = parseInt(res) || 30;
      }
    }
    try {
      await api.put(`/admin/users/${userId}/plan`, { plan, durationDays, expiryDate });
      fetchUsers();
      toast.success(`Plan updated to ${plan}`);
    } catch {
      toast.error("Failed to update plan");
    }
  };

  const toggleStatus = async (userId) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/status`);
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId ? { ...u, isActive: data.isActive } : u,
        ),
      );
      toast.success(data.message);
    } catch {
      toast.error("Failed to toggle status");
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      toast.success("User deleted");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed");
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code.trim()) return toast.error("Coupon code is required");
    setCreatingCoupon(true);
    try {
      const { data } = await api.post("/admin/coupons", newCoupon);
      setCoupons((prev) => [data, ...prev]);
      setNewCoupon({ code: "", plan: "starter", maxUses: 1, expiresAt: "", discountPercent: 0 });
      toast.success("Coupon code created successfully! 🎫");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create coupon");
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!confirm("Delete this coupon code?")) return;
    try {
      await api.delete(`/admin/coupons/${couponId}`);
      setCoupons((prev) => prev.filter((c) => c._id !== couponId));
      toast.success("Coupon deleted");
    } catch {
      toast.error("Failed to delete coupon");
    }
  };

  const handleSendAlert = async (e) => {
    e.preventDefault();
    if (!alertForm.message.trim())
      return toast.error("Alert message cannot be empty");
    setSendingAlert(true);
    try {
      const { data } = await api.post("/admin/alerts", alertForm);
      toast.success(data.message || "Alert broadcasted successfully! 📢");
      setAlertForm((f) => ({ ...f, message: "" }));
    } catch {
      toast.error("Failed to send admin alert");
    } finally {
      setSendingAlert(false);
    }
  };

  if (!isAdminVerified) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "var(--accent)",
              marginBottom: 16,
            }}
          >
            <Shield size={32} color="white" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
            Admin Area Protected
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            This page is password-protected. Enter the administrator password to
            gain access.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!promptPassword) return;
              setCheckingPassword(true);
              try {
                const { data } = await api.post("/auth/login", {
                  identifier: "admin@crm.com",
                  password: promptPassword,
                });
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data));
                setIsAdminVerified(true);
                toast.success("Admin access granted! 🔐");
              } catch (err) {
                toast.error(
                  err.response?.data?.message ||
                    "Invalid administrator password",
                );
              } finally {
                setCheckingPassword(false);
              }
            }}
          >
            <input
              type="password"
              className="input"
              placeholder="Enter admin password"
              value={promptPassword}
              onChange={(e) => setPromptPassword(e.target.value)}
              style={{ textAlign: "center", marginBottom: 16 }}
              required
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => router.push("/dashboard")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={checkingPassword}
              >
                {checkingPassword ? (
                  <div className="spinner" style={{ width: 18, height: 18 }} />
                ) : (
                  "Access"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text)",
              padding: 4,
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="page-title">Admin Panel</h1>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "rgba(99,102,241,0.1)",
            borderRadius: 10,
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <Shield size={14} color="var(--accent)" />
          <span
            style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}
          >
            Admin
          </span>
        </div>
      </div>

      <div className="page-content">
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            marginBottom: 16,
          }}
        >
          {[
            { id: "users", label: "👥 Users" },
            { id: "payments", label: "💳 Payments" },
            { id: "coupons", label: "🎫 Coupons" },
            { id: "alerts", label: "📢 Alerts" },
            { id: "abuse", label: "🚨 Abuse Logs" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1,
                padding: "12px 6px",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === t.id ? "2px solid var(--accent)" : "none",
                color:
                  activeTab === t.id ? "var(--accent)" : "var(--text-muted)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: USERS */}
        {activeTab === "users" && (
          <div>
            {/* Stats bar */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
                overflow: "auto",
              }}
            >
              <div className="stat-card" style={{ flex: 1, minWidth: 80 }}>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {pagination.total || 0}
                </div>
                <div className="stat-label">Users</div>
              </div>
              {PLAN_OPTIONS.map((p) => {
                const count = users.filter((u) => u.plan === p).length;
                return (
                  <div
                    key={p}
                    className="stat-card"
                    style={{ flex: 1, minWidth: 70 }}
                  >
                    <div
                      className="stat-value"
                      style={{ fontSize: 18, color: PLAN_COLORS[p] }}
                    >
                      {count}
                    </div>
                    <div
                      className="stat-label"
                      style={{ textTransform: "capitalize" }}
                    >
                      {p}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div className="search-bar" style={{ marginBottom: 10 }}>
              <Search size={16} />
              <input
                className="input"
                placeholder="Search by name, email, phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="filter-chips" style={{ marginBottom: 16 }}>
              {["", ...PLAN_OPTIONS].map((p) => (
                <button
                  key={p}
                  className={`chip ${planFilter === p ? "active" : ""}`}
                  onClick={() => {
                    setPlanFilter(p);
                    setPage(1);
                  }}
                >
                  {p || "All Plans"}
                </button>
              ))}
            </div>

            {/* Users list */}
            {loadingUsers ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "32px 0",
                }}
              >
                <div className="spinner" />
              </div>
            ) : users.length === 0 ? (
              <div className="empty-state">
                <Users size={40} />
                <h3>No users found</h3>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {users.map((u) => (
                  <div key={u._id} className="card">
                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${PLAN_COLORS[u.plan]}, ${PLAN_COLORS[u.plan]}90)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "white",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                          {u.name}{" "}
                          {u.isAdmin && (
                            <span
                              style={{
                                fontSize: 10,
                                background: "var(--accent)",
                                color: "white",
                                padding: "1px 4px",
                                borderRadius: 4,
                              }}
                            >
                              Admin
                            </span>
                          )}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {u.email || u.phone}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 4,
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 10,
                              background: `${PLAN_COLORS[u.plan]}20`,
                              color: PLAN_COLORS[u.plan],
                              fontWeight: 600,
                              textTransform: "capitalize",
                            }}
                          >
                            {u.plan}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: u.suspension?.isSuspended ? "var(--red)" : "var(--green)",
                            }}
                          >
                            ● {u.suspension?.isSuspended ? `Suspended (Lvl ${u.suspension.level || 1})` : "Active"}
                          </span>
                          {u.plan !== 'free' && u.planEndDate && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              | Expires: {new Date(u.planEndDate).toLocaleDateString()} {new Date() > new Date(u.planEndDate) && <span style={{ color: 'var(--red)', fontWeight: 600 }}>(Expired)</span>}
                            </span>
                          )}
                          {u.leadCount > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              {u.leadCount} leads
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ position: "relative", flex: 1 }}>
                        <select
                          value={u.plan}
                          onChange={(e) => assignPlan(u._id, e.target.value)}
                          style={{
                            width: "100%",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            padding: "6px 10px",
                            color: "var(--text)",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {PLAN_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                              {p.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          setSuspensionForm({
                            isSuspended: u.suspension?.isSuspended || false,
                            level: u.suspension?.level || 1,
                            reason: u.suspension?.reason || "",
                          });
                          setSuspensionModalUser(u);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          background: u.suspension?.isSuspended
                            ? "rgba(34,197,94,0.1)"
                            : "rgba(239,68,68,0.1)",
                          border: `1px solid ${u.suspension?.isSuspended ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                          borderRadius: 8,
                          cursor: "pointer",
                          color: u.suspension?.isSuspended ? "var(--green)" : "var(--red)",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {u.suspension?.isSuspended ? (
                          <ToggleLeft size={14} />
                        ) : (
                          <ToggleRight size={14} />
                        )}
                        {u.suspension?.isSuspended ? "Lift / Edit" : "Suspend"}
                      </button>

                      <button
                        onClick={() => deleteUser(u._id)}
                        style={{
                          padding: "6px 10px",
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: 8,
                          cursor: "pointer",
                          color: "var(--red)",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </button>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  {page}/{pagination.pages}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB: PAYMENTS */}
        {activeTab === "payments" && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>💳 Manual Payment Requests</h3>
            {loadingPayments ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                <div className="spinner" />
              </div>
            ) : payments.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12 }}>
                No manual payment requests found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {payments.map((p) => (
                  <div key={p._id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12, borderLeft: p.status === 'pending' ? '4px solid var(--yellow)' : p.status === 'approved' ? '4px solid var(--green)' : '4px solid var(--red)' }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong style={{ fontSize: 15 }}>{p.username}</strong>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                          Plan Selected: <span style={{ textTransform: "capitalize", color: "var(--text)", fontWeight: 600 }}>{p.planSelected}</span>
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                          UTR: <strong style={{ color: "var(--text)" }}>{p.utrNumber}</strong>
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                          Submitted: {new Date(p.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: p.status === 'pending' ? 'rgba(245,158,11,0.1)' : p.status === 'approved' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: p.status === 'pending' ? 'var(--yellow)' : p.status === 'approved' ? 'var(--green)' : 'var(--red)',
                      }}>
                        {p.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Price: ₹{p.finalPrice} {p.couponCodeUsed && <span style={{ fontSize: 11, color: "var(--green)" }}>(Coupon: {p.couponCodeUsed})</span>}</span>
                      <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => setSelectedScreenshot(p.screenshotUrl)}>
                        View Proof Image
                      </button>
                    </div>

                    {p.status === 'pending' && (
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button className="btn btn-primary" style={{ flex: 1, padding: "8px 12px", fontSize: 13, background: "var(--green)", border: "none" }} onClick={() => handleApprovePayment(p._id)}>
                          Approve
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: "8px 12px", fontSize: 13, color: "var(--red)", borderColor: "var(--red)" }} onClick={() => handleRejectPayment(p._id)}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COUPONS */}
        {activeTab === "coupons" && (
          <div>
            {/* Create Coupon Form */}
            <div className="card" style={{ marginBottom: 16 }}>
              <p className="section-title">➕ Create Coupon Code</p>
              <form
                onSubmit={handleCreateCoupon}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div>
                  <label className="label">Coupon Code (e.g. WELCOME100)</label>
                  <input
                    className="input"
                    placeholder="ENTER_CODE"
                    value={newCoupon.code}
                    onChange={(e) =>
                      setNewCoupon((f) => ({
                        ...f,
                        code: e.target.value.toUpperCase(),
                      }))
                    }
                    required
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div>
                    <label className="label">Unlocks Plan</label>
                    <select
                      className="input"
                      value={newCoupon.plan}
                      onChange={(e) =>
                        setNewCoupon((f) => ({ ...f, plan: e.target.value }))
                      }
                    >
                      <option value="starter">Starter</option>
                      <option value="growth">Growth</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Max Usages</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={newCoupon.maxUses}
                      onChange={(e) =>
                        setNewCoupon((f) => ({
                          ...f,
                          maxUses: parseInt(e.target.value) || 1,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Discount %</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      value={newCoupon.discountPercent}
                      onChange={(e) =>
                        setNewCoupon((f) => ({
                          ...f,
                          discountPercent: parseInt(e.target.value) || 0,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">
                    Validity Expiry Date (Optional)
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={newCoupon.expiresAt}
                    onChange={(e) =>
                      setNewCoupon((f) => ({ ...f, expiresAt: e.target.value }))
                    }
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", gap: 6 }}
                  disabled={creatingCoupon}
                >
                  {creatingCoupon ? (
                    <div
                      className="spinner"
                      style={{ width: 14, height: 14 }}
                    />
                  ) : (
                    <>
                      <Plus size={16} /> Create Coupon
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Coupons List */}
            <p className="section-title">🎫 Active Coupon Codes</p>
            {loadingCoupons ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "24px 0",
                }}
              >
                <div className="spinner" />
              </div>
            ) : coupons.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  padding: "16px 0",
                }}
              >
                No coupon codes active.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {coupons.map((c) => (
                  <div
                    key={c._id}
                    className="card"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: 14,
                          color: "var(--accent)",
                        }}
                      >
                        {c.code}
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 12,
                          color: "var(--text-muted)",
                        }}
                      >
                        Unlocks:{" "}
                        <strong style={{ textTransform: "capitalize" }}>
                          {c.plan}
                        </strong>{" "}
                        plan
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 11,
                          color: "var(--text-muted)",
                        }}
                      >
                        Uses: {c.usedCount} / {c.maxUses} | Discount: {c.discountPercent || 0}%
                      </p>
                      {c.expiresAt && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color:
                              new Date() > new Date(c.expiresAt)
                                ? "var(--red)"
                                : "var(--text-muted)",
                          }}
                        >
                          Expires: {new Date(c.expiresAt).toLocaleDateString()}{" "}
                          {new Date() > new Date(c.expiresAt) && "(Expired)"}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCoupon(c._id)}
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "var(--red)",
                        borderRadius: 8,
                        padding: 8,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ALERTS */}
        {activeTab === "alerts" && (
          <div>
            <div className="card">
              <p className="section-title">📢 Broadcast Custom Message Alert</p>
              <form
                onSubmit={handleSendAlert}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div>
                  <label className="label">Target User</label>
                  <select
                    className="input"
                    value={alertForm.targetUserId}
                    onChange={(e) =>
                      setAlertForm((f) => ({
                        ...f,
                        targetUserId: e.target.value,
                      }))
                    }
                  >
                    <option value="all">Broadcast to All Users</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.phone || u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Alert Message</label>
                  <textarea
                    className="input"
                    placeholder="Type alert notification message here..."
                    rows={4}
                    value={alertForm.message}
                    onChange={(e) =>
                      setAlertForm((f) => ({ ...f, message: e.target.value }))
                    }
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", gap: 8 }}
                  disabled={sendingAlert}
                >
                  {sendingAlert ? (
                    <div
                      className="spinner"
                      style={{ width: 14, height: 14 }}
                    />
                  ) : (
                    <>
                      <Send size={16} /> Send Custom Alert
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: ABUSE LOGS */}
        {activeTab === "abuse" && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p className="section-title" style={{ margin: 0 }}>🚨 Abuse Detection & Rate Limits Logs</p>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total: {abuseTotalCount}</span>
            </div>
            
            {loadingAbuse ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                <div className="spinner" />
              </div>
            ) : abuseLogs.length === 0 ? (
              <div className="empty-state">
                <h3>No abuse logs found</h3>
                <p>System is clean. No rate limit or spam violations detected.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {abuseLogs.map((log) => (
                  <div key={log._id} className="card" style={{ borderLeft: '3px solid var(--red)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)' }}>
                        {log.type?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                      {log.description}
                    </div>

                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>IP: {log.ipAddress || 'unknown'}</span>
                      {log.userId && (
                        <span>
                          User: <strong>{log.userId.name || log.userId.username}</strong> ({log.userId.phone || log.userId.email})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {abuseTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={abusePage === 1}
                  onClick={() => fetchAbuseLogs(abusePage - 1)}
                >
                  Prev
                </button>
                <span style={{ display: "flex", alignItems: "center", fontSize: 13 }}>
                  {abusePage}/{abuseTotalPages}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={abusePage >= abuseTotalPages}
                  onClick={() => fetchAbuseLogs(abusePage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SUSPENSION SETTINGS MODAL */}
      {suspensionModalUser && (
        <div className="modal-overlay" onClick={() => setSuspensionModalUser(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Manage Suspension — {suspensionModalUser.name}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              User identifier: {suspensionModalUser.email || suspensionModalUser.phone}
            </p>

            <form onSubmit={handleSaveSuspension}>
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="isSuspended"
                  checked={suspensionForm.isSuspended}
                  onChange={(e) => setSuspensionForm(f => ({ ...f, isSuspended: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="isSuspended" style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Suspension Enabled
                </label>
              </div>

              {suspensionForm.isSuspended && (
                <div style={{ marginBottom: 14 }}>
                  <label className="label">Suspension Duration Level</label>
                  <select
                    className="input"
                    value={suspensionForm.level}
                    onChange={(e) => setSuspensionForm(f => ({ ...f, level: parseInt(e.target.value) || 1 }))}
                  >
                    <option value="1">Level 1 — 24 hours lock</option>
                    <option value="2">Level 2 — 7 days lock</option>
                    <option value="3">Level 3 — 30 days lock</option>
                    <option value="4">Level 4 — Permanent ban</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label className="label">Reason / Notes</label>
                <textarea
                  className="input"
                  placeholder="e.g. Repeated rate limit breaches / spam reports..."
                  value={suspensionForm.reason}
                  onChange={(e) => setSuspensionForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  required={suspensionForm.isSuspended}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-full"
                  onClick={() => setSuspensionModalUser(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-full">
                  Save Changes
                </button>
              </div>
             </form>
           </div>
         </div>
       )}

       {/* Proof Lightbox Modal */}
       {selectedScreenshot && (
         <div className="modal-overlay" onClick={() => setSelectedScreenshot(null)}>
           <div className="modal-sheet" style={{ maxWidth: 500, width: "95%", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
             <h4 style={{ margin: "0 0 12px" }}>Proof Screenshot</h4>
             <img src={selectedScreenshot} alt="Payment proof screenshot" style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 8, objectFit: "contain", border: "1px solid var(--border)", marginBottom: 12 }} />
             <button className="btn btn-secondary btn-full" onClick={() => setSelectedScreenshot(null)}>Close</button>
           </div>
         </div>
       )}
     </div>
   );
 }
