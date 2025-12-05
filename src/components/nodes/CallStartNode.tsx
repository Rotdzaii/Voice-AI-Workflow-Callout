import { useState } from 'react';
import api from '../../services/api';

export default function CallStartNode() {
  const [token, setToken] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function startCall() {
    if (isSubmitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (!token.trim()) throw new Error('Thiếu bearer token (Authorization).');
      if (!workflowId.trim()) throw new Error('Thiếu Workflow ID.');
      if (!phone.trim()) throw new Error('Thiếu số điện thoại khách hàng.');

      const payload = {
        workflow_id: workflowId.trim(),
        customer_phone: phone.trim(),
      };
      const response = await api.calls.start(token.trim(), payload);
      setResult(response);
    } catch (err: any) {
      setResult(null);
      setError(String(err?.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wb-card-sm wb-col wb-gap-8">
      <div className="wb-title">Start Call</div>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Bearer token"
      />
      <input
        value={workflowId}
        onChange={(e) => setWorkflowId(e.target.value)}
        placeholder="Workflow ID"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Số điện thoại khách hàng"
      />
      <div className="wb-row wb-gap-8">
        <button className="wb-btn" onClick={startCall} disabled={isSubmitting}>
          {isSubmitting ? 'Đang gọi...' : 'Gọi khách hàng'}
        </button>
      </div>
      {error && <div className="wb-error">{error}</div>}
      {result && <pre className="wb-pre">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
