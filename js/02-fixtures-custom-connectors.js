// 02-fixtures-custom-connectors.js — Plain functions passed as source.fn/target.fn to the custom connector
// fixtures in this project.

// ===================================================================
// Custom source/target functions
//
// These are plain functions in this project, passed to a node config as a
// direct reference. cli()'s global scan finds *config objects* and never
// calls anything it discovers - executable code only enters the library
// this way, as a reference you handed it yourself.
// ===================================================================

function myCustomExtract(source) {
  return [['col1', 'col2'], ['a', 1], ['b', 2]];
}

function myCustomExtractEmpty(source) {
  return [];
}

function myCustomExtractBadShape(source) {
  return ['not', 'a', '2d', 'array'];
}

function myCustomLoad(rows, target) {
  testLog('myCustomLoad received ' + rows.length + ' rows; first row: ' + rows[0]);
  return 'custom-load-wrote-' + rows.length + '-rows';
}

// Note there's no "custom source wrapping extractPaginated" example here:
// extractPaginated (and everything else in move.js) lives inside the
// library's own IIFE and is private to it - cli.js's IIFE returns only
// { cli: cli }. A custom source needing to page through a native Advanced
// Service call (YouTube.Search.list() and friends) has to walk its own
// pages by hand; see README.md's api source section.

// One row (status "not_a_real_status") violates an accepted_values test -
// used by both the "raise" and "discard_row" data-tests fixtures below.
function myCustomExtractForDataTests(source) {
  return [
    ['order_id', 'status'],
    ['1', 'open'],
    ['2', 'not_a_real_status'],
    ['3', 'closed']
  ];
}

// A duplicate order_id ("1" twice) and a blank one, for the unique/not_null
// data-tests fixture below.
function myCustomExtractForUniquenessTest(source) {
  return [['order_id'], ['1'], ['1'], ['']];
}

// Base (a, b) then evolved (a, b, c) rows for the schema-evolution
// fixtures below - a real Drive/Sheets source wouldn't usually change
// shape between runs, so this fakes that with two fixed custom extracts
// instead of hand-editing a live fixture file between test runs.
function myCustomExtractSchemaEvolutionBase(source) {
  return [['a', 'b'], ['1', 'x'], ['2', 'y']];
}

function myCustomExtractSchemaEvolutionEvolved(source) {
  return [['a', 'b', 'c'], ['3', 'z', 'new']];
}

// Fixtures for the target.sqlTests staging feature: a small "reference"
// table (two known customer ids) plus two orders batches - one whose
// customer_id values all exist in the reference table (passes the
// referential-integrity sqlTests check below) and one with a "999" that
// doesn't (fails it).
function myCustomExtractSqlTestCustomers(source) {
  return [['customer_id'], ['1'], ['2']];
}

function myCustomExtractSqlTestOrdersValid(source) {
  return [['order_id', 'customer_id'], ['100', '1'], ['101', '2']];
}

function myCustomExtractSqlTestOrdersOrphan(source) {
  return [['order_id', 'customer_id'], ['200', '1'], ['201', '999']];
}

// Fixtures for the model-sources test category ({{ source(...) }} +
// cli('sources')) - see js/26-tests-model-sources.js. updated_at is
// computed at CALL time (new Date()), not baked into the function body,
// so "fresh" is actually fresh whenever a human runs the fixture, and
// "stale" is always a fixed 3 hours old relative to that run - freshness
// tests then vary only the warnAfterMinutes/errorAfterMinutes threshold in
// notsobigdataModels.sources, not the underlying data.
function myCustomExtractSourceFresh(source) {
  var now = new Date().toISOString();
  return [['customer_id', 'updated_at'], ['1', now], ['2', now], ['3', now]];
}

function myCustomExtractSourceStale(source) {
  var threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  return [['customer_id', 'updated_at'], ['1', threeHoursAgo], ['2', threeHoursAgo]];
}

// A duplicate customer_id ("1" twice) and a blank one, for the
// cli('sources') generic-tests-fail fixture - same shape
// myCustomExtractForUniquenessTest above already uses for move's own data
// tests, just with an updated_at column alongside since this table is
// declared as a source (which needs one) rather than a move target.
function myCustomExtractSourceViolations(source) {
  var now = new Date().toISOString();
  return [['customer_id', 'updated_at'], ['1', now], ['1', now], ['', now]];
}

// Same valid customer_ids as myCustomExtractSqlTestOrdersValid, but with
// an extra "region" column the destination table doesn't have yet -
// combined with target.allowSchemaEvolution below, this is the one
// interaction release/7's independent review flagged as never actually
// run: does a promotion copy job (not a load job) really accept
// schemaUpdateOptions the same way?
function myCustomExtractSqlTestOrdersValidWithNewColumn(source) {
  return [['order_id', 'customer_id', 'region'], ['300', '1', 'us'], ['301', '2', 'eu']];
}
