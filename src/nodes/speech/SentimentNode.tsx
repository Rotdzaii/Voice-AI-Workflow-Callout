import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function SentimentNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #f97316', background: '#fff7ed', minWidth: 170 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="pos" />
      <Handle type="source" position={Position.Bottom} id="neg" />
      😊/☹️ Sentiment
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default SentimentNode;
