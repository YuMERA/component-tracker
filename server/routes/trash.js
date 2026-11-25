// Kanta: pregled, vraćanje, trajno brisanje
import { Router } from 'express';
import * as trash from '../services/trash.js';

const r = Router();

r.get('/', (req, res) => res.json(trash.listTrash()));
r.get('/count', (req, res) => res.json({ count: trash.trashCount() }));
// { ids?: [], force? } – bez ids vraća sve; force: i kad postoji komponenta sa istim MPN-om ("Poništi")
r.post('/restore', (req, res) => res.json(trash.restoreMany(Array.isArray(req.body.ids) ? req.body.ids.map(Number) : null, { force: !!req.body.force })));
// { force: true } – vrati i kad postoji komponenta sa istim MPN-om
r.post('/:id/restore', (req, res) => res.json(trash.restore(Number(req.params.id), { force: !!req.body.force })));
r.delete('/:id', (req, res) => { trash.purge(Number(req.params.id)); res.status(204).end(); });
r.delete('/', (req, res) => res.json({ removed: trash.emptyTrash() }));

export default r;
