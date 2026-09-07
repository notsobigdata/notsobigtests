// 08-fixtures-publish-targets.js — Declared move()+publish() nodes proving the publish kind
// end-to-end: a move node lands a small, known dataset in BigQuery, and a publish node reads
// it back (via source.ref) to render KPIs, a bar chart, and paginated tables (raw + aggregated).
// Backs the 'publish' test category. See notsobiglib's docs/publish.md for the kind's config
// reference.

// A fixed 6-row sample across two categories, so every KPI/chart total the
// test asserts on is hand-computable rather than "did it run" - same
// reasoning loadSqlTestReference (06-fixtures-bigquery-targets.js) uses a
// custom extractor instead of a live external source. A custom source
// must return a 2D array (header row + data rows), like every other
// source in this library - see notsobiglib's move.md: "every source
// produces a 2d array... a 'dataframe' for this library" - not an array
// of objects.
function myCustomExtractPublishOrders() {
  return [
    ['order_id', 'category', 'revenue'],
    ['1', 'Beverages', '10'],
    ['2', 'Beverages', '20'],
    ['3', 'Snacks', '5'],
    ['4', 'Snacks', '15'],
    ['5', 'Snacks', '25'],
    ['6', 'Beverages', '30']
  ];
}

// Own scratch table (BIGQUERY_PUBLISH_TABLE), not reused from any other
// fixture - same "don't let one test's data leak into another's
// assumptions" reasoning every other scratch table in
// 06-fixtures-bigquery-targets.js already follows.
var loadPublishOrders = {
  kind: 'move',
  name: 'loadPublishOrders',
  source: { type: 'custom', fn: myCustomExtractPublishOrders },
  target: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_PUBLISH_TABLE, mode: 'overwrite' }
};

// upsertByName: true - a publish target without it creates a brand-new
// Drive file on every single run (see notsobiglib's docs/publish.md,
// "Limits worth knowing"), which would pile up duplicate files here the
// same way the create-mode Drive-target fixtures already had to learn to
// avoid (see notsobiglib's CLAUDE.md, "Drive-target tests that create a
// new file must clean up after themselves"). upsertByName finds and
// overwrites the same file instead, so repeated runs - including
// testRunEverything() in 25-tests-pipeline.js, which sweeps every
// declared node - never leave anything behind to clean up.
var salesPublish = {
  kind: 'publish',
  name: 'salesPublish',
  dependsOn: ['loadPublishOrders'],
  source: { type: 'ref', ref: 'loadPublishOrders' },
  target: { type: 'drive', folderId: P.NOTSOBIGDATA_DRIVE_FOLDER_ID, fileName: 'publish-smoke-test.html', upsertByName: true },
  kpis: [
    { label: 'Total revenue', agg: 'sum', field: 'revenue', format: 'currency' },
    { label: 'Orders', agg: 'count', format: 'integer' }
  ],
  charts: [
    { id: 'by_category', type: 'bar', title: 'By category', groupBy: 'category', metric: { agg: 'sum', field: 'revenue' } }
  ],
  // Table block (notsobiglib PR #83). raw: the source's own columns,
  // row-for-row, pageSize 3 over these same 6 rows so the static first
  // page is provably paginated (2 pages), not just "did it render
  // something". aggregated: same category totals the chart above already
  // proves (60 Beverages / 45 Snacks), tabular instead of a bar.
  tables: [
    {
      id: 'recent_orders', title: 'Recent orders', mode: 'raw', pageSize: 3,
      columns: [
        { field: 'order_id', label: 'Order' },
        { field: 'category', label: 'Category' },
        { field: 'revenue', label: 'Revenue', format: 'currency' }
      ]
    },
    {
      id: 'by_category_table', title: 'Revenue by category', mode: 'aggregated',
      groupBy: 'category',
      metrics: [{ label: 'Revenue', agg: 'sum', field: 'revenue', format: 'currency' }]
    }
  ]
};

// notsobiglib PR (CSV export for tables[]): own scratch table, deliberately
// kept separate from loadPublishOrders/salesPublish above, same "don't let
// one test's data leak into another's assumptions" reasoning that fixture's
// own comment already gives. Each value here starts with a character
// (=/+/-/@) that Excel/Google Sheets parses as a formula trigger on CSV
// import - csvField() in src/publish.js is supposed to prefix each with a
// leading straight-quote so they land as literal text instead. A GAS test
// can't click a button or open a spreadsheet app, so this only proves the
// pipeline reaches Drive with the guard's source present (see
// testPublishCsvExportOffersDownloadAndGuardsFormulaInjection below) - the
// actual open-in-Excel/Sheets check is left to testLog for a human.
function myCustomExtractCsvInjectionCheck() {
  return [
    ['label', 'value'],
    ['equals', '=1+1'],
    ['plus', '+cmd|calc'],
    ['minus', '-2+3'],
    ['at', '@SUM(1,2)'],
    ['normal', 'plain text']
  ];
}

