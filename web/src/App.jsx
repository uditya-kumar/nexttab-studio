import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAccount } from "./lib/account.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Connect from "./pages/Connect.jsx";
import Overview from "./pages/Overview.jsx";
import Content from "./pages/Content.jsx";
import Compose from "./pages/Compose.jsx";
import Analytics from "./pages/Analytics.jsx";
import Inbox from "./pages/Inbox.jsx";
import Comments from "./pages/Comments.jsx";
import Automations from "./pages/Automations.jsx";
import AutomationEditor from "./pages/AutomationEditor.jsx";
import Settings from "./pages/Settings.jsx";
import { Empty, ErrorNotice, Spinner } from "./components/ui.jsx";

export default function App() {
  const { session, hasKey, accountsQuery, account } = useAccount();
  const location = useLocation();

  let content;
  if (session.isLoading) {
    content = <Centered><Spinner /></Centered>;
  } else if (session.isError) {
    content = (
      <div className="page">
        <ErrorNotice error={session.error} onRetry={() => session.refetch()} />
      </div>
    );
  } else if (!hasKey && location.pathname !== "/settings") {
    content = <Connect />;
  } else if (hasKey && accountsQuery.isLoading) {
    content = <Centered><Spinner /></Centered>;
  } else if (hasKey && accountsQuery.isError && location.pathname !== "/settings") {
    content = (
      <div className="page">
        <ErrorNotice error={accountsQuery.error} onRetry={() => accountsQuery.refetch()} />
      </div>
    );
  } else if (hasKey && !account && location.pathname !== "/settings") {
    content = (
      <div className="page">
        <Empty title="No Instagram account connected">
          Connect an Instagram professional account in your provider dashboard, then reload this page
        </Empty>
      </div>
    );
  } else {
    content = (
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/content" element={<Content />} />
        <Route path="/compose" element={<Compose />} />
        <Route path="/compose/:postId" element={<Compose />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/comments" element={<Comments />} />
        <Route path="/automations" element={<Automations />} />
        <Route path="/automations/new" element={<AutomationEditor />} />
        <Route path="/automations/:id" element={<AutomationEditor />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="main" key={location.pathname}>
        {content}
      </main>
    </div>
  );
}

function Centered({ children }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", color: "var(--text-3)" }}>{children}</div>;
}
