import { useEffect, useState } from 'react';
import { MiningDocument, OrganisationFilter } from '@/types';
import { fetchDocuments } from '@/services/documents';

/**
 * The document corpus, shared by the pieces of chrome that need to describe it
 * rather than list it: the sidebar's organisation filter, the command
 * palette's recents and Ask DataForge's example questions.
 *
 * Pages still fetch their own documents — this exists so those three do not
 * each trigger a separate request, and so none of them has to invent content
 * when the corpus is empty. Uploading or deleting invalidates it through
 * refreshCorpus().
 */

let cache: MiningDocument[] | null = null;
let inFlight: Promise<MiningDocument[]> | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

function load(): Promise<MiningDocument[]> {
  if (!inFlight) {
    inFlight = fetchDocuments()
      .then((docs) => {
        cache = docs;
        return docs;
      })
      .catch(() => {
        // The corpus is decoration for these consumers; a failure means they
        // render empty rather than surfacing a second error alongside the
        // page's own.
        cache = [];
        return cache;
      })
      .finally(() => {
        inFlight = null;
        notify();
      });
  }
  return inFlight;
}

/** Drop the cached corpus so the next read refetches — call after upload/delete. */
export function refreshCorpus() {
  cache = null;
  inFlight = null;
  notify();
  void load();
}

export function useCorpus(): { documents: MiningDocument[]; isLoading: boolean } {
  const [documents, setDocuments] = useState<MiningDocument[]>(cache ?? []);
  const [isLoading, setIsLoading] = useState(cache === null);

  useEffect(() => {
    let active = true;

    const sync = () => {
      if (!active) return;
      setDocuments(cache ?? []);
      setIsLoading(cache === null);
    };

    subscribers.add(sync);
    if (cache === null) {
      void load().then(sync);
    } else {
      sync();
    }

    return () => {
      active = false;
      subscribers.delete(sync);
    };
  }, []);

  return { documents, isLoading };
}

/**
 * The organisations present in the corpus, in descending document count.
 *
 * There is no canonical list to fall back on: if no document names an
 * organisation, there are none to filter by and the sidebar says so.
 */
export function organisationsIn(
  documents: MiningDocument[]
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const doc of documents) {
    const name = doc.organisation?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** True when a document belongs to the selected organisation scope. */
export function matchesOrganisation(
  doc: MiningDocument,
  filter: OrganisationFilter
): boolean {
  return filter === 'ALL' || doc.organisation === filter;
}

/** Narrow a document list to the selected organisation scope. */
export function filterByOrganisation<T extends MiningDocument>(
  documents: T[],
  filter: OrganisationFilter
): T[] {
  if (filter === 'ALL') return documents;
  return documents.filter((doc) => matchesOrganisation(doc, filter));
}

/** Longest field value that still reads naturally inside a question. */
const MAX_SUBJECT_LENGTH = 60;

function distinct(values: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length <= MAX_SUBJECT_LENGTH) seen.add(trimmed);
  }
  return [...seen];
}

/**
 * Example questions built from what the corpus actually contains.
 *
 * Every example names a mineral, mine, location or organisation that appears
 * in an indexed document, so clicking one returns a real answer. An empty
 * corpus yields no examples rather than questions about documents that do not
 * exist.
 */
export function exampleQuestions(documents: MiningDocument[], limit = 4): string[] {
  const minerals = distinct(documents.map((d) => d.mineralType));
  const mines = distinct(documents.map((d) => d.mineName));
  const locations = distinct(documents.map((d) => d.location));
  const organisations = distinct(documents.map((d) => d.organisation));

  const candidates: string[] = [];

  if (minerals.length > 1) {
    candidates.push(`Compare the quantities reported for ${minerals[0]} and ${minerals[1]}.`);
  } else if (minerals.length === 1) {
    candidates.push(`What quantity of ${minerals[0]} is reported across the indexed documents?`);
  }
  if (mines.length > 0) {
    candidates.push(`Summarise the extraction method and reserves reported for ${mines[0]}.`);
  }
  if (locations.length > 0) {
    candidates.push(`What do the indexed reports say about operations in ${locations[0]}?`);
  }
  if (organisations.length > 0) {
    candidates.push(`List the key findings reported by ${organisations[0]}.`);
  }
  if (mines.length > 1) {
    candidates.push(`How do the figures for ${mines[0]} and ${mines[1]} differ?`);
  }

  return candidates.slice(0, limit);
}
