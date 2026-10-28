export const LOT_STATUS_CHOICES = [
  { value: "planned", label: "Chuẩn bị gieo", badge: "badge-neutral" },
  { value: "growing", label: "Đang chăm sóc", badge: "badge-info" },
  { value: "ready", label: "Sắp thu hoạch", badge: "badge-warning" },
  { value: "harvested", label: "Đã thu hoạch", badge: "badge-success" },
];

export const CARE_ACTIVITY_CHOICES = [
  { value: "water", label: "Tưới nước" },
  { value: "fertilize", label: "Bón phân" },
  { value: "pest_check", label: "Kiểm tra sâu bệnh" },
  { value: "weed", label: "Làm cỏ" },
  { value: "observe", label: "Quan sát sinh trưởng" },
  { value: "other", label: "Khác" },
];

export const CARE_STATUS_CHOICES = [
  { value: "todo", label: "Chưa thực hiện", badge: "badge-warning" },
  { value: "in_progress", label: "Đang thực hiện", badge: "badge-info" },
  { value: "done", label: "Hoàn thành", badge: "badge-success" },
];

export const MATERIAL_CATEGORY_CHOICES = [
  { value: "seed", label: "Hạt giống" },
  { value: "fertilizer", label: "Phân bón" },
  { value: "bio", label: "Chế phẩm sinh học" },
  { value: "tool", label: "Dụng cụ" },
  { value: "other", label: "Khác" },
];

export const HARVEST_GRADE_CHOICES = [
  { value: "pending", label: "Chờ kiểm tra" },
  { value: "pass", label: "Đạt yêu cầu" },
  { value: "review", label: "Cần kiểm tra lại" },
];
