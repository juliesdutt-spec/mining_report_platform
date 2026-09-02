import { KpiMetrics, MiningDocument, ProductionDataPoint, QueryResult, TopicEntity, ValidationItem } from '../types';

export const INITIAL_KPIS: KpiMetrics = {
  documentsProcessed: 1428,
  pagesProcessed: 28410,
  recordsExtracted: 94620,
  reportsGenerated: 412,
  queriesAnswered: 3890,
  automationRate: 94.2,
  extractionAccuracy: 98.6,
  processingTimeSavedHours: 84.5,
};

export const MOCK_DOCUMENTS: MiningDocument[] = [
  {
    id: 1,
    filename: "SECL_Gevra_Annual_Production_2023_24.pdf",
    fileType: "PDF",
    fileSizeBytes: 4820192,
    pageCount: 68,
    uploadDate: "2026-08-28T09:30:00Z",
    status: "completed",
    confidenceScore: 0.984,
    subsidiary: "SECL",
    mineName: "Gevra OC Mega Project",
    location: "Korba, Chhattisgarh",
    district: "Korba",
    state: "Chhattisgarh",
    mineralType: "Non-Coking Coal (Grade G11)",
    quantityExtracted: "52.50 MT",
    extractionMethod: "Opencast",
    reserveEstimate: "410.20 MT",
    topics: ["opencast mining", "overburden removal", "dragline operations", "environmental clearance"],
    summary: "Annual operational audit for Gevra Opencast Project under SECL. Recorded total coal excavation of 52.50 MT against a target of 50.00 MT. Environmental compliance certified by MoEFCC for expanded capacity.",
    keyFindings: [
      "Coal production surpassed target by 5.0% achieving 52.50 MT.",
      "Composite stripping ratio averaged 1.18 m³/t.",
      "Fleet automation deployed across 240T dumpers and 42m³ electric shovels.",
      "Zero fatal accidents reported during FY 2023-24."
    ],
    validationStatus: "validated",
    evidenceSnippets: [
      {
        id: "ev-1-1",
        documentId: 1,
        documentName: "SECL_Gevra_Annual_Production_2023_24.pdf",
        pageNumber: 14,
        sectionHeader: "3.2 Annual Production Metrics",
        field: "coal_production_mt",
        extractedValue: "52.50 MT",
        originalContext: "Total raw coal excavated during the operational cycle FY 2023-24 reached 52.50 MT (Million Tonnes) compared to 49.12 MT in the previous fiscal year.",
        confidence: 0.99
      },
      {
        id: "ev-1-2",
        documentId: 1,
        documentName: "SECL_Gevra_Annual_Production_2023_24.pdf",
        pageNumber: 22,
        sectionHeader: "4.1 Stripping Ratio & Overburden",
        field: "overburden_removal",
        extractedValue: "61.95 M.Cu.M",
        originalContext: "Overburden removal totaled 61.95 Million Cubic Meters, maintaining a strip ratio of 1.18 across northern and southern benches.",
        confidence: 0.97
      }
    ]
  },
  {
    id: 2,
    filename: "BCCL_Jharia_Seam_XVI_Geological_Survey.pdf",
    fileType: "PDF",
    fileSizeBytes: 8192000,
    pageCount: 112,
    uploadDate: "2026-08-29T14:15:00Z",
    status: "completed",
    confidenceScore: 0.962,
    subsidiary: "BCCL",
    mineName: "Moonidih Underground Mine",
    location: "Dhanbad, Jharkhand",
    district: "Dhanbad",
    state: "Jharkhand",
    mineralType: "Prime Coking Coal (W-II)",
    quantityExtracted: "1.42 MT",
    extractionMethod: "Underground",
    reserveEstimate: "88.40 MT",
    topics: ["coking coal", "longwall automation", "methane drainage", "seam geology"],
    summary: "Comprehensive geological borehole telemetry and production log for Seam XVI. Documenting longwall retreat performance and commercial coal seam degasification measures.",
    keyFindings: [
      "Prime coking coal recovery reached 1.42 MT using powered roof supports.",
      "Pre-drainage gas well telemetry reduced roadway methane concentrations below 0.3%.",
      "Identified 88.40 MT extractable reserves across blocks C and D."
    ],
    validationStatus: "validated",
    evidenceSnippets: [
      {
        id: "ev-2-1",
        documentId: 2,
        documentName: "BCCL_Jharia_Seam_XVI_Geological_Survey.pdf",
        pageNumber: 38,
        sectionHeader: "Borehole Assay Summary",
        field: "coking_coal_yield",
        extractedValue: "1.42 MT",
        originalContext: "Mechanized Longwall face output yielded 1,420,000 MT of Prime Coking Coal meeting washery Grade W-II specifications.",
        confidence: 0.98
      }
    ]
  },
  {
    id: 3,
    filename: "CMPDI_Exploration_Talcher_Basin_Block_V.pdf",
    fileType: "PDF",
    fileSizeBytes: 12400500,
    pageCount: 144,
    uploadDate: "2026-08-30T11:00:00Z",
    status: "completed",
    confidenceScore: 0.941,
    subsidiary: "CMPDI",
    mineName: "Talcher Basin Regional Block V",
    location: "Angul, Odisha",
    district: "Angul",
    state: "Odisha",
    mineralType: "Thermal Coal (Grade G12-G14)",
    quantityExtracted: "Proved Reserve Stage",
    extractionMethod: "Opencast",
    reserveEstimate: "1,240.00 MT",
    topics: ["geological exploration", "borehole logging", "proved reserves", "basin telemetry"],
    summary: "Regional exploration report conducted by CMPDI Regional Institute VII. 48 exploratory boreholes drilled totaling 14,200 meters confirming super-thick coal seams up to 42 meters.",
    keyFindings: [
      "Total estimated geological reserves upgraded to 1,240 MT in Proved category.",
      "Average seam thickness exceeds 28 meters with minimal parting.",
      "Favorable stripping ratio of 1:0.85 identified for proposed future mega opencast quarry."
    ],
    validationStatus: "needs_review",
    evidenceSnippets: [
      {
        id: "ev-3-1",
        documentId: 3,
        documentName: "CMPDI_Exploration_Talcher_Basin_Block_V.pdf",
        pageNumber: 52,
        sectionHeader: "5.0 Resource Categorization (UNFC)",
        field: "proved_reserves",
        extractedValue: "1,240.00 MT",
        originalContext: "UNFC Code 111 (Proved Mineral Reserve) calculated at 1,240.00 MT across seams II, III, and IV.",
        confidence: 0.94
      }
    ]
  },
  {
    id: 4,
    filename: "NCL_Jayant_Expansion_Review_FY24.pdf",
    fileType: "PDF",
    fileSizeBytes: 6140000,
    pageCount: 82,
    uploadDate: "2026-08-30T17:40:00Z",
    status: "completed",
    confidenceScore: 0.915,
    subsidiary: "NCL",
    mineName: "Jayant Opencast Project",
    location: "Singrauli, Madhya Pradesh",
    district: "Singrauli",
    state: "Madhya Pradesh",
    mineralType: "Non-Coking Coal (Grade G8)",
    quantityExtracted: "25.00 MT",
    extractionMethod: "Opencast",
    reserveEstimate: "295.10 MT",
    topics: ["first-mile connectivity", "coal handling plant", "surface miners", "crushing capacity"],
    summary: "Operational performance review of Jayant OC project. Commissioning of 20 MTPA Rapid Loading System and mechanized conveyor corridor connecting directly to NTPC Singrauli Super Thermal Station.",
    keyFindings: [
      "Produced 25.00 MT of Non-Coking Coal, operating at 100% dispatch target.",
      "First-Mile Connectivity (FMC) silos eliminated 1,200 daily truck trips.",
      "Dust suppression nozzles and live PM10 telemetry deployed at high-speed conveyor zones."
    ],
    validationStatus: "conflicting",
    evidenceSnippets: [
      {
        id: "ev-4-1",
        documentId: 4,
        documentName: "NCL_Jayant_Expansion_Review_FY24.pdf",
        pageNumber: 19,
        sectionHeader: "Dispatch vs Extraction Reconciliation",
        field: "annual_extraction",
        extractedValue: "25.00 MT",
        originalContext: "Total extraction audited at 25.00 MT, whereas Subsidiary Executive Ledger note lists 24.62 MT due to bunker weighbridge calibration divergence.",
        confidence: 0.89
      }
    ]
  },
  {
    id: 5,
    filename: "MCL_Lakhanpur_Environmental_Audit_2024.docx",
    fileType: "DOCX",
    fileSizeBytes: 3120000,
    pageCount: 44,
    uploadDate: "2026-08-31T08:10:00Z",
    status: "completed",
    confidenceScore: 0.978,
    subsidiary: "MCL",
    mineName: "Lakhanpur Opencast Mine",
    location: "Jharsuguda, Odisha",
    district: "Jharsuguda",
    state: "Odisha",
    mineralType: "Thermal Coal (Grade G13)",
    quantityExtracted: "21.80 MT",
    extractionMethod: "Opencast",
    reserveEstimate: "182.00 MT",
    topics: ["plantation", "mine void reclamation", "water discharge", "air quality"],
    summary: "Half-yearly environmental compliance audit. Land reclamation reached 140 hectares with native forestry species. Bio-drainage trenches functioning at optimum capacity.",
    keyFindings: [
      "Eco-restoration completed across 140 hectares of backfilled void.",
      "Mine water treatment plant discharging 12,000 KLD treated water to 6 neighboring villages.",
      "Ambient noise and vibration within DGMS permissible standards."
    ],
    validationStatus: "validated",
    evidenceSnippets: [
      {
        id: "ev-5-1",
        documentId: 5,
        documentName: "MCL_Lakhanpur_Environmental_Audit_2024.docx",
        pageNumber: 11,
        sectionHeader: "Annual Offtake & Clearance Balance",
        field: "coal_extracted",
        extractedValue: "21.80 MT",
        originalContext: "Excavation for the audit window logged 21.80 MT adhering to MoEFCC annual production cap of 22.00 MT.",
        confidence: 0.98
      }
    ]
  }
];

