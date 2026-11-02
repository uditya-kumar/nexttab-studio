import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

const ToastContext = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);

  const show = useCallback((message, kind = "ok") => {
    const key = ++id.current;
    setItems((list) => [...list.slice(-2), { key, message, kind }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.key !== key)), kind === "error" ? 7000 : 3500);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.key} className={`toast ${t.kind === "error" ? "error" : ""}`}>
            {t.kind === "error" ? <CircleAlert size={16} strokeWidth={1.5} /> : <CircleCheck size={16} strokeWidth={1.5} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
