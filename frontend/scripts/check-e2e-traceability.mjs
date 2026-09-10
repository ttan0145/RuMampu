import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repositoryDirectory = path.dirname(frontendDirectory);

const completedEpics = [
  {
    epic: 'Epic 1',
    expected: 62,
    allowedDeferred: ['AC1.1.8'],
    requirements: 'docs/requirements/EPIC_1_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md',
    specification: 'frontend/e2e/epic1.spec.ts',
  },
  {
    epic: 'Epic 2',
    expected: 18,
    requirements: 'docs/requirements/EPIC_2_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md',
    specification: 'frontend/e2e/epic2.spec.ts',
  },
];

function read(relativePath) {
  return readFileSync(path.join(repositoryDirectory, relativePath), 'utf8');
}

function ids(text, expression) {
  return [...text.matchAll(expression)].map(match => match[1]);
}

let failed = false;

for (const item of completedEpics) {
  const required = [...new Set(ids(read(item.requirements), /\b(AC\d+\.\d+\.\d+)\b/g))];
  const implemented = ids(read(item.specification), /\bac\(\s*['"](AC\d+\.\d+\.\d+)['"]/g);
  const deferred = ids(read(item.specification), /\bdeferredAc\(\s*['"](AC\d+\.\d+\.\d+)['"]/g);
  const implementedSet = new Set(implemented);
  const deferredSet = new Set(deferred);
  const mapped = [...implemented, ...deferred];
  const mappedSet = new Set(mapped);
  const duplicates = [...mappedSet].filter(id => mapped.filter(candidate => candidate === id).length > 1);
  const missing = required.filter(id => !mappedSet.has(id));
  const unknown = [...mappedSet].filter(id => !required.includes(id));
  const allowedDeferred = item.allowedDeferred || [];
  const unexpectedDeferred = [...deferredSet].filter(id => !allowedDeferred.includes(id));
  const expectedDeferredMissing = allowedDeferred.filter(id => !deferredSet.has(id));

  const errors = [];
  if (required.length !== item.expected) errors.push(`requirements contain ${required.length}, expected ${item.expected}`);
  if (missing.length) errors.push(`missing: ${missing.join(', ')}`);
  if (unknown.length) errors.push(`unknown: ${unknown.join(', ')}`);
  if (duplicates.length) errors.push(`duplicated: ${duplicates.join(', ')}`);
  if (unexpectedDeferred.length) errors.push(`unexpectedly deferred: ${unexpectedDeferred.join(', ')}`);
  if (expectedDeferredMissing.length) errors.push(`configured deferral missing: ${expectedDeferredMissing.join(', ')}`);

  if (errors.length) {
    failed = true;
    console.error(`${item.epic}: traceability failed (${errors.join('; ')})`);
  } else {
    const suffix = deferred.length ? `; ${deferred.length} explicitly deferred` : '';
    console.log(`${item.epic}: ${implemented.length} executable + ${deferred.length} deferred / ${required.length} ACs mapped exactly once${suffix}.`);
  }
}

if (failed) process.exitCode = 1;