export const MOCK_PRODUCTION_TRENDS: Record<'3m' | '30d' | '7d', ProductionDataPoint[]> = {
  '3m': [
    { date: "May 01", actual: 18.2, target: 17.5, opencast: 16.1, underground: 2.1 },
    { date: "May 15", actual: 19.1, target: 18.0, opencast: 17.0, underground: 2.1 },
    { date: "Jun 01", actual: 21.4, target: 19.5, opencast: 19.1, underground: 2.3 },
    { date: "Jun 15", actual: 22.8, target: 21.0, opencast: 20.4, underground: 2.4 },
    { date: "Jul 01", actual: 24.2, target: 22.5, opencast: 21.7, underground: 2.5 },
    { date: "Jul 15", actual: 25.1, target: 23.0, opencast: 22.5, underground: 2.6 },
    { date: "Aug 01", actual: 27.6, target: 25.0, opencast: 24.8, underground: 2.8 },
    { date: "Aug 15", actual: 28.4, target: 26.5, opencast: 25.5, underground: 2.9 },
    { date: "Aug 31", actual: 29.8, target: 27.5, opencast: 26.7, underground: 3.1 },
  ],
  '30d': [
    { date: "Aug 02", actual: 6.8, target: 6.5, opencast: 6.1, underground: 0.7 },
    { date: "Aug 06", actual: 7.1, target: 6.8, opencast: 6.4, underground: 0.7 },
    { date: "Aug 10", actual: 7.4, target: 7.0, opencast: 6.6, underground: 0.8 },
    { date: "Aug 14", actual: 7.9, target: 7.2, opencast: 7.1, underground: 0.8 },
    { date: "Aug 18", actual: 8.2, target: 7.5, opencast: 7.3, underground: 0.9 },
    { date: "Aug 22", actual: 8.6, target: 7.9, opencast: 7.7, underground: 0.9 },
    { date: "Aug 26", actual: 9.1, target: 8.2, opencast: 8.1, underground: 1.0 },
    { date: "Aug 30", actual: 9.5, target: 8.5, opencast: 8.5, underground: 1.0 },
  ],
  '7d': [
    { date: "Aug 25", actual: 1.25, target: 1.15, opencast: 1.12, underground: 0.13 },
    { date: "Aug 26", actual: 1.30, target: 1.18, opencast: 1.16, underground: 0.14 },
    { date: "Aug 27", actual: 1.28, target: 1.20, opencast: 1.14, underground: 0.14 },
    { date: "Aug 28", actual: 1.35, target: 1.22, opencast: 1.21, underground: 0.14 },
    { date: "Aug 29", actual: 1.41, target: 1.25, opencast: 1.26, underground: 0.15 },
    { date: "Aug 30", actual: 1.44, target: 1.28, opencast: 1.29, underground: 0.15 },
    { date: "Aug 31", actual: 1.49, target: 1.30, opencast: 1.33, underground: 0.16 },
  ]
};

