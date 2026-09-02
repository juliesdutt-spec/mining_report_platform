import React, { useState, useEffect } from "react";
import {
  Cloud,
  Hash,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  ExternalLink,
  Search,
  Filter
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopicEntity, MiningDocument, EvidenceSnippet, Subsidiary } from "@/types";
import { fetchTopics } from "@/services/topics";
import { fetchDocuments } from "@/services/documents";

interface TopicsPageProps {
  onInspectEvidence: (evidence: EvidenceSnippet) => void;
  selectedSubsidiary: Subsidiary | "ALL";
}

export function TopicsPage({ onInspectEvidence, selectedSubsidiary }: TopicsPageProps) {
  const [topics, setTopics] = useState<TopicEntity[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicEntity | null>(null);
  const [documents, setDocuments] = useState<MiningDocument[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    fetchTopics().then((data) => {
      setTopics(data);
      if (data.length > 0) {
        setSelectedTopic(data[0]);
      }
    });
    fetchDocuments().then(setDocuments);
  }, []);

  const filteredTopics = filterCategory === "all"
    ? topics
    : topics.filter(t => t.category === filterCategory);

  const matchedDocs = selectedTopic
    ? documents.filter(d => d.topics.some(t => t.toLowerCase().includes(selectedTopic.name.toLowerCase()) || selectedTopic.name.toLowerCase().includes(t.toLowerCase())))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            Topic Intelligence & Semantic Word Cloud
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Automated topic modeling across archival geological reports, mineral classifications & statutory audits.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-md border border-zinc-800 text-xs">
          {["all", "operation", "mineral", "environment", "safety"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`capitalize px-2.5 py-1 rounded transition-colors text-[11px] ${
                filterCategory === cat
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Interactive Word Cloud Canvas Surface */}
      <Card className="border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <CardHeader className="border-b border-zinc-800/80 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Cloud className="h-4 w-4 text-sky-400" />
                <span>Interactive Semantic Mining Word Cloud</span>
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Click any topic cluster to inspect grounded document references and frequency metrics.
              </CardDescription>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Weight derived from term frequency & inverse document frequency (TF-IDF)
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="relative min-h-[220px] rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-6 flex flex-wrap items-center justify-center gap-4 select-none">
            {filteredTopics.map((topic) => {
              const isSelected = selectedTopic?.id === topic.id;
              // Compute dynamic font sizes and weights based on frequency weight
              const fontSize = Math.max(12, Math.min(28, Math.round(topic.weight * 0.28)));
              const opacity = Math.max(0.6, topic.weight / 100);

              return (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic)}
                  style={{ fontSize: `${fontSize}px` }}
                  className={`group relative rounded-md px-3 py-1.5 font-medium transition-all duration-200 transform hover:scale-110 ${
                    isSelected
                      ? "bg-zinc-800 text-emerald-400 border border-emerald-800/80 shadow-lg scale-105"
                      : "text-zinc-300 hover:text-white hover:bg-zinc-900 border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[10px] font-mono">#{topic.weight}</span>
                    <span>{topic.name}</span>
                  </span>
                  {topic.trendPercent > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Drill-down Detail Area for Selected Topic */}
      {selectedTopic && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Topic Metrics & Related Terms (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-zinc-500 tracking-wider">Topic Metadata</span>
                  <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                    Weight: {selectedTopic.weight}/100
                  </span>
                </div>
                <CardTitle className="text-lg font-bold text-zinc-100 mt-1">
                  {selectedTopic.name}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Category: <span className="text-zinc-200 uppercase font-mono">{selectedTopic.category}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-xs">
                <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 p-2.5">
                  <span className="text-zinc-400">Reporting Frequency:</span>
                  <span className="font-mono font-semibold text-zinc-200">{selectedTopic.documentCount} documents</span>
                </div>

                <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 p-2.5">
                  <span className="text-zinc-400">Quarterly Velocity Trend:</span>
                  <span className="font-mono font-semibold text-emerald-400 flex items-center gap-1">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    +{selectedTopic.trendPercent}% Ingestion
                  </span>
                </div>

                {/* Related Terms */}
                <div>
                  <span className="text-[11px] font-mono uppercase text-zinc-500 block mb-1.5">
                    Co-Occurring Semantic Terms
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTopic.relatedTerms.map((term, idx) => (
                      <span
                        key={idx}
                        className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 font-mono"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Associated Documents & Excerpts (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center justify-between">
                  <span>Supporting Documents & Excerpts ({matchedDocs.length})</span>
                  <span className="text-xs font-mono text-zinc-400 font-normal">
                    Targeted Topic: {selectedTopic.name}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {matchedDocs.length > 0 ? (
                  matchedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 space-y-2 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-zinc-400" />
                          <span className="font-medium text-zinc-200">{doc.filename}</span>
                          <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                            {doc.subsidiary}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => doc.evidenceSnippets[0] && onInspectEvidence(doc.evidenceSnippets[0])}
                          className="h-6 text-[11px] gap-1 text-sky-400"
                        >
                          <span>Evidence</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Button>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-2.5 py-0.5">
                        {doc.summary}
                      </p>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
                        <span>Mine: {doc.mineName}</span>
                        <span>Confidence: {Math.round(doc.confidenceScore * 100)}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    No documents currently associated with this topic filter.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
