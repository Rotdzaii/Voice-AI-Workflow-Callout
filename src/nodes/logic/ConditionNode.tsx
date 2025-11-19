import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function ConditionNode({ data }: NodeProps) {
  const branches: string[] = Array.isArray((data as any)?.branches) && (data as any).branches.length
    ? (data as any).branches
    : ['yes', 'no'];
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #059669', background: '#ecfdf5', minWidth: 170 }}>
      <Handle type="target" position={Position.Top} id="in" />
      {branches.map((b, i) => {
        const count = branches.length;
        const leftPct = ((i + 1) * 100) / (count + 1);
        const color = b === 'yes' ? '#059669' : b === 'no' ? '#ef4444' : '#2563eb';
        return (
          <Handle key={b} type="source" position={Position.Bottom} id={b} style={{ left: `${leftPct}%`, background: color }} />
        );
      })}
      🔀 Condition
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default ConditionNode;
