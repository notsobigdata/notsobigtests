// 28-tests-publish.js — Layer 2 verification for the publish kind: BigQuery Tabledata.list
// read, JS-side KPI/chart/table aggregation, and the generated HTML actually containing the
// right numbers - not just "did it run without throwing". See notsobiglib's docs/publish.md for
// the kind's full config reference, and js/08-fixtures-publish-targets.js for the fixtures below.

function extractPublishPayload(html) {
  var match = html.match(/window\.__PUBLISH_PAYLOAD__ = (.+?);/);
  if (!match) {
    throw new Error('expected an embedded __PUBLISH_PAYLOAD__ in the generated HTML');
  }
  return JSON.parse(match[1]);
}

function testPublishGeneratesReportWithCorrectAggregates() {
  runOne('loadPublishOrders');
  var result = runOne('salesPublish');
  check('publish reports the row count it read', result.rowCount === 6, result.rowCount);
  check('publish reports a driveFileId', !!result.driveFileId, result.driveFileId);

  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();
  // 10+20+30 = 60 Beverages, 5+15+25 = 45 Snacks, total = 105.
  check('KPI total revenue is correct', html.indexOf('$105.00') !== -1, 'expected "$105.00" in generated HTML');
  check('KPI order count is correct', html.indexOf('>6<') !== -1, 'expected the order count 6 to render');
  var chartPayload = extractPublishPayload(html).charts.filter(function (c) { return c.id === 'by_category'; })[0];
  var chartTotals = {};
  chartPayload.data.forEach(function (d) { chartTotals[d.groupValue] = d.total; });
  check('chart shows the Beverages group and its total', chartTotals.Beverages === 60, 'expected Beverages total 60, got: ' + JSON.stringify(chartPayload.data));
  check('chart shows the Snacks group and its total', chartTotals.Snacks === 45, 'expected Snacks total 45, got: ' + JSON.stringify(chartPayload.data));
  testLog('Generated report file id: ' + result.driveFileId);
}

