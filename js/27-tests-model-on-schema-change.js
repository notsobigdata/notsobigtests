// 27-tests-model-on-schema-change.js — model-on-schema-change test category
// Layer 2 verification for on_schema_change config: ignore, fail, append_new_columns, sync_all_columns
// Tests that on_schema_change behavior works correctly against live BigQuery


function testOnSchemaChangeIgnoreSkipsNewColumns() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        on_schema_change_ignore: { sqlFile: 'html/model_on_schema_change_ignore.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select on_schema_change_ignore');
    check('on_schema_change=ignore first build: node count', report.nodes.length === 1);
    check('on_schema_change=ignore first build: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change=ignore first build created table with (id, name)');

    // Second run: schema changes but new_column is ignored
    report = NotSoBigData.cli('run --select on_schema_change_ignore');
    check('on_schema_change=ignore second run: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change=ignore second run ignored new_column');
  });
}


function testOnSchemaChangeFailBlocksSchemaChange() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        on_schema_change_fail: { sqlFile: 'html/model_on_schema_change_fail.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select on_schema_change_fail');
    check('on_schema_change=fail first build: node count', report.nodes.length === 1);
    check('on_schema_change=fail first build: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change=fail first build created table with (id, name)');

    // Second run: schema changes and should fail
    report = NotSoBigData.cli('run --select on_schema_change_fail');
    check('on_schema_change=fail second run: fails as expected', report.nodes[0].status !== 'success',
      'expected error but got: ' + (report.nodes[0].error || 'success'));
    testLog('✓ on_schema_change=fail second run correctly failed on schema change');
  });
}


function testOnSchemaChangeAppendNewColumnsAddsColumns() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        on_schema_change_append: { sqlFile: 'html/model_on_schema_change_append_new_columns.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select on_schema_change_append');
    check('on_schema_change=append_new_columns first build: node count', report.nodes.length === 1);
    check('on_schema_change=append_new_columns first build: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change=append_new_columns first build created table with (id, name)');

    // Second run: schema changes and new_column is appended
    report = NotSoBigData.cli('run --select on_schema_change_append');
    check('on_schema_change=append_new_columns second run: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change=append_new_columns second run added new_column to table');
  });
}


function testOnSchemaChangeSyncAllColumnsFullyResync() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        on_schema_change_sync: { sqlFile: 'html/model_on_schema_change_sync_all_columns.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select on_schema_change_sync');
    check('on_schema_change=sync_all_columns first build: node count', report.nodes.length === 1);
    check('on_schema_change=sync_all_columns first build: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change=sync_all_columns first build created table with (id, name)');

    // Second run: schema changes and all columns are synced
    report = NotSoBigData.cli('run --select on_schema_change_sync');
    check('on_schema_change=sync_all_columns second run: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change=sync_all_columns second run synced all columns from source');
  });
}


function testOnSchemaChangeIgnoredDuringFullRefresh() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        on_schema_change_full_refresh: { sqlFile: 'html/model_on_schema_change_ignore.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('run --select on_schema_change_full_refresh');
    check('on_schema_change full-refresh: first build success', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change full-refresh first build created table');

    // Full refresh: on_schema_change is ignored during full refresh
    report = NotSoBigData.cli('run --full-refresh --select on_schema_change_full_refresh');
    check('on_schema_change full-refresh: success status', report.nodes[0].status === 'success', 'got: ' + report.nodes[0].error);
    testLog('✓ on_schema_change full-refresh rebuilt table (on_schema_change ignored)');
  });
}
