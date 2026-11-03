"use client";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
} from "react";
import { X } from "lucide-react";
export function Button({
  primary = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...props}
      className={`btn ${primary ? "btn-primary" : ""} ${className}`}
    />
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
export function Badge({ status }: { status: "PAID" | "UNPAID" }) {
  return (
    <span className={`badge ${status === "PAID" ? "paid" : "unpaid"}`}>
      {status === "PAID" ? "Đã nhận" : "Chưa nhận"}
    </span>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
  error,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 id="dialog-title">{title}</h2>
          <Button aria-label="Đóng" disabled={busy} onClick={onClose}>
            <X size={17} />
          </Button>
        </div>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
