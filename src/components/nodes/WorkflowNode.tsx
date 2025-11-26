import { useState } from 'react';
import api from '../../services/api';

export default function WorkflowNode() {
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    try {
      const body = { name: name || 'Untitled', nodes: [], edges: [] };
      const r = await api.workflows.create(token, body);
      setResult(r);
    } catch (e: any) {
      setError(String(e.message || e));
    }
  }

  async function handleList() {
    setError(null);
    try { setResult(await api.workflows.list(token)); } catch (e: any) { setError(String(e.message || e)); }
  }

  return (
    <div className="wb-card-sm wb-col wb-gap-8">
      <div className="wb-title">Workflow Node</div>
      <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Bearer token" />
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Workflow name" />
      <div className="wb-row wb-gap-8">
        <button className="wb-btn" onClick={handleCreate}>Create</button>
        <button className="wb-btn" onClick={handleList}>List</button>
      </div>
      {error && <div className="wb-error">{error}</div>}
      {result && <pre className="wb-pre">{JSON.stringify(result,null,2)}</pre>}
    </div>
  );
}
