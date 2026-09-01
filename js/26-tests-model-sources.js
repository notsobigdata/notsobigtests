// 26-tests-model-sources.js — model-sources test category (see PROJECT.md; runAllTests('model-sources')).

// {{ source(...) }} + notsobigdataModels.sources + cli('sources') - dbt's
// source.yml equivalent (see notsobiglib's docs/model.md, "Declaring
// external data"). A source is deliberately never a node, so unlike every
// other model-* category here, nothing below calls cli('run') to exercise
// a source directly - only cli('sources') and cli('list') do, plus one
// test (testModelSourceResolvesAndSelectsRealData) that runs a *model*
// which itself selects from a source, to prove the round trip works
// end to end against real BigQuery, not just string substitution (already
// covered headlessly on the library's own PR - see that PR's test plan).
//
// myCustomExtractSourceFresh/Stale/Violations (02-fixtures-custom-connectors.js)
// back the tables these tests load via a temporary move() node before
// declaring them as a notsobigdataModels.sources table - same "reset this
// test's own scratch table, then declare it" pattern
// 19-tests-model-tests.js already uses for a model's own tests[].
// Freshness/tests checks that are deliberately never configured (the
// skipped/select/list fixtures below) never touch BigQuery at all - see
// checkSourceEntry() in notsobiglib's src/cli.js - so those reuse
// BIGQUERY_SOURCE_FRESH_TABLE's *name* without ever loading anything into
// it.


function testModelSourceResolvesAndSelectsRealData() {
  withTemporaryNodes({
    tmpLoadSourceFresh: {
      kind: 'move',
      source: { type: 'custom', fn: myCustomExtractSourceFresh },
      target: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_SOURCE_FRESH_TABLE, mode: 'overwrite' }
    },
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: {
        sourcetest: { tables: { customers: { table: P.BIGQUERY_SOURCE_FRESH_TABLE } } }
      },
      models: { tmpSourceModel: { sqlFile: 'html/model_source_customers.html' } }
    }
  }, function () {
    runOne('tmpLoadSourceFresh');

    var compiled = NotSoBigData.cli('compile --select tmpSourceModel').nodes[0];
    var expectedRelation = '`' + P.BIGQUERY_PROJECT_ID + '.' + P.BIGQUERY_DATASET + '.' + P.BIGQUERY_SOURCE_FRESH_TABLE + '`';
    check('{{ source(...) }} compiles to the real table\'s relation', compiled.compiledSql.indexOf(expectedRelation) !== -1, compiled.compiledSql);

    var result = runOne('tmpSourceModel');
    check('the model actually materializes by selecting from the source table', result.materialized === 'view', JSON.stringify(result));
  });
}


function testSourcesFreshnessOkAndTestsPass() {
  withTemporaryNodes({
    tmpLoadSourceFresh: {
      kind: 'move',
      source: { type: 'custom', fn: myCustomExtractSourceFresh },
      target: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_SOURCE_FRESH_TABLE, mode: 'overwrite' }
    },
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: {
        sourcetest: {
          tables: {
            customers: {
              table: P.BIGQUERY_SOURCE_FRESH_TABLE,
              loadedAtField: 'updated_at',
              freshness: { warnAfterMinutes: 60, errorAfterMinutes: 1440 },
              tests: [
                { column: 'customer_id', check: 'not_null' },
                { column: 'customer_id', check: 'unique' }
              ]
            }
          }
        }
      }
    }
  }, function () {
    runOne('tmpLoadSourceFresh');
    var report = NotSoBigData.cli('sources');
    check('sources report ok', report.ok, JSON.stringify(report.checks));

    var freshness = report.checks.filter(function (c) { return c.table === 'customers' && c.check === 'freshness'; })[0];
    check('freshness check reports ok for data loaded seconds ago', freshness.status === 'ok', JSON.stringify(freshness));

    var tests = report.checks.filter(function (c) { return c.table === 'customers' && c.check === 'tests'; })[0];
    check('both declared tests passed', tests.status === 'ok' && tests.message.indexOf('2 test') !== -1, JSON.stringify(tests));
  });
}


function testSourcesFreshnessWarn() {
  withTemporaryNodes({
    tmpLoadSourceStale: {
      kind: 'move',
      source: { type: 'custom', fn: myCustomExtractSourceStale },
      target: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_SOURCE_STALE_TABLE, mode: 'overwrite' }
    },
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: {
        sourcetest: {
          tables: {
            customers: {
              table: P.BIGQUERY_SOURCE_STALE_TABLE,
              loadedAtField: 'updated_at',
              // Data is a fixed 3 hours old (myCustomExtractSourceStale) -
              // warnAfterMinutes: 60 puts that past the warn line, but
              // errorAfterMinutes: 1440 (24h) keeps it well short of error.
              freshness: { warnAfterMinutes: 60, errorAfterMinutes: 1440 }
            }
          }
        }
      }
    }
  }, function () {
    runOne('tmpLoadSourceStale');
    var report = NotSoBigData.cli('sources');
    var freshness = report.checks.filter(function (c) { return c.check === 'freshness'; })[0];
    check('3-hour-old data past a 60-minute warnAfterMinutes reports warn', freshness.status === 'warn', JSON.stringify(freshness));
    check('a warn does not flip the whole report to not-ok', report.ok === true, JSON.stringify(report));
  });
}


