/**
 * src/pages/ScanPage.jsx
 * Full scan flow: condition → identify → confirm → questions → verdict.
 * Also renders the History tab.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  identifyByName,
  identifyByPhoto,
  getDishQuestions,
  submitVerdict,
  getHistory,
} from '../api';

/* ── shared styles ───────────────────────────────────────────────── */
const s = {
  page:     { maxWidth: 520, margin: '0 auto', padding: '0 16px 40px', fontFamily: 'system-ui, sans-serif' },
  card:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', marginTop: 16 },
  title:    { margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: '#1a202c' },
  label:    { display: 'block', fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 4 },
  input:    { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e0',
              borderRadius: 6, fontSize: 15, outline: 'none' },
  btn:      { padding: '10px 20px', background: '#38a169', color: '#fff', border: 'none',
              borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  btnFull:  { width: '100%', padding: '11px 0', background: '#38a169', color: '#fff', border: 'none',
              borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 10 },
  btnSec:   { padding: '9px 18px', background: '#edf2f7', color: '#2d3748', border: 'none',
              borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnLink:  { background: 'none', border: 'none', color: '#38a169', cursor: 'pointer',
              fontSize: 13, padding: 0, textDecoration: 'underline' },
  err:      { background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6,
              padding: '10px 12px', color: '#c53030', fontSize: 13, marginBottom: 12 },
  ok:       { background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6,
              padding: '10px 12px', color: '#276749', fontSize: 13, marginBottom: 12 },
  info:     { background: '#ebf8ff', border: '1px solid #90cdf4', borderRadius: 6,
              padding: '10px 12px', color: '#2b6cb0', fontSize: 13, marginBottom: 12 },
  field:    { marginBottom: 14 },
  divider:  { borderTop: '1px solid #e2e8f0', margin: '18px 0' },
  small:    { fontSize: 12, color: '#a0aec0' },
  spinner:  { display: 'inline-block', width: 13, height: 13, border: '2px solid currentColor',
              borderTop: '2px solid transparent', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite', marginRight: 6 },
  radio:    { marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15,
              cursor: 'pointer' },
  preview:  { maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #e2e8f0',
              marginTop: 8, display: 'block' },
  badgeSafe:  { display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#c6f6d5',
                color: '#22543d', fontWeight: 700, fontSize: 14 },
  badgeMod:   { display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#fefcbf',
                color: '#744210', fontWeight: 700, fontSize: 14 },
  badgeAvoid: { display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#fed7d7',
                color: '#742a2a', fontWeight: 700, fontSize: 14 },
  disclaimer: { fontSize: 12, color: '#718096', marginTop: 14, fontStyle: 'italic', lineHeight: 1.5 },
  swapList:   { paddingLeft: 20, margin: '6px 0 0', fontSize: 14, color: '#2d3748' },
  tabs:       { display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 0 },
  tabActive:  { padding: '10px 22px', background: 'none', border: 'none', borderBottom: '2px solid #38a169',
                marginBottom: -2, fontWeight: 700, fontSize: 15, color: '#38a169', cursor: 'pointer' },
  tabInactive:{ padding: '10px 22px', background: 'none', border: 'none', borderBottom: '2px solid transparent',
                marginBottom: -2, fontWeight: 500, fontSize: 15, color: '#718096', cursor: 'pointer' },
  histItem:   { padding: '14px 0', borderBottom: '1px solid #f0f0f0' },
  histDish:   { fontWeight: 700, fontSize: 15, color: '#1a202c' },
  histMeta:   { fontSize: 12, color: '#718096', marginTop: 2 },
};

function Spinner() { return <span style={s.spinner} />; }

function ErrorBox({ msg }) {
  if (!msg) return null;
  return <div style={s.err} role="alert">{msg}</div>;
}

const CONDITIONS = [
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'kidney_disease', label: 'Kidney disease' },
  { value: 'high_blood_pressure', label: 'High blood pressure' },
];

function VerdictBadge({ verdict }) {
  if (verdict === 'Safe')       return <span style={s.badgeSafe}>Safe</span>;
  if (verdict === 'Moderation') return <span style={s.badgeMod}>Eat in moderation</span>;
  if (verdict === 'Avoid')      return <span style={s.badgeAvoid}>Avoid</span>;
  return <span>{verdict}</span>;
}

/* ── downscale helper ────────────────────────────────────────────── */
function downscaleImage(file, maxPx = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')); };
    img.src = url;
  });
}

