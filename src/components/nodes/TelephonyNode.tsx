import { useState } from 'react';
import api from '../../services/api';

export default function TelephonyNode() {
  const [channel, setChannel] = useState('SIP/100');
  const [exten, setExten] = useState('100');
  const [context, setContext] = useState('default');
  const [callerid, setCallerid] = useState('Workflow <1000>');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function originate() {
    setError(null);
    try { setResult(await api.telephony.originate({ channel, exten, context, callerid })); } catch (e:any){ setError(String(e.message||e)); }
  }

  return (
    <div className="wb-card-sm wb-col wb-gap-8">
      <div className="wb-title">Telephony Node</div>
      <input value={channel} onChange={e=>setChannel(e.target.value)} placeholder="Channel" />
      <input value={exten} onChange={e=>setExten(e.target.value)} placeholder="Exten" />
      <input value={context} onChange={e=>setContext(e.target.value)} placeholder="Context" />
      <input value={callerid} onChange={e=>setCallerid(e.target.value)} placeholder="CallerID" />
      <div className="wb-row wb-gap-8"><button className="wb-btn" onClick={originate}>Originate</button></div>
      {error && <div className="wb-error">{error}</div>}
      {result && <pre className="wb-pre">{JSON.stringify(result,null,2)}</pre>}
    </div>
  );
}
