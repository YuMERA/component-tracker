import { Router } from 'express';
import * as svc from '../services/components.js';
import { cacheImageInBackground, cacheImage, cacheDatasheet } from '../services/files.js';
import { trashComponents } from '../services/trash.js';

const r = Router();

r.get('/', (req, res) => res.json(svc.listComponents()));

r.get('/movements', (req, res) => {
    res.json(svc.getMovements({ limit: Math.min(200, Number(req.query.limit) || 20) }));
});

r.get('/:id', (req, res) => {
    const c = svc.getComponent(req.params.id);
    res.json({ ...c, movements: svc.getMovements({ componentId: c.id, limit: 100 }) });
});

r.post('/', (req, res) => {
    const c = svc.createComponent(req.body);
    if (c.image_url) cacheImageInBackground(c.id);
    res.status(201).json(c);
});

r.patch('/:id', (req, res) => {
    const c = svc.updateComponent(req.params.id, req.body);
    if (c.image_url && !c.image_file) cacheImageInBackground(c.id);
    res.json(c);
});

r.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    // ide u kantu; trash = id-jevi u kanti (za "Poništi")
    const trash = trashComponents([id]);
    if (!trash.length) throw new svc.HttpError(404, 'Component not found');
    res.json({ trash });
});

r.post('/bulk', (req, res) => {
    if (req.body.action === 'delete') {
        if (!Array.isArray(req.body.ids) || !req.body.ids.length) throw new svc.HttpError(400, 'No components selected');
        const trash = trashComponents(req.body.ids);
        return res.json({ changed: trash.length, trash });
    }
    res.json({ changed: svc.bulkUpdate(req.body.ids, req.body.action, req.body.value) });
});

// Uvoz liste: { rows, existing: 'skip' | 'add', dryRun }
r.post('/import', (req, res) => res.json(svc.importComponents(req.body)));

// Brza promena stanja: { location_id, delta, note }
r.post('/:id/adjust', (req, res) => res.json(svc.adjustStock(Number(req.params.id), req.body)));

// Premeštanje: { from, to, quantity }
r.post('/:id/move', (req, res) => res.json(svc.moveStock(Number(req.params.id), req.body)));

// Lokalne kopije fajlova
r.post('/:id/cache-image', async (req, res) => {
    try {
        await cacheImage(Number(req.params.id));
    } catch (e) {
        throw new svc.HttpError(422, e.message);
    }
    res.json(svc.getComponent(req.params.id));
});

r.post('/:id/cache-datasheet', async (req, res) => {
    try {
        await cacheDatasheet(Number(req.params.id));
    } catch (e) {
        throw new svc.HttpError(422, e.message);
    }
    res.json(svc.getComponent(req.params.id));
});

export default r;
