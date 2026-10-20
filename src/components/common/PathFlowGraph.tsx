import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphData } from '../../types/api';

interface PathFlowGraphProps {
  graphData: GraphData;
  onNodeClick?: (nodeData: any) => void;
}

export const PathFlowGraph: React.FC<PathFlowGraphProps> = ({ graphData, onNodeClick }) => {
  if (!graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-lg text-sm text-vt-muted">
        No candidate execution route found. The vulnerable symbol could not be reached from any static entry point.
      </div>
    );
  }

  // Map backend ReactFlowNode to @xyflow/react Node format
  const flowNodes: Node[] = graphData.nodes.map((n) => {
    const isEntry = n.data.is_entry_point;
    const isTarget = n.data.is_vulnerable_target;

    let borderClass = 'border-vt-border bg-white text-vt-ink';
    let labelPrefix = 'Function';
    if (isEntry) {
      borderClass = 'border-vt-navy bg-vt-tint text-vt-deep-navy font-semibold';
      labelPrefix = 'Entry Point';
    } else if (isTarget) {
      borderClass = 'border-vt-red bg-vt-red-light text-vt-red font-semibold';
      labelPrefix = 'Vulnerable Function';
    }

    return {
      id: n.id,
      position: n.position,
      data: {
        label: (
          <div className="text-left cursor-pointer" onClick={() => onNodeClick && onNodeClick(n.data)}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="mono text-[9px] uppercase tracking-wider opacity-75">{labelPrefix}</span>
              {n.data.line_number && (
                <span className="mono text-[9px] bg-white/80 px-1 rounded border border-gray-200">
                  L{n.data.line_number}
                </span>
              )}
            </div>
            <div className="font-mono text-xs font-bold truncate max-w-[200px]">
              {n.data.label}
            </div>
            {n.data.file_path && (
              <div className="text-[10px] text-vt-muted truncate max-w-[200px] mt-0.5">
                {n.data.file_path}
              </div>
            )}
          </div>
        ),
      },
      style: {
        borderWidth: 2,
        borderRadius: 8,
        padding: 10,
        minWidth: 200,
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
      },
      className: borderClass,
    };
  });

  // Map backend ReactFlowEdge to @xyflow/react Edge format
  const flowEdges: Edge[] = graphData.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || 'CALLS',
    animated: e.animated,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: e.style?.stroke || '#1E338C',
    },
    style: {
      stroke: e.style?.stroke || '#1E338C',
      strokeWidth: e.style?.strokeWidth || 2,
    },
    labelStyle: {
      fontSize: 10,
      fontFamily: 'JetBrains Mono',
      fill: '#5A6070',
    },
  }));

  return (
    <div className="w-full h-[320px] bg-slate-50 border border-vt-border rounded-lg relative overflow-hidden">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        fitView
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="#CBD5E1" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};
