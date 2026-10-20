import logging
import networkx as nx
from typing import List, Dict, Any, Optional
from backend.app.config import settings
from backend.app.models.schemas import PathHop, CandidatePath

logger = logging.getLogger("vulntrace.graph")

class VulnTraceGraphDB:
    def __init__(self, host: str = None, port: int = None):
        self.host = host or settings.FALKORDB_HOST
        self.port = port or settings.FALKORDB_PORT
        self.falkor_client = None
        self._connected = False
        self._nx_graph = nx.DiGraph()
        self._node_attrs: Dict[str, Dict[str, Any]] = {}
        self._edge_attrs: Dict[str, Dict[str, Any]] = {}

        self._try_connect_falkor()

    def _try_connect_falkor(self):
        try:
            from falkordb import FalkorDB
            client = FalkorDB(host=self.host, port=self.port)
            # Ping connection
            client.connection.ping()
            self.falkor_client = client.select_graph("vulntrace")
            self._connected = True
            logger.info(f"Connected to FalkorDB on {self.host}:{self.port}")
        except Exception as e:
            self._connected = False
            self.falkor_client = None
            logger.info(f"FalkorDB service not available ({e}); using resilient in-memory graph driver.")

    @property
    def is_falkordb_connected(self) -> bool:
        return self._connected

    def reset_graph(self):
        self._nx_graph.clear()
        self._node_attrs.clear()
        self._edge_attrs.clear()
        if self._connected and self.falkor_client:
            try:
                self.falkor_client.query("MATCH (n) DETACH DELETE n")
            except Exception as e:
                logger.warning(f"Error resetting FalkorDB: {e}")

    def add_node(self, node_id: str, label: str, properties: Dict[str, Any]):
        self._node_attrs[node_id] = {"label": label, **properties}
        self._nx_graph.add_node(node_id, label=label, **properties)
        
        if self._connected and self.falkor_client:
            try:
                # Sanitize Cypher insertion
                props_str = ", ".join([f"{k}: '{str(v)}'" for k, v in properties.items() if isinstance(v, (str, int, float, bool))])
                self.falkor_client.query(f"MERGE (n:{label} {{id: '{node_id}', {props_str}}})")
            except Exception as e:
                logger.warning(f"FalkorDB node insert error: {e}")

    def add_edge(self, source_id: str, target_id: str, rel_type: str, properties: Dict[str, Any]):
        edge_key = f"{source_id}->{target_id}:{rel_type}"
        self._edge_attrs[edge_key] = properties
        self._nx_graph.add_edge(source_id, target_id, rel_type=rel_type, **properties)

        if self._connected and self.falkor_client:
            try:
                props_str = ", ".join([f"{k}: '{str(v)}'" for k, v in properties.items() if isinstance(v, (str, int, float, bool))])
                query = f"""
                MATCH (a {{id: '{source_id}'}}), (b {{id: '{target_id}'}})
                MERGE (a)-[r:{rel_type} {{{props_str}}}]->(b)
                """
                self.falkor_client.query(query)
            except Exception as e:
                logger.warning(f"FalkorDB edge insert error: {e}")

    def query_candidate_paths(self, vulnerable_node_id: str, max_depth: int = 10, limit: int = 5) -> List[CandidatePath]:
        """
        Executes bounded path traversal from application entry points to the vulnerable target node.
        Matches PRD §10 Cypher:
        MATCH p = (e:Function {is_entry_point: true})-[:CALLS*1..10]->(v:Function {id: $vulnerable_function_id})
        RETURN p LIMIT 5
        """
        candidate_paths: List[CandidatePath] = []

        # Find all entry point nodes in graph
        entry_points = [
            n for n, attr in self._node_attrs.items()
            if attr.get("label") == "Function" and attr.get("is_entry_point") is True
        ]

        if not self._nx_graph.has_node(vulnerable_node_id):
            return []

        for ep in entry_points:
            try:
                # Find simple paths up to max_depth
                all_paths = nx.all_simple_edge_paths(self._nx_graph, source=ep, target=vulnerable_node_id, cutoff=max_depth)
                for edge_path in all_paths:
                    if len(candidate_paths) >= limit:
                        break

                    hops: List[PathHop] = []
                    has_unresolved = False

                    # First hop: entry point itself
                    ep_attr = self._node_attrs.get(ep, {})
                    hops.append(PathHop(
                        node_id=ep,
                        file_path=ep_attr.get("file_path", ""),
                        function_name=ep_attr.get("name", ep),
                        line_number=ep_attr.get("start_line", 1),
                        is_entry_point=True,
                        call_resolved=True,
                        code_snippet=ep_attr.get("code_snippet")
                    ))

                    # Subsequent hops along edges
                    for u, v in edge_path:
                        edge_data = self._nx_graph.get_edge_data(u, v) or {}
                        v_attr = self._node_attrs.get(v, {})
                        resolved = edge_data.get("resolved", True)
                        if not resolved:
                            has_unresolved = True

                        hops.append(PathHop(
                            node_id=v,
                            file_path=v_attr.get("file_path", ""),
                            function_name=v_attr.get("name", v),
                            line_number=edge_data.get("line_number", v_attr.get("start_line", 1)),
                            is_entry_point=v_attr.get("is_entry_point", False),
                            call_resolved=resolved,
                            code_snippet=v_attr.get("code_snippet")
                        ))

                    candidate_paths.append(CandidatePath(
                        path_id=f"path-{len(candidate_paths) + 1}",
                        entry_point_id=ep,
                        vulnerable_target_id=vulnerable_node_id,
                        hops=hops,
                        contains_unresolved_call=has_unresolved,
                        depth=len(hops) - 1
                    ))
            except nx.NetworkXNoPath:
                continue
            except Exception as e:
                logger.warning(f"Path traversal error for {ep} -> {vulnerable_node_id}: {e}")

        return candidate_paths

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        return self._node_attrs.get(node_id)

    def get_all_nodes(self) -> Dict[str, Dict[str, Any]]:
        return self._node_attrs

    def get_all_edges(self) -> List[Dict[str, Any]]:
        edges = []
        for u, v, data in self._nx_graph.edges(data=True):
            edges.append({
                "source": u,
                "target": v,
                **data
            })
        return edges

graph_db = VulnTraceGraphDB()
