import React, { useState, useEffect } from "react";
import { Plus, Search, Users, Shield, Lock, Unlock, UserCheck } from "lucide-react";
import { farmService } from "../services/farmService";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";

export function AccountsPage() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState({ users: [], roles: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    email: "",
    role: "Staff",
  });

  const [alert, setAlert] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await farmService.getAccounts({ q: search });
      setData(res);
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải danh sách tài khoản." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [search]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await farmService.createAccount(formData);
      setAlert({ type: "success", message: `Đã tạo tài khoản ${formData.username} thành công!` });
      setModalOpen(false);
      setFormData({ username: "", password: "", full_name: "", email: "", role: "Staff" });
      fetchAccounts();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi tạo tài khoản." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await farmService.setRole(userId, newRole);
      setAlert({ type: "success", message: "Đã cập nhật phân quyền tài khoản thành công!" });
      fetchAccounts();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi đổi quyền tài khoản." });
    }
  };

  const handleToggle = async (user) => {
    if (user.id === currentUser?.id) {
      setAlert({ type: "warning", message: "Không thể tự khóa tài khoản của chính mình." });
      return;
    }
    try {
      await farmService.toggleAccount(user.id);
      setAlert({ type: "success", message: `Đã ${user.is_active ? "khóa" : "mở khóa"} tài khoản ${user.username}.` });
      fetchAccounts();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi đổi trạng thái tài khoản." });
    }
  };

  return (
    <div>
      {alert.message && (
        <Alert variant={alert.type} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ position: "relative", minWidth: "260px" }}>
          <input
            type="text"
            className="form-control"
            placeholder="Tìm theo username, họ tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "34px" }}
          />
          <Search size={16} style={{ position: "absolute", left: "11px", top: "11px", color: "#94a3b8" }} />
        </div>

        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={18} />
          Tạo tài khoản mới
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Đang tải danh sách tài khoản..." />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Vai trò phân quyền</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data?.users?.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.username}</strong>
                      {isSelf && <span style={{ marginLeft: "6px", fontSize: "0.72rem", color: "#059669" }}>(Bạn)</span>}
                    </td>
                    <td>{u.full_name}</td>
                    <td>{u.email || "—"}</td>
                    <td>
                      {isSelf || u.is_superuser ? (
                        <Badge variant="info">{u.role}</Badge>
                      ) : (
                        <select
                          className="form-control"
                          style={{ padding: "4px 8px", fontSize: "0.82rem", width: "auto" }}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="Manager">Quản lý</option>
                          <option value="Technician">Kỹ thuật viên</option>
                          <option value="Staff">Nhân viên</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <Badge variant={u.is_active ? "success" : "danger"}>
                        {u.is_active ? "Hoạt động" : "Bị khóa"}
                      </Badge>
                    </td>
                    <td>{u.date_joined}</td>
                    <td style={{ textAlign: "right" }}>
                      {!isSelf && !u.is_superuser && (
                        <button
                          className={`btn btn-sm ${u.is_active ? "btn-secondary" : "btn-primary"}`}
                          onClick={() => handleToggle(u)}
                          title={u.is_active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                        >
                          {u.is_active ? <Lock size={14} /> : <Unlock size={14} />}
                          {u.is_active ? "Khóa" : "Mở khóa"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add Account */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tạo tài khoản người dùng mới"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreate}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Tên đăng nhập (*)</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: kythuat2"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu (*)</label>
              <input
                type="password"
                className="form-control"
                placeholder="Tối thiểu 8 ký tự..."
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Họ và tên</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: Nguyễn Văn A"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="email@greenfarm.local"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Vai trò hệ thống (*)</label>
            <select
              className="form-control"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="Staff">Nhân viên (Xem & ghi nhật ký, sử dụng vật tư)</option>
              <option value="Technician">Kỹ thuật viên (Quản lý lô, thu hoạch, hỏi AI)</option>
              <option value="Manager">Quản lý (Toàn quyền, bán hàng, kho tri thức, tài khoản)</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
