import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { BlogPost } from '../../models/ContentModels.js';
import { Store } from '../../models/Store.model.js';
import { Product } from '../../models/Product.model.js';
import { authMiddleware, requireRole } from '../auth/middleware.js';
import { getPlanForStore, getModuleCreditCost } from '../plan/access.js';
import { AI_TIMEOUT_MS, deductCredits, logAiUsage, resolveScenarioConfig, buildProviderPayload } from '../ai/routes.js';
import { logger } from '../../utils/logger.js';

const router: Router = Router();
router.use(authMiddleware, requireRole('superadmin'));

const validate = (req:Request,res:Response,next:Function)=>{
  const e = validationResult(req);
  if(!e.isEmpty()) return res.status(400).json({errors:e.array()});
  next();
};

async function getPlatformStore(){
  let store = await Store.findOne({ where:{ siteCode:'platform' } });
  if(!store){
    // create platform store stub for blog
    try{
      store = await Store.create({ name:'Platform', siteCode:'platform', email:'platform@rahatio.com.tr', isActive:true, published:true } as any);
    }catch(e){ return null; }
  }
  return store;
}

router.get('/', async(req:Request,res:Response)=>{
  try{
    const store = await getPlatformStore();
    if(!store) return res.status(500).json({error:'Platform store not found'});
    const page = Math.max(1, parseInt(String(req.query.page??'1'))||1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit??'20'))||20));
    const search = String(req.query.search??'').trim();
    const where:any={ storeId: (store as any).id };
    if(search) where.title = { [require('sequelize').Op.iLike]: `%${search}%` };
    if(req.query.status) where.status = req.query.status;
    const { rows, count } = await BlogPost.findAndCountAll({ where, order:[['createdAt','DESC']], offset:(page-1)*limit, limit });
    res.json({ posts: rows, pagination:{ page, limit, total:count, totalPages: Math.max(1, Math.ceil(count/limit)) } });
  }catch(e:any){ logger.error({err:e},'platform blog list'); res.status(500).json({error:'Internal'}); }
});

router.get('/:id', [param('id').isInt()], validate, async(req:Request,res:Response)=>{
  const store = await getPlatformStore();
  const post = await BlogPost.findOne({ where:{ id:req.params.id, storeId:(store as any).id } });
  if(!post) return res.status(404).json({error:'Not found'});
  res.json({ post });
});

router.post('/', [
  body('title').isString().isLength({min:2,max:300}),
  body('slug').optional({values:'falsy'}).isString().isLength({max:200}),
  body('excerpt').optional().isString(),
  body('content').optional().isString(),
  body('coverImage').optional().isString(),
  body('tags').optional().isArray(),
  body('status').optional().isIn(['draft','scheduled','published','archived']),
  body('scheduledAt').optional({values:'falsy'}).isISO8601(),
  body('ctaTitle').optional().isString(),
  body('ctaSubtitle').optional().isString(),
  body('ctaUrl').optional().isString(),
  body('seo').optional().isObject(),
], validate, async(req:Request,res:Response)=>{
  const store = await getPlatformStore();
  const slug = req.body.slug ? String(req.body.slug).toLowerCase().replace(/[^a-z0-9]+/g,'-') : String(req.body.title).toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const exists = await BlogPost.findOne({ where:{ storeId:(store as any).id, slug } });
  if(exists) return res.status(409).json({error:'Slug exists'});
  const post = await BlogPost.create({
    storeId:(store as any).id,
    slug,
    title:req.body.title,
    excerpt:req.body.excerpt||null,
    content:req.body.content||'',
    coverImage:req.body.coverImage||null,
    tags:req.body.tags||[],
    meta:req.body.meta||{},
    status:req.body.status||'draft',
    scheduledAt:req.body.scheduledAt? new Date(req.body.scheduledAt):null,
    publishedAt: req.body.status==='published'? new Date():null,
    isActive: req.body.status==='published',
    ctaTitle:req.body.ctaTitle||null,
    ctaSubtitle:req.body.ctaSubtitle||null,
    ctaUrl:req.body.ctaUrl||'/register',
    seo:req.body.seo||{},
  } as any);
  res.status(201).json({ post });
});

