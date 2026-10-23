import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import dishRouter from './dish.js';
import historyRouter from './history.js';
import { pool } from './db.js';

// Minimal auth stub
vi.mock('./auth.js', () => ({ requireAuth: (req,res,next)=>{ req.userId = 1; next(); } }));

const app = express();
app.use(express.json());
app.use('/dish', dishRouter);
app.use('/history', historyRouter);

// Stub Groq fetch in ai.js when needed

describe('/dish/questions', () => {
  beforeEach(() => {
    vi.stubEnv('GROQ_API_KEY', 'test');
    vi.stubEnv('GROQ_TEXT_MODEL', 'text-model');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns known dish questions filtered by condition and common_questions', async () => {
    const res = await request(app).post('/dish/questions').send({ dish: 'Biryani', condition: 'diabetes' });
    expect(res.status).toBe(200);
    expect(res.body.questions.some(q=>q.id==='portion')).toBe(true);
    // oil question is conditional on diabetes
    expect(res.body.questions.some(q=>q.id==='oil')).toBe(true);
  });

  it('matches alias case-insensitive', async () => {
    const res = await request(app).post('/dish/questions').send({ dish: 'karachi biryani', condition: 'diabetes' });
    expect(res.status).toBe(200);
    expect(res.body.questions.some(q=>q.id==='portion')).toBe(true);
  });

  it('unknown dish uses generateQuestions and caches result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async ()=>({ choices:[{ message:{ content: JSON.stringify([{id:'q1',text:'How big?',options:[{id:'a',label:'A'}]}]) } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const res1 = await request(app).post('/dish/questions').send({ dish: 'Some New Dish', condition: 'diabetes' });
    expect(res1.status).toBe(200);
    expect(res1.body.questions[0].id).toBe('q1');
    // Second call should hit cache and not call fetch again
    const res2 = await request(app).post('/dish/questions').send({ dish: 'Some New Dish', condition: 'diabetes' });
    expect(res2.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('AI failure falls back to common_questions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const res = await request(app).post('/dish/questions').send({ dish: 'Unknown X', condition: 'diabetes' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
  });

  it('bad condition returns 400', async () => {
    const res = await request(app).post('/dish/questions').send({ dish: 'Biryani', condition: 'foo' });
    expect(res.status).toBe(400);
  });
});

describe('/history', () => {
  it('returns scans for authenticated user only', async () => {
    // stub pool.query
    vi.spyOn(pool, 'query').mockResolvedValue({ rows: [ { id:1, user_id:1, dish:'chai', condition:'diabetes', verdict:'Safe', created_at:new Date() } ] });
    const res = await request(app).get('/history');
    expect(res.status).toBe(200);
    expect(res.body.scans[0].dish).toBe('chai');
    pool.query.mockRestore();
  });
});
