import React, { Suspense, lazy, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const DocumentsPage = lazy(() =>
  import("@/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage }))
);
const AskPage = lazy(() =>
  import("@/pages/AskPage").then((m) => ({ default: m.AskPage }))
);
const AnalyticsPage = lazy(() =>
  import("@/pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage }))
);
const TopicsPage = lazy(() =>
  import("@/pages/TopicsPage").then((m) => ({ default: m.TopicsPage }))
);
const ReportStudioPage = lazy(() =>
  import("@/pages/ReportStudioPage").then((m) => ({ default: m.ReportStudioPage }))
);
const DataExplorerPage = lazy(() =>
  import("@/pages/DataExplorerPage").then((m) => ({ default: m.DataExplorerPage }))
);
const ValidationPage = lazy(() =>
  import("@/pages/ValidationPage").then((m) => ({ default: m.ValidationPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
import { NavigationTab, OrganisationFilter, EvidenceSnippet } from "@/types";
import { useHashRoute } from "@/lib/useHashRoute";

export function App() {
  // Tab lives in the URL hash so Back/Forward, deep links and refresh all work.
  const [currentTab, setCurrentTab, routeParam] = useHashRoute();
  const [selectedOrganisation, setSelectedOrganisation] = useState<OrganisationFilter>("ALL");
  const [activeEvidence, setActiveEvidence] = useState<EvidenceSnippet | null>(null);

  const handleInspectEvidence = (evidence: EvidenceSnippet) => {
    setActiveEvidence(evidence);
  };

  const handleCloseEvidence = () => {
    setActiveEvidence(null);
  };

  const handleQuickUpload = () => {
    setCurrentTab("documents");
  };

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      selectedOrganisation={selectedOrganisation}
      onSelectOrganisation={setSelectedOrganisation}
      activeEvidence={activeEvidence}
      onCloseEvidence={handleCloseEvidence}
      onQuickUpload={handleQuickUpload}
    >
      {/* A page crash is contained here rather than blanking the whole app. */}
      <ErrorBoundary resetKey={currentTab}>
      {/* Pages are code-split, so a brief fallback covers the chunk fetch. */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
      {currentTab === "dashboard" && (
        <DashboardPage
          onNavigate={setCurrentTab}
          onInspectEvidence={handleInspectEvidence}
          selectedOrganisation={selectedOrganisation}
        />
      )}

      {currentTab === "documents" && (
        <DocumentsPage
          onInspectEvidence={handleInspectEvidence}
          selectedOrganisation={selectedOrganisation}
          /* #/documents/12 — set by the command palette, or a shared link. */
          focusDocumentId={routeParam ? Number(routeParam) : undefined}
        />
      )}

      {currentTab === "ask" && (
        <AskPage
          onInspectEvidence={handleInspectEvidence}
          selectedOrganisation={selectedOrganisation}
        />
      )}

      {currentTab === "analytics" && (
        <AnalyticsPage selectedOrganisation={selectedOrganisation} />
      )}

      {currentTab === "topics" && (
        <TopicsPage
          onInspectEvidence={handleInspectEvidence}
          selectedOrganisation={selectedOrganisation}
        />
      )}

      {currentTab === "reports" && <ReportStudioPage />}

      {currentTab === "explorer" && (
        <DataExplorerPage
          onInspectEvidence={handleInspectEvidence}
          selectedOrganisation={selectedOrganisation}
        />
      )}

      {currentTab === "validation" && (
        <ValidationPage
          onInspectEvidence={handleInspectEvidence}
          selectedOrganisation={selectedOrganisation}
        />
      )}

      {currentTab === "settings" && (
        <SettingsPage />
      )}
      </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

export default App;
