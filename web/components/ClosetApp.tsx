"use client";

import { useCallback, useRef, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { AppShell } from "./AppShell";

interface ToastAction {
  label: string;
  onAction: () => void;
}

export function ClosetApp() {
  const [authed, setAuthed] = useState(false);
  const [toastMsg, setToastMsg] = useState("완료했어요.");
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const [toastShow, setToastShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, action?: ToastAction) => {
    setToastMsg(msg);
    setToastAction(action ?? null);
    setToastShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastShow(false), action ? 4200 : 2400);
  }, []);

  return (
    <>
      {authed ? (
        <AppShell toast={toast} onLogout={() => setAuthed(false)} />
      ) : (
        <AuthScreen
          toast={toast}
          onEnter={(msg) => {
            setAuthed(true);
            toast(msg || "로그인했어요");
          }}
        />
      )}
      <div
        className={"toast" + (toastShow ? " show" : "")}
        id="toast"
        role="status"
        aria-live="polite"
      >
        <span>{toastMsg}</span>
        {toastAction && (
          <button
            className="toast-action"
            onClick={() => {
              toastAction.onAction();
              setToastShow(false);
            }}
          >
            {toastAction.label}
          </button>
        )}
      </div>
    </>
  );
}
