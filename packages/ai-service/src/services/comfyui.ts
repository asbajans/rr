import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { ProductCategory, ComfyWorkflow } from '../types';

const COMFY_URL = process.env.COMFY_URL || 'http://localhost:8188';

/**
 * Workflows live next to this module. `path.resolve('workflows')` resolves
 * against the process CWD, which breaks inside the production container
 * (the Dockerfile copies them to packages/ai-service/workflows but the CWD is
 * /app). Resolve from __dirname so edit/generate work both in dev (src/
 * services -> ../../workflows) and in the built Docker image
 * (dist/services -> ../../workflows).
 */
const WORKFLOWS_DIR = path.resolve(__dirname, '..', '..', 'workflows');

const WORKFLOW_FILES: Record<ProductCategory, string> = {
  giyim: 'product-studio-giyim.json',
  taki: 'product-studio-taki.json',
  kozmetik: 'product-studio-kozmetik.json',
  ayakkabi: 'product-studio-ayakkabi.json',
  canta: 'product-studio-canta.json',
  elektronik: 'product-studio-elektronik.json',
  ev_dekorasyon: 'product-studio-dekorasyon.json',
  spor: 'product-studio-spor.json',
  diger: 'product-studio-generic.json',
};

const NEGATIVE_PROMPT = 'text, watermark, signature, deformed, bad quality, blurry, distorted, lowres, extra limbs, bad anatomy';

async function uploadImage(filePath: string): Promise<string> {
  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));
  const res = await axios.post(`${COMFY_URL}/upload/image`, form, {
    headers: form.getHeaders(),
  });
  return res.data.name;
}

function loadWorkflow(category: ProductCategory, imageName: string, prompt?: string): ComfyWorkflow {
  const file = WORKFLOW_FILES[category];
  const workflowPath: string = fs.existsSync(`${WORKFLOWS_DIR}/${file}`)
    ? `${WORKFLOWS_DIR}/${file}`
    : path.resolve('workflows', file);

  if (!fs.existsSync(workflowPath)) {
    throw new Error(`Workflow not found for category: ${category}`);
  }

  const raw = fs.readFileSync(workflowPath, 'utf-8');
  const workflow: ComfyWorkflow = JSON.parse(raw);

  // The node connected to the KSampler's `positive` input is the CLIPTextEncode
  // driving the composition — override that one with the seller's prompt so the
  // edit actually follows the instruction (never the negative node).
  let positiveNodeId: string | null = null;
  for (const [nodeId, node] of Object.entries(workflow)) {
    const n = node as Record<string, unknown>;
    if (n && n.class_type === 'KSampler') {
      const positive: unknown = (n as { inputs?: Record<string, unknown> }).inputs?.positive;
      if (Array.isArray(positive) && positive.length > 0) positiveNodeId = String(positive[0]);
      break;
    }
  }

  for (const [nodeId, node] of Object.entries(workflow)) {
    const n = node as Record<string, unknown>;
    if (
      typeof n === 'object' &&
      n !== null &&
      'inputs' in n &&
      typeof (n as Record<string, unknown>).inputs === 'object'
    ) {
      const inputs = (n as { inputs: Record<string, unknown> }).inputs;
      if (inputs.image === 'IMAGE_PLACEHOLDER') {
        inputs.image = imageName;
      }
      if (prompt && positiveNodeId && nodeId === positiveNodeId) {
        inputs.text = prompt;
      }
    }
  }

  return workflow;
}

function checkpointName(category: ProductCategory): string {
  const file = WORKFLOW_FILES[category];
  const workflowPath: string = fs.existsSync(`${WORKFLOWS_DIR}/${file}`)
    ? `${WORKFLOWS_DIR}/${file}`
    : path.resolve('workflows', file);
  if (!fs.existsSync(workflowPath)) throw new Error(`Workflow not found for category: ${category}`);
  const raw = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));
  for (const node of Object.values(raw)) {
    const n = node as Record<string, unknown>;
    if (n && n.class_type === 'CheckpointLoaderSimple') {
      return ((n as { inputs?: { ckpt_name?: unknown } }).inputs as any)?.ckpt_name as string;
    }
  }
  throw new Error(`Checkpoint loader not found for category: ${category}`);
}

/**
 * Builds a self-contained Stable Diffusion text-to-image API workflow so the
 * seller can generate brand-new product images from a prompt without ComfyUI
 * sidecar workflow files. Same checkpoint family as the matching category
 * workflow keeps the visual style consistent.
 */
