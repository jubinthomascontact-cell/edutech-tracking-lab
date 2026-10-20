const crypto=require("node:crypto");
const allowed=new Set(["new","contacted","qualified","proposal","won","lost"]);
module.exports=async function(req,res){
res.setHeader("Cache-Control","no-store");
if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
const secret=process.env.COORDINATOR_SYNC_TOKEN;
const token=(req.headers.authorization||"").replace(/^Bearer /i,"");
if(!secret||!token||Buffer.byteLength(token)!==Buffer.byteLength(secret)||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(secret)))return res.status(401).json({error:"Unauthorized"});
const {lead_id,status,expected_status,call_remarks,follow_up_date}=req.body||{};
if(!Number.isSafeInteger(lead_id)||lead_id<1||!allowed.has(status)||!allowed.has(expected_status)||typeof call_remarks!=="string"||call_remarks.length>1000||!(follow_up_date===null||(typeof follow_up_date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(follow_up_date)&&!Number.isNaN(Date.parse(follow_up_date)))))return res.status(400).json({error:"Invalid update"});
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)return res.status(500).json({error:"Server not configured"});
try{
const response=await fetch(url.replace(/\/$/,"")+"/rest/v1/Leads?id=eq."+lead_id+"&lead_status=eq."+encodeURIComponent(expected_status)+"&select=id,lead_status",{method:"PATCH",headers:{"apikey":key,"Content-Type":"application/json","Prefer":"return=representation"},body:JSON.stringify({lead_status:status,call_remarks,follow_up_date})});
if(!response.ok){console.error("Coordinator update status",response.status);return res.status(502).json({error:"Database update failed"});}
const rows=await response.json();
if(rows.length!==1)return res.status(409).json({error:"Record changed. Refresh sheet."});
return res.status(200).json({success:true,lead_id:rows[0].id});
}catch(e){console.error("Coordinator update error",e.message);return res.status(502).json({error:"Update failed"});}
};