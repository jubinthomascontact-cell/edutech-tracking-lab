/**
 * EduTech coordinator sync — paste into Extensions > Apps Script.
 * Set Script Properties COORDINATOR_SYNC_TOKEN to same token as Vercel.
 * Run setupCoordinatorSync() once and grant access.
 */
const CFG = {
  url: "https://edutech-tracking-api.vercel.app",
  sheet: "Coordinator Leads",
  headers: ["Lead ID","School","Role","Requirement","Lead Source","Campaign","Status","Call Remarks","Follow-up Date (YYYY-MM-DD)","Created UTC"],
  statuses: ["new","contacted","qualified","proposal","won","lost"]
};
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Lead Sync")
    .addItem("Refresh leads","refreshLeads")
    .addItem("Push selected row","pushSelectedLead")
    .addToUi();
}
function api_(path, method, payload) {
  const token=PropertiesService.getScriptProperties().getProperty("COORDINATOR_SYNC_TOKEN");
  if (!token) throw new Error("Set COORDINATOR_SYNC_TOKEN in Script Properties.");
  const opts={method,headers:{Authorization:"Bearer "+token},muteHttpExceptions:true};
  if(payload!==undefined){opts.contentType="application/json";opts.payload=JSON.stringify(payload);}
  const resp=UrlFetchApp.fetch(CFG.url+path,opts);
  if(resp.getResponseCode()>=300)throw new Error("Sync HTTP "+resp.getResponseCode()+": "+resp.getContentText());
  return JSON.parse(resp.getContentText());
}
function refreshLeads() {
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.sheet);
  if(!sheet)throw new Error("Missing Coordinator Leads tab");
  const leads=api_("/api/coordinator-leads","get").leads;
  const old=sheet.getDataRange().getValues();
  const existing=new Map(old.slice(1).filter(r=>r[0]!=="").map(r=>[Number(r[0]),r]));
  const out=leads.map(l=>{
    const prev=existing.get(Number(l.id));
    return [l.id,l.school_name||"",l.enquirer_role||"",l.primary_need||"",
      l.lead_source||"",l.utm_campaign||"",
      prev?String(prev[6]).toLowerCase():l.lead_status,
      prev?prev[7]:l.call_remarks||"",
      prev?prev[8]:l.follow_up_date||"",
      l.created_at||""];
  });
  // Do not overwrite unsent coordinator edits during refresh.
  // Existing row values in G:I are preserved. New rows use Supabase values.
  const n=Math.max(sheet.getLastRow()-1,0);
  if(n)sheet.getRange(2,1,n,10).clearContent();
  if(out.length)sheet.getRange(2,1,out.length,10).setValues(out);
}
function pushSelectedLead() {
  const sh=SpreadsheetApp.getActiveSheet();
  if(sh.getName()!==CFG.sheet)throw new Error("Select a row in Coordinator Leads");
  const row=sh.getActiveRange().getRow();
  if(row<2)throw new Error("Select a lead row");
  const values=sh.getRange(row,1,1,10).getValues()[0];
  const remote=api_("/api/coordinator-leads","get").leads.find(l=>Number(l.id)===Number(values[0]));
  if(!remote)throw new Error("Lead not found in Supabase");
  let date=values[8];
  if(date instanceof Date)date=Utilities.formatDate(date,Session.getScriptTimeZone(),"yyyy-MM-dd");
  if(date==="")date=null;
  api_("/api/coordinator-update","post",{
    lead_id:Number(values[0]),
    status:String(values[6]).toLowerCase(),
    expected_status:remote.lead_status,
    call_remarks:String(values[7]||""),
    follow_up_date:date
  });
  SpreadsheetApp.getActive().toast("Saved lead "+values[0]+" to Supabase");
}
function setupCoordinatorSync() {
  onOpen();
  refreshLeads();
  // Pull new leads every 5 minutes; do not add auto-write trigger until tested.
  const fn="refreshLeads";
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===fn).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(5).create();
}
