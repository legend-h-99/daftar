// Read-only aggregate connector. Deploy separately with --no-verify-jwt;
// its dedicated bearer secret is verified here, never reuse a service-role key as the bearer token.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
Deno.serve(async (req:Request)=>{
 const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='GET')return respond({error:'Method not allowed'},405);
 const token=Deno.env.get('OPS_METRICS_TOKEN')||'';
 const provided=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(token.length<32||provided.length!==token.length)return respond({error:'Unauthorized'},401);
 let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^provided.charCodeAt(i);
 if(diff)return respond({error:'Unauthorized'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const excluded=(Deno.env.get('OPS_EXCLUDED_USER_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 const {data,error}=await client.rpc('operations_metrics',{excluded_user_ids:excluded});
 if(error)return respond({error:'Metrics unavailable'},503);
 return respond(data);
});