// Table block (notsobiglib PR #83): raw mode shows the source's own
// columns row-for-row, paginated at pageSize 3 over the fixture's 6 rows -
// asserting the static first page is capped at exactly pageSize (not "did
// it render something") is what a Node/Layer-1 test already proves for
// the library itself; this just confirms the real generated file agrees.
// Aggregated mode reuses the same category totals the chart assertions
// above already prove (60 Beverages / 45 Snacks), tabular instead of a
// bar. Clicking "Next" itself can't be driven from this Apps Script test
// (no browser here) - see testLog's note below for the one manual check
// this leaves to a human.
function testPublishTableBlockRendersRawAndAggregatedTables() {
  var result = runOne('salesPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();

  var rawSection = html.match(/<section class="table-block" data-table-id="recent_orders">[\s\S]*?<\/section>/);
  check('recent_orders table section is present', !!rawSection, html);
  var bodyMatch = rawSection && rawSection[0].match(/<tbody>([\s\S]*?)<\/tbody>/);
  var rowCount = bodyMatch ? (bodyMatch[1].match(/<tr>/g) || []).length : 0;
  check('raw table static first page shows exactly pageSize (3) of 6 rows', rowCount === 3, rowCount);
  check('raw table pager reads "Page 1 of 2"', !!(rawSection && rawSection[0].indexOf('Page 1 of 2') !== -1),
    rawSection && rawSection[0]);

  check('aggregated table shows Beverages total ($60.00)', html.indexOf('$60.00') !== -1, 'expected "$60.00" in generated HTML');
  check('aggregated table shows Snacks total ($45.00)', html.indexOf('$45.00') !== -1, 'expected "$45.00" in generated HTML');

  testLog('Table-block report file id: ' + result.driveFileId + ' - open it in a browser and click '
    + '"Next" on Recent orders to confirm the remaining 3 rows appear (client-side pagination can\'t '
    + 'be driven from this Apps Script test).');
}

// CSV export (notsobiglib PR feat/publish-table-csv-export): the button
// and its wiring reach the real generated file, including the
// formula-injection guard - same regex-on-generated-HTML ceiling the
// Node/Layer-1 test already accepts (see notsobiglib's src/publish.md),
// since a GAS test can't click a button or open a spreadsheet app. The
// open-in-Excel/Sheets check that actually proves the guard works is left
// to a human via testLog below.
function testPublishCsvExportOffersDownloadAndGuardsFormulaInjection() {
  runOne('loadCsvInjectionCheck');
  var result = runOne('csvInjectionPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();

  check('Export CSV button is present', html.indexOf('class="table-csv-export"') !== -1, html);
  check('CSV export wiring (Blob/text/csv) is present', html.indexOf('Blob') !== -1 && html.indexOf('text/csv') !== -1, html);
  check('csvField guards a leading =/+/-/@ formula-trigger character', /\/\^\[=\+@-\]\//.test(html), html);

  testLog('CSV-injection-check report file id: ' + result.driveFileId + ' - open it in a browser, click '
    + '"Export CSV" on "Injection check", then open the downloaded CSV in Excel or Google Sheets and '
    + 'confirm the =1+1 / +cmd|calc / -2+3 / @SUM(1,2) cells render as literal text - each preceded by '
    + 'a leading apostrophe or otherwise unevaluated - never as a computed result, a launched app, or a '
    + 'security warning dialog.');
}

// D3 chart engine (notsobiglib feat/publish-d3-charts): a GAS test can't
// execute D3 or open a browser, so this only proves the pipeline reaches
// Drive with the right containers/payload for each new type - same
// ceiling notsobiglib's own Layer 1 tests already accept. The actual
// visual check is left to a human via testLog below.
function testPublishChartTypesRenderMountPointsAndPayload() {
  var result = runOne('chartTypesPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();

  check('line chart mount point is present', html.indexOf('<div class="chart-canvas" id="chart-by_order">') !== -1, html);
  check('pie chart mount point is present', html.indexOf('<div class="chart-canvas" id="chart-share">') !== -1, html);
  check('stacked bar chart mount point is present', html.indexOf('<div class="chart-canvas" id="chart-by_category_stacked">') !== -1, html);
  check('pinned D3 CDN script tag is present', html.indexOf('cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js') !== -1, html);

  var payload = extractPublishPayload(html);
  var pieChart = payload.charts.filter(function (c) { return c.id === 'share'; })[0];
  check('pie chart payload has donut: true', pieChart.donut === true, JSON.stringify(pieChart));
  var stackedChart = payload.charts.filter(function (c) { return c.id === 'by_category_stacked'; })[0];
  check('stacked bar chart payload has seriesKeys', stackedChart.seriesKeys && stackedChart.seriesKeys.length > 0, 'expected seriesKeys array, got: ' + JSON.stringify(stackedChart));

  testLog('Chart-types report file id: ' + result.driveFileId + ' - open it in a browser and confirm '
    + 'all three charts actually render: a line chart (by order), a donut chart (by category), and a '
    + 'stacked bar chart (by category) - client-side D3 drawing can\'t be verified from this Apps Script test.');
}

// Cross-chart click-to-highlight (notsobiglib feat/publish-chart-interactivity):
// a GAS test can't click anything or read computed opacity, so this only
// proves the pipeline reaches Drive with linkKey/seriesLinkKey correctly
// present/absent in the payload - same ceiling notsobiglib's own Layer 1
// tests already accept. The actual click/highlight behavior is left to a
// human via testLog below.
function testPublishChartInteractivityLinksPropagateToPayload() {
  var result = runOne('chartInteractivityPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();
  var payload = extractPublishPayload(html);

  var byCategory = payload.charts.filter(function (c) { return c.id === 'by_category'; })[0];
  check('by_category has linkKey "category"', byCategory.linkKey === 'category', JSON.stringify(byCategory));

  var byCategoryOrder = payload.charts.filter(function (c) { return c.id === 'by_category_order'; })[0];
  check('by_category_order has both linkKey and seriesLinkKey', byCategoryOrder.linkKey === 'category' && byCategoryOrder.seriesLinkKey === 'order_id', JSON.stringify(byCategoryOrder));

  var byOrder = payload.charts.filter(function (c) { return c.id === 'by_order'; })[0];
  check('by_order (unlinked) has no linkKey', byOrder.linkKey === undefined, JSON.stringify(byOrder));

  testLog('Chart-interactivity report file id: ' + result.driveFileId + ' - open it in a browser and: '
    + '(1) click a bar/slice on "By category" or "Share by category" and confirm the other category-linked '
    + 'charts dim to the matching category while "Revenue by order" (unlinked) is unaffected; '
    + '(2) click a segment on "By category and order" and confirm only the exact (category, order) pair '
    + 'lights up elsewhere, not the whole category; '
    + '(3) click the same element again and confirm everything returns to full opacity.');
}

// filters[] (notsobiglib feat/publish-filters): a GAS test can't change a
// dropdown or read a recomputed DOM value, so this only proves the
// pipeline reaches Drive with the filters bar, the raw rows, and the
// opt-in/opt-out filterableConfig split all correctly present - same
// ceiling notsobiglib's own Layer 1 tests already accept. The actual
// filter-change/recompute behavior is left to a human via testLog below.
function testPublishFiltersRenderAndPayloadReflectReactsToOptIn() {
  var result = runOne('filtersPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();

  check('filters bar is present with a category select', html.indexOf('data-filter-field="category"') !== -1, html);
  check('category options include Beverages and Snacks', html.indexOf('<option value="Beverages">Beverages</option>') !== -1 && html.indexOf('<option value="Snacks">Snacks</option>') !== -1, html);

  var payload = extractPublishPayload(html);
  check('payload.rows carries all 6 raw rows for client-side filtering', payload.rows && payload.rows.length === 6, JSON.stringify(payload.rows));
  check('filterableConfig includes the reactsTo kpi/chart/table, and excludes the opted-out Orders kpi',
    payload.filterableConfig.kpis.length === 1 && payload.filterableConfig.charts.length === 1 && payload.filterableConfig.tables.length === 1,
    JSON.stringify(payload.filterableConfig));

  testLog('Filters report file id: ' + result.driveFileId + ' - open it in a browser and: '
    + '(1) set the Category filter to "Beverages" and confirm "Total revenue" updates to $60.00, the "By category" bar chart shows only Beverages, and "Recent orders" shows only Beverages rows, while "Orders" (no reactsTo) stays at 6; '
    + '(2) set it to "Snacks" and confirm the equivalent $45.00/Snacks-only behavior; '
    + '(3) set it back to "All" and confirm every block returns to its original page-load value.');
}

// upsertByName means re-running publish should find and overwrite the
// same file, not create a second one - the whole reason the fixture
// declares it (see 08-fixtures-publish-targets.js's own comment).
function testPublishRerunOverwritesSameFile() {
  var first = runOne('salesPublish');
  var second = runOne('salesPublish');
  check('re-running publish overwrites the same Drive file (upsertByName)',
    first.driveFileId === second.driveFileId, first.driveFileId + ' vs ' + second.driveFileId);
}

// A move node whose target is Sheets, not BigQuery, proves publish's ref
// resolution rejects it with a clear error rather than silently reading
// nothing. Declared as temporary nodes (see withTemporaryNodes' own
// comment in 01-test-helpers.js) since a permanently-declared broken
// publish node would make testRunEverything() fail.
function testPublishRefToNonBigQueryMoveTargetFails() {
  withTemporaryNodes({
    nonBigQuerySource: {
      kind: 'move',
      name: 'nonBigQuerySource',
      source: { type: 'sheets', spreadsheetId: P.SHEETS_SOURCE_SPREADSHEET_ID, range: P.SHEETS_SOURCE_RANGE },
      target: { type: 'sheets', spreadsheetId: P.SHEETS_SOURCE_SPREADSHEET_ID, sheetName: 'PublishRefCheckScratch', mode: 'overwrite' }
    },
    publishFromNonBigQuery: {
      kind: 'publish',
      name: 'publishFromNonBigQuery',
      dependsOn: ['nonBigQuerySource'],
      source: { type: 'ref', ref: 'nonBigQuerySource' },
      target: { type: 'drive', folderId: P.NOTSOBIGDATA_DRIVE_FOLDER_ID, fileName: 'publish-should-not-be-created.html' },
      kpis: [{ label: 'x', agg: 'count', format: 'integer' }]
    }
  }, function () {
    var error = runOneExpectingFailure('publishFromNonBigQuery');
    check('publish rejects a ref to a non-bigquery move target',
      error.indexOf('does not match a declared model or a move node with a bigquery target') !== -1, error);
  });
}
