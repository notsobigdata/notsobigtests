// 28-tests-publish.js — Layer 2 verification for the publish kind: BigQuery Tabledata.list
// read, JS-side KPI/chart/table aggregation, and the generated HTML actually containing the
// right numbers - not just "did it run without throwing". See notsobiglib's docs/publish.md for
// the kind's full config reference, and js/08-fixtures-publish-targets.js for the fixtures below.

function testPublishGeneratesReportWithCorrectAggregates() {
  runOne('loadPublishOrders');
  var result = runOne('salesPublish');
  check('publish reports the row count it read', result.rowCount === 6, result.rowCount);
  check('publish reports a driveFileId', !!result.driveFileId, result.driveFileId);

  var html = DriveApp.getFileById(result.driveFileId).getBlob().getDataAsString();
  // 10+20+30 = 60 Beverages, 5+15+25 = 45 Snacks, total = 105.
  check('KPI total revenue is correct', html.indexOf('$105.00') !== -1, 'expected "$105.00" in generated HTML');
  check('KPI order count is correct', html.indexOf('>6<') !== -1, 'expected the order count 6 to render');
  check('chart shows the Beverages group and its total', html.indexOf('Beverages') !== -1 && html.indexOf('>60<') !== -1,
    'expected a Beverages group with total 60');
  check('chart shows the Snacks group and its total', html.indexOf('Snacks') !== -1 && html.indexOf('>45<') !== -1,
    'expected a Snacks group with total 45');
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