function testSourcesFreshnessError() {
  withTemporaryNodes({
    tmpLoadSourceStale: {
      kind: 'move',
      source: { type: 'custom', fn: myCustomExtractSourceStale },
      target: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_SOURCE_STALE_TABLE, mode: 'overwrite' }
    },
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: {
        sourcetest: {
          tables: {
            customers: {
              table: P.BIGQUERY_SOURCE_STALE_TABLE,
              loadedAtField: 'updated_at',
              // Same 3-hour-old data as testSourcesFreshnessWarn, but a
              // 120-minute errorAfterMinutes this time puts it past error
              // instead - only the threshold moved, not the data.
              freshness: { warnAfterMinutes: 60, errorAfterMinutes: 120 }
            }
          }
        }
      }
    }
  }, function () {
    runOne('tmpLoadSourceStale');
    var report = NotSoBigData.cli('sources');
    var freshness = report.checks.filter(function (c) { return c.check === 'freshness'; })[0];
    check('3-hour-old data past a 120-minute errorAfterMinutes reports error', freshness.status === 'error', JSON.stringify(freshness));
    check('an error flips the whole report to not-ok', report.ok === false, JSON.stringify(report));
  });
}


function testSourcesGenericTestsFailCollectAllViolations() {
  withTemporaryNodes({
    tmpLoadSourceViolations: {
      kind: 'move',
      source: { type: 'custom', fn: myCustomExtractSourceViolations },
      target: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_SOURCE_VIOLATIONS_TABLE, mode: 'overwrite' }
    },
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: {
        sourcetest: {
          tables: {
            customers: {
              table: P.BIGQUERY_SOURCE_VIOLATIONS_TABLE,
              tests: [
                { column: 'customer_id', check: 'not_null' },
                { column: 'customer_id', check: 'unique' }
              ]
            }
          }
        }
      }
    }
  }, function () {
    runOne('tmpLoadSourceViolations');
    var report = NotSoBigData.cli('sources');
    check('the whole report is not-ok', report.ok === false, JSON.stringify(report));
    var tests = report.checks.filter(function (c) { return c.check === 'tests'; })[0];
    check('the tests check reports error', tests.status === 'error', JSON.stringify(tests));
    ['not_null_customer_id', 'unique_customer_id'].forEach(function (name) {
      check('failure message names "' + name + '"', tests.message.indexOf(name) !== -1, tests.message);
    });
  });
}


function testSourcesSkippedWhenNothingConfigured() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: {
        sourcetest: { tables: { customers: { table: P.BIGQUERY_SOURCE_FRESH_TABLE } } }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('sources');
    check('sources report ok (nothing configured is not a failure)', report.ok, JSON.stringify(report));
    check('both checks report skipped - no BigQuery call was needed for either',
      report.checks.length === 2 && report.checks.every(function (c) { return c.status === 'skipped'; }),
      JSON.stringify(report.checks));
  });
}


function testSourcesSelectFiltersByDottedSourceTable() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: {
        sourcetest: {
          tables: {
            customers: { table: P.BIGQUERY_SOURCE_FRESH_TABLE },
            orders: { table: P.BIGQUERY_SOURCE_STALE_TABLE }
          }
        }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('sources --select sourcetest.customers');
    check('--select "source.table" narrows to just that table\'s two checks',
      report.checks.length === 2 && report.checks.every(function (c) { return c.table === 'customers'; }),
      JSON.stringify(report.checks));
  });
}


function testSourcesUnknownSelectorThrows() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: { sourcetest: { tables: { customers: { table: P.BIGQUERY_SOURCE_FRESH_TABLE } } } }
    }
  }, function () {
    try {
      NotSoBigData.cli('sources --select nope');
      check('unknown source selector throws', false, 'it did not throw');
    } catch (e) {
      check('unknown source selector throws a clear error', e.message.indexOf('matched no declared source') !== -1, e.message);
    }
  });
}


function testListReportsDeclaredSources() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      sources: {
        sourcetest: {
          tables: {
            customers: {
              table: P.BIGQUERY_SOURCE_FRESH_TABLE,
              loadedAtField: 'updated_at',
              freshness: { warnAfterMinutes: 60 },
              tests: [{ column: 'customer_id', check: 'not_null' }]
            }
          }
        }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('list');
    var entry = report.sources.filter(function (s) { return s.source === 'sourcetest' && s.table === 'customers'; })[0];
    var expectedRelation = '`' + P.BIGQUERY_PROJECT_ID + '.' + P.BIGQUERY_DATASET + '.' + P.BIGQUERY_SOURCE_FRESH_TABLE + '`';
    check('list reports the declared source with its resolved relation and configured flags',
      !!entry && entry.relation === expectedRelation && entry.freshness === true && entry.tests === true && entry.columns === false,
      JSON.stringify(entry));
  });
}
