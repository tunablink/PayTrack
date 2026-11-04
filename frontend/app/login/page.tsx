"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/ui";
import { ArrowRight, Wallet } from "lucide-react";
import styles from "@/components/auth-page.module.css";
export default function Login() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password"),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Không thể đăng nhập.");
      }
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể kết nối máy chủ.");
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
        <h1 className="mt-2 mb-2">Đăng nhập</h1>
        <p className="muted mb-7">
          Quản lý công việc và các khoản phải thu của bạn.
        </p>
        <form onSubmit={submit} className="grid gap-5">
          <Field label="Tên đăng nhập">
            <input
              name="username"
              autoComplete="username"
              maxLength={100}
              required
              autoFocus
            />
          </Field>
          <Field label="Mật khẩu">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
            />
          </Field>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button primary disabled={busy} type="submit">
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            <ArrowRight size={17} />
          </Button>
        </form>
        <div className="mt-7">
          <p className="muted text-xs mb-2">Chưa có tài khoản chủ sở hữu?</p>
          <Link href="/register" className="text-link">
            Đăng ký tài khoản
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
