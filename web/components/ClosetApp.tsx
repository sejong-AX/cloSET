"use client";

import { useCallback, useRef, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { AppShell } from "./AppShell";

export function ClosetApp() {
  const [authed, setAuthed] = useState(false);
  const [toastMsg, setToastMsg] = useState("완료했어요.");
  const [toastShow, setToastShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastShow(false), 2400);
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
      <div className={"toast" + (toastShow ? " show" : "")} id="toast" role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  );
}
