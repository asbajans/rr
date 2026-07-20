import { Router } from 'express';

export const slaveRoutes: Router = Router();

slaveRoutes.get('/slave/download-php', (_req, res) => {
  res.json({ message: 'PHP slave download endpoint - not implemented' });
});

slaveRoutes.get('/slave/download-vercel', (_req, res) => {
  res.json({ message: 'Vercel slave download endpoint - not implemented' });
});