import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AppPageProvider } from "./context/AppPageProvider";
import { useApplication } from "./hooks/useApplication";
import { AuthScreen } from "./pages/AuthScreen";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { FeedbackModal } from "./pages/FeedbackModal";
import { GroupPage } from "./pages/GroupPage";
import { JoinInvitePage } from "./pages/JoinInvitePage";
import { ProfilePage } from "./pages/ProfilePage";
import { ShortlistPage } from "./pages/ShortlistPage";

const appPaths = ["/", "/group", "/shortlist", "/analytics", "/profile", "/join"] as const;

function App() {
  const app = useApplication();
  if (!app.user) {
    return (
      <Routes>
        {appPaths.map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <AuthScreen
                mode={app.authMode}
                setMode={app.setAuthMode}
                error={app.error}
                setError={app.setError}
                busy={app.busy}
                authenticate={app.authenticate}
              />
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <AppPageProvider value={app.pageContext}>
      <AppLayout
        user={app.user}
        logout={app.logout}
        error={app.error}
        notice={app.notice}
        setError={app.setError}
        setNotice={app.setNotice}
        modal={
          <FeedbackModal
            feedbackId={app.feedbackId}
            groupId={app.groupId}
            busy={app.busy}
            setFeedbackId={app.setFeedbackId}
            setNotice={app.setNotice}
            act={app.act}
          />
        }
      >
        <Routes>
          <Route path="/join" element={<JoinInvitePage />} />
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/group" element={<GroupPage />} />
          <Route path="/shortlist" element={<ShortlistPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </AppPageProvider>
  );
}

export { App };
