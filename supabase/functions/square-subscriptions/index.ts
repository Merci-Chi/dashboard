import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const squareBase=Deno.env.get("SQUARE_ENVIRONMENT")==="sandbox"?"https://connect.squareupsandbox.com":"https://connect.squareup.com";
const squareVersion="2026-08-19";
async function squareApi(path:string,init:RequestInit={}){const token=Deno.env.get("SQUARE_ACCESS_TOKEN");if(!token)throw new Error("SQUARE_ACCESS_TOKEN is not configured.");const response=await fetch(`${squareBase}${path}`,{...init,headers:{"Authorization":`Bearer ${token}`,"Square-Version":squareVersion,"Content-Type":"application/json",...(init.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.errors?.[0]?.detail||`Square returned ${response.status}.`);return data}
async function currentUser(req:Request){const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});const{data,error}=await client.auth.getUser();if(error||!data.user)throw new Error("Please log in again.");return data.user}
const admin=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const plans=()=>({"website-development":{label:"$100 — Website Development · one-time payment",amount:10000,cadence:"ONE_TIME",variationId:null},"standard-monthly":{label:"$20/month — Standard Website Hosting · billed monthly",amount:2000,cadence:"MONTHLY",variationId:Deno.env.get("SQUARE_STANDARD_PLAN_VARIATION_ID")},"backend-monthly":{label:"$30/month — Backend Website Hosting · billed monthly",amount:3000,cadence:"MONTHLY",variationId:Deno.env.get("SQUARE_BACKEND_PLAN_VARIATION_ID")}});

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return json({message:"Method not allowed."},405);
 try{
  const user=await currentUser(req),body=await req.json(),db=admin();
  if(body.action==="validate-discount-code")return json({valid:false,message:"Invalid discount code."});
  if(body.action==="create-checkout"){
   const plan=plans()[body.planKey as keyof ReturnType<typeof plans>];if(!plan)return json({message:"Unknown payment plan."},400);if(plan.cadence==="MONTHLY"&&!plan.variationId)return json({message:"The Square subscription plan is not configured."},500);
   const locationId=Deno.env.get("SQUARE_LOCATION_ID");if(!locationId)return json({message:"SQUARE_LOCATION_ID is not configured."},500);
   const redirect=new URL(String(body.returnUrl));if(redirect.protocol!=="https:")return json({message:"Checkout return URL must use HTTPS."},400);
   const options:Record<string,unknown>={redirect_url:redirect.toString(),ask_for_shipping_address:false};if(plan.variationId)options.subscription_plan_id=plan.variationId;
   const result=await squareApi("/v2/online-checkout/payment-links",{method:"POST",body:JSON.stringify({idempotency_key:crypto.randomUUID(),description:plan.label,quick_pay:{name:plan.label,price_money:{amount:plan.amount,currency:"USD"},location_id:locationId},checkout_options:options,pre_populated_data:{buyer_email:user.email}})});
   const link=result.payment_link;if(!link?.url||!link?.order_id)return json({message:"Square did not return a checkout link."},502);
   const sourceid=crypto.randomUUID();const{data:person}=await db.from("crm").select("id,name,company,phone").eq("userid",user.id).order("updated",{ascending:false}).limit(1).maybeSingle();
   const{data:session,error}=await db.from("square").insert({crmid:person?.id||null,userid:user.id,agreementid:body.agreementId||null,source:"checkout",sourceid,checkoutid:link.id,name:person?.name||"",company:person?.company||"",email:user.email||"",phone:person?.phone||"",plan:plan.label,amount:plan.amount,currency:"USD",cadence:plan.cadence,status:"PENDING",original:{plankey:body.planKey,orderid:link.order_id,paymentlinkid:link.id}}).select("id").single();if(error)throw error;
   return json({checkoutUrl:link.url,checkoutId:session.id});
  }
  if(body.action==="verify-checkout"){
   const{data:session,error}=await db.from("square").select("*").eq("id",body.checkoutId).eq("userid",user.id).single();if(error||!session)return json({message:"Checkout was not found."},404);if(session.status==="COMPLETED"||session.status==="ACTIVE")return json({verified:true});
   const result=await squareApi(`/v2/orders/${session.original?.orderid}`),order=result.order;if(order?.state!=="COMPLETED")return json({verified:false,status:order?.state||"PENDING"});
   let subscriptionid=null;if(session.cadence==="MONTHLY"&&order.customer_id){const found=await squareApi("/v2/subscriptions/search",{method:"POST",body:JSON.stringify({query:{filter:{customer_ids:[order.customer_id],location_ids:[Deno.env.get("SQUARE_LOCATION_ID")]}}})});const expected=plans()[session.original?.plankey as keyof ReturnType<typeof plans>]?.variationId;subscriptionid=(found.subscriptions||[]).find((x:any)=>x.plan_variation_id===expected&&!["CANCELED","DEACTIVATED"].includes(x.status))?.id||null}
   const{error:updateError}=await db.from("square").update({customerid:order.customer_id||session.customerid,subscriptionid,status:session.cadence==="MONTHLY"?"ACTIVE":"COMPLETED",lastpayment:new Date().toISOString(),updated:new Date().toISOString()}).eq("id",session.id);if(updateError)throw updateError;return json({verified:true});
  }
  if(body.action==="cancel"){
   const{data:s,error}=await db.from("square").select("*").eq("id",body.subscriptionId).eq("userid",user.id).single();if(error||!s)return json({message:"Subscription was not found."},404);if(!s.subscriptionid)return json({message:"Square is still syncing this subscription. Contact support before cancelling."},409);
   const result=await squareApi(`/v2/subscriptions/${s.subscriptionid}/cancel`,{method:"POST",body:"{}"}),until=result.subscription?.charged_through_date||null;await db.from("square").update({status:"CANCELED",chargedthrough:until,updated:new Date().toISOString()}).eq("id",s.id);return json({success:true,accessUntil:until});
  }
  return json({message:"Unknown action."},400);
 }catch(error){console.error(error);return json({message:error instanceof Error?error.message:"Unexpected server error."},500)}
});
