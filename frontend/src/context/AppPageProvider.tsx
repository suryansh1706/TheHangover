import type { ReactNode } from "react";
import { appPageContext, type AppPageContextValue } from "./AppPageContext";
export function AppPageProvider({
  value,
  children,
}: {
  value: AppPageContextValue;
  children: ReactNode;
}) {
  return <appPageContext.Provider value={value}>{children}</appPageContext.Provider>;
}
