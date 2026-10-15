import type { ReactNode } from "react";
export function Notice({ children, type }: { children: ReactNode; type: "error" | "success" }) {
  return (
    <div className={`notice ${type}`} role={type === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
