import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphData } from '../../types/api';
import { Drawer } from '../shared/Drawer';
import { Button } from '../shared/Button';
import { CodeBlock } from '../shared/CodeBlock';
import {
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  Info,
  ExternalLink,
} from 'lucide-react';

interface PathFlowGraphProps {
  graphData: GraphData;
  unresolvedCalls?: any[];
  gitHubRepoUrl?: string;
}

export const PathFlowGraph: React.FC<PathFlowGraphProps> = ({
  graphData,
  unresolvedCalls = [],
  gitHubRepoUrl,
}) => {
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [singlePathMode, setSinglePathMode] = useState(false);
  const [collapsedLibrary, setCollapsedLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter and process nodes & edges
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) {
      return { flowNodes: [], flowEdges: [] };
    }

    let rawNodes = [...graphData.nodes];
    let rawEdges = [...(graphData.edges || [])];

    // Search query filter
    const q = searchQuery.toLowerCase().trim();

    const nodes: Node[] = rawNodes.map((n, idx) => {
      const isEntry = n.data.is_entry_point;
      const isTarget = n.data.is_vulnerable_target;
      const category = n.data.category || (isEntry ? 'entry' : isTarget ? 'sink' : 'app');
      const isSink = category === 'sink';
      const isLibrary = category === 'library';

      const isStepped = stepIndex !== null && idx === stepIndex;
      const matchesSearch = !q || n.data.label.toLowerCase().includes(q) || (n.data.file_path || '').toLowerCase().includes(q);

      // Custom node borders & colors strictly adhering to Section 0 & 6
      let borderStyle = '1px solid var(--border)';
      let bgStyle = 'var(--bg-primary)';
      let textColor = 'var(--text-primary)';

      if (isSink) {
        borderStyle = '2px solid var(--semantic-red)';
        bgStyle = 'var(--semantic-red-light)';
        textColor = 'var(--semantic-red)';
      } else if (isEntry) {
        borderStyle = '1px solid var(--accent)';
        bgStyle = 'var(--accent-light)';
        textColor = 'var(--accent)';
      } else if (isLibrary) {
        borderStyle = '1px dashed var(--border)';
        bgStyle = 'var(--bg-surface)';
        textColor = 'var(--text-secondary)';
      }

      const opacity = !matchesSearch ? 0.2 : stepIndex !== null && !isStepped ? 0.25 : 1;

      return {
        id: n.id,
        position: n.position,
        data: {
          label: (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius)',
                border: borderStyle,
                backgroundColor: bgStyle,
                color: textColor,
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                opacity,
                cursor: 'pointer',
                transition: 'all var(--duration) ease',
                boxShadow: isSink ? '0 0 0 2px rgba(220, 38, 38, 0.2)' : 'none',
              }}
              onClick={() => {
                setSelectedNodeData(n.data);
                setDrawerOpen(true);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {category}
                </span>
                {n.data.line_number && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    L{n.data.line_number}
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                {n.data.label}
              </div>
              {n.data.file_path && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                  {n.data.file_path}
                </div>
              )}
            </div>
          ),
          raw: n.data,
        },
      };
    });

    const edges: Edge[] = rawEdges.map((e, idx) => {
      const isCall = e.label === 'calls' || e.label === 'CALLS';
      const isTainted = !isCall;
      const isCurrentStep = stepIndex !== null && (idx === stepIndex || idx === stepIndex - 1);
      const edgeOpacity = stepIndex !== null && !isCurrentStep ? 0.15 : 1;

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: isTainted,
        label: e.label,
        labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' },
        style: {
          stroke: isTainted ? 'var(--accent)' : 'var(--border)',
          strokeWidth: isCurrentStep ? 3 : 2,
          strokeDasharray: isTainted ? '5,5' : undefined,
          opacity: edgeOpacity,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isTainted ? 'var(--accent)' : 'var(--border)',
        },
      };
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [graphData, searchQuery, stepIndex, singlePathMode, collapsedLibrary]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // If graph data is empty
  if (!graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div
        className="vt-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          height: '420px',
        }}
      >
        <Info size={32} style={{ color: 'var(--semantic-amber)', marginBottom: '12px' }} />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>No path observed</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', marginTop: '6px' }}>
          The analyzer traced static application call trees, but did not observe a complete path to the vulnerable function.
        </p>
        {unresolvedCalls.length > 0 && (
          <div style={{ marginTop: '16px', textAlign: 'left', width: '100%', maxWidth: '480px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Unresolved dynamic calls ({unresolvedCalls.length}):
            </span>
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {unresolvedCalls.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--semantic-amber)',
                  }}
                >
                  {c.callee_name || c.raw_expression} (L{c.line_number})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleStep = (direction: 'next' | 'back') => {
    if (stepIndex === null) {
      setStepIndex(0);
      return;
    }
    const maxSteps = graphData.nodes.length;
    if (direction === 'next') {
      setStepIndex((prev) => (prev !== null && prev < maxSteps - 1 ? prev + 1 : prev));
    } else {
      setStepIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 100 : 1,
        width: '100%',
        height: isFullscreen ? '100vh' : '520px',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: isFullscreen ? 0 : 'var(--radius)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '180px' }}>
            <input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '28px',
                padding: '0 8px',
                fontSize: '12px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Single Path vs All Paths */}
          <div style={{ display: 'flex', gap: '2px', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px' }}>
            <button
              onClick={() => setSinglePathMode(false)}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                backgroundColor: !singlePathMode ? 'var(--bg-primary)' : 'transparent',
                color: !singlePathMode ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              All Paths
            </button>
            <button
              onClick={() => setSinglePathMode(true)}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                backgroundColor: singlePathMode ? 'var(--bg-primary)' : 'transparent',
                color: singlePathMode ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              Single Path
            </button>
          </div>

          <button
            onClick={() => setCollapsedLibrary(!collapsedLibrary)}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: collapsedLibrary ? 'var(--accent-dim)' : 'transparent',
              color: collapsedLibrary ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {collapsedLibrary ? 'Libraries Collapsed' : 'Collapse Libs'}
          </button>
        </div>

        {/* Step-through Walk Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleStep('back')}
            disabled={stepIndex === null || stepIndex === 0}
            icon={<ChevronLeft size={12} />}
          >
            Back
          </Button>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {stepIndex !== null ? `Hop ${stepIndex + 1}/${graphData.nodes.length}` : 'Full graph'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleStep('next')}
            disabled={stepIndex !== null && stepIndex >= graphData.nodes.length - 1}
            icon={<ChevronRight size={12} />}
          >
            Next
          </Button>
          {stepIndex !== null && (
            <button
              onClick={() => setStepIndex(null)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px' }}
            >
              Reset
            </button>
          )}

          <Button
            variant="ghost"
            size="sm"
            icon={isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            onClick={toggleFullscreen}
          />
        </div>
      </div>

      {/* React Flow Canvas */}
      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color="var(--border)" gap={20} size={1} />
          <Controls showInteractive={false} style={{ border: '1px solid var(--border)', borderRadius: '6px' }} />
          <MiniMap
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
            }}
            nodeColor={(node: any) => {
              if (node.id?.includes('sink') || node.id?.includes('Template') || node.id?.includes('load')) return 'var(--semantic-red)';
              if (node.id?.includes('main') || node.id?.includes('route')) return 'var(--accent)';
              return 'var(--border-strong)';
            }}
          />
        </ReactFlow>

        {/* Collapsible Legend in bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
            zIndex: 10,
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Legend</span>
            <button
              onClick={() => setLegendOpen(!legendOpen)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}
            >
              {legendOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          {legendOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--accent-light)', border: '1px solid var(--accent)' }} />
                <span>Entry point</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }} />
                <span>App code</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border)' }} />
                <span>Library code</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--semantic-red-light)', border: '2px solid var(--semantic-red)' }} />
                <span>Vulnerable function (Sink)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Detail Drawer on node click */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedNodeData?.label || 'Node Details'}
        subtitle={selectedNodeData?.file_path ? `${selectedNodeData.file_path}:${selectedNodeData.line_number || ''}` : 'Execution Hop'}
        footer={
          selectedNodeData?.file_path && gitHubRepoUrl ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<ExternalLink size={12} />}
              onClick={() => {
                const url = `${gitHubRepoUrl.replace(/\/$/, '')}/blob/main/${selectedNodeData.file_path}#L${selectedNodeData.line_number || 1}`;
                window.open(url, '_blank');
              }}
            >
              Open in GitHub
            </Button>
          ) : undefined
        }
      >
        {selectedNodeData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Type:</span>
              <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                {selectedNodeData.category || (selectedNodeData.is_entry_point ? 'Entry Point' : selectedNodeData.is_vulnerable_target ? 'Vulnerable Function' : 'Internal Call')}
              </span>
            </div>

            {selectedNodeData.code_snippet && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                  Source Code Context
                </span>
                <CodeBlock
                  code={selectedNodeData.code_snippet}
                  language="python"
                  showLineNumbers
                  highlightLine={selectedNodeData.line_number}
                />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