export const MOCK_VALIDATION_ITEMS: ValidationItem[] = [
  {
    id: "val-01",
    type: "conflict",
    severity: "high",
    title: "Production Figure Discrepancy — Jayant OC",
    fieldName: "coal_production_mt",
    subsidiary: "NCL",
    mineName: "Jayant Opencast Project",
    dateReported: "2026-08-31T06:12:00Z",
    status: "pending",
    sourceA: {
      documentId: 4,
      documentName: "NCL_Jayant_Expansion_Review_FY24.pdf",
      pageNumber: 19,
      value: "25.00 MT",
      confidence: 0.94
    },
    sourceB: {
      documentId: 9,
      documentName: "CIL_Subsidiary_Dispatch_Ledger_2024.xlsx",
      pageNumber: 4,
      value: "24.62 MT",
      confidence: 0.91
    }
  },
  {
    id: "val-02",
    type: "low_confidence",
    severity: "medium",
    title: "Low Confidence Stripping Ratio in Handwritten Field Log",
    fieldName: "stripping_ratio",
    subsidiary: "BCCL",
    mineName: "Katras Area Borehole Log #12",
    dateReported: "2026-08-30T18:44:00Z",
    status: "pending",
    sourceA: {
      documentId: 8,
      documentName: "BCCL_Katras_Field_Scan_2023.pdf",
      pageNumber: 7,
      value: "1:2.45 (?)",
      confidence: 0.62
    }
  },
  {
    id: "val-03",
    type: "missing_data",
    severity: "low",
    title: "Missing Geological Core Recovery % for Seam V",
    fieldName: "core_recovery_rate",
    subsidiary: "CMPDI",
    mineName: "Talcher Basin Regional Block V",
    dateReported: "2026-08-29T12:00:00Z",
    status: "resolved",
    resolutionNote: "Verified by CMPDI RI-VII geophysicist from supplementary digital LAS log.",
    sourceA: {
      documentId: 3,
      documentName: "CMPDI_Exploration_Talcher_Basin_Block_V.pdf",
      pageNumber: 64,
      value: "Not reported in tabular summary",
      confidence: 0.98
    }
  }
];

