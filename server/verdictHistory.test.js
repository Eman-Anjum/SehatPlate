import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
// No external body-parser; use express.json()

import verdictRouter, { _insertScan } from './verdictRoute.js';
import historyRouter from './history.js';
import { pool } from './db.js';
import { issueToken } from './auth.js';

// Simple app wiring for tests
const app = express();
app.use(express.json());
app.use('/verdict', verdictRouter);
app.use('/history', historyRouter);

// Create a test user and token
const TEST_USER_ID = 'test-user-1';
const token = issueToken(TEST_USER_ID, { expiresIn: '1h' });

describe('/verdict -> /history persistence', () => {
  it('POST /verdict creates a row that GET /history returns for the same user', async () => {
    // call POST /verdict
    const postRes = await request(app)
      .post('/verdict')
      .set('Authorization', `Bearer ${token}`)
      .send({ dish: 'Daal Chawal', condition: 'diabetes', answers: { rice: 'small' }, confidence: 0.9 });

    expect(postRes.status).toBe(200);
    // Then call GET /history
    const getRes = await request(app).get('/history').set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.scans)).toBe(true);
    // Find a scan for the dish
    const found = getRes.body.scans.find((s) => (s.dish || '').toLowerCase() === 'daal chawal');
    expect(found).toBeTruthy();
    expect(found.user_id === TEST_USER_ID || found.user_id === TEST_USER_ID).toBeTruthy();
  });
});

// Additional integration test to ensure history returns inserted scan
// (Cleaned duplicate imports and app wiring)
import { it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
// No external body-parser; use express.json()

import verdictRouter from './verdictRoute.js';
import historyRouter from './history.js';
import { issueToken } from './auth.js';

const app = express();
app.use(express.json());
app.use('/verdict', verdictRouter);
app.use('/history', historyRouter);

const TEST_USER_ID = 'test-user-1';
const token = issueToken(TEST_USER_ID, { expiresIn: '1h' });

it('POST /verdict persists and GET /history returns the same scan (integration)', async () => {
  const dish = 'Test Dish XYZ';
  await request(app)
    .post('/verdict')
    .set('Authorization', `Bearer ${token}`)
    .send({ dish, condition: 'diabetes', answers: {}, confidence: 1 });

  const getRes = await request(app).get('/history').set('Authorization', `Bearer ${token}`);
  expect(getRes.status).toBe(200);
  const found = Array.isArray(getRes.body.scans) && getRes.body.scans.find((s) => (s.dish || '').toLowerCase() === dish.toLowerCase());
  expect(found).toBeTruthy();
  if (found) expect(found.user_id).toBe(TEST_USER_ID);
});
