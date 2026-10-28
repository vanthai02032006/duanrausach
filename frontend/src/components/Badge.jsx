import React from "react";

export function Badge({ children, variant = "neutral" }) {
  const variantClass = `badge-${variant}`;
  return <span className={`badge ${variantClass}`}>{children}</span>;
}
