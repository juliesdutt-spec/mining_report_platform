import React, { useState, useEffect } from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section, FieldLabel } from "@/components/shared/Section";
import { cn } from "@/lib/utils";
import { TopicEntity, MiningDocument, EvidenceSnippet, Subsidiary } from "@/types";
import { fetchTopics } from "@/services/topics";
import { fetchDocuments } from "@/services/documents";

interface TopicsPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

const CATEGORIES = ["all", "operation", "mineral", "environment", "safety"] as const;

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

export function TopicsPage({ onInspectEvidence }: TopicsPageProps) {
  const [topics, setTopics] = useState<TopicEntity[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicEntity | null>(null);
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    fetchTopics().then((data) => {
      setTopics(data);
      if (data.length > 0) setSelectedTopic(data[0]);
    });
    fetchDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  const filteredTopics =
    filterCategory === "all" ? topics : topics.filter((t) => t.category === filterCategory);

  const matchedDocs = selectedTopic
    ? documents.filter((d) =>
        d.topics.some(
          (t) =>
            t.toLowerCase().includes(selectedTopic.name.toLowerCase()) ||
            selectedTopic.name.toLowerCase().includes(t.toLowerCase())
        )
      )
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Topic intelligence"
        description="Terms surfaced across the archive by frequency and distinctiveness. Select one to see where it appears."
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
        <p className="mt-8 border-t border-border pt-3 text-center text-xs text-muted-foreground">
          Size reflects term frequency weighted by inverse document frequency.
        </p>
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
                    {selectedTopic.documentCount}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Quarterly trend</dt>
                  <dd className="inline-flex items-center gap-1 font-mono text-sm tabular-nums font-medium text-success">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {selectedTopic.trendPercent}%
                  </dd>
                </div>
              </dl>

              <div>
                <FieldLabel>Co-occurring terms</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                  {selectedTopic.relatedTerms.map((term, idx) => (
                    <span key={idx} className="text-sm text-muted-foreground">
                      {term}
                    </span>
                  ))}
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
                      <span className="font-mono">{doc.subsidiary}</span>
                      <span aria-hidden>·</span>
                      <span>{doc.mineName}</span>
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
