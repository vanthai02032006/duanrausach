import React from "react";

export function StatCard({ label, value, icon, change, changeType = "neutral" }) {
  return (
    <div className="card stat-card">
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {change && (
          <div style={{ fontSize: "0.75rem", color: changeType === "up" ? "#16a34a" : changeType === "down" ? "#dc2626" : "#64748b" }}>
            {change}
          </div>
        )}
      </div>
      {icon && <div className="stat-icon">{icon}</div>}
    </div>
  );
}
