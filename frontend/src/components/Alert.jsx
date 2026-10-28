import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

export function Alert({ variant = "info", message, onClose }) {
  if (!message) return null;

  const icons = {
    success: <CheckCircle2 size={18} className="flex-shrink-0" />,
    danger: <AlertCircle size={18} className="flex-shrink-0" />,
    warning: <AlertTriangle size={18} className="flex-shrink-0" />,
    info: <Info size={18} className="flex-shrink-0" />,
  };

  return (
    <div className={`alert alert-${variant}`}>
      {icons[variant] || icons.info}
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: "bold" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
