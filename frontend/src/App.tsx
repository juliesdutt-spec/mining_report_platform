import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { AskPage } from "@/pages/AskPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { TopicsPage } from "@/pages/TopicsPage";
import { ReportStudioPage } from "@/pages/ReportStudioPage";
import { DataExplorerPage } from "@/pages/DataExplorerPage";
import { ValidationPage } from "@/pages/ValidationPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NavigationTab, Subsidiary, EvidenceSnippet } from "@/types";

export function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>("dashboard");
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<Subsidiary | "ALL">("ALL");
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
      selectedSubsidiary={selectedSubsidiary}
      onSelectSubsidiary={setSelectedSubsidiary}
      activeEvidence={activeEvidence}
      onCloseEvidence={handleCloseEvidence}
      onQuickUpload={handleQuickUpload}
    >
      {currentTab === "dashboard" && (
        <DashboardPage
          onNavigate={setCurrentTab}
          onInspectEvidence={handleInspectEvidence}
          selectedSubsidiary={selectedSubsidiary}
        />
      )}

      {currentTab === "documents" && (
        <DocumentsPage
          onInspectEvidence={handleInspectEvidence}
          selectedSubsidiary={selectedSubsidiary}
        />
      )}

      {currentTab === "ask" && (
        <AskPage
          onInspectEvidence={handleInspectEvidence}
          selectedSubsidiary={selectedSubsidiary}
        />
      )}

      {currentTab === "analytics" && (
        <AnalyticsPage selectedSubsidiary={selectedSubsidiary} />
      )}

      {currentTab === "topics" && (
        <TopicsPage
          onInspectEvidence={handleInspectEvidence}
          selectedSubsidiary={selectedSubsidiary}
        />
      )}

      {currentTab === "reports" && <ReportStudioPage />}

      {currentTab === "explorer" && (
        <DataExplorerPage
          onInspectEvidence={handleInspectEvidence}
          selectedSubsidiary={selectedSubsidiary}
        />
      )}

      {currentTab === "validation" && (
        <ValidationPage
          onInspectEvidence={handleInspectEvidence}
          selectedSubsidiary={selectedSubsidiary}
        />
      )}

      {currentTab === "settings" && (
        <SettingsPage />
      )}
    </AppShell>
  );
}

export default App;
