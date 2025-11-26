import React, { useState } from 'react';
import api from '../../services/api';

export default function CallNode() {
  const [token, setToken] = useState('');
  const [payload, setPayload] = useState('{}');
  const [reply, setReply] = useState('{}');
  const [callId, setCallId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    try { setResult(await api.calls.start(token, JSON.parse(payload||'{}'))); } catch (e:any){ setError(String(e.message||e)); }
  }
  async function sendReply() {
    setError(null);
    try { setResult(await api.calls.reply(JSON.parse(reply||'{}'))); } catch (e:any){ setError(String(e.message||e)); }
  }
  async function fetchLogs() {
    setError(null);
    try { setResult(await api.calls.logs(callId, 50)); } catch (e:any){ setError(String(e.message||e)); }
  }

  return (
    <div className="wb-card-sm wb-col wb-gap-8">
      <div className="wb-title">Call Node</div>
      <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Bearer token" />
      <textarea value={payload} onChange={e=>setPayload(e.target.value)} placeholder="start payload JSON" />
      <div className="wb-row wb-gap-8"><button className="wb-btn" onClick={start}>Start</button></div>
      <textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="reply JSON" />
      <div className="wb-row wb-gap-8"><button className="wb-btn" onClick={sendReply}>Reply</button></div>
      <input value={callId} onChange={e=>setCallId(e.target.value)} placeholder="Call ID" />
      <div className="wb-row wb-gap-8"><button className="wb-btn" onClick={fetchLogs}>Logs</button></div>
      {error && <div className="wb-error">{error}</div>}
      {result && <pre className="wb-pre">{JSON.stringify(result,null,2)}</pre>}
    </div>
  );
}
