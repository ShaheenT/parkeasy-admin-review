import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS", "Content-Type":"application/json" };
const json = (x: unknown, status=200) => new Response(JSON.stringify(x), {status, headers:cors});
const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, service, {auth:{persistSession:false}});
const roleForUi = (role:string) => String(role).toLowerCase() === "super_admin" ? "admin" : String(role).toLowerCase();
async function authorize(token:string) {
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||!data.user) return null;
 const {data:admin}=await db.from("admin_users").select("user_id,role").eq("user_id",data.user.id).maybeSingle();
 if(!admin||!["admin","support","super_admin"].includes(String(admin.role).toLowerCase())) return null;
 return {user:data.user,role:roleForUi(admin.role)};
}
async function profiles(ids:string[]) {
 const unique=[...new Set(ids.filter(Boolean))];
 if(!unique.length) return new Map();
 const {data}=await db.from("profiles").select("id,full_name,email,role,city,suburb,account_status,risk_level,is_verified,suspicious_activity").in("id",unique);
 return new Map((data||[]).map((p:any)=>[p.id,p]));
}
async function list(resource:string) {
 if(resource==="notifications") {
  const [payments,bookings,payouts]=await Promise.all([
   db.from("payment_events").select("id,external_reference,processed,created_at,provider").order("created_at",{ascending:false}).limit(8),
   db.from("parking_bookings").select("id,status,created_at").order("created_at",{ascending:false}).limit(8),
   db.from("host_payouts").select("id,status,total_amount,created_at,reference").order("created_at",{ascending:false}).limit(8),
  ]);
  const rows:any[]=[];
  for(const x of payments.data||[]) rows.push({id:"payment-"+x.id,message:"Payment event "+(x.external_reference||x.provider||x.id)+" · "+(x.processed?"processed":"pending"),when:x.created_at,createdAt:x.created_at});
  for(const x of bookings.data||[]) rows.push({id:"booking-"+x.id,message:"Booking "+String(x.id).slice(0,8)+" · "+x.status,when:x.created_at,createdAt:x.created_at});
  for(const x of payouts.data||[]) rows.push({id:"payout-"+x.id,message:"Host payout "+(x.reference||String(x.id).slice(0,8))+" · "+x.status,when:x.created_at,createdAt:x.created_at});
  rows.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  return json(rows.slice(0,20).map((x:any)=>({id:x.id,message:x.message,when:new Date(x.createdAt).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg"})})));
 }
 if(["users","scouts","kyc"].includes(resource)) {
  let q=db.from("profiles").select("*").order("created_at",{ascending:false}).limit(500);
  if(resource==="scouts") q=q.eq("role","scout");
  const {data,error}=await q; if(error) return json({error:"Profile query failed"},500);
  const rows=data||[];
  if(resource==="users") return json(rows.filter((p:any)=>["host","driver","scout"].includes(String(p.role).toLowerCase())).map((p:any)=>({id:p.id,name:p.full_name||p.email||"Unnamed user",email:p.email,role:p.role,status:p.account_status||"active",area:[p.suburb,p.city].filter(Boolean).join(", ")||"—"})));
  if(resource==="scouts") {
   const ids=rows.map((p:any)=>p.id);
   const {data:leads}=await db.from("scout_leads").select("scout_user_id").in("scout_user_id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]);
   const counts=new Map<string,number>(); for(const x of leads||[]) counts.set(x.scout_user_id,(counts.get(x.scout_user_id)||0)+1);
   return json(rows.map((p:any)=>({id:p.id,name:p.full_name||p.email||"Scout",leads:counts.get(p.id)||0,earned:"—"})));
  }
  const ids=rows.map((p:any)=>p.id);
  const {data:docs}=await db.from("identity_documents").select("user_id,document_type,status,is_current").in("user_id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]).eq("is_current",true);
  const docsByUser=new Map((docs||[]).map((d:any)=>[d.user_id,d]));
  return json(rows.map((p:any)=>{const d:any=docsByUser.get(p.id);return {id:p.id,name:p.full_name||p.email||"Unnamed user",document:d?.document_type||"Not submitted",risk:p.risk_level||(p.suspicious_activity?"high":"low"),status:d?.status==="approved"||p.is_verified?"verified":d?.status==="rejected"?"rejected":"review"};}));
 }
 if(resource==="bays") {
  const {data,error}=await db.from("parking_listings").select("*").order("created_at",{ascending:false}).limit(500);
  if(error) return json({error:"Listing query failed"},500);
  const ps=await profiles((data||[]).map((x:any)=>x.owner_id));
  return json((data||[]).map((x:any)=>({id:x.id,name:x.title,host:(ps.get(x.owner_id) as any)?.full_name||(ps.get(x.owner_id) as any)?.email||"—",rate:x.hourly_rate,status:x.is_active?"active":"paused",occupancy:null,address:x.address,city:x.city,suburb:x.suburb,lat:x.latitude,lng:x.longitude})));
 }
 if(resource==="bookings") {
  const {data,error}=await db.from("parking_bookings").select("*").order("created_at",{ascending:false}).limit(500);
  if(error) return json({error:"Booking query failed"},500);
  const ps=await profiles((data||[]).flatMap((x:any)=>[x.driver_id,x.host_id]));
  const ids=(data||[]).map((x:any)=>x.listing_id).filter(Boolean);
  const bookingIds=(data||[]).map((x:any)=>x.id);
  const {data:listings}=await db.from("parking_listings").select("id,title,address").in("id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]);
  const {data:escrows}=await db.from("escrow_transactions").select("booking_id,commission_amount,host_amount,status").in("booking_id",bookingIds.length?bookingIds:["00000000-0000-0000-0000-000000000000"]);
  const ls=new Map((listings||[]).map((x:any)=>[x.id,x]));
  const es=new Map((escrows||[]).map((x:any)=>[x.booking_id,x]));
  return json((data||[]).map((x:any)=>{const l:any=ls.get(x.listing_id);const e:any=es.get(x.id);const mins=Number(x.duration_minutes??((new Date(x.end_time).getTime()-new Date(x.start_time).getTime())/60000));return {id:x.id,ref:String(x.id).slice(0,8).toUpperCase(),driver:(ps.get(x.driver_id) as any)?.full_name||(ps.get(x.driver_id) as any)?.email||"—",bay:l?.title||l?.address||"—",hours:Math.round(mins/60*100)/100,amount:Number(x.total_amount||0),commissionAmount:e?Number(e.commission_amount||0):null,hostAmount:e?Number(e.host_amount||0):null,escrowStatus:e?.status||null,status:x.status,paymentStatus:x.payment_status,date:x.start_time||x.created_at,start:x.start_time,end:x.end_time};}));
 }
 if(resource==="payments") {
  const {data,error}=await db.from("payment_events").select("*").order("created_at",{ascending:false}).limit(500);
  if(error) return json({error:"Payment query failed"},500);
  return json((data||[]).map((x:any)=>({id:x.id,ref:x.external_reference||String(x.id).slice(0,8),booking:x.payload?.booking_id||x.payload?.metadata?.booking_id||"—",amount:Number(x.payload?.amount_zar??x.payload?.amount??x.payload?.data?.amount??0)/(x.payload?.amount_zar!=null?1:100),status:x.processed?"processed":"pending",provider:x.provider,received:x.received_at||x.created_at,verified:x.verified_at})));
 }
 if(resource==="payouts") {
  const {data,error}=await db.from("host_payouts").select("*").order("created_at",{ascending:false}).limit(500);
  if(error) return json({error:"Payout query failed"},500);
  const ps=await profiles((data||[]).map((x:any)=>x.host_id));
  return json((data||[]).map((x:any)=>({id:x.id,ref:x.reference||String(x.id).slice(0,8),host:(ps.get(x.host_id) as any)?.full_name||(ps.get(x.host_id) as any)?.email||"—",amount:Number(x.total_amount||0),status:["pending","queued","processing"].includes(String(x.status).toLowerCase())?"queued":x.status,date:x.payout_date||x.created_at,bookingCount:x.booking_count})));
 }
 if(resource==="devices") {
  const {data,error}=await db.from("device_registrations").select("*").order("last_seen_at",{ascending:false}).limit(500);
  if(error) return json({error:"Device query failed"},500);
  const ps=await profiles((data||[]).map((x:any)=>x.user_id));
  return json((data||[]).map((x:any)=>({id:x.id,name:x.installation_id||x.platform||"Device",bay:(ps.get(x.user_id) as any)?.full_name||(ps.get(x.user_id) as any)?.email||"—",status:x.last_seen_at&&Date.now()-new Date(x.last_seen_at).getTime()<900000?"online":"offline",battery:"—",platform:x.platform,browser:x.browser,os:x.os,lastSeen:x.last_seen_at,pushEnabled:!!x.push_enabled})));
 }
 if(resource==="leads") {
  const {data,error}=await db.from("scout_leads").select("*").order("created_at",{ascending:false}).limit(500);
  if(error) return json({error:"Scout lead query failed"},500);
  const ps=await profiles((data||[]).map((x:any)=>x.scout_user_id));
  return json((data||[]).map((x:any)=>({id:x.id,address:x.address,scout:(ps.get(x.scout_user_id) as any)?.full_name||(ps.get(x.scout_user_id) as any)?.email||"—",status:x.status,city:x.city,suburb:x.suburb,parkingType:x.parking_type})));
 }
 if(resource==="support") {
  const {data,error}=await db.from("support_conversations").select("*").order("updated_at",{ascending:false}).limit(500);
  if(error) return json({error:"Support query failed"},500);
  const ps=await profiles((data||[]).map((x:any)=>x.user_id));
  return json((data||[]).map((x:any)=>({id:x.id,from:x.visitor_name||(ps.get(x.user_id) as any)?.full_name||x.visitor_email||"Visitor",subject:x.subject||x.category||"Support request",status:x.status,email:x.visitor_email,lastMessageAt:x.last_message_at})));
 }
 return json({error:"Unknown resource"},404);
}
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 const path=new URL(req.url).searchParams.get("path")||"/";
 try {
  if(req.method==="POST"&&path==="/auth/login") {
   const body=await req.json(); if(!body?.email||!body?.password) return json({error:"Email and password are required"},400);
   const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await client.auth.signInWithPassword({email:body.email,password:body.password});
   if(error||!data.user||!data.session) return json({error:"Email or password is incorrect."},401);
   const {data:admin}=await db.from("admin_users").select("user_id,role").eq("user_id",data.user.id).maybeSingle();
   if(!admin||!["admin","support","super_admin"].includes(String(admin.role).toLowerCase())) return json({error:"This account is not authorised for the admin dashboard."},403);
   return json({token:data.session.access_token,user:{id:data.user.id,name:data.user.user_metadata?.full_name||data.user.email,email:data.user.email,role:roleForUi(admin.role)}});
  }
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) return json({error:"Sign in required"},401);
  const auth=await authorize(token); if(!auth) return json({error:"Invalid session or admin access denied"},401);
  if(req.method==="GET"&&path==="/auth/me") return json({id:auth.user.id,name:auth.user.user_metadata?.full_name||auth.user.email,email:auth.user.email,role:auth.role});
  if(req.method==="GET"&&path==="/admin/integrations") return json([
   {id:"slack",name:"Slack",description:"Booking, payout and device alerts; server-side webhook setup required.",connected:false,config:""},
   {id:"zoom",name:"Zoom",description:"Host onboarding calls; OAuth setup required.",connected:false},
   {id:"hubspot",name:"HubSpot",description:"CRM sync; server-side OAuth setup required.",connected:false},
   {id:"salesforce",name:"Salesforce",description:"CRM sync; server-side OAuth setup required.",connected:false}
  ]);
  if(req.method==="PUT"&&path.startsWith("/admin/integrations/")) return json({error:"Integration credentials are not stored until a secure server-side OAuth/webhook flow is configured."},409);
  if(req.method==="POST"&&path==="/admin/announcements") return json({error:"Push announcements are not enabled yet; no message was sent."},409);
  if(path==="/admin/opportunities"&&req.method==="GET") {
   const {data,error}=await db.from("admin_opportunities").select("*").order("starts_at",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false});
   if(error) return json({error:"Opportunity records could not be loaded"},500);
   return json((data||[]).map((r:any)=>({id:r.id,opportunityType:r.opportunity_type,title:r.title,location:r.location,latitude:r.latitude,longitude:r.longitude,startsAt:r.starts_at,endsAt:r.ends_at,status:r.status,sourceUrl:r.source_url||"",confidence:r.confidence,estimatedDemand:r.estimated_demand,nearbySupply:r.nearby_supply,notes:r.notes||"",createdAt:r.created_at,updatedAt:r.updated_at})));
  }
  if(path==="/admin/opportunities"&&req.method==="POST") {
   if(!["admin","super_admin"].includes(String(auth.role).toLowerCase())) return json({error:"Admin role required"},403);
   const b=await req.json();
   if(!["event","ev_charger","wash_service"].includes(b?.opportunityType)||!String(b?.title||"").trim()||!String(b?.location||"").trim()) return json({error:"Type, title and location are required"},400);
   const payload={opportunity_type:b.opportunityType,title:String(b.title).trim(),location:String(b.location).trim(),starts_at:b.startsAt||null,ends_at:b.endsAt||null,status:["research","verified","contacted","active","closed"].includes(b.status)?b.status:"research",source_url:b.sourceUrl||null,confidence:["unverified","partially_verified","verified"].includes(b.confidence)?b.confidence:"unverified",estimated_demand:b.estimatedDemand==null||b.estimatedDemand===""?null:Number(b.estimatedDemand),nearby_supply:b.nearbySupply==null||b.nearbySupply===""?null:Number(b.nearbySupply),notes:String(b.notes||"").slice(0,5000),created_by:auth.user.id};
   if((payload.estimated_demand!==null&&(!Number.isFinite(payload.estimated_demand)||payload.estimated_demand<0))||(payload.nearby_supply!==null&&(!Number.isFinite(payload.nearby_supply)||payload.nearby_supply<0))) return json({error:"Demand and supply estimates must be non-negative numbers"},400);
   const {data,error}=await db.from("admin_opportunities").insert(payload).select("*").single();
   if(error) return json({error:"Opportunity could not be saved"},500);
   return json({id:data.id,opportunityType:data.opportunity_type,title:data.title,location:data.location,latitude:data.latitude,longitude:data.longitude,startsAt:data.starts_at,endsAt:data.ends_at,status:data.status,sourceUrl:data.source_url||"",confidence:data.confidence,estimatedDemand:data.estimated_demand,nearbySupply:data.nearby_supply,notes:data.notes||"",createdAt:data.created_at,updatedAt:data.updated_at},201);
  }
  const opp=path.match(new RegExp("^/admin/opportunities/([^/]+)$"));
  if(opp&&req.method==="PATCH") {
   if(!["admin","super_admin"].includes(String(auth.role).toLowerCase())) return json({error:"Admin role required"},403);
   const b=await req.json(); const patch:any={updated_at:new Date().toISOString()};
   if(typeof b.status==="string"&&["research","verified","contacted","active","closed"].includes(b.status)) patch.status=b.status;
   if(typeof b.notes==="string") patch.notes=b.notes.slice(0,5000);
   if(typeof b.confidence==="string"&&["unverified","partially_verified","verified"].includes(b.confidence)) patch.confidence=b.confidence;
   if(Object.keys(patch).length===1) return json({error:"No valid fields supplied"},400);
   const {data,error}=await db.from("admin_opportunities").update(patch).eq("id",opp[1]).select("*").maybeSingle();
   if(error||!data) return json({error:"Opportunity update failed"},400);
   return json({id:data.id,opportunityType:data.opportunity_type,title:data.title,location:data.location,latitude:data.latitude,longitude:data.longitude,startsAt:data.starts_at,endsAt:data.ends_at,status:data.status,sourceUrl:data.source_url||"",confidence:data.confidence,estimatedDemand:data.estimated_demand,nearbySupply:data.nearby_supply,notes:data.notes||"",createdAt:data.created_at,updatedAt:data.updated_at});
  }
  const m=path.match(/^\/admin\/([a-z-]+)(?:\/([^/]+))?$/);
  if(req.method==="GET"&&m&&!m[2]) return await list(m[1]);
  if(req.method==="PATCH"&&m?.[2]) {
   const body=await req.json().catch(()=>({})); const action=body?.action;
   if(auth.role!=="admin"&&!(m[1]==="support"&&action==="resolve")) return json({error:"Admin role required for this action"},403);
   if(m[1]==="bays"&&["pause","activate"].includes(action)) {
    const {data,error}=await db.from("parking_listings").update({is_active:action==="activate"}).eq("id",m[2]).select("id,title,hourly_rate,is_active").maybeSingle();
    if(error||!data) return json({error:"Listing update failed"},400);
    return json({id:data.id,name:data.title,rate:data.hourly_rate,status:data.is_active?"active":"paused"});
   }
   if(m[1]==="leads"&&["approve","reject"].includes(action)) {
    const {data,error}=await db.from("scout_leads").update({status:action==="approve"?"approved":"rejected"}).eq("id",m[2]).select("id,address,status").maybeSingle();
    if(error||!data) return json({error:"Scout lead update failed"},400);
    return json(data);
   }
   if(m[1]==="support"&&action==="resolve") {
    const {data,error}=await db.from("support_conversations").update({status:"resolved"}).eq("id",m[2]).select("id,status").maybeSingle();
    if(error||!data) return json({error:"Support update failed"},400);
    return json(data);
   }
   return json({error:"This action is not enabled for live data. Payment, refund, KYC and payout actions need dedicated audited workflows."},409);
  }
  return json({error:"Endpoint not found"},404);
 } catch(e) { console.error("admin-api",e); return json({error:"Unexpected admin API error"},500); }
});