var loadCsvInjectionCheck = {
  kind: 'move',
  name: 'loadCsvInjectionCheck',
  source: { type: 'custom', fn: myCustomExtractCsvInjectionCheck },
  target: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_CSV_INJECTION_TABLE, mode: 'overwrite' }
};

var csvInjectionPublish = {
  kind: 'publish',
  name: 'csvInjectionPublish',
  dependsOn: ['loadCsvInjectionCheck'],
  source: { type: 'ref', ref: 'loadCsvInjectionCheck' },
  target: { type: 'drive', folderId: P.NOTSOBIGDATA_DRIVE_FOLDER_ID, fileName: 'publish-csv-injection-check.html', upsertByName: true },
  kpis: [{ label: 'Rows', agg: 'count', format: 'integer' }],
  tables: [
    {
      id: 'injection_rows', title: 'Injection check', mode: 'raw', pageSize: 10,
      columns: [
        { field: 'label', label: 'Label' },
        { field: 'value', label: 'Value' }
      ]
    }
  ]
};

// D3 chart engine (notsobiglib feat/publish-d3-charts): one chart of
// each new type against the same 6-row sample loadPublishOrders already
// seeds - reuses that data rather than a fresh scratch table, since this
// isn't testing a different dataset, just different chart types over the
// one already-proven-correct dataset.
var chartTypesPublish = {
  kind: 'publish',
  name: 'chartTypesPublish',
  dependsOn: ['loadPublishOrders'],
  source: { type: 'ref', ref: 'loadPublishOrders' },
  target: { type: 'drive', folderId: P.NOTSOBIGDATA_DRIVE_FOLDER_ID, fileName: 'publish-chart-types.html', upsertByName: true },
  charts: [
    { id: 'by_order', type: 'line', title: 'Revenue by order', groupBy: 'order_id', metric: { agg: 'sum', field: 'revenue' } },
    { id: 'share', type: 'pie', title: 'Share by category', donut: true, groupBy: 'category', metric: { agg: 'sum', field: 'revenue' } },
    { id: 'by_category_stacked', type: 'bar', title: 'By category (stacked)', groupBy: 'category', metric: { agg: 'sum', field: 'revenue' }, series: 'order_id', stacking: 'stacked' }
  ]
};

// Cross-chart interactivity (notsobiglib feat/publish-chart-interactivity):
// three charts linked on 'category' (plain bar, pie, and a stacked bar
// also linking its series on 'order_id'), one ('by_order', a plain line
// chart) left deliberately unlinked - the same shape as the design spec's
// worked example, reusing loadPublishOrders' already-proven 6-row sample
// rather than a fresh scratch table.
var chartInteractivityPublish = {
  kind: 'publish',
  name: 'chartInteractivityPublish',
  dependsOn: ['loadPublishOrders'],
  source: { type: 'ref', ref: 'loadPublishOrders' },
  target: { type: 'drive', folderId: P.NOTSOBIGDATA_DRIVE_FOLDER_ID, fileName: 'publish-chart-interactivity.html', upsertByName: true },
  charts: [
    { id: 'by_category', type: 'bar', title: 'By category', groupBy: 'category', metric: { agg: 'sum', field: 'revenue' }, linkKey: 'category' },
    { id: 'share', type: 'pie', title: 'Share by category', donut: true, groupBy: 'category', metric: { agg: 'sum', field: 'revenue' }, linkKey: 'category' },
    { id: 'by_category_order', type: 'bar', title: 'By category and order', groupBy: 'category', series: 'order_id', stacking: 'stacked', metric: { agg: 'sum', field: 'revenue' }, linkKey: 'category', seriesLinkKey: 'order_id' },
    { id: 'by_order', type: 'line', title: 'Revenue by order', groupBy: 'order_id', metric: { agg: 'sum', field: 'revenue' } }
  ]
};

