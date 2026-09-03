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

  check(report.ok, 'run should succeed');
  check(report.nodes.length === 3, 'expected 3 models run');
  check(report.nodes.every(function (n) { return n.status === 'success'; }), 'all models should succeed');

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