/* ══════════════════════════════════════════════════════════════════
   History tab
══════════════════════════════════════════════════════════════════ */
function HistoryTab() {
  const [scans, setScans]   = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await getHistory();
      setScans(data.scans || []);
    } catch (err) {
      setError(err.status === 429 ? 'Too many requests, wait a minute.' : (err.message || 'Failed to load history.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // load on first render
  React.useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Your scan history</h2>
        <button style={s.btnSec} onClick={load} disabled={loading}>
          {loading ? <><Spinner />Loading…</> : 'Refresh'}
        </button>
      </div>
      <ErrorBox msg={error} />
      {loading && !scans && <p style={{ color: '#718096' }}>Loading…</p>}
      {scans && scans.length === 0 && (
        <p style={{ color: '#718096', marginTop: 24, textAlign: 'center' }}>No scans yet.</p>
      )}
      {scans && scans.map(scan => (
        <div key={scan.id} style={s.histItem}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={s.histDish}>{scan.dish}</span>
            <VerdictBadge verdict={scan.verdict} />
          </div>
          <div style={s.histMeta}>
            {CONDITIONS.find(c => c.value === scan.condition)?.label || scan.condition}
            &nbsp;·&nbsp;
            {scan.created_at ? new Date(scan.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Scan flow
══════════════════════════════════════════════════════════════════ */

// Step constants
const STEP_INPUT    = 'input';
const STEP_CONFIRM  = 'confirm';
const STEP_QUESTIONS = 'questions';
const STEP_RESULT   = 'result';

function ScanFlow() {
  /* ── step state ─────────────────────────────────────────────── */
  const [step, setStep] = useState(STEP_INPUT);

  /* ── step 1 ─────────────────────────────────────────────────── */
  const [condition, setCondition]   = useState('');
  const [dishName, setDishName]     = useState('');
  const [photoFile, setPhotoFile]   = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  /* ── identify result ─────────────────────────────────────────── */
  const [identified, setIdentified] = useState(null); // {dish_guess, confidence, dish_id, matched}

  /* ── step 2 (confirm) ────────────────────────────────────────── */
  const [confirmedDish, setConfirmedDish] = useState('');
  const [editName, setEditName]           = useState('');

  /* ── step 3 (questions) ──────────────────────────────────────── */
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});

  /* ── step 4 (result) ─────────────────────────────────────────── */
  const [verdictData, setVerdictData] = useState(null);

  /* ── shared loading / error ──────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  /* helpers */
  const fmtErr = (err) => {
    if (err.status === 429) return 'Too many requests, wait a minute.';
    if (err.status === 502) return 'AI is unavailable, please type the dish name.';
    return err.message || 'Something went wrong.';
  };

  const resetFlow = () => {
    setStep(STEP_INPUT);
    setCondition(''); setDishName('');
    setPhotoFile(null); setPreviewUrl('');
    setIdentified(null); setConfirmedDish(''); setEditName('');
    setQuestions([]); setAnswers([]);
    setVerdictData(null); setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── photo selection ─────────────────────────────────────────── */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setDishName(''); // clear typed name when photo chosen
    setError('');
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(''); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── step 1 → identify ───────────────────────────────────────── */
  const handleIdentify = async () => {
    if (!condition) { setError('Please select a condition.'); return; }
    if (!dishName.trim() && !photoFile) { setError('Please enter a dish name or choose a photo.'); return; }
    setError(''); setLoading(true);
    try {
      let result;
      if (photoFile) {
        const blob = await downscaleImage(photoFile);
        result = await identifyByPhoto(blob);
      } else {
        result = await identifyByName(dishName.trim());
      }
      const safe = {
        dish_guess: result.dish_guess || '',
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        dish_id: result.dish_id ?? null,
        matched: result.matched ?? false,
      };
      setIdentified(safe);
      setEditName(safe.dish_guess);
      setStep(STEP_CONFIRM);
    } catch (err) {
      setError(fmtErr(err));
    } finally {
      setLoading(false);
    }
  };

  /* ── step 2 → confirm → load questions ──────────────────────── */
  const handleConfirm = async (chosenDish) => {
    setError(''); setLoading(true);
    try {
      const data = await getDishQuestions(chosenDish, condition);
      setConfirmedDish(chosenDish);
      setQuestions(data.questions || []);
      setAnswers({});
      setStep(STEP_QUESTIONS);
    } catch (err) {
      setError(fmtErr(err));
    } finally {
      setLoading(false);
    }
  };

  /* ── re-check from confirm step ──────────────────────────────── */
  const handleRecheck = async () => {
    if (!editName.trim()) { setError('Please enter a dish name.'); return; }
    setError(''); setLoading(true);
    try {
      const result = await identifyByName(editName.trim());
      const safe = {
        dish_guess: result.dish_guess || editName.trim(),
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        dish_id: result.dish_id ?? null,
        matched: result.matched ?? false,
      };
      setIdentified(safe);
      setEditName(safe.dish_guess);
    } catch (err) {
      setError(fmtErr(err));
    } finally {
      setLoading(false);
    }
  };

  /* ── step 3 → submit verdict ─────────────────────────────────── */
  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id]);

  const handleSubmitVerdict = async () => {
    setError(''); setLoading(true);
    try {
      const data = await submitVerdict({
        dish: confirmedDish,
        dish_id: identified?.dish_id ?? null,
        condition,
        answers,
        confidence: identified?.confidence ?? 0,
      });
      setVerdictData(data);
      setStep(STEP_RESULT);
    } catch (err) {
      setError(fmtErr(err));
    } finally {
      setLoading(false);
    }
  };

  /* ══ render ══════════════════════════════════════════════════════ */

  /* Step 1 — Input */
  if (step === STEP_INPUT) {
    return (
      <div>
        <h2 style={s.title}>Check a dish</h2>
        <ErrorBox msg={error} />

        {/* Condition */}
        <div style={s.field}>
          <span style={s.label}>Your condition</span>
          {CONDITIONS.map(c => (
            <label key={c.value} style={s.radio}>
              <input
                type="radio"
                name="condition"
                value={c.value}
                checked={condition === c.value}
                onChange={() => setCondition(c.value)}
                disabled={loading}
              />
              {c.label}
            </label>
          ))}
        </div>

        <div style={s.divider} />

        {/* Dish name */}
        <div style={s.field}>
          <label style={s.label}>Dish name (type OR upload a photo below)</label>
          <input
            style={s.input}
            type="text"
            placeholder="e.g. Biryani"
            value={dishName}
            onChange={e => { setDishName(e.target.value); if (e.target.value) clearPhoto(); }}
            disabled={loading}
          />
        </div>

        {/* Photo upload */}
        <div style={s.field}>
          <label style={s.label}>Or upload a photo (JPEG / PNG / WebP, max 5 MB)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={loading}
          />
          {previewUrl && (
            <div>
              <img src={previewUrl} alt="preview" style={s.preview} />
              <button style={{ ...s.btnLink, marginTop: 4 }} onClick={clearPhoto} disabled={loading}>Remove photo</button>
            </div>
          )}
        </div>

        <button
          style={{ ...s.btnFull, opacity: loading ? 0.7 : 1 }}
          onClick={handleIdentify}
          disabled={loading}
        >
          {loading && <Spinner />}
          {loading ? 'Identifying…' : 'Identify dish'}
        </button>
      </div>
    );
  }

  /* Step 2 — Confirm */
  if (step === STEP_CONFIRM) {
    const { dish_guess, confidence, matched } = identified;
    const highConf = matched && confidence >= 0.6;
    return (
      <div>
        <h2 style={s.title}>Confirm dish</h2>
        <ErrorBox msg={error} />

        {highConf ? (
          <div style={s.info}>
            We think this is: <strong>{dish_guess}</strong>
          </div>
        ) : dish_guess ? (
          <div style={s.info}>
            Is this <strong>{dish_guess}</strong>?
          </div>
        ) : (
          <div style={s.info}>We could not identify the dish. Please type it below.</div>
        )}

        {highConf && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button
              style={s.btn}
              onClick={() => handleConfirm(dish_guess)}
              disabled={loading}
            >
              {loading && <Spinner />}
              Yes, that's right
            </button>
            <button style={s.btnSec} onClick={() => setIdentified({ ...identified, matched: false })} disabled={loading}>
              No, change it
            </button>
          </div>
        )}

        {!highConf && (
          <>
            <div style={s.field}>
              <label style={s.label}>Dish name</label>
              <input
                style={s.input}
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                disabled={loading}
                placeholder="Enter dish name"
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <button
                style={s.btn}
                onClick={() => handleConfirm(editName.trim() || dish_guess)}
                disabled={loading || !editName.trim()}
              >
                {loading && <Spinner />}
                Continue
              </button>
              <button style={s.btnSec} onClick={handleRecheck} disabled={loading || !editName.trim()}>
                {loading ? 'Checking…' : 'Re-check'}
              </button>
            </div>
          </>
        )}

        <button style={s.btnLink} onClick={() => { setStep(STEP_INPUT); setError(''); }} disabled={loading}>
          ← Back
        </button>
      </div>
    );
  }

  /* Step 3 — Questions */
  if (step === STEP_QUESTIONS) {
    return (
      <div>
        <h2 style={s.title}>A few questions about <em>{confirmedDish}</em></h2>
        <ErrorBox msg={error} />

        {questions.length === 0 && <p style={{ color: '#718096' }}>No questions for this dish. You can proceed.</p>}

        {questions.map(q => (
          <div key={q.id} style={s.field}>
            <span style={s.label}>{q.text}</span>
            {(q.options || []).map(opt => (
              <label key={opt.id} style={s.radio}>
                <input
                  type="radio"
                  name={q.id}
                  value={opt.id}
                  checked={answers[q.id] === opt.id}
                  onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt.id }))}
                  disabled={loading}
                />
                {opt.label}
              </label>
            ))}
          </div>
        ))}

        <button
          style={{ ...s.btnFull, opacity: (loading || (!allAnswered && questions.length > 0)) ? 0.6 : 1 }}
          onClick={handleSubmitVerdict}
          disabled={loading || (!allAnswered && questions.length > 0)}
        >
          {loading && <Spinner />}
          {loading ? 'Getting verdict…' : 'Submit'}
        </button>

        <div style={{ marginTop: 10 }}>
          <button style={s.btnLink} onClick={() => { setStep(STEP_CONFIRM); setError(''); }} disabled={loading}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  /* Step 4 — Result */
  if (step === STEP_RESULT && verdictData) {
    const { verdict, reason, swaps, disclaimer, adjusted_for_safety } = verdictData;
    return (
      <div>
        <h2 style={s.title}>Result for <em>{verdictData.dish}</em></h2>

        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <VerdictBadge verdict={verdict} />
          {adjusted_for_safety && (
            <span style={{ fontSize: 12, color: '#744210', fontStyle: 'italic' }}>
              Adjusted to be safer
            </span>
          )}
        </div>

        {reason && (
          <p style={{ fontSize: 15, color: '#2d3748', lineHeight: 1.6, margin: '0 0 12px' }}>
            {reason}
          </p>
        )}

        {swaps && swaps.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>Healthier swaps:</strong>
            <ul style={s.swapList}>
              {swaps.map((sw, i) => <li key={i}>{sw}</li>)}
            </ul>
          </div>
        )}

        {disclaimer && <p style={s.disclaimer}>{disclaimer}</p>}

        <div style={s.divider} />
        <button style={s.btn} onClick={resetFlow}>Scan another dish</button>
      </div>
    );
  }

  return null;
}

/* ══════════════════════════════════════════════════════════════════
   Root export — two tabs
══════════════════════════════════════════════════════════════════ */
export default function ScanPage() {
  const [tab, setTab] = useState('scan');

  const handleTabChange = (t) => {
    setTab(t);
  };

  return (
    <div style={s.page}>
      <div style={s.tabs}>
        <button
          style={tab === 'scan' ? s.tabActive : s.tabInactive}
          onClick={() => handleTabChange('scan')}
        >
          Scan
        </button>
        <button
          style={tab === 'history' ? s.tabActive : s.tabInactive}
          onClick={() => handleTabChange('history')}
        >
          History
        </button>
      </div>

      <div style={s.card}>
        {tab === 'scan'    && <ScanFlow />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}
