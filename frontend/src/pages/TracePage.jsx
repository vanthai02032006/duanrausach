import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  QrCode, 
  CheckCircle2, 
  Calendar, 
  AlertCircle, 
  Camera, 
  CameraOff, 
  RefreshCw, 
  Download, 
  Printer, 
  ShieldCheck, 
  ShieldAlert, 
  Sprout, 
  PackageCheck, 
  Info,
  Upload
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { farmService } from "../services/farmService";
import { Badge } from "../components/Badge";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function TracePage({ initialCode = "" }) {
  const [activeTab, setActiveTab] = useState("camera"); // "camera" | "manual"
  const [code, setCode] = useState(initialCode || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(!initialCode);
  
  // Camera scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Sẵn sàng quét mã QR trên bao bì rau sạch.");
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState("environment"); // "environment" | "user"
  const qrScannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const scannerContainerId = "react-qr-reader";

  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError("");
    setCameraStatus("Đang đọc mã QR từ file ảnh...");
    try {
      if (!qrScannerRef.current) {
        qrScannerRef.current = new Html5Qrcode(scannerContainerId);
      }
      const decodedText = await qrScannerRef.current.scanFile(file, true);
      const clean = sanitizeScannedCode(decodedText);
      if (clean) {
        setCameraStatus(`✔ Đã đọc thành công mã từ ảnh: ${clean}`);
        setCode(clean);
        handleSearch(clean);
      } else {
        setCameraError("Ảnh không chứa mã hợp lệ hoặc không thuộc hệ thống GreenFarm.");
      }
    } catch (err) {
      console.warn("File scan error:", err);
      setCameraError("Không nhận diện được mã QR trong ảnh. Vui lòng chọn ảnh chụp rõ nét hơn.");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Sanitize scanned text safely
  const sanitizeScannedCode = (decodedText) => {
    if (!decodedText || typeof decodedText !== "string") return "";
    let text = decodedText.trim();
    if (text.startsWith("http://") || text.startsWith("https://")) {
      try {
        const parsed = new URL(text);
        if (parsed.searchParams.has("code")) {
          text = parsed.searchParams.get("code");
        } else {
          const segments = parsed.pathname.split("/").filter(Boolean);
          if (segments.length >= 2 && segments[0] === "trace") {
            text = segments[1];
          } else if (segments.length >= 1) {
            text = segments[segments.length - 1];
          }
        }
      } catch (e) {
        console.warn("URL parse error:", e);
      }
    }
    return text.replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 64);
  };

  const handleSearch = async (codeToSearch) => {
    const raw = codeToSearch || code;
    const clean = sanitizeScannedCode(raw);
    if (!clean) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await farmService.traceCode(clean);
      setResult(data);
      setShowScanner(false);
    } catch (err) {
      if (err.status === 410 && err.data) {
        // Mã đã bị vô hiệu hóa
        setResult(err.data);
      } else if (err.status === 404) {
        setResult({ searched: true, found: false, code: clean });
      } else {
        setError(err.message || "Lỗi khi tra cứu mã nguồn gốc.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Start QR Scanner
  const startCamera = async () => {
    setCameraError("");
    setCameraStatus("Đang khởi tạo camera...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Trình duyệt không hỗ trợ camera hoặc trang chưa bật HTTPS/localhost.");
      return;
    }

    try {
      if (!qrScannerRef.current) {
        qrScannerRef.current = new Html5Qrcode(scannerContainerId);
      }

      await qrScannerRef.current.start(
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const clean = sanitizeScannedCode(decodedText);
          if (clean) {
            setCameraStatus(`✔ Đã quét thành công mã: ${clean}`);
            stopCamera();
            setCode(clean);
            handleSearch(clean);
          } else {
            setCameraStatus("Mã QR không hợp lệ hoặc không thuộc hệ thống GreenFarm.");
          }
        },
        () => {
          // Frame check - silent
        }
      );

      setIsScanning(true);
      setCameraStatus("Đang quét... Hướng camera về mã QR trên bao bì.");
    } catch (err) {
      console.error("Camera start error:", err);
      setIsScanning(false);
      let msg = "Không thể truy cập camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Quyền truy cập camera bị từ chối. Vui lòng cho phép quyền trên trình duyệt.";
      } else if (err.name === "NotFoundError") {
        msg = "Không tìm thấy thiết bị camera trên máy.";
      }
      setCameraError(msg);
      setCameraStatus(msg);
    }
  };

  // Stop QR Scanner
  const stopCamera = async () => {
    if (qrScannerRef.current && isScanning) {
      try {
        await qrScannerRef.current.stop();
      } catch (e) {
        console.warn("Stop scanner error:", e);
      }
      setIsScanning(false);
      setCameraStatus("Đã dừng quét camera.");
    }
  };

  // Switch facing camera (front/back)
  const toggleCameraFacing = async () => {
    await stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  useEffect(() => {
    if (initialCode) {
      handleSearch(initialCode);
    }
    return () => {
      if (qrScannerRef.current && isScanning) {
        qrScannerRef.current.stop().catch(() => {});
      }
    };
  }, [initialCode]);

  // Restart camera when facingMode toggles
  useEffect(() => {
    if (isScanning) {
      startCamera();
    }
  }, [facingMode]);

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* Header Info */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 14px",
          background: "#ecfdf5",
          color: "#059669",
          borderRadius: "20px",
          fontSize: "0.82rem",
          fontWeight: 700,
          marginBottom: "10px"
        }}>
          <ShieldCheck size={16} /> HỆ THỐNG TRUY XUẤT MINH BẠCH GREENFARM AI
        </div>
        <h2 style={{ fontSize: "1.7rem", fontWeight: 800, color: "#064e3b", margin: "0 0 6px" }}>
          Truy xuất nguồn gốc rau sạch
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: "560px", margin: "0 auto" }}>
          Quét mã QR trên tem bao bì bằng camera điện thoại hoặc nhập mã lô trồng để kiểm chứng toàn bộ quy trình gieo trồng, chăm sóc và thu hoạch.
        </p>
      </div>

      {/* Toggle header when result already found */}
      {result && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          padding: "10px 16px",
          borderRadius: "12px",
          flexWrap: "wrap",
          gap: "8px",
          boxShadow: "0 2px 6px rgba(16,185,129,0.08)"
        }}>
          <span style={{ fontSize: "0.85rem", color: "#065f46", fontWeight: 700 }}>
            🌱 Đang hiển thị kết quả cho mã: <code style={{ background: "#fff", padding: "3px 8px", borderRadius: "6px", border: "1px solid #a7f3d0", fontWeight: 800 }}>{code || initialCode}</code>
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowScanner((prev) => !prev)}
            style={{ fontSize: "0.8rem", background: "#fff", fontWeight: 600 }}
          >
            {showScanner ? "▲ Thu gọn khung quét" : "🔍 Tra cứu mã khác / Quét lại"}
          </button>
        </div>
      )}

      {/* Methods Tabs Card (Auto-collapsed when result is loaded) */}
      {(!result || showScanner) && (
        <div className="card" style={{ marginBottom: "26px", padding: "20px" }}>
        <div style={{ display: "flex", gap: "10px", borderBottom: "2px solid #edf4f0", paddingBottom: "12px", marginBottom: "18px" }}>
          <button
            type="button"
            className={`btn ${activeTab === "camera" ? "btn-primary" : "btn-outline"}`}
            onClick={() => {
              setActiveTab("camera");
            }}
            style={{ fontSize: "0.88rem" }}
          >
            <Camera size={16} /> Phương thức A: Quét mã QR bằng Camera
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "manual" ? "btn-primary" : "btn-outline"}`}
            onClick={() => {
              setActiveTab("manual");
              stopCamera();
            }}
            style={{ fontSize: "0.88rem" }}
          >
            <Search size={16} /> Phương thức B: Nhập mã thủ công
          </button>
        </div>

        {/* Tab A: Camera */}
        {activeTab === "camera" && (
          <div style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}>
            <div style={{
              position: "relative",
              width: "100%",
              minHeight: "260px",
              background: "#0f1c13",
              borderRadius: "14px",
              overflow: "hidden",
              border: "2px dashed #10b981",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "14px",
            }}>
              <div id={scannerContainerId} style={{ width: "100%" }} />

              {!isScanning && (
                <div style={{ padding: "30px 20px", color: "#d1fae5" }}>
                  <QrCode size={52} style={{ margin: "0 auto 12px", color: "#34d399" }} />
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "6px" }}>Camera chưa kích hoạt</div>
                  <div style={{ fontSize: "0.82rem", opacity: 0.85, maxWidth: "340px", margin: "0 auto" }}>
                    Nhấn nút “Mở camera quét QR” bên dưới và cho phép trình duyệt truy cập camera thiết bị của bạn.
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
              {!isScanning ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={startCamera}>
                    <Camera size={18} /> Mở camera quét QR
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={18} /> Tải ảnh QR từ máy
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleFileScan}
                  />
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={stopCamera}>
                    <CameraOff size={18} /> Dừng quét
                  </button>
                  <button type="button" className="btn btn-outline" onClick={toggleCameraFacing}>
                    <RefreshCw size={16} /> Đổi camera
                  </button>
                </>
              )}
            </div>

            <div style={{
              marginTop: "12px",
              fontSize: "0.82rem",
              color: cameraError ? "#dc2626" : "#059669",
              fontWeight: 600,
            }}>
              {cameraError || cameraStatus}
            </div>

            {/* Quick Demo Chips */}
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed #e2e8f0", fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "6px" }}>
              <span>Thử nhanh mã mẫu: </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  stopCamera();
                  setCode("GF-ROM-A12901");
                  handleSearch("GF-ROM-A12901");
                }}
                style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", padding: "2px 8px" }}
              >
                GF-ROM-A12901 (Xà lách Romaine)
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  stopCamera();
                  setCode("GF-D6DCF7C9FE41");
                  handleSearch("GF-D6DCF7C9FE41");
                }}
                style={{ background: "#f0fdf4", color: "#047857", border: "1px solid #86efac", padding: "2px 8px" }}
              >
                GF-D6DCF7C9FE41 (Xà lách VietGAP)
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  stopCamera();
                  setCode("LO-A01");
                  handleSearch("LO-A01");
                }}
                style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "2px 8px" }}
              >
                LO-A01 (Lô đang trồng)
              </button>
            </div>
          </div>
        )}

        {/* Tab B: Manual */}
        {activeTab === "manual" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              style={{ display: "flex", gap: "10px" }}
            >
              <input
                type="text"
                className="form-control"
                placeholder="Ví dụ: LOT-ACT-01 hoặc GF-XXXXXXXXXXXX..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                style={{ fontSize: "0.95rem", padding: "12px 16px" }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: "0 24px" }} disabled={loading}>
                <Search size={18} /> Tra cứu
              </button>
            </form>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div>💡 Nhấn <strong>Enter</strong> để tra cứu ngay. Hỗ trợ cả mã lô trồng và mã truy xuất thu hoạch.</div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span>Thử nhanh:</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setCode("GF-D6DCF7C9FE41");
                    handleSearch("GF-D6DCF7C9FE41");
                  }}
                  style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", padding: "1px 6px", fontSize: "0.76rem" }}
                >
                  GF-D6DCF7C9FE41
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setCode("LO-A01");
                    handleSearch("LO-A01");
                  }}
                  style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "1px 6px", fontSize: "0.76rem" }}
                >
                  LO-A01
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {loading && <LoadingSpinner text="Đang tra cứu dữ liệu từ sổ tay canh tác GreenFarm AI..." />}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* ================= KẾT QUẢ XÁC MINH ================= */}

      {/* 1. Mã đã bị vô hiệu hóa */}
      {result && (result.status === "revoked" || result.is_active === false) && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "14px",
          padding: "20px 24px",
          color: "#991b1b",
          marginBottom: "24px",
          display: "flex",
          gap: "16px",
          alignItems: "flex-start",
        }}>
          <ShieldAlert size={36} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 6px" }}>Mã không còn hiệu lực</h3>
            <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6 }}>
              Mã truy xuất <strong>{result.code}</strong> đã bị quản lý nông trại vô hiệu hóa hoặc thu hồi.
            </p>
            {result.revocation && (
              <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(255,255,255,0.7)", borderRadius: "8px", fontSize: "0.82rem" }}>
                <div><strong>Lý do:</strong> {result.revocation.reason || "Vô hiệu hóa theo quy trình kiểm tra chất lượng"}</div>
                <div><strong>Thời điểm vô hiệu hóa:</strong> {result.revocation.revoked_at || "Chưa có dữ liệu ghi nhận"}</div>
              </div>
            )}
            <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: "8px" }}>
              Thời điểm kiểm tra: {result.verification?.updated_at || "Hiện tại"} · GreenFarm AI Security
            </div>
          </div>
        </div>
      )}

      {/* 2. Không tìm thấy mã */}
      {result && result.searched && !result.found && result.status !== "revoked" && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <AlertCircle size={40} style={{ color: "#d97706", margin: "0 auto 12px" }} />
          <h4 style={{ color: "#b45309", fontSize: "1.15rem", fontWeight: 700 }}>Không tìm thấy mã</h4>
          <p style={{ marginTop: "6px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Không tìm thấy thông tin nào khớp với mã: <strong>{result.code}</strong>.
          </p>
          <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "10px" }}>
            Vui lòng kiểm tra lại mã in trên bao bì hoặc thử mã mẫu như <code>LOT-ACT-01</code>.
          </div>
        </div>
      )}

      {/* 3. Tìm thấy hợp lệ */}
      {result && result.found && result.status !== "revoked" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Verification Badge Header based on Rule 2 Quality */}
          {result.quality_grade === "pending" || result.verification?.status === "pending_inspection" ? (
            <div style={{
              background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
              border: "1px solid #fde68a",
              borderRadius: "14px",
              padding: "18px 22px",
              color: "#92400e",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 2px 8px rgba(217,119,6,0.08)"
            }}>
              <AlertCircle size={34} style={{ color: "#d97706", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#b45309" }}>Đang chờ kiểm định chất lượng nội bộ</div>
                <div style={{ fontSize: "0.85rem", opacity: 0.95, marginTop: "2px", color: "#92400e" }}>
                  <strong>CẢNH BÁO CHO KHÁCH HÀNG:</strong> Lô nông sản này vừa thu hoạch và đang trong quá trình xét nghiệm chất lượng nội bộ tại trang trại GreenFarm AI. <u>Chưa đủ điều kiện và chưa được cấp phép xuất bán ra thị trường</u>.
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: "0.78rem", opacity: 0.9 }}>
                <span className="badge badge-warning" style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fcd34d", fontWeight: 700 }}>Chờ kiểm tra</span>
              </div>
            </div>
          ) : result.quality_grade === "review" || result.verification?.status === "failed_inspection" ? (
            <div style={{
              background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
              border: "1px solid #fecaca",
              borderRadius: "14px",
              padding: "18px 22px",
              color: "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 2px 8px rgba(220,38,38,0.08)"
            }}>
              <ShieldAlert size={34} style={{ color: "#dc2626", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#991b1b" }}>Cần kiểm tra lại - Chưa đạt chuẩn xuất xưởng</div>
                <div style={{ fontSize: "0.85rem", opacity: 0.95, marginTop: "2px", color: "#7f1d1d" }}>
                  <strong>CẢNH BÁO:</strong> Lô nông sản chưa đạt tiêu chuẩn an toàn thực phẩm VietGAP để xuất xưởng thương mại. Không được phép lưu hành.
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: "0.78rem", opacity: 0.9 }}>
                <span className="badge badge-danger" style={{ fontWeight: 700 }}>Cần kiểm tra lại</span>
              </div>
            </div>
          ) : (
            <div style={{
              background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
              border: "1px solid #a7f3d0",
              borderRadius: "14px",
              padding: "18px 22px",
              color: "#065f46",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 2px 8px rgba(16,185,129,0.08)"
            }}>
              <ShieldCheck size={34} style={{ color: "#059669", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>Đạt chuẩn an toàn VietGAP</div>
                <div style={{ fontSize: "0.85rem", opacity: 0.9, marginTop: "2px" }}>
                  {result.verification?.note || "Nông sản đã hoàn tất kiểm nghiệm chất lượng, đạt tiêu chuẩn an toàn thực phẩm VietGAP và đủ điều kiện lưu hành thương mại."}
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: "0.78rem", opacity: 0.8 }}>
                <div>Cập nhật: {result.verification?.updated_at || "Hiện tại"}</div>
                <div style={{ fontWeight: 700, color: "#059669" }}>✔ Đạt yêu cầu</div>
              </div>
            </div>
          )}

          {/* Overview Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
            {/* Left: Product & Planting info */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid #edf4f0", paddingBottom: "14px" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#059669", letterSpacing: "1px" }}>
                    NÔNG SẢN MINH BẠCH
                  </div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#064e3b", margin: "4px 0" }}>
                    {result.product?.name || "Chưa có dữ liệu ghi nhận"}
                  </h2>
                  <div style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                    Giống: <strong>{result.product?.variety || "Chưa có dữ liệu ghi nhận"}</strong>
                  </div>
                </div>
                <Badge variant="success">
                  {result.product?.status || "Đang canh tác"}
                </Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "18px" }}>
                <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>MÃ LÔ TRỒNG</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{result.product?.lot_code || "Chưa có dữ liệu ghi nhận"}</div>
                </div>
                <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>MÃ TRUY XUẤT</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", fontFamily: "monospace" }}>{result.product?.trace_code || result.code}</div>
                </div>
                <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>DIỆN TÍCH</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {result.product?.area_m2 ? `${result.product.area_m2} m²` : "Chưa có dữ liệu ghi nhận"}
                  </div>
                </div>
                <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>NGÀY GIEO TRỒNG</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{result.planting?.planting_date || "Chưa có dữ liệu ghi nhận"}</div>
                </div>
              </div>

              <div style={{ background: "#f0fdf4", borderLeft: "4px solid #059669", padding: "12px 16px", borderRadius: "0 8px 8px 0" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#065f46" }}>KHU VỰC CANH TÁC:</div>
                <div style={{ fontSize: "0.88rem", color: "#064e3b", marginTop: "2px" }}>
                  {result.planting?.farm_location || "GreenFarm AI Campus Farm (Trang trại mẫu ứng dụng AI)"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#047857", marginTop: "4px" }}>
                  Thời gian sinh trưởng: {result.planting?.growth_days || "—"} ngày · 
                  Dự kiến thu hoạch: {result.planting?.expected_harvest_date || "Chưa có dữ liệu ghi nhận"}
                </div>
              </div>
            </div>

            {/* Right: QR Code & Print sticker */}
            <div className="card" style={{ padding: "20px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#064e3b", marginBottom: "12px" }}>
                  MÃ QR XÁC THỰC
                </div>
                {result.qr?.data_uri ? (
                  <img
                    src={result.qr.data_uri}
                    alt="QR Code"
                    style={{ maxWidth: "160px", width: "100%", margin: "0 auto 12px", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "4px" }}
                  />
                ) : (
                  <div style={{ padding: "30px", background: "#f8fafc", borderRadius: "8px", color: "var(--text-muted)" }}>
                    <QrCode size={40} style={{ margin: "0 auto" }} />
                  </div>
                )}
                <div style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--text-muted)", wordBreak: "break-all" }}>
                  {result.code}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "14px" }}>
                {result.qr?.image_url && (
                  <a
                    href={`${result.qr.image_url}?download=1`}
                    className="btn btn-outline"
                    style={{ fontSize: "0.8rem", justifyContent: "center" }}
                  >
                    <Download size={14} /> Tải mã QR (PNG)
                  </a>
                )}
                {result.qr?.label_url && (
                  <a
                    href={result.qr.label_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ fontSize: "0.8rem", justifyContent: "center" }}
                  >
                    <Printer size={14} /> In tem nhãn QR
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Care Logs (Sanitized) */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "14px" }}>
              Nhật ký chăm sóc minh bạch
            </h3>
            {(!result.care_logs || result.care_logs.length === 0) ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Chưa có dữ liệu ghi nhận hoạt động chăm sóc cho lô này.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {result.care_logs.map((log, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "14px", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: "16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: "#ecfdf5",
                      color: "#059669",
                      whiteSpace: "nowrap",
                      height: "fit-content"
                    }}>
                      {log.activity || "Chăm sóc"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}>
                        {log.date || "Chưa ghi nhận ngày"}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: "2px" }}>
                        {log.note || "Hoạt động chăm sóc định kỳ theo tiêu chuẩn VietGAP."}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "14px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
              🔒 <em>Thông tin cá nhân của nhân viên và ghi chú vận hành nội bộ được ẩn nhằm tuân thủ chính sách an toàn thông tin nông trại.</em>
            </div>
          </div>

          {/* Harvest Details */}
          <div className="card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "14px" }}>
              Thông tin thu hoạch
            </h3>
            {result.harvest ? (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
                padding: "16px 20px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                flexWrap: "wrap",
                gap: "12px",
              }}>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "#065f46" }}>
                    {result.harvest.product_name || result.product?.name}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Ngày thu hoạch: <strong>{result.harvest.harvest_date || "Chưa có dữ liệu ghi nhận"}</strong> · 
                    Sản lượng: <strong>{result.harvest.quantity_kg ? `${result.harvest.quantity_kg} kg` : "Chưa có dữ liệu ghi nhận"}</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#059669", fontWeight: 700, marginTop: "2px", fontFamily: "monospace" }}>
                    Mã đợt: {result.harvest.trace_code}
                  </div>
                </div>
                <div>
                  <Badge variant="success">
                    {result.harvest.quality || "Đạt tiêu chuẩn"}
                  </Badge>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Chưa có dữ liệu thu hoạch được ghi nhận cho lô này.
              </p>
            )}

            {/* Disclaimer */}
            <div style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "8px",
              padding: "12px 16px",
              marginTop: "16px",
              fontSize: "0.8rem",
              color: "#92400e",
              lineHeight: 1.6,
            }}>
              <strong>Cam kết minh bạch:</strong> Dữ liệu truy xuất thể hiện nhật ký gieo trồng và thu hoạch thực tế được hệ thống GreenFarm AI số hóa. Hệ thống không tự động tuyên bố chứng nhận hữu cơ quốc tế khi cơ sở dữ liệu chưa có chứng thư tương ứng.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
