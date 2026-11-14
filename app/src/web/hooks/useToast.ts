/** Transient toast message state shared by the shell and the panes. */

import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [toastState, setToastState] = useState({ message: "", show: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string) => {
    setToastState({ message, show: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastState((prev) => ({ ...prev, show: false }));
    }, 3200);
  }, []);

  return { toast, toastState };
}
