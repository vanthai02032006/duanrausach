export function formatVND(value) {
  if (value == null) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

export function formatKg(value) {
  if (value == null) return "0 kg";
  return `${Number(value).toLocaleString("vi-VN")} kg`;
}

export function formatDate(dateString) {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
}
