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
