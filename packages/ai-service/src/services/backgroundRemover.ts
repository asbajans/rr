import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const MODELS_DIR = path.resolve('/models');
const BIRefNet_SCRIPT = path.resolve('scripts/remove_bg.py');

function ensurePythonDeps(): void {
  try {
    execSync('python3 -c "import torch, rembg" 2>/dev/null', { stdio: 'ignore' });
  } catch {
    execSync('pip install rembg[gpu] torch torchvision --quiet', {
      stdio: 'inherit',
      timeout: 300_000,
    });
  }
}

function removeBgRembg(inputPath: string, outputPath: string): void {
  const code = `
from rembg import remove
from PIL import Image
import sys
img = Image.open("${inputPath.replace(/\\/g, '/')}")
out = remove(img)
out.save("${outputPath.replace(/\\/g, '/')}")
`;
  execSync(`python3 -c "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
    stdio: 'inherit',
    timeout: 120_000,
  });
}

function removeBgBiRefNet(inputPath: string, outputPath: string): void {
  execSync(
    `python3 ${BIRefNet_SCRIPT} --input "${inputPath}" --output "${outputPath}"`,
    { stdio: 'inherit', timeout: 180_000 }
  );
}

export async function removeBackground(
  inputPath: string,
  sessionId: string,
  onProgress: (msg: string) => void
): Promise<string> {
  const outputDir = path.resolve('output', sessionId);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'no-bg.png');

  onProgress('Arka plan siliniyor...');

  const inputExt = path.extname(inputPath).toLowerCase();

  if (inputExt === '.png') {
    removeBgRembg(inputPath, outputPath);
  } else {
    const jpgPath = inputPath.replace(inputExt, '_converted.png');
    execSync(`python3 -c "
from PIL import Image
img = Image.open('${inputPath.replace(/\\/g, '/')}')
img.save('${jpgPath.replace(/\\/g, '/')}', 'PNG')
"`, { stdio: 'ignore', timeout: 30_000 });
    removeBgRembg(jpgPath, outputPath);
  }

  return outputPath;
}
