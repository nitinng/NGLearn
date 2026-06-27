const fs = require('fs');
const filePath = 'src/app/(dashboard)/data-management/coursera/license-audit/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const returnStart = content.indexOf('  if (needsMigration) {');
if (returnStart !== -1) {
  const newReturn = `  if (needsMigration) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-4xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2 border-b border-border/60 pb-4">
          <Link href="/data-management/coursera" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">License Compliance Audit</h1>
        </div>
        <p className="text-red-500">Database Schema Incomplete. Please set up the schema in the main integration page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/data-management/coursera" className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md border border-transparent transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-600 rounded-md border border-amber-500/20 shadow-inner">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              License Compliance Audit
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Verify learners who log at least 20 hours of study time.
            </p>
          </div>
        </div>
      </div>

      <Card className="border border-border/80 rounded-md overflow-hidden shadow-md bg-card/45 backdrop-blur-sm mt-4">
        <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UserX className="w-4 h-4 text-amber-500" /> License Compliance Audit
              </CardTitle>
              <CardDescription className="text-xs">
                List learners and verify if they log at least 20 hours of study time during the selected month.
              </CardDescription>
            </div>

            {/* Audit filters */}
            <div className="flex gap-2 w-full md:w-auto flex-1 justify-end max-w-lg">
              <select
                value={selectedAuditMonth}
                onChange={(e) => setSelectedAuditMonth(e.target.value)}
                className="h-9 px-3 rounded-md border border-border/80 bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer w-full md:w-44 shrink-0"
              >
                <option value="2026-04">Audit Month: April 2026</option>
                <option value="2026-05">Audit Month: May 2026</option>
                <option value="2026-06">Audit Month: June 2026 (Live)</option>
              </select>

              <div className="relative w-full md:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by name or email..."
                  value={auditSearchTerm}
                  onChange={e => setAuditSearchTerm(e.target.value)}
                  className="pl-9 h-9 rounded-md border-border/80 text-xs w-full bg-background"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={copyInactiveEmails}
                className="h-9 text-xs font-semibold rounded-md border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Inactive Emails
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[45rem]">
            <thead className="bg-muted/50 border-b border-border/60">
              <tr>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Learner</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Email</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-center">Month Usage</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-center">Target (20h) Progress</th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {getAuditLearners().map((item) => {
                const progressPercent = Math.min(100, (item.hours / 20.0) * 100);
                return (
                  <tr key={item.email} className="border-t border-border/40 hover:bg-muted/15 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground text-sm">{item.name}</td>
                    <td className="px-5 py-4 font-mono text-muted-foreground">{item.email}</td>
                    <td className="px-5 py-4 text-center font-bold text-foreground text-sm">{item.hours} hrs</td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-3 max-w-[150px] mx-auto">
                        <div className="w-20 bg-secondary rounded-md h-1.5 overflow-hidden border border-border/50">
                          <div
                            className={\`h-full rounded-md \${item.isCompliant ? 'bg-emerald-500' : 'bg-amber-500'}\`}
                            style={{ width: \`\${progressPercent}%\` }}
                          />
                        </div>
                        <span className="font-semibold text-muted-foreground w-8 text-right">{Math.round(progressPercent)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Badge
                        variant="outline"
                        className={\`text-[9px] font-bold px-2.5 py-0.5 rounded-md border shadow-sm \${item.isCompliant ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900' :
                          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900'
                          }\`}
                      >
                        {item.isCompliant ? 'COMPLIANT' : 'AT RISK (< 20H)'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {getAuditLearners().length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground font-semibold">
                    No learners found matching the audit filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
`;
  content = content.substring(0, returnStart) + newReturn;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Updated license audit page.");
} else {
  console.log("Return start not found.");
}
