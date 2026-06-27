const fs = require('fs');
const path = require('path');

const filePath = 'src/app/(dashboard)/data-management/coursera/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the Activity Logs Table
const activityLogsStart = '{/* Main Learner Activity Table Panel */}';

// Let's find the exact indices
const startIdx1 = content.indexOf(activityLogsStart);
const endIdx1 = content.indexOf('</Card>', startIdx1) + '</Card>'.length;

if (startIdx1 !== -1 && endIdx1 !== -1) {
  const replacement1 = `
            {/* Nav Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <Link href="/data-management/coursera/activity-logs" className="group block">
                <Card className="h-full border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
                  <CardHeader className="flex flex-row items-start gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-105 transition-transform">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">Synced Learner Activity Logs</CardTitle>
                      <CardDescription className="mt-1">
                        View individual course progression, completions, and learning hours logged.
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
              
              <Link href="/data-management/coursera/license-audit" className="group block">
                <Card className="h-full border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-amber-500/30">
                  <CardHeader className="flex flex-row items-start gap-4">
                    <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl group-hover:scale-105 transition-transform">
                      <UserX className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold group-hover:text-amber-500 transition-colors">License Compliance Audit</CardTitle>
                      <CardDescription className="mt-1">
                        Verify learners who log at least 20 hours of study time during the selected month.
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </div>
`;
  content = content.substring(0, startIdx1) + replacement1 + content.substring(endIdx1);
} else {
  console.log("Could not find Activity Logs Table");
}

// Remove the License Audit Table
const auditStart = '{/* Seat Auditing table card */}';
const startIdx2 = content.indexOf(auditStart);
const endIdx2 = content.indexOf('</Card>', startIdx2) + '</Card>'.length;

if (startIdx2 !== -1 && endIdx2 !== -1) {
  content = content.substring(0, startIdx2) + content.substring(endIdx2);
} else {
  console.log("Could not find License Audit Table");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Modified page.tsx');
