// Controlled HTTP disconnect experiment against a local production server.
// No patching/filtering of Next.js, and no credentials or response bodies logged.
import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.QA_BASE_URL || "http://localhost:3000";
const log = process.env.QA_SERVER_LOG || ".playwright-mcp/phase9-server.log";
const count = () => (readFileSync(log,"utf8").match(/destination stream closed early/g) || []).length;
async function request(cancel) {
  return new Promise((resolve,reject)=>{
    const req=http.get(base+"/?streamExperiment="+Date.now(),res=>{
      if(cancel) res.once("data",()=>{res.destroy();resolve();});
      else {res.resume();res.once("end",resolve);}
      res.on("error",error=>{if(!cancel) reject(error);});
    });
    req.setTimeout(15000,()=>{req.destroy();reject(new Error("HTTP timeout"));});req.on("error",reject);
  });
}
const initial=count();
for(let i=0;i<8;i++) await request(false);
await new Promise(resolve=>setTimeout(resolve,1000));
const complete=count();
for(let i=0;i<8;i++) {await request(true);await new Promise(resolve=>setTimeout(resolve,300));}
await new Promise(resolve=>setTimeout(resolve,1500));
const aborted=count();
await request(false);
const result={completedRequests:8,completedWarnings:complete-initial,abortedRequests:8,abortedWarnings:aborted-complete,recovery:"PASS"};
writeFileSync(".playwright-mcp/phase9-stream-experiment.json",JSON.stringify(result,null,2));console.log(JSON.stringify(result));
