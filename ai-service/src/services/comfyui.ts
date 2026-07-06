import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { ProductCategory, ComfyWorkflow } from '../types';

const COMFY_URL = process.env.COMFY_URL || 'http://localhost:8188';

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

async function uploadImage(filePath: string): Promise<string> {
  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));
  const res = await axios.post(`${COMFY_URL}/upload/image`, form, {
    headers: form.getHeaders(),
  });
  return res.data.name;
}

function loadWorkflow(category: ProductCategory, imageName: string): ComfyWorkflow {
  const file = WORKFLOW_FILES[category];
  const workflowPath = path.resolve('workflows', file);

  if (!fs.existsSync(workflowPath)) {
    throw new Error(`Workflow not found for category: ${category}`);
  }

  const raw = fs.readFileSync(workflowPath, 'utf-8');
  const workflow: ComfyWorkflow = JSON.parse(raw);

  for (const node of Object.values(workflow)) {
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
    }
  }

  return workflow;
}

async function queuePrompt(workflow: ComfyWorkflow): Promise<string> {
  const res = await axios.post(`${COMFY_URL}/prompt`, {
    prompt: workflow,
  });
  return res.data.prompt_id as string;
}

async function waitForCompletion(
  promptId: string,
  onProgress: (msg: string) => void
): Promise<string[]> {
  const outputDir = path.resolve('output');
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
              const imgPath = path.join(outputDir, img.filename);
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
  });
  const writer = fs.createWriteStream(dest);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

export async function processWithComfyUI(
  imagePath: string,
  category: ProductCategory,
  onProgress: (msg: string) => void
): Promise<string[]> {
  onProgress('Görsel ComfyUI\'ya yükleniyor...');
  const imageName = await uploadImage(imagePath);

  onProgress('Workflow yükleniyor...');
  const workflow = loadWorkflow(category, imageName);

  onProgress('Yapay zeka modeline gönderiliyor...');
  const promptId = await queuePrompt(workflow);

  onProgress('Görsel oluşturuluyor...');
  const images = await waitForCompletion(promptId, onProgress);

  return images;
}
