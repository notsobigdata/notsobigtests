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

// linkTo (notsobiglib feat/publish-link-to): a GAS test can't click a bar
// or follow a navigation, so this only proves the pipeline resolved the
// destination's own filename and embedded it correctly in the payload -
// same ceiling every other interactive-chart test above already accepts.
// linkTo resolves to a plain relative link (the destination's own
// target.fileName), not a Drive URL, and has no "destination must have
// been published first" requirement - so unlike an earlier version of
// this test, filtersPublish doesn't need to run before linkToPublish for
// this to resolve. The actual click-through and destination pre-filtering
// is left to a human via testLog below.
function testPublishLinkToResolvesRelativeFilenameToDestination() {
  var result = runOne('linkToPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();

  var payload = extractPublishPayload(html);
  var chart = payload.charts.filter(function (c) { return c.id === 'by_category'; })[0];
  check('linkTo resolves to filtersPublish\'s own target.fileName', !!chart.linkTo && chart.linkTo.url === 'publish-filters.html',
    'expected "publish-filters.html", got: ' + JSON.stringify(chart.linkTo));
  check('linkTo carries the configured field', !!chart.linkTo && chart.linkTo.field === 'category', JSON.stringify(chart.linkTo));
  check('linkTo newTab is true', !!chart.linkTo && chart.linkTo.newTab === true, JSON.stringify(chart.linkTo));

  testLog('LinkTo report file id: ' + result.driveFileId + ' - download (or Drive-for-Desktop-sync) both this file and the '
    + 'filtersPublish report ("publish-filters.html") into the SAME local folder, then open the linkTo report in a browser '
    + '(a file:// URL, or via a local server) and: (1) click a bar on "By category" and confirm it opens the filtersPublish '
    + 'report in a new tab; (2) confirm that report\'s Category filter is already set to the clicked category, with "Total '
    + 'revenue" and "Recent orders" already narrowed to it, exactly as if you\'d picked it from the dropdown yourself. '
    + 'Opening either file straight from Drive\'s own web preview (rather than a downloaded/synced local copy) will not work - '
    + 'Drive\'s preview doesn\'t execute the report\'s inline script.');
}

// Block source override (notsobiglib feat/publish-block-source-override):
// proves a single kpi/table reading its own source.ref actually pulls
// from that other table (loadPublishRefunds), not the report's default
// source (loadPublishOrders) - both nodes are run explicitly here rather
// than relying on an earlier test in the category having already loaded
// them, so this test also passes standalone
// (runAllTests('testPublishBlockSourceOverrideReadsFromItsOwnRef')).
function testPublishBlockSourceOverrideReadsFromItsOwnRef() {
  runOne('loadPublishOrders');
  runOne('loadPublishRefunds');
  var result = runOne('blockSourceOverridePublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();
  var payload = extractPublishPayload(html);

  var totalRevenue = payload.kpis.filter(function (k) { return k.label === 'Total revenue'; })[0];
  var totalRefunds = payload.kpis.filter(function (k) { return k.label === 'Total refunds'; })[0];
  check('default-source kpi sums loadPublishOrders\' revenue (10+20+5+15+25+30=105)',
    totalRevenue.value === 105, JSON.stringify(totalRevenue));
  check('overridden kpi sums loadPublishRefunds\' amount (10+5+30=45), not the default source',
    totalRefunds.value === 45, JSON.stringify(totalRefunds));

  var table = payload.tables.filter(function (t) { return t.id === 'refunds_detail'; })[0];
  check('overridden table holds all 3 loadPublishRefunds rows', table.rows.length === 3, JSON.stringify(table.rows));
  var reasons = table.rows.map(function (row) { return row[3]; }).sort();
  check('overridden table\'s rows are loadPublishRefunds\' own (has a "reason" column absent from the default source)',
    JSON.stringify(reasons) === JSON.stringify(['damaged', 'damaged', 'wrong item']), JSON.stringify(table.rows));
}

// Detail drill-down (notsobiglib feat/publish-detail-drilldown): automated
// part checks the written report's payload carries the right .detail data
// (groupBy/rows, trimmed to just detail.columns+groupBy+series per the
// branch's own security fix) for both the chart and the table. Human part
// (do by hand after this passes): open the written Drive file in a
// browser, expand the "Beverages" row's "▸" toggle and click the
// "Beverages" bar in the chart - both should open a modal listing exactly
// order_id 1, 2, 6 with revenues 10/20/30.
function testPublishDetailDrilldownPayloadCarriesGroupRows() {
  runOne('loadPublishOrders');
  var result = runOne('detailDrilldownPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();
  var payload = extractPublishPayload(html);

  var chart = payload.charts.filter(function (c) { return c.id === 'by_category'; })[0];
  check('chart.detail.groupBy is "category"', chart.detail.groupBy === 'category', JSON.stringify(chart.detail));
  var beverageRows = chart.detail.rows.filter(function (r) { return r.category === 'Beverages'; });
  check('chart.detail.rows holds exactly the 3 Beverages rows', beverageRows.length === 3, JSON.stringify(beverageRows));

  var table = payload.tables.filter(function (t) { return t.id === 'by_category_table'; })[0];
  check('table.detail.groupBy is "category"', table.detail.groupBy === 'category', JSON.stringify(table.detail));
  check('table.detail.rows holds all 6 loadPublishOrders rows (ungrouped)', table.detail.rows.length === 6, JSON.stringify(table.detail.rows));
}

// Automated part: the written report's markup/payload carries board-mode
// structure (an unpositioned node per block, the relatesTo edge encoded
// in the payload, an empty edges layer to be filled client-side).
// Position computation and edge drawing moved client-side in notsobiglib
// feat/publish-board-d3-layout (d3-hierarchy's d3.stratify()/d3.tree() +
// d3-zoom) - GAS can't execute that browser JS, so neither a positioned
// "board-node" nor a rendered "board-edge" path exists in the raw HTML
// this test reads; both only appear after a real browser runs the page's
// script. Human part (do by hand after this passes): open the written
// Drive file in a browser, confirm "overview" and "order_detail" render
// as two connected boxes (this is where the one edge actually becomes
// visible), drag to pan the canvas, scroll to zoom in/out (and pinch-zoom
// on a touch device, and double-click to zoom in - both new, free
// upgrades from d3-zoom), and drag the little resize grip in a node's
// bottom-right corner to confirm it grows/shrinks (native CSS resize -
// resizing may overlap the other node, that's expected, positions don't
// reflow). This fixture only has 2 boxes so it can't show off d3-tree's
// spacing on a genuinely lopsided tree - if a board fixture with a deep
// branch next to a wide shallow one ever gets added here, eyeball that
// the narrow branch doesn't get pushed out by the wide one's full leaf
// count.
function testPublishBoardLayoutRendersPositionedTreeWithOneEdge() {
  runOne('loadPublishOrders');
  var result = runOne('boardLayoutPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();

  check('board-viewport markup present', html.indexOf('board-viewport') !== -1, html);
  var nodeCount = (html.match(/class="board-node"/g) || []).length;
  check('exactly 2 unpositioned board nodes rendered', nodeCount === 2, 'got ' + nodeCount);
  check('board-edges layer present, empty until the client script fills it', html.indexOf('<svg class="board-edges" id="board-edges"></svg>') !== -1, html);

  var payload = extractPublishPayload(html);
  var overview = payload.charts.filter(function (c) { return c.id === 'overview'; })[0];
  var orderDetail = payload.tables.filter(function (t) { return t.id === 'order_detail'; })[0];
  check('overview has no relatesTo (board root)', overview.relatesTo === null, JSON.stringify(overview));
  check('order_detail.relatesTo is "overview" (the one edge, drawn client-side)', orderDetail.relatesTo === 'overview', JSON.stringify(orderDetail));
}

// Design-system verification (notsobiglib feat/publish-design-system):
// every report now ships a built-in light/dark toggle and a second,
// dark token set - mechanical checks mirror notsobiglib's own Layer 1
// coverage (same file, different runtime). The real cross-theme/
// cross-block visual check (KPIs, chart, table, and - on a board
// fixture - board nodes all re-theme together, with no flash of
// unstyled content) can't be driven from this Apps Script test, so it's
// left to a human via testLog below, same ceiling every other
// browser-only check in this file already accepts.
function testPublishThemeToggleRendersWithDarkTokens() {
  var result = runOne('salesPublish');
  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();

  check('theme toggle button present', html.indexOf('id="theme-toggle"') !== -1, html);
  check('sun/moon icon classes present',
    html.indexOf('theme-toggle-icon-sun') !== -1 && html.indexOf('theme-toggle-icon-moon') !== -1, html);
  check('dark-mode media block present', /prefers-color-scheme:\s*dark/.test(html), html);
  check('manual dark override selector present', html.indexOf('data-theme="dark"') !== -1, html);
  check('theme choice persisted via localStorage', html.indexOf('localStorage.setItem("publish-theme"') !== -1, html);

  testLog('Theme-toggle report file id: ' + result.driveFileId + ' - open it in a browser and: '
    + '(1) confirm it opens light or dark matching your OS color-scheme setting with no toggle click; '
    + '(2) click the top-right toggle and confirm KPIs, the chart, and the table all re-theme together '
    + 'with no flash of unstyled content; (3) reload the tab and confirm your last explicit choice '
    + 'persisted; (4) with no stored choice (clear localStorage for this file\'s origin), flip your '
    + 'OS dark-mode setting and confirm the report follows it automatically.');
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