router.put('/:id', [param('id').isInt()], validate, async(req:Request,res:Response)=>{
  const store = await getPlatformStore();
  const post = await BlogPost.findOne({ where:{ id:req.params.id, storeId:(store as any).id } });
  if(!post) return res.status(404).json({error:'Not found'});
  await post.update(req.body as any);
  res.json({ post });
});

router.delete('/:id', [param('id').isInt()], validate, async(req:Request,res:Response)=>{
  const store = await getPlatformStore();
  const post = await BlogPost.findOne({ where:{ id:req.params.id, storeId:(store as any).id } });
  if(!post) return res.status(404).json({error:'Not found'});
  await post.destroy();
  res.json({success:true});
});

// Bulk generate for platform blog — konuları alt alta, aralıklı otomatik yayın
const platformBulkJobs = new Map<string, any>();

function slugifyPlatform(v:string){
  return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,150) || 'blog-yazi';
}
function computeReadingTimePlatform(content:string){
  const words = String(content||'').replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words/200));
}

router.post('/bulk/generate', [
  body('topics').isString().isLength({min:3, max:10000}),
  body('keywords').optional().isArray(),
  body('notes').optional().isString().isLength({max:2000}),
  body('ctaTitle').optional().isString().isLength({max:200}),
  body('ctaSubtitle').optional().isString().isLength({max:500}),
  body('ctaUrl').optional().isString().isLength({max:500}),
  body('scheduleMode').optional().isIn(['draft','scheduled','publish_now']),
  body('startAt').optional({values:'falsy'}).isISO8601(),
  body('intervalDays').optional().isInt({min:1, max:30}),
  body('intervalHours').optional().isInt({min:1, max:72}),
], validate, async(req:Request,res:Response)=>{
  const user=(req as any).user;
  const store=await getPlatformStore();
  if(!store) return res.status(500).json({error:'Platform store not found'});
  const topics = String(req.body.topics).split(/\r?\n/).map((s:string)=>s.trim()).filter(Boolean).slice(0,50);
  if(topics.length===0) return res.status(400).json({error:'En az 1 konu gerekli'});
  if(topics.length>30) return res.status(400).json({error:'En fazla 30 konu'});

  const plan = await getPlanForStore(store as any);
  const { provider, model, scenario, costCredits, keys } = await resolveScenarioConfig('blog_generation', { plan });
  const baseCredits = costCredits || 8;
  const moduleCost = getModuleCreditCost(plan as any, 'blog_generation');
  const perTopic = moduleCost != null ? moduleCost : baseCredits;
  const totalCredits = perTopic * topics.length;

  if((user.aiCredits ?? 0) < totalCredits) return res.status(402).json({ error:'INSUFFICIENT_CREDITS', credits: user.aiCredits??0, required: totalCredits, message:`Toplam ${totalCredits} kredi gerekli` });
  if(!provider || !model) return res.status(422).json({ error:'AI_PROVIDER_NOT_CONFIGURED', message:'Blog senaryosu için sağlayıcı/model atanmamış' });

  const jobId = `pbulk_${(store as any).id}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const scheduleMode = req.body.scheduleMode || 'scheduled';
  const intervalDays = Number(req.body.intervalDays)||1;
  const intervalHours = req.body.intervalHours ? Number(req.body.intervalHours):null;
  const startAt = req.body.startAt ? new Date(req.body.startAt) : new Date(Date.now()+60*60*1000);
  const keywords = Array.isArray(req.body.keywords)? req.body.keywords : [];
  const notes = req.body.notes||'';
  const ctaTitle = req.body.ctaTitle||null;
  const ctaSubtitle = req.body.ctaSubtitle||null;
  const ctaUrl = req.body.ctaUrl||'/register';

  platformBulkJobs.set(jobId, { id:jobId, storeId:(store as any).id, total:topics.length, done:0, failed:0, pending:topics.length, topics: topics.map((t:string,i:number)=>({ topic:t, status:'pending', index:i })), createdAt:new Date().toISOString(), scheduleMode, startAt: startAt.toISOString() });

  (async()=>{
    const axios=(await import('axios')).default;
    const aiServiceUrl=process.env.AI_SERVICE_URL||'http://localhost:3001';
    const providerPayload=buildProviderPayload(provider, model, scenario, keys);
    for(let i=0;i<topics.length;i++){
      const topic=topics[i];
      const job=platformBulkJobs.get(jobId);
      if(!job) break;
      job.topics[i].status='processing';
      try{
        const resp=await axios.post(`${aiServiceUrl}/ai/blog`, { topic, notes, keywords, ...providerPayload }, { timeout: AI_TIMEOUT_MS });
        const data=resp.data;
        try{ await deductCredits(user.id, (store as any).id, perTopic, 'blog_generation', 'blog_generation'); }catch(deductErr:any){
          if(deductErr?.status===402) { job.topics[i].status='failed'; job.topics[i].error='Yetersiz kredi'; job.failed++; job.pending--; continue; }
          throw deductErr;
        }
        await logAiUsage(user.id, (store as any).id, 'blog_generation', provider?.id||null, model?.id||null, perTopic, { path:'/ai/blog', topic }, { status: resp.status }).catch(()=>{});
        let scheduledAt:Date|null=null;
        let status:string='draft';
        let publishedAt:Date|null=null;
        if(scheduleMode==='publish_now'){ status='published'; publishedAt=new Date(); }
        else if(scheduleMode==='scheduled'){ status='scheduled'; const base=new Date(startAt); if(intervalHours) base.setHours(base.getHours()+i*intervalHours); else base.setDate(base.getDate()+i*intervalDays); scheduledAt=base; }
        else { status='draft'; }
        let slugBase=slugifyPlatform(data.slug || data.title || topic);
        let slug=slugBase;
        let counter=1;
        while(await BlogPost.findOne({ where:{ storeId:(store as any).id, slug } })){ slug=`${slugBase}-${counter++}`; if(counter>10){ slug=`${slugBase}-${Date.now()}`; break; } }
        const content=data.content||'';
        const seo={ metaTitle:(data.seo_title||data.title||topic).slice(0,60), metaDescription:(data.seo_description||data.excerpt||'').slice(0,160), keywords:data.keywords||keywords||[], faq:data.faq||[], readingTime: computeReadingTimePlatform(content) };
        const post=await BlogPost.create({
          storeId:(store as any).id, slug, title:(data.title||topic).slice(0,300), excerpt:(data.excerpt||'').slice(0,500), content, coverImage:data.coverImage||null, tags:data.tags||[], meta:{ seo_title: seo.metaTitle, seo_description: seo.metaDescription }, isActive: status==='published', publishedAt, status, scheduledAt, viewCount:0, ctaTitle, ctaSubtitle, ctaUrl, seo, bulkJobId: jobId,
        } as any);
        job.topics[i].status='done'; job.topics[i].postId=post.id; job.topics[i].slug=slug; job.done++; job.pending--;
      }catch(err:any){
        logger.error({err: err.message, topic},'Platform bulk blog topic failed');
        const job2=platformBulkJobs.get(jobId);
        if(job2){ job2.topics[i].status='failed'; job2.topics[i].error= err?.response?.data?.error || err.message || 'Hata'; job2.failed++; job2.pending--; }
      }
      if(i < topics.length-1) await new Promise(r=> setTimeout(r,800));
    }
    const finalJob=platformBulkJobs.get(jobId);
    if(finalJob){ finalJob.completedAt=new Date().toISOString(); }
    try{ const { checkAndNotifyQuota }=await import('../quota/service.js'); checkAndNotifyQuota((store as any).id, user.id).catch(()=>undefined); }catch{}
  })().catch(err=> logger.error({err},'platform bulk background error'));

  res.status(202).json({ jobId, total: topics.length, requiredCredits: totalCredits, scheduleMode, message:`${topics.length} konu kuyruğa alındı` });
});

router.get('/bulk/:jobId', [param('jobId').isString()], validate, async(req:Request,res:Response)=>{
  const job=platformBulkJobs.get(req.params.jobId);
  if(!job) return res.status(404).json({error:'Job not found'});
  res.json({ job });
});

export const platformBlogRoutes = router;
