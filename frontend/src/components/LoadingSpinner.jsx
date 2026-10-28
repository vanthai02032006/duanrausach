import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingSpinner({ text = "Đang tải dữ liệu..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: "12px", color: "var(--text-muted)" }}>
      <Loader2 size={32} className="animate-spin" style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
      <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>{text}</span>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
