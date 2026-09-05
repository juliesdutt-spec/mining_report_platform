import React, { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section, FieldLabel } from "@/components/shared/Section";
import { cn } from "@/lib/utils";
import { TopicEntity, MiningDocument, EvidenceSnippet, OrganisationFilter } from "@/types";
import { ApiError } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTopics } from "@/services/topics";
import { fetchDocuments } from "@/services/documents";
import { filterByOrganisation } from "@/lib/corpus";

interface TopicsPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedOrganisation: OrganisationFilter;
}

// Every value TopicEntity["category"] can hold needs a tab here. The
// categoriser in services/topics.ts also returns "location", and without a
// tab those terms were reachable only under "all".
const CATEGORIES = [
  "all",
  "operation",
  "mineral",
  "location",
  "environment",
  "safety",
] as const;

/**
 * Term weight is expressed through type size and weight rather than colour, so
 * the cloud reads as a document index instead of a decorative tag soup.
 */
function weightStyles(weight: number, isSelected: boolean) {
  const size = Math.max(13, Math.min(30, Math.round(weight * 0.3)));
  const emphasis = weight > 70 ? "font-semibold" : weight > 45 ? "font-medium" : "font-normal";
  return {
    style: { fontSize: `${size}px` },
    className: cn(
      emphasis,
      isSelected ? "text-primary" : weight > 60 ? "text-foreground" : "text-muted-foreground"
    ),
  };
}

import { WordCloud } from "@/components/shared/WordCloud";

export function TopicsPage({ onInspectEvidence, selectedOrganisation }: TopicsPageProps) {
  const [topics, setTopics] = useState<TopicEntity[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicEntity | null>(null);
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // Topics are derived from GET /reports, so a backend that is down leaves
    // this page with nothing to show. Without a catch the rejection was
    // unhandled and the page sat empty, indistinguishable from a corpus that
    // genuinely has no terms.
    Promise.all([fetchTopics(), fetchDocuments()])
      .then(([topicData, documentData]) => {
        if (!active) return;
        setTopics(topicData);
        setDocuments(documentData);
        if (topicData.length > 0) setSelectedTopic(topicData[0]);
        setLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        setTopics([]);
        setDocuments([]);
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Could not load topics from the backend."
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredTopics =
    filterCategory === "all" ? topics : topics.filter((t) => t.category === filterCategory);

  // Switching category could leave the detail panel describing a term the
  // cloud no longer shows. Follow the filter instead.
  useEffect(() => {
    if (filteredTopics.length === 0) {
      setSelectedTopic(null);
      return;
    }
    setSelectedTopic((current) =>
      current && filteredTopics.some((t) => t.id === current.id)
        ? current
        : filteredTopics[0]
    );
  }, [filterCategory, topics]); // eslint-disable-line react-hooks/exhaustive-deps

  const scopedDocs = filterByOrganisation(documents, selectedOrganisation);

  const matchedDocs = selectedTopic
    ? scopedDocs.filter((d) =>
        d.topics.some(
          (t) =>
            t.toLowerCase().includes(selectedTopic.name.toLowerCase()) ||
            selectedTopic.name.toLowerCase().includes(t.toLowerCase())
        )
      )
    : [];

  // Both figures are counted over the documents currently in scope. The
  // aggregate on TopicEntity is corpus-wide, so showing it beside an
  // organisation-filtered list made the panel state two different numbers for
  // the same term.
  const matchedCount = matchedDocs.length;
  const corpusShare =
    scopedDocs.length > 0 ? Math.round((matchedCount / scopedDocs.length) * 100) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Topic intelligence"
        description="Terms extracted from the indexed reports, ranked by how many documents mention them. Select one to see where it appears."
        actions={
          <Tabs value={filterCategory} onValueChange={setFilterCategory}>
            <TabsList>
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {/* Term cloud on one calm surface */}
      <Card className="px-6 py-8">
        {isLoading && (
          <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-4">
            {[64, 96, 80, 120, 72, 104].map((width, i) => (
              <Skeleton key={i} className="h-6" style={{ width }} />
            ))}
          </div>
        )}

        {!isLoading && loadError && (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            {loadError}
          </p>
        )}

        {/* An empty cloud otherwise reads as "loading forever". Say which of
            the two empty cases this is. */}
        {!isLoading && !loadError && filteredTopics.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {topics.length === 0
              ? "No topics yet — upload and process a document to build the term index."
              : `No terms in the ${filterCategory} category.`}
          </p>
        )}

        <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-4">
          {filteredTopics.map((topic) => {
            const isSelected = selectedTopic?.id === topic.id;
            const { style, className } = weightStyles(topic.weight, isSelected);
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                style={style}
                aria-pressed={isSelected}
                className={cn(
                  "rounded leading-none tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  className
                )}
              >
                {topic.name}
              </button>
            );
          })}
        </div>
        {filteredTopics.length > 0 && (
          <p className="mt-8 border-t border-border pt-3 text-center text-xs text-muted-foreground">
            Size reflects how many indexed documents mention the term.
          </p>
        )}
      </Card>

      {selectedTopic && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Section title={selectedTopic.name} description={`Category · ${selectedTopic.category}`}>
              <dl className="divide-y divide-border border-y border-border">
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Weight</dt>
                  <dd className="font-mono text-sm tabular-nums font-medium text-foreground">
                    {selectedTopic.weight}/100
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Documents</dt>
                  <dd className="font-mono text-sm tabular-nums font-medium text-foreground">
                    {matchedCount}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Share of corpus</dt>
                  <dd className="font-mono text-sm tabular-nums font-medium text-foreground">
                    {corpusShare !== null ? `${corpusShare}%` : "\u2014"}
                  </dd>
                </div>
              </dl>

              {matchedDocs.length > 0 && (
                <div>
                  <FieldLabel>Term cloud · {matchedDocs[0].filename}</FieldLabel>
                  <div className="mt-2">
                    <WordCloud reportId={matchedDocs[0].id} />
                  </div>
                </div>
              )}

              <div>
                <FieldLabel>Co-occurring terms</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                  {selectedTopic.relatedTerms.length > 0 ? (
                    selectedTopic.relatedTerms.map((term, idx) => (
                      <span key={idx} className="text-sm text-muted-foreground">
                        {term}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No other terms share a document with this one.
                    </span>
                  )}
                </div>
              </div>
            </Section>
          </div>

          <div className="lg:col-span-8">
            <Section title={`Appears in ${matchedDocs.length} documents`}>
              <ul className="divide-y divide-border border-y border-border">
                {matchedDocs.map((doc) => (
                  <li key={doc.id} className="py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="min-w-0 truncate text-sm font-medium text-foreground">
                        {doc.filename}
                      </h3>
                      {doc.evidenceSnippets[0] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onInspectEvidence(doc.evidenceSnippets[0])}
                        >
                          Evidence
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {doc.summary}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {doc.organisation && (
                        <>
                          <span className="truncate font-mono">{doc.organisation}</span>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <span>{doc.mineName ?? doc.filename}</span>
                    </div>
                  </li>
                ))}

                {matchedDocs.length === 0 && (
                  <li className="py-12 text-center text-sm text-muted-foreground">
                    No documents associated with this term.
                  </li>
                )}
              </ul>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
