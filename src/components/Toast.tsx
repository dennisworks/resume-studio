import { useEffect } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  kind: "info" | "error";
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: Props) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const ms = toast.kind === "error" ? 6000 : 3000;
    const t = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      className={`toast toast--${toast.kind}`}
      onClick={() => onDismiss(toast.id)}
      role="status"
    >
      {toast.text}
    </div>
  );
}
