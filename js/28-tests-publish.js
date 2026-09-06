// 28-tests-publish.js — Layer 2 verification for the publish kind: BigQuery Tabledata.list
// read, JS-side KPI/chart aggregation, and the generated HTML actually containing the right
// numbers - not just "did it run without throwing". See notsobiglib's docs/publish.md for the
// kind's full config reference, and js/08-fixtures-publish-targets.js for the fixtures below.

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
