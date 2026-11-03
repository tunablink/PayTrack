export type Organization = {
  id: number;
  name: string;
  notes: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Payment = {
  id: number;
  organization_id: number;
  organization_name: string;
  description: string;
  quantity: string;
  unit_price: number;
  amount: number;
  work_date: string;
  status: "PAID" | "UNPAID";
  version: number;
  created_at: string;
  updated_at: string;
};
export type Totals = {
  total: number;
  paid: number;
  unpaid: number;
  count: number;
  paid_count: number;
  unpaid_count: number;
};
export type Summary = {
  totals: Totals;
  organizations: (Totals & { id: number; name: string })[];
  periods: (Totals & { period: string })[];
};
export type PaymentList = {
  items: Payment[];
  total: number;
  page: number;
  page_size: number;
};
export type Filters = {
  search: string;
  organization_id: string;
  status: string;
  start_date: string;
  end_date: string;
};
export const money = (v: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(v);
export const day = (v: string) => v.split("-").reverse().join("/");
export const timestamp = (v: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(v));
