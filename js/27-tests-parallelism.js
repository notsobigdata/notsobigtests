// 27-tests-parallelism.js
// Layer 2: test parallel execution of model nodes within a level.
// Three independent models, each ~5s on BigQuery via nested select sleep.
// Expected: ~5s total with parallelism (sequential: ~15s).

var notsobigdataModels = {
  projectId: P.BIGQUERY_PROJECT_ID,
  dataset: P.BIGQUERY_DATASET,
  models: {
    parallelism_model_a: { sqlFile: 'html/parallelism_model_a.html' },
    parallelism_model_b: { sqlFile: 'html/parallelism_model_b.html' },
    parallelism_model_c: { sqlFile: 'html/parallelism_model_c.html' }
  }
};

function testParallelismThreeModelsExecuteInParallel() {
  // Three independent models, no dependencies.
  // With parallelism: should complete in ~5-7s (all queries run in parallel on BigQuery).
  // Without parallelism: would take ~15s+ (sequential execution).
  var startTime = new Date().getTime();
  var report = NotSoBigData.cli('run --select model');
  var elapsed = new Date().getTime() - startTime;

  // check(label, passed, detail) - these three calls used to pass their
  // arguments in the wrong order (report.ok/a boolean expression as the
  // label, the label string as `passed`), which made every one of them
  // unfailable: a non-empty string is always truthy, so `passed` was
  // always true regardless of what report.ok or the node statuses
  // actually were. Fixed alongside the two new scenarios below, added
  // while re-verifying notsobiglib release/15's parallel-model-execution
  // fix - this file needing to genuinely catch a bad run is the whole
  // point of it existing.
  check('run should succeed', report.ok, JSON.stringify(report.nodes));
  check('expected 3 models run', report.nodes.length === 3);
  check('all models should succeed', report.nodes.every(function (n) { return n.status === 'success'; }), JSON.stringify(report.nodes));

  // Log timing for Layer 2 verification. With true parallelism, elapsed should be
  // close to max(individual query times) ≈ 5s. Without, ≈ sum ≈ 15s.
  // (Note: Apps Script overhead + BigQuery latency adds ~1-2s, so 5-7s is expected.)
  testLog('  Elapsed: ' + elapsed + 'ms for 3 parallel 5s queries');
  if (elapsed > 12000) {
    testLog('  WARNING: elapsed > 12s suggests queries ran sequentially, not in parallel');
  } else {
    testLog('  SUCCESS: elapsed < 12s indicates parallelism is working');
  }
}

// Re-verifies notsobiglib release/15's parallel-model-execution fix: the
// pre-fix code only ever submitted the plain CREATE OR REPLACE statement
// for every model in an all-model level, regardless of materialized type
// - an incremental model got invalid "CREATE OR REPLACE INCREMENTAL ..."
// DDL, and a staged table-with-tests model skipped staging/tests
// entirely. Five independent models (no dependsOn between them, so they
// land in one level together) cover every materialization branch
// buildModelPipeline() dispatches on: plain view, merge, insert_overwrite,
// append, and staged table with tests. This is the scenario the existing
// per-strategy tests in 14b-tests-model-incremental.js and
// 19-tests-model-tests.js never exercised - each of those always selects
// exactly one model, which (per notsobiglib's cli.md) is still its own
// one-node "level" and so already took the parallel branch on its own;
// none of them ever proved several *different* materializations correctly
// share one parallel batch.
function testParallelismMixedMaterializationTypesSucceedTogether() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        tmpParallelPlainView: { sqlFile: 'html/parallelism_model_a.html' },
        // Tag ids below must match the model name exactly - both html
        // files hold more than one <script> tag (see docs/model.md's
        // "More than one tag" rule) - these are the same registry keys
        // 14b-tests-model-incremental.js already uses for the same files.
        incremental_orders_merge: {
          sqlFile: 'html/model_incremental_merge.html',
          materialized: 'incremental', incrementalStrategy: 'merge', uniqueKey: 'order_id'
        },
        incremental_events_daily_insert_overwrite: {
          sqlFile: 'html/model_incremental_insert_overwrite.html',
          materialized: 'incremental', incrementalStrategy: 'insert_overwrite',
          partitionBy: { field: 'event_date', dataType: 'DATE', granularity: 'DAY' }
        },
        incremental_logs_append: {
          sqlFile: 'html/model_incremental_append.html',
          materialized: 'incremental', incrementalStrategy: 'append'
        },
        tmpParallelStagedCustomers: {
          sqlFile: 'html/model_tests_customers.html',
          materialized: 'table',
          tests: [{ column: 'customer_id', check: 'not_null' }]
        }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select model');
    check('expected 5 models run', report.nodes.length === 5, JSON.stringify(report.nodes.map(function (n) { return n.name; })));
    check('every materialization type succeeded', report.ok, JSON.stringify(report.nodes));

    var byName = {};
    report.nodes.forEach(function (n) { byName[n.name] = n; });
    check('plain view materialized correctly', byName.tmpParallelPlainView.result.materialized === 'view', JSON.stringify(byName.tmpParallelPlainView));
    check('merge strategy ran (not the plain-path bug: invalid "CREATE OR REPLACE INCREMENTAL")',
      byName.incremental_orders_merge.result.strategy === 'merge', JSON.stringify(byName.incremental_orders_merge));
    check('insert_overwrite strategy ran', byName.incremental_events_daily_insert_overwrite.result.strategy === 'insert_overwrite',
      JSON.stringify(byName.incremental_events_daily_insert_overwrite));
    check('append strategy ran', byName.incremental_logs_append.result.strategy === 'append', JSON.stringify(byName.incremental_logs_append));
    check('staged table went through staging+promotion, not a direct write (the plain-path bug this fix closes)',
      !!byName.tmpParallelStagedCustomers.result.staged, JSON.stringify(byName.tmpParallelStagedCustomers));
    check('the staged table\'s declared test actually ran (not silently skipped)',
      !!byName.tmpParallelStagedCustomers.result.testResults && byName.tmpParallelStagedCustomers.result.testResults.ran === 1,
      JSON.stringify(byName.tmpParallelStagedCustomers));
  });
}

// Re-verifies the other half of the same fix: one node's failure inside a
// parallel model level must not abort the other nodes in that level (the
// pre-fix code let a thrown compile/submit error escape the whole level
// uncaught). tmpMultiStatement is the same deliberately-invalid fixture
// 18-tests-model-discovery.js already uses for a single-node discovery
// check; here it runs alongside two healthy models in the same
// dependency-free level.
function testParallelismOneFailureDoesNotAbortItsLevel() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        tmpParallelHealthyA: { sqlFile: 'html/parallelism_model_a.html' },
        tmpParallelHealthyB: { sqlFile: 'html/parallelism_model_b.html' },
        tmpMultiStatement: { sqlFile: 'html/model_multi_statement.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select model');
    check('expected 3 models run', report.nodes.length === 3, JSON.stringify(report.nodes.map(function (n) { return n.name; })));
    check('overall run reports failure (one bad node)', !report.ok);

    var byName = {};
    report.nodes.forEach(function (n) { byName[n.name] = n; });
    check('the broken model failed', byName.tmpMultiStatement.status === 'failed', JSON.stringify(byName.tmpMultiStatement));
    check('the healthy models still succeeded despite the sibling failure',
      byName.tmpParallelHealthyA.status === 'success' && byName.tmpParallelHealthyB.status === 'success',
      JSON.stringify([byName.tmpParallelHealthyA, byName.tmpParallelHealthyB]));
  });
}
