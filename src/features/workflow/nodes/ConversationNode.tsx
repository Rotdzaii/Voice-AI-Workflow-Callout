import { useState } from 'react';
import api from '../../../services/api';

export default function ConversationNode() {
  const [nextPayload, setNextPayload] = useState('{}');
  const [agentPayload, setAgentPayload] = useState('{}');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    setError(null);
    try { setResult(await api.conversation.next(JSON.parse(nextPayload||'{}'))); } catch (e:any){ setError(String(e.message||e)); }
  }
  async function agent() {
    setError(null);
    try { setResult(await api.conversation.agent(JSON.parse(agentPayload||'{}'))); } catch (e:any){ setError(String(e.message||e)); }
  }

  return (
    <div className="wb-card-sm wb-col wb-gap-8">
      <div className="wb-title">Conversation Node</div>
      <textarea value={nextPayload} onChange={e=>setNextPayload(e.target.value)} placeholder="/conversation/next JSON" />
      <div className="wb-row wb-gap-8"><button className="wb-btn" onClick={next}>Next</button></div>
      <textarea value={agentPayload} onChange={e=>setAgentPayload(e.target.value)} placeholder="/conversation/agent JSON" />
      <div className="wb-row wb-gap-8"><button className="wb-btn" onClick={agent}>Agent</button></div>
      {error && <div className="wb-error">{error}</div>}
      {result && <pre className="wb-pre">{JSON.stringify(result,null,2)}</pre>}
    </div>
  );
}
