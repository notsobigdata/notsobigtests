// 20-tests-targets.js — targets test category (see PROJECT.md; runAllTests('targets')).

// ===================================================================
// Tests — --target flag and target overlays
// ===================================================================

function testTargetFlagOnMoveOverlay() {
  withTemporaryNodes({
    targetMoveOverlay: {
      kind: 'move',
      source: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_TABLE },
      target: { type: 'drive', folderId: P.DRIVE_FOLDER_ID, fileName: 'target-move-prod.csv' },
      targets: {
        dev: { target: { type: 'drive', folderId: P.DRIVE_FOLDER_ID, fileName: 'target-move-dev.csv' } },
        prod: { target: { type: 'drive', folderId: P.DRIVE_FOLDER_ID, fileName: 'target-move-prod.csv' } }
      }
    }
  }, function () {
    var reportDev = NotSoBigData.cli('list --target dev --select targetMoveOverlay');
    check('--target dev resolves without error on move with targets', reportDev.ok);
    check('targetMoveOverlay is in results', reportDev.nodes.some(function (n) { return n.name === 'targetMoveOverlay'; }));
  });
}


function testTargetFlagOnModelOverlay() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        targetModelWithTargets: {
          sqlFile: 'stg_orders.html',
          targets: {
            dev: { dataset: P.BIGQUERY_DATASET + '_dev' },
            prod: { dataset: P.BIGQUERY_DATASET }
          }
        }
      }
    }
  }, function () {
    var reportProd = NotSoBigData.cli('list --target prod --select model');
    check('--target prod resolves without error on models', reportProd.ok);
  });
}


function testNoTargetUsesDefaults() {
  withTemporaryNodes({
    targetMoveOverlay: {
      kind: 'move',
      source: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_TABLE },
      target: { type: 'drive', folderId: P.DRIVE_FOLDER_ID, fileName: 'target-move-prod.csv' },
      targets: {
        dev: { target: { type: 'drive', folderId: P.DRIVE_FOLDER_ID, fileName: 'target-move-dev.csv' } }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('list --select targetMoveOverlay');
    check('omitting --target uses default config', report.ok);
    check('targetMoveOverlay appears in list', report.nodes.some(function (n) { return n.name === 'targetMoveOverlay'; }));
  });
}


function testUnknownTargetThrows() {
  withTemporaryNodes({
    targetMoveOverlay: {
      kind: 'move',
      source: { type: 'bigquery', projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET, table: P.BIGQUERY_TABLE },
      target: { type: 'drive', folderId: P.DRIVE_FOLDER_ID, fileName: 'target-move-prod.csv' },
      targets: {
        dev: { target: { type: 'drive', folderId: P.DRIVE_FOLDER_ID, fileName: 'target-move-dev.csv' } }
      }
    }
  }, function () {
    var threw = false;
    try {
      NotSoBigData.cli('list --target staging --select targetMoveOverlay');
    } catch (e) {
      threw = true;
      check('unknown target throws error with known targets listed',
        e.message.indexOf('not declared') !== -1 && e.message.indexOf('dev') !== -1);
    }
    check('--target staging threw as expected', threw);
  });
}


function testTargetDevModel() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        targetModelWithTargets: {
          sqlFile: 'stg_orders.html',
          targets: {
            dev: { dataset: P.BIGQUERY_DATASET + '_dev' },
            prod: { dataset: P.BIGQUERY_DATASET }
          }
        }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('compile --target dev --select targetModelWithTargets');
    check('--target dev compiles model without error', report.ok);
    check('targetModelWithTargets compiled', report.nodes.some(function (n) { return n.name === 'targetModelWithTargets' && n.status === 'planned'; }));
  });
}


function testTargetProdModel() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID,
      dataset: P.BIGQUERY_DATASET,
      models: {
        targetModelWithTargets: {
          sqlFile: 'stg_orders.html',
          targets: {
            dev: { dataset: P.BIGQUERY_DATASET + '_dev' },
            prod: { dataset: P.BIGQUERY_DATASET }
          }
        }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('compile --target prod --select targetModelWithTargets');
    check('--target prod compiles model without error', report.ok);
    check('targetModelWithTargets compiled', report.nodes.some(function (n) { return n.name === 'targetModelWithTargets' && n.status === 'planned'; }));
  });
}
