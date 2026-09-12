// 29-tests-docs.js — docs test category (see PROJECT.md; runAllTests('docs')).

// cli('docs') writes one project doc site to Drive: every declared node's
// kind/dependsOn drawn as an interactive board (reusing publish()'s own
// board layout/dark-mode design), plus per-kind detail. It has no
// --select - it always documents the whole discovered project - so the
// temporary model this test declares sits alongside every permanently-
// declared move/publish fixture elsewhere in this project when
// cli('docs') runs, the same "document the whole real thing" shape a
// production run would see.
//
// docs_multi_parent_demo depends on BOTH stg_orders and orders_summary via
// two {{ ref() }} calls - a genuine multi-parent dependency, and the one
// property notsobiglib's own Node test suite (Layer 1) cannot verify: the
// board positions nodes with a single-parent tree layout, but the real
// edges drawn must show every dependsOn, not just the one that drove
// positioning. See notsobiglib's
// docs/superpowers/specs/2026-09-11-docs-command-design.md §4 for why
// that split exists. No other model fixture in this project has more than
// one ref() (checked before adding this one), so without it cli('docs')
// would never actually exercise a real multi-parent board edge here.
function testDocsCommand() {
  withTemporaryNodes({
    notsobigdataModels: {
      projectId: P.BIGQUERY_PROJECT_ID, dataset: P.BIGQUERY_DATASET,
      models: {
        stg_orders: {},
        orders_summary: {},
        docs_multi_parent_demo: { sqlFile: 'html/docs_multi_parent_demo.html' }
      }
    }
  }, function () {
    var report = NotSoBigData.cli('docs');
    check('cli("docs") reports ok', report.ok === true, JSON.stringify(report));
    check('cli("docs") returns the command name', report.command === 'docs');
    check('cli("docs") returns a written file id', !!report.fileId, report.fileId);

    var multiParent = (report.nodes || []).filter(function (n) { return n.name === 'docs_multi_parent_demo'; })[0];
    check('the multi-parent model is in the returned payload', !!multiParent,
      JSON.stringify((report.nodes || []).map(function (n) { return n.name; })));
    check('it depends on both refs, not just the first',
      !!multiParent && multiParent.dependsOn.length === 2 &&
      multiParent.dependsOn.indexOf('stg_orders') !== -1 && multiParent.dependsOn.indexOf('orders_summary') !== -1,
      multiParent ? JSON.stringify(multiParent.dependsOn) : 'model missing from payload');
    check('its compiled SQL substituted both refs (no {{ }} left)',
      !!multiParent && !!multiParent.detail && !!multiParent.detail.compiledSql &&
      multiParent.detail.compiledSql.indexOf('{{') === -1,
      multiParent && multiParent.detail ? multiParent.detail.compiledSql : 'no compiledSql in detail');

    var writtenHtml = DriveApp.getFileById(report.fileId).getBlob().getDataAsString();
    check('the written Drive file actually contains the rendered board', writtenHtml.indexOf('board-node') !== -1);
    var edgeMatches = writtenHtml.match(/"to":"docs_multi_parent_demo"/g) || [];
    check('the written file embeds both real edges into the multi-parent node, not just one',
      edgeMatches.length === 2, 'found ' + edgeMatches.length + ' - expected 2 (from stg_orders and from orders_summary)');

    testLog('cli("docs") wrote ' + report.fileId + ' - open https://drive.google.com/file/d/' + report.fileId
      + '/view and confirm by eye: the board pans/zooms, the dark-mode toggle works, and '
      + 'docs_multi_parent_demo shows BOTH incoming edges (from stg_orders and from orders_summary), not just one.');
  });
}
