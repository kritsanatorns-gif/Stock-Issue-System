const ISSUE_REPORTS_STORAGE_KEY = 'stock-issue-reports'

export function getIssueReports() {
  try {
    return JSON.parse(localStorage.getItem(ISSUE_REPORTS_STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveIssueReport(report) {
  const reports = getIssueReports()
  const nextReports = [report, ...reports.filter((item) => item.documentNo !== report.documentNo)]

  localStorage.setItem(ISSUE_REPORTS_STORAGE_KEY, JSON.stringify(nextReports))

  return report
}

