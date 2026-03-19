'use strict';

const GROUP_THRESHOLD = 3;

function groupIssues(issues) {
  const buckets = new Map();

  for (const issue of issues) {
    const code = issue.code || 'UNKNOWN';
    if (!buckets.has(code)) {
      buckets.set(code, []);
    }
    buckets.get(code).push(issue);
  }

  const result = [];
  for (const [code, items] of buckets) {
    if (items.length <= GROUP_THRESHOLD) {
      result.push(...items);
    } else {
      result.push({
        code,
        message: `${items.length} issues with code ${code}`,
        examples: items.slice(0, 3),
        totalCount: items.length,
      });
    }
  }

  return result;
}

function formatGroupedIssues(issues, label) {
  const grouped = groupIssues(issues);
  const lines = [];

  for (const issue of grouped) {
    if (issue.examples) {
      lines.push(`  - [${issue.code}] ${issue.message}`);
      for (const example of issue.examples) {
        lines.push(`      ${example.message}`);
      }
      const remaining = issue.totalCount - issue.examples.length;
      if (remaining > 0) {
        lines.push(`      (and ${remaining} more)`);
      }
    } else {
      lines.push(`  - [${issue.code}] ${issue.message}`);
    }
  }

  if (lines.length > 0) {
    return `wf validate found ${label}:\n${lines.join('\n')}`;
  }
  return '';
}

module.exports = { groupIssues, formatGroupedIssues };
