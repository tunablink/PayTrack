"use client";

import { DatabaseBackup, LogOut } from "lucide-react";
import { Button } from "./ui";
import styles from "./workspace-header.module.css";

type Props = {
  title: string;
  username: string;
  busy: boolean;
  canBackup: boolean;
  onBackup: () => void;
  onLogout: () => void;
};

export default function WorkspaceHeader({
  title,
  username,
  busy,
  canBackup,
  onBackup,
  onLogout,
}: Props) {
  const initials = username.trim().slice(0, 2).toLocaleUpperCase("vi-VN");

  return (
    <header className={styles.header}>
      <div className={styles.context}>
        <span className={styles.contextLabel}>Không gian làm việc</span>
        <span className={styles.separator} aria-hidden="true">
          /
        </span>
        <strong>{title}</strong>
      </div>
      <div className={styles.actions}>
        {canBackup && (
          <Button
            className={styles.backup}
            aria-label="Sao lưu dữ liệu"
            title="Sao lưu dữ liệu"
            onClick={onBackup}
          >
            <DatabaseBackup size={17} />
          </Button>
        )}
        <div
          className={styles.profile}
          role="group"
          aria-label="Tài khoản người dùng"
        >
          <span
            className={styles.avatar}
            aria-hidden="true"
            data-testid="account-avatar"
          >
            {initials || "…"}
          </span>
          <div className={styles.meta}>
            <span
              className={styles.name}
              title={username}
              data-testid="account-name"
            >
              {username || "Đang tải…"}
            </span>
          </div>
          <div className={styles.controls}>
            <Button
              className={styles.logout}
              aria-label="Đăng xuất"
              title="Đăng xuất"
              onClick={onLogout}
              disabled={busy}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
