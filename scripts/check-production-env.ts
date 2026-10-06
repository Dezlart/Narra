import "dotenv/config";
import { environmentIssues } from "../src/lib/environment";

const issues = environmentIssues(process.env, true);
if (issues.length) {
  console.error(issues.map((issue) => `- ${issue}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Production environment format PASS. Resource identity, private-store access, migrations and HTTPS smoke still require verification.");
}
