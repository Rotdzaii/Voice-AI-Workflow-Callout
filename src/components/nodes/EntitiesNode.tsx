import React, { useState } from 'react';
import api from '../../services/api';

export default function EntitiesNode() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setError(null);
    try { setResult(await api.entities()); } catch (e:any){ setError(String(e.message||e)); }
  }
  return (
    <div className="wb-card-sm wb-col wb-gap-8">
      <div className="wb-title">Entities Node</div>
      <div className="wb-row wb-gap-8"><button className="wb-btn" onClick={load}>Load</button></div>
      {error && <div className="wb-error">{error}</div>}
      {result && <pre className="wb-pre">{JSON.stringify(result,null,2)}</pre>}
    </div>
  );
}
