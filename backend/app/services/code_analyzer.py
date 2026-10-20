import os
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
import tree_sitter_python as tspython
from tree_sitter import Language, Parser, Node
from pydantic import BaseModel, Field

PY_LANGUAGE = Language(tspython.language())

class CodeFunction(BaseModel):
    id: str  # e.g., "app.py:process_data"
    name: str
    file_path: str
    start_line: int
    end_line: int
    is_entry_point: bool = False
    entry_point_type: Optional[str] = None
    code_snippet: str = ""

class CodeCall(BaseModel):
    caller_id: str
    callee_name: str
    line_number: int
    is_dynamic: bool = False
    raw_expression: str = ""
    resolved_target_id: Optional[str] = None

class CodeImport(BaseModel):
    file_path: str
    line_number: int
    module: str
    imported_symbols: Dict[str, str] = Field(default_factory=dict)  # local_name -> original_name

class AnalysisResult(BaseModel):
    functions: Dict[str, CodeFunction] = Field(default_factory=dict)
    imports: List[CodeImport] = Field(default_factory=list)
    calls: List[CodeCall] = Field(default_factory=list)
    unresolved_calls: List[CodeCall] = Field(default_factory=list)
    entry_points: List[str] = Field(default_factory=list)

class PythonCodeAnalyzer:
    def __init__(self):
        self.parser = Parser(PY_LANGUAGE)

    def analyze_repository(self, repo_dir: Path) -> AnalysisResult:
        result = AnalysisResult()
        python_files = list(repo_dir.glob("**/*.py"))

        # Skip virtualenvs or hidden test caches
        filtered_files = [
            f for f in python_files 
            if "venv" not in f.parts and ".pytest_cache" not in f.parts and "__pycache__" not in f.parts
        ]

        # First pass: parse ASTs and extract functions, decorators, imports, calls
        file_ast_map: Dict[str, Tuple[Node, str]] = {}
        file_imports_map: Dict[str, List[CodeImport]] = {}

        for py_file in filtered_files:
            rel_path = str(py_file.relative_to(repo_dir)).replace("\\", "/")
            try:
                code_text = py_file.read_text(encoding="utf-8")
            except Exception:
                continue

            tree = self.parser.parse(bytes(code_text, "utf-8"))
            file_ast_map[rel_path] = (tree.root_node, code_text)
            
            imports = self._extract_imports(tree.root_node, rel_path, code_text)
            file_imports_map[rel_path] = imports
            result.imports.extend(imports)

            functions = self._extract_functions(tree.root_node, rel_path, code_text)
            for fn in functions:
                result.functions[fn.id] = fn
                if fn.is_entry_point:
                    result.entry_points.append(fn.id)

            calls = self._extract_calls(tree.root_node, rel_path, code_text, functions)
            result.calls.extend(calls)

        # Second pass: resolve call edges across imports and modules
        self._resolve_calls(result, file_imports_map)
        return result

    def _extract_imports(self, root_node: Node, file_path: str, code: str) -> List[CodeImport]:
        imports = []
        for child in self._traverse_tree(root_node):
            if child.type == "import_statement":
                # import foo, bar
                for name_node in child.children_by_field_name("name"):
                    module_name = code[name_node.start_byte:name_node.end_byte]
                    imports.append(CodeImport(
                        file_path=file_path,
                        line_number=child.start_point[0] + 1,
                        module=module_name,
                        imported_symbols={module_name: module_name}
                    ))
            elif child.type == "import_from_statement":
                # from foo import bar, baz as b
                module_node = child.child_by_field_name("module_name")
                module_name = code[module_node.start_byte:module_node.end_byte] if module_node else ""
                
                symbols: Dict[str, str] = {}
                for name_node in child.children_by_field_name("name"):
                    if name_node.type == "dotted_name" or name_node.type == "identifier":
                        sym_name = code[name_node.start_byte:name_node.end_byte]
                        symbols[sym_name] = sym_name
                    elif name_node.type == "aliased_import":
                        orig_node = name_node.child_by_field_name("name")
                        alias_node = name_node.child_by_field_name("alias")
                        if orig_node and alias_node:
                            orig_name = code[orig_node.start_byte:orig_node.end_byte]
                            alias_name = code[alias_node.start_byte:alias_node.end_byte]
                            symbols[alias_name] = orig_name

                imports.append(CodeImport(
                    file_path=file_path,
                    line_number=child.start_point[0] + 1,
                    module=module_name,
                    imported_symbols=symbols
                ))
        return imports

    def _extract_functions(self, root_node: Node, file_path: str, code: str) -> List[CodeFunction]:
        functions = []
        for node in self._traverse_tree(root_node):
            if node.type == "function_definition":
                name_node = node.child_by_field_name("name")
                if not name_node:
                    continue
                func_name = code[name_node.start_byte:name_node.end_byte]
                start_line = node.start_point[0] + 1
                end_line = node.end_point[0] + 1
                func_id = f"{file_path}:{func_name}"

                # Snippet (first 10 lines)
                lines = code[node.start_byte:node.end_byte].splitlines()
                snippet = "\n".join(lines[:10])

                # Check for entry-point decorators or signatures (PRD §10)
                is_entry, entry_type = self._check_entry_point(node, func_name, code)

                functions.append(CodeFunction(
                    id=func_id,
                    name=func_name,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    is_entry_point=is_entry,
                    entry_point_type=entry_type,
                    code_snippet=snippet
                ))
        return functions

    def _check_entry_point(self, func_node: Node, func_name: str, code: str) -> Tuple[bool, Optional[str]]:
        # 1. Check decorators
        parent = func_node.parent
        if parent and parent.type == "decorated_definition":
            for child in parent.children:
                if child.type == "decorator":
                    dec_text = code[child.start_byte:child.end_byte].lower()
                    if any(route_token in dec_text for route_token in ["route", "get", "post", "put", "delete", "endpoint", "api"]):
                        return True, f"HTTP Route Handler ({dec_text.split('(')[0].strip()})"

        # 2. Heuristics: main block, cli, handler
        if func_name in ["main", "cli", "handler", "entrypoint"]:
            return True, f"Standard Application Entry ({func_name})"

        return False, None

    def _extract_calls(self, root_node: Node, file_path: str, code: str, functions: List[CodeFunction]) -> List[CodeCall]:
        calls = []
        for fn in functions:
            fn_node = self._find_function_node(root_node, fn.name, fn.start_line)
            if not fn_node:
                continue

            for node in self._traverse_tree(fn_node):
                if node.type == "call":
                    func_field = node.child_by_field_name("function")
                    if not func_field:
                        continue
                    
                    callee_text = code[func_field.start_byte:func_field.end_byte].strip()
                    line_no = node.start_point[0] + 1
                    raw_expr = code[node.start_byte:node.end_byte].strip()

                    # Detect dynamic reflection/calls (PRD §7: dynamic dispatch, getattr, eval)
                    is_dynamic = False
                    if "getattr" in callee_text or "eval" in callee_text or "exec" in callee_text:
                        is_dynamic = True

                    calls.append(CodeCall(
                        caller_id=fn.id,
                        callee_name=callee_text,
                        line_number=line_no,
                        is_dynamic=is_dynamic,
                        raw_expression=raw_expr
                    ))
        return calls

    def _find_function_node(self, root_node: Node, func_name: str, start_line: int) -> Optional[Node]:
        for node in self._traverse_tree(root_node):
            if node.type == "function_definition":
                if node.start_point[0] + 1 == start_line:
                    return node
        return None

    def _resolve_calls(self, result: AnalysisResult, file_imports_map: Dict[str, List[CodeImport]]):
        for call in result.calls:
            if call.is_dynamic:
                result.unresolved_calls.append(call)
                continue

            caller_file = call.caller_id.split(":")[0]
            callee_str = call.callee_name
            resolved = False

            # Case A: direct function call in the same file `func(...)`
            direct_id = f"{caller_file}:{callee_str}"
            if direct_id in result.functions:
                call.resolved_target_id = direct_id
                resolved = True
                continue

            # Case B: function imported from another local file or package
            imports = file_imports_map.get(caller_file, [])
            for imp in imports:
                # e.g., `from utils import helper` -> call is `helper(...)`
                if callee_str in imp.imported_symbols:
                    orig_symbol = imp.imported_symbols[callee_str]
                    # Check if imported module corresponds to a local file
                    mod_path = imp.module.replace(".", "/") + ".py"
                    candidate_id = f"{mod_path}:{orig_symbol}"
                    if candidate_id in result.functions:
                        call.resolved_target_id = candidate_id
                        resolved = True
                        break
                    else:
                        # External package symbol
                        call.resolved_target_id = f"{imp.module}::{orig_symbol}"
                        resolved = True
                        break

                # e.g., `import utils` -> call is `utils.helper(...)`
                if "." in callee_str:
                    prefix, method = callee_str.split(".", 1)
                    if prefix == imp.module or prefix in imp.imported_symbols:
                        mod_path = imp.module.replace(".", "/") + ".py"
                        candidate_id = f"{mod_path}:{method}"
                        if candidate_id in result.functions:
                            call.resolved_target_id = candidate_id
                            resolved = True
                            break
                        else:
                            # External package method
                            call.resolved_target_id = f"{imp.module}::{method}"
                            resolved = True
                            break

            if not resolved:
                # Mark as unresolved call (drives uncertain reachability per PRD §7)
                result.unresolved_calls.append(call)

    def _traverse_tree(self, node: Node):
        cursor = node.walk()
        visited_children = False
        while True:
            if not visited_children:
                yield cursor.node
                if cursor.goto_first_child():
                    continue
            if cursor.goto_next_sibling():
                visited_children = False
            elif cursor.goto_parent():
                visited_children = True
            else:
                break

code_analyzer = PythonCodeAnalyzer()
