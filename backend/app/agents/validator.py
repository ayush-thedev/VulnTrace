from typing import List, Tuple

class EvidenceRefValidationError(ValueError):
    """Raised when an LLM agent hallucinates an evidence reference not present in the graph."""
    pass

def validate_evidence_refs(claimed_refs: List[str], valid_node_ids: List[str]) -> Tuple[bool, List[str]]:
    """
    Validates every evidence reference cited by an agent against the ground-truth graph nodes.
    Returns (is_valid, unknown_references).
    """
    valid_set = set(valid_node_ids)
    unknown = [ref for ref in claimed_refs if ref not in valid_set]
    return len(unknown) == 0, unknown