function buildTextToImageWorkflow(prompt: string, category: ProductCategory, seed: number): ComfyWorkflow {
  return {
    '3': {
      inputs: {
        seed,
        steps: 28,
        cfg: 7,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
      class_type: 'KSampler',
    },
    '4': {
      inputs: { ckpt_name: checkpointName(category) },
      class_type: 'CheckpointLoaderSimple',
    },
    '5': {
      inputs: { width: 1024, height: 1024, batch_size: 1 },
      class_type: 'EmptyLatentImage',
    },
    '6': {
      inputs: { text: prompt, clip: ['4', 1] },
      class_type: 'CLIPTextEncode',
    },
    '7': {
      inputs: { text: NEGATIVE_PROMPT, clip: ['4', 1] },
      class_type: 'CLIPTextEncode',
    },
    '8': {
      inputs: { samples: ['3', 0], vae: ['4', 2] },
      class_type: 'VAEDecode',
    },
    '9': {
      inputs: { images: ['8', 0] },
      class_type: 'SaveImage',
    },
  };
}

async function queuePrompt(workflow: ComfyWorkflow): Promise<string> {
  const res = await axios.post(`${COMFY_URL}/prompt`, {
    prompt: workflow,
  });
  return res.data.prompt_id as string;
}

async function waitForCompletion(
  promptId: string,
  outputDir: string,
  onProgress: (msg: string) => void
): Promise<string[]> {
  fs.mkdirSync(outputDir, { recursive: true });
  const images: string[] = [];

  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${COMFY_URL}/history/${promptId}`);
        const history = res.data[promptId];

        if (!history) {
          onProgress('Görsel oluşturuluyor...');
          return;
        }

        clearInterval(poll);

        const outputs = history.outputs || {};
        for (const nodeId of Object.keys(outputs)) {
          const nodeOutput = outputs[nodeId];
          if (nodeOutput.images) {
            for (const img of nodeOutput.images) {
              const imgPath = path.join(outputDir, `${Date.now()}-${img.filename}`);
              await downloadImage(img.filename, imgPath);
              images.push(imgPath);
            }
          }
        }

        resolve(images.slice(0, 3));
      } catch {
        onProgress('Görsel oluşturuluyor...');
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(poll);
      reject(new Error('ComfyUI timeout after 120s'));
    }, 120_000);
  });
}

async function downloadImage(filename: string, dest: string): Promise<void> {
  const res = await axios.get(`${COMFY_URL}/view?filename=${filename}`, {
    responseType: 'stream',
    timeout: 60_000,
  });
  const writer = fs.createWriteStream(dest);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

function friendlyComfyError(err: any): Error {
  const code = err?.code || err?.cause?.code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
    return new Error(
      `ComfyUI'ya ulaşılamadı (${COMFY_URL}). Görsel işleme/generasyon kapalı. Lütfen ComfyUI servisini başlatın (${code}).`
    );
  }
  const upstream = err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || 'Bilinmeyen hata';
  return new Error(`Görsel oluşturulamadı: ${upstream}`);
}

async function runComfy(workflow: ComfyWorkflow, outputDir: string, onProgress: (msg: string) => void): Promise<string[]> {
  onProgress('Workflow ComfyUI\'ya gönderiliyor...');
  const promptId = await queuePrompt(workflow);
  onProgress('Görsel oluşturuluyor...');
  return waitForCompletion(promptId, outputDir, onProgress);
}

export async function processWithComfyUI(
  imagePath: string,
  category: ProductCategory,
  onProgress: (msg: string) => void,
  extra?: { prompt?: string; outputDir?: string }
): Promise<string[]> {
  onProgress('Görsel ComfyUI\'ya yükleniyor...');
  const imageName = await uploadImage(imagePath);

  onProgress('Workflow yükleniyor...');
  const workflow = loadWorkflow(category, imageName, extra?.prompt);

  try {
    return await runComfy(workflow, extra?.outputDir || path.resolve('output'), onProgress);
  } catch (err: any) {
    throw friendlyComfyError(err);
  }
}

/**
 * Generates brand-new product images from a text prompt using a programmatic
 * Stable Diffusion workflow (no sidecar workflow file required).
 */
export async function generateTextToImage(
  prompt: string,
  category: ProductCategory,
  count: number,
  outputDir: string,
  onProgress: (msg: string) => void
): Promise<string[]> {
  onProgress('Checkpoint yükleniyor...');
  const images: string[] = [];
  const n = Math.max(1, Math.min(4, Math.floor(count || 1)));
  const seedBase = Math.floor(Math.random() * 1_000_000);
  try {
    for (let i = 0; i < n; i++) {
      const workflow = buildTextToImageWorkflow(prompt, category, seedBase + i);
      const generated = await runComfy(workflow, outputDir, onProgress);
      images.push(...generated);
    }
    return images;
  } catch (err: any) {
    throw friendlyComfyError(err);
  }
}