export const MOCK_TOPICS: TopicEntity[] = [
  { id: "top-1", name: "Opencast Extraction", weight: 94, category: "operation", trendPercent: 14, relatedTerms: ["Dragline", "Surface Miner", "Overburden Removal", "Haulage Fleet"], documentCount: 38, documentIds: [1, 3, 4, 5] },
  { id: "top-2", name: "Prime Coking Coal", weight: 82, category: "mineral", trendPercent: 9, relatedTerms: ["W-II Grade", "Jharia Basin", "Steel Autarky", "Washery Yield"], documentCount: 24, documentIds: [2] },
  { id: "top-3", name: "UNFC Proved Reserves", weight: 76, category: "mineral", trendPercent: 21, relatedTerms: ["Borehole Telemetry", "Seam Parting", "Core Recovery", "Block V"], documentCount: 19, documentIds: [3] },
  { id: "top-4", name: "First-Mile Connectivity", weight: 71, category: "operation", trendPercent: 32, relatedTerms: ["Rapid Loading System", "SILO Dispatch", "Conveyor Belt", "Rail Siding"], documentCount: 27, documentIds: [4] },
  { id: "top-5", name: "MoEFCC Compliance", weight: 65, category: "environment", trendPercent: 6, relatedTerms: ["Mine Void Reclamation", "Bio-Drainage", "PM10 Sensor", "Afforestation"], documentCount: 31, documentIds: [1, 5] },
  { id: "top-6", name: "Methane Drainage (CBM)", weight: 58, category: "safety", trendPercent: -4, relatedTerms: ["Underground Ventilation", "Degasification", "DGMS Standards", "Moonidih"], documentCount: 12, documentIds: [2] },
  { id: "top-7", name: "Overburden Ratio (OBR)", weight: 54, category: "operation", trendPercent: 11, relatedTerms: ["M.Cu.M", "Stripping Benches", "Composite Ratio", "Dump Stabilization"], documentCount: 29, documentIds: [1, 4] },
  { id: "top-8", name: "Gross Calorific Value (GCV)", weight: 49, category: "mineral", trendPercent: 3, relatedTerms: ["Grade G11", "Proximate Analysis", "Equilibrated Moisture", "Ash %"], documentCount: 22, documentIds: [1, 3] },
];

