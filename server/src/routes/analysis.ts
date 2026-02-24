import { Router } from 'express';

export const analysisRouter = Router();

// Phase 2 placeholder
analysisRouter.get('/', (_req, res) => {
  res.json({ message: 'Analysis API - Coming in Phase 2' });
});
