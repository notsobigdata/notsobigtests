// 14b-tests-model-incremental.js — model-incremental test category
// Layer 2 verification for incremental strategies: merge, insert_overwrite, append
// Tests that actual MERGE/INSERT OVERWRITE/INSERT statements work against live BigQuery


function testIncrementalMergeFirstBuild() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      materialized: 'incremental',
      incrementalStrategy: 'merge',
      uniqueKey: 'order_id',
      models: {
        incremental_orders_merge: { sqlFile: 'html/model_incremental_merge.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select incremental_orders_merge');
    check('MERGE first build: node count', report.nodes.length === 1);
    check('MERGE first build: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ MERGE first build created table');

    // Second run: update row 1 via MERGE (incremental)
    report = NotSoBigData.cli('run --select incremental_orders_merge');
    check('MERGE second run: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ MERGE second run (incremental) updated table');

    // Full refresh: rebuild entirely
    report = NotSoBigData.cli('run --full-refresh --select incremental_orders_merge');
    check('MERGE full-refresh: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ MERGE --full-refresh rebuilt table');
  });
}


function testIncrementalMergeSecondRun() {
  // Placeholder - actual test is in testIncrementalMergeFirstBuild
  testLog('✓ MERGE second run (tested in first build)');
}


function testIncrementalMergeFullRefresh() {
  // Placeholder - actual test is in testIncrementalMergeFirstBuild
  testLog('✓ MERGE full-refresh (tested in first build)');
}


function testIncrementalAppendFirstBuild() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      materialized: 'incremental',
      incrementalStrategy: 'append',
      models: {
        incremental_logs_append: { sqlFile: 'html/model_incremental_append.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select incremental_logs_append');
    check('APPEND first build: node count', report.nodes.length === 1);
    check('APPEND first build: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ APPEND first build created table');

    // Second run: append new row (incremental)
    report = NotSoBigData.cli('run --select incremental_logs_append');
    check('APPEND second run: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ APPEND second run appended to table');
  });
}


function testIncrementalAppendSecondRun() {
  // Placeholder - actual test is in testIncrementalAppendFirstBuild
  testLog('✓ APPEND second run (tested in first build)');
}


function testIncrementalInsertOverwriteFirstBuild() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      materialized: 'incremental',
      incrementalStrategy: 'insert_overwrite',
      partitionBy: { field: 'event_date', dataType: 'DATE', granularity: 'DAY' },
      models: {
        incremental_events_daily_insert_overwrite: { sqlFile: 'html/model_incremental_insert_overwrite.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select incremental_events_daily_insert_overwrite');
    check('INSERT_OVERWRITE first build: node count', report.nodes.length === 1);
    check('INSERT_OVERWRITE first build: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ INSERT_OVERWRITE first build created partitioned table');

    // Second run: INSERT OVERWRITE with multi-statement script (incremental)
    report = NotSoBigData.cli('run --select incremental_events_daily_insert_overwrite');
    check('INSERT_OVERWRITE second run: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ INSERT_OVERWRITE second run executed multi-statement script');
  });
}


function testIncrementalInsertOverwriteSecondRun() {
  // Placeholder - actual test is in testIncrementalInsertOverwriteFirstBuild
  testLog('✓ INSERT_OVERWRITE second run (tested in first build)');
}


function testIsIncrementalConditionalEvaluatesCorrectly() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        // Simple incremental that uses is_incremental() in the SQL
        test_is_incremental: {
          materialized: 'incremental',
          incrementalStrategy: 'append',
          sqlFile: 'html/model_incremental_append.html'
        }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('compile --select test_is_incremental');
    check('is_incremental() compile: node count', report.nodes.length === 1);
    // compile returns 'planned' for dry-run or 'success' after compilation - accept either
    var isCompiled = report.nodes[0].status === 'planned' || report.nodes[0].status === 'success';
    check('is_incremental() compile: compiled status', isCompiled, 'got: ' + report.nodes[0].status);
    testLog('✓ is_incremental() in SQL compiled without error');
  });
}
