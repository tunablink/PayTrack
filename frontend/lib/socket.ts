export type Connection =
  | "connecting"
  | "connected"
  | "disconnected"
  | "expired";
type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  write: boolean;
};
export class SocketClient {
  socket: WebSocket | null = null;
  pending = new Map<string, Pending>();
  stopped = false;
  attempts = 0;
  retry: ReturnType<typeof setTimeout> | undefined;
  heartbeat: ReturnType<typeof setInterval> | undefined;
  private failPending() {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(
        new Error(
          entry.write
            ? "Kết quả lưu chưa xác định do mất kết nối. Hệ thống sẽ đồng bộ lại; kiểm tra dữ liệu trước khi thử lại."
            : "Mất kết nối. Dữ liệu đã tải vẫn được giữ để xem.",
        ),
      );
    }
    this.pending.clear();
  }
  private offline = () => {
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.failPending();
    const previous = this.socket;
    this.socket = null;
    previous?.close();
    this.change("disconnected");
  };
  private online = () => {
    if (
      !this.stopped &&
      (!this.socket || this.socket.readyState === WebSocket.CLOSED)
    ) {
      clearTimeout(this.retry);
      this.attempts = 0;
      this.connect();
    }
  };
  constructor(
    private change: (s: Connection) => void,
    private refreshed: () => void,
  ) {
    window.addEventListener("offline", this.offline);
    window.addEventListener("online", this.online);
  }
  connect() {
    if (this.stopped) return;
    if (!navigator.onLine) {
      this.change("disconnected");
      return;
    }
    this.change("connecting");
    const url =
      process.env.NEXT_PUBLIC_WS_URL ||
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8000/ws`;
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket || this.stopped) {
        socket.close();
        return;
      }
      this.attempts = 0;
      this.change("connected");
      this.refreshed();
      this.heartbeat = setInterval(() => {
        this.request("system.ping", {}).catch(() => socket.close());
      }, 15000);
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      let response;
      try {
        response = JSON.parse(event.data);
      } catch {
        return;
      }
      const entry = this.pending.get(response.requestId);
      if (!entry) return;
      clearTimeout(entry.timer);
      this.pending.delete(response.requestId);
      if (response.success) entry.resolve(response.data);
      else {
        entry.reject(
          new Error(response.error?.message || "Không thể xử lý thao tác."),
        );
        if (response.error?.code === "UNAUTHORIZED") {
          this.stopped = true;
          this.change("expired");
          socket.close();
        }
      }
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      clearInterval(this.heartbeat);
      this.failPending();
      if (event.code === 4401 || this.stopped) {
        if (event.code === 4401) this.change("expired");
        return;
      }
      this.change("disconnected");
      if (!navigator.onLine) return;
      this.retry = setTimeout(
        () => this.connect(),
        Math.min(
          30000,
          1000 *
            2 ** Math.min(this.attempts++, 5) *
            (0.75 + Math.random() * 0.5),
        ),
      );
    };
    socket.onerror = () => socket.close();
  }
  request<T>(action: string, payload: object, write = false): Promise<T> {
    if (!navigator.onLine || this.socket?.readyState !== WebSocket.OPEN)
      return Promise.reject(
        new Error("Chưa kết nối. Vui lòng chờ kết nối lại."),
      );
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new Error(
            write
              ? "Hết thời gian chờ. Kết quả lưu chưa xác định; tải lại và kiểm tra trước khi thử lại."
              : "Hết thời gian chờ phản hồi.",
          ),
        );
        this.socket?.close();
      }, 12000);
      this.pending.set(requestId, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
        write,
      });
      this.socket!.send(
        JSON.stringify({
          requestId,
          action,
          payload,
          ...(write ? { idempotencyKey: crypto.randomUUID() } : {}),
        }),
      );
    });
  }
  close() {
    this.stopped = true;
    window.removeEventListener("offline", this.offline);
    window.removeEventListener("online", this.online);
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.failPending();
    this.socket?.close();
  }
}
