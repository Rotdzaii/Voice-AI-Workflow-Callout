import { useState } from 'react';
import api from '../../../services/api';

export default function NLUNode() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setError(null);
    try { setResult(await api.nlu.parse({ text })); } catch (e:any){ setError(String(e.message||e)); }
  }

  return (
    <div className="wb-card-sm wb-col wb-gap-8">
      <div className="wb-title">NLU Node</div>
      <input value={text} onChange={e=>setText(e.target.value)} placeholder="Text to parse" />
      <div className="wb-row wb-gap-8"><button className="wb-btn" onClick={parse}>Parse</button></div>
      {error && <div className="wb-error">{error}</div>}
      {result && <pre className="wb-pre">{JSON.stringify(result,null,2)}</pre>}
    </div>
  );
}
