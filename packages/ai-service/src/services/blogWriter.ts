import { callLlm, ChatMessage, ProviderConfig } from './llmProvider.js';

export interface BlogWriterInput {
  topic?: string;
  product?: Record<string, unknown> | null;
  imageUrl?: string;
  notes?: string;
  keywords?: string[];
}

export interface BlogPostResult {
  title: string;
  excerpt: string;
  content: string;
  seo_title: string;
  seo_description: string;
  slug: string;
  keywords: string[];
  tags: string[];
}

function buildSystemPrompt(): string {
  return `You are an expert content writer for e-commerce store blogs on the Turkish market. You write long, SEO-friendly blog articles in natural Turkish.

Rules:
- Return ONLY valid JSON, no markdown, no code blocks
- Write in Turkish unless the topic is clearly in another language
- NEVER invent product facts the seller did not provide: no prices, stock, technical specs, or brand claims that contradict the given data
- For health, cosmetic and food topics, do NOT make medical or safety claims
- The article must be 600-1200 words, structured with HTML (h2, h3, p, ul, li, strong, em only — no scripts, styles, iframes or external links)
- Excerpt: 1-2 sentences (max 170 chars) used as meta description
- SEO title max 60 chars, meta description max 160 chars
- Slug: lowercase, latin, dash-separated
- keywords: 5-10 comma friendly Turkish keywords
- tags: 3-5 short tags`;
}

function buildPrompt(input: BlogWriterInput): string {
  const source = input.product
    ? `Below a product from the store. Write the article around it (its benefits, use cases, buying guide / related advice) WITHOUT inventing unprovided facts:
- Product title: ${input.product.title || ''}
- Description: ${input.product.description || ''}
- SKU: ${input.product.sku || ''}
- Price: ${input.product.price != null ? `${input.product.price} ${input.product.currency || 'TRY'}` : 'not provided'}
- Images: ${Array.isArray(input.product.images) && input.product.images.length ? input.product.images[0] : 'none'}`
    : `Write a standalone informative article about this topic:
Topic: ${input.topic || 'Mağaza ürünleri rehberi'}`;

  return `${source}

${input.imageUrl ? `Optional cover image reference: ${input.imageUrl}` : ''}
${input.notes ? `Seller notes to include/respect: ${input.notes}` : ''}
${input.keywords?.length ? `Suggested keywords to reflect: ${input.keywords.join(', ')}` : ''}

Return the following JSON exactly:
{
  "title": "catchy article title (max 70 chars)",
  "excerpt": "1-2 sentence summary (max 170 chars)",
  "content": "<h2>...</h2><p>...</p><ul><li>...</li></ul>... full HTML article",
  "seo_title": "SEO title max 60 chars",
  "seo_description": "SEO description max 160 chars",
  "slug": "url-friendly-slug",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "tags": ["tag1", "tag2", "tag3"]
}`;
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`LLM did not return valid JSON:\n${raw.slice(0, 300)}`);
  }

  return JSON.parse(jsonMatch[0]);
}

const slugify = (value: string) => {
  return String(value).toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 150) || 'blog-yazi';
};

export async function generateBlogPost(
  input: BlogWriterInput,
  providerConfig?: ProviderConfig
): Promise<BlogPostResult> {
  const config: ProviderConfig = providerConfig?.baseUrl
    ? {
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.model || process.env.OLLAMA_LLM_MODEL || 'llama3',
        apiKey: providerConfig.apiKey,
        authType: providerConfig.authType || 'bearer',
        maxTokens: providerConfig.maxTokens,
        reasoningEffort: providerConfig.reasoningEffort,
      }
    : {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_LLM_MODEL || 'llama3',
      };

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildPrompt(input) },
  ];

  const raw = await callLlm(config, messages, {
    temperature: 0.6,
    maxTokens: config.maxTokens,
    reasoningEffort: config.reasoningEffort,
    responseFormatJson: true,
  });

  const data = parseJsonResponse(raw);

  const result: BlogPostResult = {
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : '',
    excerpt: typeof data.excerpt === 'string' ? data.excerpt.trim() : '',
    content: typeof data.content === 'string' ? data.content : '',
    seo_title: typeof data.seo_title === 'string' ? data.seo_title.trim() : '',
    seo_description: typeof data.seo_description === 'string' ? data.seo_description.trim() : '',
    slug: typeof data.slug === 'string' && data.slug.trim() ? slugify(data.slug) : '',
    keywords: Array.isArray(data.keywords) ? data.keywords.filter((k: any) => typeof k === 'string') : [],
    tags: Array.isArray(data.tags) ? data.tags.filter((t: any) => typeof t === 'string') : [],
  };

  const fallbackTitle = input.topic?.trim() || (input.product?.title as string) || 'Blog Yazısı';
  if (!result.title) result.title = fallbackTitle.slice(0, 70);
  if (!result.slug) result.slug = slugify(fallbackTitle);
  if (!result.seo_title) result.seo_title = result.title.slice(0, 60);
  if (!result.seo_description) result.seo_description = result.excerpt || result.title.slice(0, 160);
  if (!result.excerpt) result.excerpt = result.title.slice(0, 170);

  return result;
}