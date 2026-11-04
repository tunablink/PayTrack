"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Wallet } from "lucide-react";
import { Button, Field } from "@/components/ui";
import styles from "@/components/auth-page.module.css";

export default function Register() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("password_confirmation") || "");
    setError("");
    if (!username) {
      setError("Vui lòng nhập tên đăng nhập.");
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          password_confirmation: confirmation,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.message ||
            "Không thể đăng ký. Kiểm tra tên đăng nhập và mật khẩu tối thiểu 12 ký tự.",
        );
      }
      setRegistered(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể kết nối máy chủ. Tải lại trang để kiểm tra kết quả đăng ký.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
        <div className={styles.brand}>
          <span>
            <Wallet size={24} />
          </span>
          PayTrack
        </div>
      <section className={styles.panel}>
        <h1 className="mt-2 mb-2">
          {registered ? "Đăng ký thành công" : "Đăng ký"}
        </h1>
        <p className="muted mb-7 mt-7">
          {registered
            ? "Tài khoản đã được tạo. Đăng nhập để tiếp tục."
            : "Quản lý công việc và các khoản phải thu của bạn."}
        </p>
        {!registered && (
          <form onSubmit={submit} className="grid gap-5">
            <Field label="Tên đăng nhập">
              <input
                name="username"
                autoComplete="username"
                minLength={1}
                maxLength={100}
                required
                autoFocus
                disabled={busy}
              />
            </Field>
            <Field label="Mật khẩu">
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={1024}
                required
                disabled={busy}
              />
            </Field>
            <Field label="Xác nhận mật khẩu">
              <input
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={1024}
                required
                disabled={busy}
              />
            </Field>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button primary type="submit" disabled={busy}>
              {busy ? "Đang đăng ký…" : "Đăng ký"}
              <ArrowRight size={17} />
            </Button>
          </form>
        )}
        <div className="mt-7">
          {!registered && (
            <p className="muted text-xs mb-2">Đã có tài khoản?</p>
          )}
          <Link
            href="/login"
            className={registered ? "btn btn-primary w-full" : "text-link"}
          >
            Đăng nhập
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