// filters[] (notsobiglib feat/publish-filters): one filter (category) on
// loadPublishOrders' already-proven 6-row sample (Beverages 60 total,
// Snacks 45 total - see loadPublishOrders' own comment). "Total revenue"
// and the bar chart and the raw table all opt in via reactsTo; "Orders"
// (a plain count) deliberately doesn't, so a human can visually confirm
// the opt-in boundary: it must stay at 6 no matter what the Category
// filter is set to, while everything else narrows to just that category.
var filtersPublish = {
  kind: 'publish',
  name: 'filtersPublish',
  dependsOn: ['loadPublishOrders'],
  source: { type: 'ref', ref: 'loadPublishOrders' },
  target: { type: 'drive', folderId: P.NOTSOBIGDATA_DRIVE_FOLDER_ID, fileName: 'publish-filters.html', upsertByName: true },
  filters: [{ field: 'category', label: 'Category' }],
  kpis: [
    { label: 'Total revenue', agg: 'sum', field: 'revenue', format: 'currency', reactsTo: ['category'] },
    { label: 'Orders', agg: 'count', format: 'integer' }
  ],
  charts: [
    { id: 'by_category', type: 'bar', title: 'By category', groupBy: 'category', metric: { agg: 'sum', field: 'revenue' }, reactsTo: ['category'] }
  ],
  tables: [
    {
      id: 'recent_orders', title: 'Recent orders', mode: 'raw', pageSize: 3,
      columns: [
        { field: 'order_id', label: 'Order' },
        { field: 'category', label: 'Category' },
        { field: 'revenue', label: 'Revenue', format: 'currency' }
      ],
      reactsTo: ['category']
    }
  ]
};

// linkTo (notsobiglib feat/publish-link-to): links to filtersPublish above
// rather than declaring a fresh destination - filtersPublish already
// satisfies linkTo's one requirement on a destination (a filters[] entry
// on the same field this chart sends), so reusing it is one less scratch
// file to manage, not a shortcut. Reuses loadPublishOrders' already-proven
// 6-row sample, same as every other publish fixture on this page. linkTo
// resolves to filtersPublish's own target.fileName as a plain relative
// link (not a Drive URL), so there's no ordering requirement between the
// two - see 28-tests-publish.js's
// testPublishLinkToResolvesRelativeFilenameToDestination.
var linkToPublish = {
  kind: 'publish',
  name: 'linkToPublish',
  dependsOn: ['loadPublishOrders'],
  source: { type: 'ref', ref: 'loadPublishOrders' },
  target: { type: 'drive', folderId: P.NOTSOBIGDATA_DRIVE_FOLDER_ID, fileName: 'publish-link-to.html', upsertByName: true },
  charts: [
    { id: 'by_category', type: 'bar', title: 'By category', groupBy: 'category', metric: { agg: 'sum', field: 'revenue' },
      linkTo: { node: 'filtersPublish', field: 'category', newTab: true } }
  ]
};

// A second, unrelated 3-row sample in its own scratch table
// (BIGQUERY_PUBLISH_REFUNDS_TABLE) - separate rows and separate column
// values (a 'reason' column loadPublishOrders doesn't have) from
// loadPublishOrders' 6-row sample, so blockSourceOverridePublish's
// override can only pass if it's genuinely reading this table, not
// silently falling back to the default source.
function myCustomExtractPublishRefunds() {
  return [
    ['order_id', 'category', 'amount', 'reason'],
    ['1', 'Beverages', '10', 'damaged'],
    ['3', 'Snacks', '5', 'wrong item'],
    ['6', 'Beverages', '30', 'damaged']
  ];
}

var loadPublishRefunds = {
  kind: 'move',
  name: 'loadPublishRefunds',
  source: { type: 'custom', fn: myCustomExtractPublishRefunds },
  target: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_PUBLISH_REFUNDS_TABLE, mode: 'overwrite' }
};

// Block source override (notsobiglib feat/publish-block-source-override):
// the report's default source is loadPublishOrders (6 rows, no 'amount'/
// 'reason' columns), but the "Total refunds" kpi and "refunds_detail"
// table both declare their own source.ref pointing at loadPublishRefunds
// instead - proving a single block can read a completely different table
// (different columns included) than the rest of the report. See
// 28-tests-publish.js's testPublishBlockSourceOverrideReadsFromItsOwnRef.
var blockSourceOverridePublish = {
  kind: 'publish',
  name: 'blockSourceOverridePublish',
  dependsOn: ['loadPublishOrders', 'loadPublishRefunds'],
  source: { type: 'ref', ref: 'loadPublishOrders' },
  target: { type: 'drive', folderId: P.NOTSOBIGDATA_DRIVE_FOLDER_ID, fileName: 'publish-block-source-override.html', upsertByName: true },
  kpis: [
    { label: 'Total revenue', agg: 'sum', field: 'revenue', format: 'currency' },
    { label: 'Total refunds', agg: 'sum', field: 'amount', format: 'currency',
      source: { type: 'ref', ref: 'loadPublishRefunds' } }
  ],
  tables: [
    {
      id: 'refunds_detail', title: 'Refunds detail', mode: 'raw',
      columns: [
        { field: 'order_id', label: 'Order' },
        { field: 'category', label: 'Category' },
        { field: 'amount', label: 'Amount', format: 'currency' },
        { field: 'reason', label: 'Reason' }
      ],
      source: { type: 'ref', ref: 'loadPublishRefunds' }
    }
  ]
};
