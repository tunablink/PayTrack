"use client";
import { useState } from "react";
import { Button, Field } from "./ui";
import { Organization, Payment, money } from "@/lib/types";
export function RecordForm({
  kind,
  record,
  organizations,
  busy,
  onSave,
  onCancel,
}: {
  kind: "organization" | "payment";
  record?: Organization | Payment;
  organizations: Organization[];
  busy: boolean;
  onSave: (p: object) => void;
  onCancel: () => void;
}) {
  const payment = record as Payment | undefined,
    org = record as Organization | undefined;
  const [quantity, setQuantity] = useState(payment?.quantity || "1");
  const [price, setPrice] = useState(String(payment?.unit_price || 0));
  // Integer thousandths provide a display preview; backend Decimal remains authoritative.
  const validPreview =
    /^\d+(\.\d{0,3})?$/.test(quantity) && /^\d+$/.test(price);
  const [whole, fraction = ""] = quantity.split(".");
  const preview = validPreview
    ? Number(
        ((BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"))) *
          BigInt(price || "0") +
          500n) /
          1000n,
      )
    : 0;
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload =
      kind === "organization"
        ? { name: f.get("name"), notes: f.get("notes") }
        : {
            organization_id: Number(f.get("organization_id")),
            description: f.get("description"),
            quantity: f.get("quantity"),
            unit_price: Number(f.get("unit_price")),
            work_date: f.get("work_date"),
            status: f.get("status"),
          };
    onSave({
      ...payload,
      ...(record ? { id: record.id, version: record.version } : {}),
    });
  }
  const localToday = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  return (
    <form onSubmit={submit} className="grid gap-4">
      {kind === "organization" ? (
        <>
          <Field label="Tên đơn vị *">
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={org?.name}
              autoFocus
            />
          </Field>
          <Field label="Ghi chú">
            <textarea
              name="notes"
              rows={4}
              maxLength={2000}
              defaultValue={org?.notes}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Đơn vị *">
            <select
              name="organization_id"
              required
              defaultValue={payment?.organization_id || ""}
              autoFocus
            >
              <option value="" disabled>
                Chọn đơn vị
              </option>
              {organizations.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nội dung công việc *">
            <textarea
              name="description"
              rows={3}
              required
              maxLength={500}
              defaultValue={payment?.description}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Số lượng *">
              <input
                name="quantity"
                type="number"
                min="0.001"
                max="1000000"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </Field>
            <Field label="Đơn giá (đồng) *">
              <input
                name="unit_price"
                type="number"
                min="0"
                max="1000000000000"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </Field>
          </div>
          <div className="preview">
            <span>Thành tiền dự kiến</span>
            <strong>{money(Math.floor(preview))}</strong>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ngày thực hiện *">
              <input
                name="work_date"
                type="date"
                required
                defaultValue={payment?.work_date || localToday}
              />
            </Field>
            <Field label="Trạng thái">
              <select name="status" defaultValue={payment?.status || "UNPAID"}>
                <option value="UNPAID">Chưa nhận</option>
                <option value="PAID">Đã nhận</option>
              </select>
            </Field>
          </div>
          <p className="muted text-xs">
            Làm tròn tới đồng. Thành tiền được backend tính khi lưu.
          </p>
        </>
      )}
      <div className="dialog-footer">
        <Button type="button" disabled={busy} onClick={onCancel}>
          Hủy
        </Button>
        <Button primary type="submit" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
    </form>
  );
}
