// 18-tests-model-discovery.js — model-discovery test category (see PROJECT.md; runAllTests('model-discovery')).


function testModelRegistryNameCollisionThrows() {
  withTemporaryNodes({
    tmpCollision: { kind: 'move', name: 'tmpCollision', source: { type: 'custom', fn: myCustomExtract } },
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      models: { tmpCollision: { sqlFile: 'stg_orders.html' } }
    }
  }, function () {
    try {
      NotSoBigData.cli('list');
      check('a model name colliding with a declared node name throws', false, 'it did not throw');
    } catch (e) {
      check('a model name colliding with a declared node name throws', e.message.indexOf('both named "tmpCollision"') !== -1, e.message);
    }
  });
}


function testModelMultiStatementThrows() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      models: { tmpMultiStatement: { sqlFile: 'html/model_multi_statement.html' } }
    }
  }, function () {
    var message = runOneExpectingFailure('tmpMultiStatement');
    check('a model with a multi-statement SQL body throws',
      message.indexOf('must be a single statement') !== -1, message);
  });
}


function testModelMalformedRegistryThrows() {
  withTemporaryNodes({
    notsobigdataModels: ['not', 'an', 'object']
  }, function () {
    var threw = null;
    try {
      NotSoBigData.cli('list');
    } catch (e) {
      threw = e;
    }
    check('a structurally malformed notsobigdataModels throws instead of silently behaving like "not declared"',
      !!threw && threw.message.indexOf('notsobigdataModels must be an object') !== -1, threw ? threw.message : 'did not throw');
  });
}


// notsobigdataModels.folders (notsobiglib PR #71) - the two errors below
// mirror the two existing shapes just above: a per-model bad reference
// (testModelSingleTagMismatchedIdFailsAtList's style - caught inside
// expandModelNodes()'s per-model try/catch, so it's that one node's own
// "failed" status, not a hard cli() abort) and a structurally malformed
// shared-config value (testModelMalformedRegistryThrows's style - thrown
// straight out of readModelsRegistry(), before the per-model loop even
// starts, so it takes the whole cli() call down).
function testModelUnknownFolderFailsAtList() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      models: { tmpUnknownFolder: { folder: 'nope' } }
    }
  }, function () {
    var node = NotSoBigData.cli('list').nodes.filter(function (n) { return n.name === 'tmpUnknownFolder'; })[0];
    check('a model declaring a folder absent from notsobigdataModels.folders is reported failed by a dry "list" run',
      !!node && node.status === 'failed' && node.error.indexOf('is not declared in notsobigdataModels.folders') !== -1,
      node ? node.status + ': ' + node.error : 'node missing from report');
  });
}


function testModelMalformedFoldersThrows() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      folders: ['not', 'an', 'object'],
      models: {}
    }
  }, function () {
    var threw = null;
    try {
      NotSoBigData.cli('list');
    } catch (e) {
      threw = e;
    }
    check('a structurally malformed notsobigdataModels.folders throws instead of being silently ignored',
      !!threw && threw.message.indexOf('notsobigdataModels.folders must be an object') !== -1, threw ? threw.message : 'did not throw');
  });
}


function testModelTopLevelVarRejected() {
  withTemporaryNodes({
    tmpOldStyleModel: { kind: 'model', sqlFile: 'stg_orders.html' }
  }, function () {
    var threw = null;
    try {
      NotSoBigData.cli('list');
    } catch (e) {
      threw = e;
    }
    check('a model declared as its own top-level var is rejected with a clear redirect',
      !!threw && threw.message.indexOf('notsobigdataModels.models instead') !== -1, threw ? threw.message : 'did not throw');
  });
}


// Regression coverage for a second /release finish pass's independent
// review finding: expandModelNodes() used to let any one model's own
// read/parse error throw straight out of discoverNodes(), aborting cli()
// for every node in the project - move nodes included - not just the
// broken model. tmpBrokenModel's sqlFile deliberately doesn't exist;
// tmpUnrelatedMove has nothing to do with it (no shared dependsOn, no ref()
// between them) and must still run to a normal success, proving the
// broken model's failure is now isolated to itself.
function testModelBrokenModelDoesNotBlockUnrelatedNode() {
  withTemporaryNodes({
    tmpUnrelatedMove: { kind: 'move', name: 'tmpUnrelatedMove', source: { type: 'custom', fn: myCustomExtract } },
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      models: { tmpBrokenModel: { sqlFile: 'html/model_does_not_exist.html' } }
    }
  }, function () {
    var rows = runOne('tmpUnrelatedMove');
    check('an unrelated move node still runs fine even though a sibling model\'s .html file is missing',
      rows.length === 3, JSON.stringify(rows));
  });
}