export const MOCK_QUERY_RESULTS: QueryResult[] = [
  {
    id: "q-1",
    question: "Compare coal production and stripping ratios across SECL and NCL opencast projects in FY 2023-24.",
    answer: "During FY 2023-24, SECL's Gevra Opencast Project produced 52.50 MT of Non-Coking Coal (Grade G11) with a composite stripping ratio of 1.18 m³/t, exceeding its annual target by 5.0%. In comparison, NCL's Jayant Opencast Project achieved 25.00 MT (Grade G8) operating at 100% dispatch target through integrated First-Mile Connectivity (FMC). SECL demonstrated higher aggregate volumetric extraction, while NCL achieved full direct-to-power plant railway siding dispatch with zero truck haulage demurrage.",
    keyFindings: [
      "Gevra (SECL) delivered 52.50 MT raw coal excavation vs. 25.00 MT at Jayant (NCL).",
      "Gevra stripping ratio audited at 1.18 m³/t (61.95 M.Cu.M overburden removed).",
      "NCL Jayant eliminated 1,200 daily truck journeys via automated 20 MTPA Rapid Loading Silos.",
      "Both projects met MoEFCC environmental clearance parameters for ambient dust and water treatment."
    ],
    evidence: [
      {
        id: "q-ev-1",
        documentId: 1,
        documentName: "SECL_Gevra_Annual_Production_2023_24.pdf",
        pageNumber: 14,
        sectionHeader: "3.2 Annual Production Metrics",
        field: "production_total",
        extractedValue: "52.50 MT",
        originalContext: "Total raw coal excavated during the operational cycle FY 2023-24 reached 52.50 MT compared to 49.12 MT in the previous fiscal year.",
        confidence: 0.99
      },
      {
        id: "q-ev-2",
        documentId: 4,
        documentName: "NCL_Jayant_Expansion_Review_FY24.pdf",
        pageNumber: 19,
        sectionHeader: "Dispatch vs Extraction Reconciliation",
        field: "annual_extraction",
        extractedValue: "25.00 MT",
        originalContext: "Total extraction audited at 25.00 MT, operating at 100% dispatch target.",
        confidence: 0.94
      }
    ],
    sourceDocuments: [
      { id: 1, filename: "SECL_Gevra_Annual_Production_2023_24.pdf", pageNumbers: [14, 22], relevanceScore: 0.98 },
      { id: 4, filename: "NCL_Jayant_Expansion_Review_FY24.pdf", pageNumbers: [19, 31], relevanceScore: 0.95 }
    ],
    timestamp: "2026-08-31T10:45:00Z"
  }
];
