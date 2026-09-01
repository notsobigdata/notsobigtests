// 99-quick-run.js — one-click smoke test. Category names: see PROJECT.md.

// Runs the 'cli' category: confirms the eval() install landed and the
// global scan can see the fixtures, without touching Sheets/Drive/BigQuery.
function test() {
  runAllTests('cli')
}
