import { Router, type Request } from 'express';
import {
  getEntries,
  updateEntry,
  createPattern,
  deleteEntry,
  bulkConfirm,
  testPattern,
  getPrefixes,
  createPrefix,
  updatePrefix,
  deletePrefix,
  getKeywords,
  createKeyword,
  updateKeyword,
  deleteKeyword,
} from '../services/action-registry.js';
import { broadcastRegistryUpdate } from '../ws.js';

export const actionRegistryRouter = Router({ mergeParams: true });

type Req<P = Record<string, string>> = Request<P>;

// GET /api/projects/:projectId/action-registry
actionRegistryRouter.get('/', (req: Req<{ projectId: string }>, res) => {
  try {
    const { projectId } = req.params;
    const entries = getEntries(projectId);
    res.json(entries);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:projectId/action-registry
actionRegistryRouter.post('/', (req: Req<{ projectId: string }>, res) => {
  try {
    const { projectId } = req.params;
    const { pattern, pattern_type, category, label, icon } = req.body;
    if (!pattern) {
      res.status(400).json({ error: 'pattern is required' });
      return;
    }
    const entry = createPattern(projectId, {
      pattern,
      pattern_type: pattern_type || 'exact',
      category,
      label,
      icon,
    });
    broadcastRegistryUpdate(projectId);
    res.status(201).json(entry);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// PUT /api/projects/:projectId/action-registry/:id
actionRegistryRouter.put('/:id', (req: Req<{ projectId: string; id: string }>, res) => {
  try {
    const { projectId } = req.params;
    const id = Number(req.params.id);
    const { category, label, icon, confirmed, pattern_type } = req.body;
    const entry = updateEntry(id, { category, label, icon, confirmed, pattern_type });
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    broadcastRegistryUpdate(projectId);
    res.json(entry);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/projects/:projectId/action-registry/:id
actionRegistryRouter.delete('/:id', (req: Req<{ projectId: string; id: string }>, res) => {
  try {
    const { projectId } = req.params;
    const id = Number(req.params.id);
    const deleted = deleteEntry(id);
    if (!deleted) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    broadcastRegistryUpdate(projectId);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:projectId/action-registry/bulk
actionRegistryRouter.post('/bulk', (req: Req<{ projectId: string }>, res) => {
  try {
    const { projectId } = req.params;
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }
    const count = bulkConfirm(ids);
    broadcastRegistryUpdate(projectId);
    res.json({ confirmed: count });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:projectId/action-registry/test
actionRegistryRouter.post('/test', (req: Req<{ projectId: string }>, res) => {
  try {
    const { projectId } = req.params;
    const { pattern, pattern_type } = req.body;
    if (!pattern) {
      res.status(400).json({ error: 'pattern is required' });
      return;
    }
    const matches = testPattern(projectId, pattern, pattern_type || 'exact');
    res.json({ matches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ────── Prefix endpoints ──────

// GET /api/projects/:projectId/action-registry/prefixes
actionRegistryRouter.get('/prefixes', (req: Req<{ projectId: string }>, res) => {
  try {
    const prefixes = getPrefixes(req.params.projectId);
    res.json(prefixes);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:projectId/action-registry/prefixes
actionRegistryRouter.post('/prefixes', (req: Req<{ projectId: string }>, res) => {
  try {
    const { projectId } = req.params;
    const { prefix, category, label, icon } = req.body;
    if (!prefix || !category || !label) {
      res.status(400).json({ error: 'prefix, category, and label are required' });
      return;
    }
    const created = createPrefix(projectId, { prefix, category, label, icon });
    broadcastRegistryUpdate(projectId);
    res.status(201).json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// PUT /api/projects/:projectId/action-registry/prefixes/:id
actionRegistryRouter.put('/prefixes/:id', (req: Req<{ projectId: string; id: string }>, res) => {
  try {
    const { projectId } = req.params;
    const id = Number(req.params.id);
    const { prefix, category, label, icon, sort_order } = req.body;
    const updated = updatePrefix(id, { prefix, category, label, icon, sort_order });
    if (!updated) {
      res.status(404).json({ error: 'Prefix not found' });
      return;
    }
    broadcastRegistryUpdate(projectId);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/projects/:projectId/action-registry/prefixes/:id
actionRegistryRouter.delete('/prefixes/:id', (req: Req<{ projectId: string; id: string }>, res) => {
  try {
    const { projectId } = req.params;
    const id = Number(req.params.id);
    const deleted = deletePrefix(id);
    if (!deleted) {
      res.status(404).json({ error: 'Prefix not found' });
      return;
    }
    broadcastRegistryUpdate(projectId);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ────── Keyword endpoints ──────

// GET /api/projects/:projectId/action-registry/keywords
actionRegistryRouter.get('/keywords', (req: Req<{ projectId: string }>, res) => {
  try {
    const keywords = getKeywords(req.params.projectId);
    res.json(keywords);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:projectId/action-registry/keywords
actionRegistryRouter.post('/keywords', (req: Req<{ projectId: string }>, res) => {
  try {
    const { projectId } = req.params;
    const { keyword, category } = req.body;
    if (!keyword || !category) {
      res.status(400).json({ error: 'keyword and category are required' });
      return;
    }
    const created = createKeyword(projectId, { keyword, category });
    broadcastRegistryUpdate(projectId);
    res.status(201).json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// PUT /api/projects/:projectId/action-registry/keywords/:id
actionRegistryRouter.put('/keywords/:id', (req: Req<{ projectId: string; id: string }>, res) => {
  try {
    const { projectId } = req.params;
    const id = Number(req.params.id);
    const { keyword, category } = req.body;
    const updated = updateKeyword(id, { keyword, category });
    if (!updated) {
      res.status(404).json({ error: 'Keyword not found' });
      return;
    }
    broadcastRegistryUpdate(projectId);
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/projects/:projectId/action-registry/keywords/:id
actionRegistryRouter.delete('/keywords/:id', (req: Req<{ projectId: string; id: string }>, res) => {
  try {
    const { projectId } = req.params;
    const id = Number(req.params.id);
    const deleted = deleteKeyword(id);
    if (!deleted) {
      res.status(404).json({ error: 'Keyword not found' });
      return;
    }
    broadcastRegistryUpdate(projectId);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
