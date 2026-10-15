import { useContext } from "react";
import { appPageContext } from "../context/AppPageContext";
export function useAppPageContext() {
  const context = useContext(appPageContext);
  if (!context) throw new Error("Page components must be rendered inside AppPageProvider");
  return context;
}
