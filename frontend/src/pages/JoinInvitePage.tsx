import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { PageHeading } from "../components/PageHeading";
import { useAppPageContext } from "../hooks/useAppPageContext";

export function JoinInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const attemptedToken = useRef("");
  const { loadGroups, setGroupId, setNotice, setError, setPage } = useAppPageContext();

  useEffect(() => {
    if (!token) {
      setError("This invite link is missing its token.");
      return;
    }
    if (attemptedToken.current === token) return;
    attemptedToken.current = token;
    api<{ joined: boolean; groupId: string }>("/api/groups/join", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(async ({ groupId }) => {
        await loadGroups();
        setGroupId(groupId);
        setNotice("You joined the group.");
        setPage("group");
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Could not join this group.");
        setPage("group");
      });
  }, [token, loadGroups, setError, setGroupId, setNotice, setPage]);

  return (
    <PageHeading
      eyebrow="GROUP INVITATION"
      title={<>Joining your <em>people.</em></>}
      description="We’re checking your invite link and adding you to the group."
    />
  );
}
