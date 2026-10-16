import { useState } from "react";

type Action = (work: () => Promise<void>) => Promise<void>;

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  
  const act: Action = async (work) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, notice, setError, setNotice, act };
}
