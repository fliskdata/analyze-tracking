#!/usr/bin/env python3
"""
Python Analytics Tracking Analyzer

This module analyzes Python source code to identify analytics tracking calls from various
libraries and extracts event information including event names, properties, and metadata.

Supported analytics libraries:
- Segment Analytics
- Mixpanel
- Amplitude
- PostHog  
- Rudderstack
- Snowplow
- Custom tracking functions

The analyzer uses Python's AST (Abstract Syntax Tree) module to parse code and identify
tracking patterns specific to each library.
"""

import ast
import json
from typing import Dict, List, Optional, Any, Union

# Type aliases for clarity
PropertyType = Union[str, Dict[str, Any]]
EventProperties = Dict[str, Dict[str, PropertyType]]
AnalyticsEvent = Dict[str, Any]

# Supported analytics sources
ANALYTICS_SOURCES = {
    'segment': {'object': 'analytics', 'method': 'track'},
    'mixpanel': {'object': 'mp', 'method': 'track'},
    'rudderstack': {'object': 'rudder_analytics', 'method': 'track'},
    'posthog': {'object': 'posthog', 'method': 'capture'},
    'amplitude': {'event_class': 'BaseEvent'},
    'snowplow': {'event_class': 'StructuredEvent', 'tracker_object': 'tracker'}
}

# Type mappings from Python to JSON Schema types
TYPE_MAPPINGS = {
    'int': 'number',
    'float': 'number', 
    'str': 'string',
    'bool': 'boolean',
    'None': 'null',
    'NoneType': 'null'
}

# Container types that map to arrays
ARRAY_TYPES = {'List', 'Tuple', 'Set', 'list', 'tuple', 'set'}

# Container types that map to objects
OBJECT_TYPES = {'Dict', 'dict'}

def _safe_id(node: ast.AST) -> Optional[str]:
    """Return the .id attribute of a node if present."""
    return getattr(node, 'id', None)

# -------------------------------------------
# Tracking Visitor
# -------------------------------------------

class TrackingVisitor(ast.NodeVisitor):
    """
    AST visitor that identifies and extracts analytics tracking calls from Python code.
    
    This visitor traverses the AST and looks for function calls that match known
    analytics library patterns. It extracts event names, properties, and metadata
    for each tracking call found.
    
    Attributes:
        events: List of analytics events found in the code
        filepath: Path to the file being analyzed
        current_function: Name of the current function being visited
        function_stack: Stack of function contexts for nested functions
        var_types: Dictionary of variable types in the current scope
        var_types_stack: Stack of variable type scopes
        custom_config: Optional custom configuration for custom tracking functions
    """
    
    def __init__(self, filepath: str, custom_config: Optional[Dict[str, Any]] = None):
        """
        Initialize the tracking visitor.
        
        Args:
            filepath: Path to the Python file being analyzed
            custom_config: Optional custom configuration for custom tracking functions
        """
        self.events: List[AnalyticsEvent] = []
        self.filepath = filepath
        self.current_function = 'global'
        self.function_stack: List[str] = []
        self.var_types: Dict[str, PropertyType] = {}
        self.var_types_stack: List[Dict[str, PropertyType]] = []
        self.custom_config = custom_config or None
        # Store convenience attributes if config provided
        if self.custom_config:
            self._custom_fn_name: str = self.custom_config.get('functionName', '')
            self._event_idx: int = self.custom_config.get('eventIndex', 0)
            self._props_idx: int = self.custom_config.get('propertiesIndex', 1)
            self._extra_params = self.custom_config.get('extraParams', [])
        else:
            self._custom_fn_name = None
            self._event_idx = 0
            self._props_idx = 1
            self._extra_params = []
        
    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """
        Visit a function definition node and track context and variable types.
        
        This method maintains the function context stack and creates a new scope
        for variable types when entering a function. It also extracts type
        annotations from function parameters.
        
        Args:
            node: The function definition AST node
        """
        # Save previous function context and variable types
        self.function_stack.append(self.current_function)
        self.var_types_stack.append(self.var_types)
        
        # Create new scope for variable types
        self.var_types = {}
        self.current_function = node.name
        
        # Extract parameter type annotations
        for arg in node.args.args:
            if arg.annotation:
                # Store the type annotation for this parameter
                self.var_types[arg.arg] = self.extract_type_annotation(arg.annotation)
        
        # Visit children
        self.generic_visit(node)
        
        # Restore function context and variable types
        self.current_function = self.function_stack.pop()
        self.var_types = self.var_types_stack.pop()
    
    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """
        Visit a class definition node and track context.
        
        Similar to function definitions, this maintains proper context
        for methods within classes.
        
        Args:
            node: The class definition AST node
        """
        # Track class context for methods
        class_name = node.name
        self.function_stack.append(self.current_function)
        self.var_types_stack.append(self.var_types)
        
        # Create new scope for the class
        self.var_types = {}
        self.current_function = class_name
        
        self.generic_visit(node)
        
        # Restore context
        self.current_function = self.function_stack.pop()
        self.var_types = self.var_types_stack.pop()
    
    def extract_type_annotation(self, annotation: ast.AST) -> PropertyType:
        """
        Extract type information from a type annotation node.
        
        Converts Python type annotations to JSON Schema compatible types.
        Handles simple types (int, str, bool) and generic types (List[int], Dict[str, int]).
        
        Args:
            annotation: The type annotation AST node
            
        Returns:
            A string representing the JSON Schema type or a dictionary for complex types
        """
        if isinstance(annotation, ast.Name):
            # Simple types like int, str, bool
            type_name = annotation.id
            return TYPE_MAPPINGS.get(type_name, 'any')
            
        elif isinstance(annotation, ast.Subscript):
            # Handle generic types like List[int], Dict[str, int]
            container_type = getattr(annotation.value, 'id', None)
            if container_type is None and isinstance(annotation.value, ast.Attribute):
                container_type = getattr(annotation.value, 'attr', None)

            if container_type:
                
                if container_type in ARRAY_TYPES:
                    # Try to get the type parameter for arrays
                    if isinstance(annotation.slice, ast.Name):
                        element_type = self.extract_type_annotation(annotation.slice)
                        return {
                            'type': 'array',
                            'items': {'type': element_type}
                        }
                    return 'array'
                    
                elif container_type in OBJECT_TYPES:
                    return 'object'
                    
        # Default for unknown or complex types
        return 'any'
    
    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        """
        Visit variable assignments with type annotations.
        
        Tracks variable types from annotated assignments like:
        user_id: str = "123"
        
        Args:
            node: The annotated assignment AST node
        """
        if isinstance(node.target, ast.Name) and node.annotation:
            # Store the type annotation for this variable
            self.var_types[node.target.id] = self.extract_type_annotation(node.annotation)
        self.generic_visit(node)
    
    def visit_Assign(self, node: ast.Assign) -> None:
        """
        Visit regular assignments to track simple type inferences.
        
        Attempts to infer types from literal values in assignments like:
        user_id = "123"  # Inferred as string
        
        Args:
            node: The assignment AST node
        """
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            var_name = node.targets[0].id
            # Try to infer type from literal values
            if isinstance(node.value, ast.Constant):
                self.var_types[var_name] = self.get_value_type(node.value.value)
        self.generic_visit(node)
    
    def visit_Call(self, node: ast.Call) -> None:
        """
        Visit function call nodes to detect analytics tracking calls.
        
        This is the main method that identifies tracking calls from various
        analytics libraries and extracts relevant information.
        
        Args:
            node: The function call AST node
        """
        # Check if this is an analytics tracking call
        source = self.detect_source(node)
        if source:
            event_name = self.extract_event_name(node, source)
            if event_name:
                properties = self.extract_properties(node, source)
                
                # Create the event record
                event = {
                    "eventName": event_name,
                    "source": source,
                    "properties": properties,
                    "filePath": self.filepath,
                    "line": node.lineno,
                    "functionName": self.current_function
                }
                self.events.append(event)
        
        # Continue visiting child nodes
        self.generic_visit(node)
    
    def detect_source(self, node: ast.Call) -> Optional[str]:
        """
        Detect which analytics library is being used in a function call.
        
        Checks the function call against known patterns for supported analytics
        libraries including Segment, Mixpanel, Amplitude, PostHog, Rudderstack,
        Snowplow, and custom functions.
        
        Args:
            node: The function call AST node
            
        Returns:
            The name of the detected analytics source, or None if not recognized
        """
        # Check for method calls (e.g., analytics.track())
        if isinstance(node.func, ast.Attribute):
            return self._detect_method_call_source(node)
        
        # Check for direct function calls
        elif isinstance(node.func, ast.Name):
            return self._detect_function_call_source(node)
        
        return None
    
    def _detect_method_call_source(self, node: ast.Call) -> Optional[str]:
        """Helper method to detect analytics source from method calls."""
        obj_val = getattr(node.func, 'value', None)
        if obj_val is None:
            return None
            
        obj_id = _safe_id(obj_val) or ''
        method_name = getattr(node.func, 'attr', '')
        
        # Check standard analytics libraries
        for source, config in ANALYTICS_SOURCES.items():
            if 'object' in config and 'method' in config:
                if obj_id == config['object'] and method_name == config['method']:
                    return source
        
        # Special case: Amplitude with BaseEvent
        if method_name == 'track' and self._is_amplitude_call(node):
            return 'amplitude'
        
        # Special case: Snowplow with StructuredEvent
        if method_name == 'track' and self._is_snowplow_tracker_call(node):
            return 'snowplow'
        
        # Handle dot-separated custom function names like CustomModule.track
        if self._custom_fn_name and '.' in self._custom_fn_name:
            full_name = f"{obj_id}.{method_name}"
            if full_name == self._custom_fn_name:
                return 'custom'
        
        return None
    
    def _detect_function_call_source(self, node: ast.Call) -> Optional[str]:
        """Helper method to detect analytics source from direct function calls."""
        func_name = _safe_id(node.func) or ''
        
        # Check for Snowplow direct functions
        if func_name in ['trackStructEvent', 'buildStructEvent']:
            return 'snowplow'
        
        # Check for Snowplow's snowplow('trackStructEvent', {...}) pattern
        if func_name == 'snowplow' and self._is_snowplow_function_call(node):
            return 'snowplow'
        
        # Check for custom tracking function
        if self._custom_fn_name and func_name == self._custom_fn_name:
            return 'custom'
        
        return None
    
    def _is_amplitude_call(self, node: ast.Call) -> bool:
        """Check if the call matches Amplitude's BaseEvent pattern."""
        if len(node.args) < 1:
            return False
            
        first_arg = node.args[0]
        if isinstance(first_arg, ast.Call) and isinstance(first_arg.func, ast.Name):
            return _safe_id(first_arg.func) == 'BaseEvent'
        return False
    
    def _is_snowplow_tracker_call(self, node: ast.Call) -> bool:
        """Check if the call matches Snowplow's tracker.track() pattern."""
        if len(node.args) < 1:
            return False
            
        first_arg = node.args[0]
        # Check if first argument is StructuredEvent
        if isinstance(first_arg, ast.Call) and isinstance(first_arg.func, ast.Name):
            return _safe_id(first_arg.func) == 'StructuredEvent'
        
        # Also check if it might be a variable (simple heuristic)
        if isinstance(first_arg, ast.Name) and hasattr(node.func, 'value'):
            return node.func.value.id == 'tracker'
            
        return False
    
    def _is_snowplow_function_call(self, node: ast.Call) -> bool:
        """Check if this is a snowplow('trackStructEvent', {...}) call."""
        if len(node.args) >= 1 and isinstance(node.args[0], ast.Constant):
            return node.args[0].value == 'trackStructEvent'
        return False
    
    def extract_event_name(self, node: ast.Call, source: str) -> Optional[str]:
        """
        Extract the event name from an analytics tracking call.
        
        Different analytics libraries have different patterns for specifying
        event names. This method handles the extraction for each supported source.
        
        Args:
            node: The function call AST node
            source: The detected analytics source
            
        Returns:
            The extracted event name, or None if not found
        """
        try:
            if source in ['segment', 'rudderstack', 'mixpanel']:
                return self._extract_standard_event_name(node)
            elif source == 'amplitude':
                return self._extract_amplitude_event_name(node)
            elif source == 'posthog':
                return self._extract_posthog_event_name(node)
            elif source == 'snowplow':
                return self._extract_snowplow_event_name(node)
            elif source == 'custom':
                return self._extract_custom_event_name(node)
        except Exception:
            # Silently fail and return None for any extraction errors
            pass
        
        return None
    
    def _extract_standard_event_name(self, node: ast.Call) -> Optional[str]:
        """Extract event name for Segment/Rudderstack/Mixpanel format."""
        # Format: library.track(user_id/distinct_id, 'event_name', {...})
        if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant):
            return node.args[1].value
        return None
    
    def _extract_amplitude_event_name(self, node: ast.Call) -> Optional[str]:
        """Extract event name for Amplitude format."""
        # Format: client.track(BaseEvent(event_type='event_name', ...))
        if len(node.args) < 1 or not isinstance(node.args[0], ast.Call):
            return None
            
        base_event_call = node.args[0]
        # Look for event_type in keyword arguments
        for keyword in base_event_call.keywords:
            if keyword.arg == 'event_type' and isinstance(keyword.value, ast.Constant):
                return keyword.value.value
        return None
    
    def _extract_posthog_event_name(self, node: ast.Call) -> Optional[str]:
        """Extract event name for PostHog format."""
        # PostHog has multiple formats:
        # 1. posthog.capture('distinct_id', 'event_name', {...})
        # 2. posthog.capture('distinct_id', event='event_name', properties={...})
        
        # Check for named parameters first (event='event_name')
        for keyword in node.keywords:
            if keyword.arg == 'event' and isinstance(keyword.value, ast.Constant):
                return keyword.value.value
        
        # If no named event parameter, check positional args (second arg is event name)
        if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant):
            return node.args[1].value
        
        return None
    
    def _extract_snowplow_event_name(self, node: ast.Call) -> Optional[str]:
        """Extract event name for Snowplow format."""
        # Pattern 1: tracker.track(StructuredEvent(action='event_name', ...))
        if len(node.args) >= 1:
            first_arg = node.args[0]
            if isinstance(first_arg, ast.Call) and isinstance(first_arg.func, ast.Name):
                if _safe_id(first_arg.func) == 'StructuredEvent':
                    # Look for action in keyword arguments
                    for keyword in first_arg.keywords:
                        if keyword.arg == 'action' and isinstance(keyword.value, ast.Constant):
                            return keyword.value.value
        
        # Pattern 2 & 3: Other Snowplow patterns would need additional handling
        # For now, return None for these cases
        return None
    
    def _extract_custom_event_name(self, node: ast.Call) -> Optional[str]:
        """Extract event name for custom tracking function."""
        args = node.args

        # Use configured index if available
        if len(args) > self._event_idx and isinstance(args[self._event_idx], ast.Constant):
            return args[self._event_idx].value

        # Fallback heuristics
        if len(args) >= 1 and isinstance(args[0], ast.Constant):
            return args[0].value
        return None
    
    def extract_properties(self, node: ast.Call, source: str) -> EventProperties:
        """
        Extract properties from an analytics tracking call.
        
        This method extracts the properties/attributes passed to the tracking call,
        handling the different formats used by various analytics libraries.
        
        Args:
            node: The function call AST node
            source: The detected analytics source
            
        Returns:
            Dictionary of properties with their types
        """
        properties = {}
        
        try:
            # Extract user/distinct ID if present
            user_id_prop = self._extract_user_id(node, source)
            if user_id_prop:
                properties.update(user_id_prop)
            
            # Special handling for Snowplow StructuredEvent
            if source == 'snowplow':
                snowplow_props = self._extract_snowplow_properties(node)
                properties.update(snowplow_props)
            else:
                # Get the properties dictionary node for other sources
                props_node = self._get_properties_node(node, source)
                
                # Extract properties from the dictionary
                if props_node and isinstance(props_node, ast.Dict):
                    extracted_props = self._extract_dict_properties(props_node, source)
                    properties.update(extracted_props)
                
        except Exception:
            # Silently fail and return what we have so far
            pass
            
        return properties
    
    def _extract_user_id(self, node: ast.Call, source: str) -> EventProperties:
        """Extract user/distinct ID from tracking call if present."""
        user_id_props = {}
        
        if source in ['segment', 'rudderstack']:
            # Format: analytics.track(user_id, ...)
            if len(node.args) > 0:
                user_id_node = node.args[0]
                if self._is_non_null_value(user_id_node):
                    user_id_props["user_id"] = {"type": "string"}
                    
        elif source == 'mixpanel':
            # Format: mp.track(distinct_id, ...)
            if len(node.args) > 0:
                distinct_id_node = node.args[0]
                if self._is_non_null_value(distinct_id_node):
                    user_id_props["distinct_id"] = {"type": "string"}
                    
        elif source == 'amplitude':
            # Check BaseEvent for user_id parameter
            user_id_props.update(self._extract_amplitude_user_id(node))
            
        elif source == 'posthog':
            # Check if event is not anonymous and extract distinct_id
            user_id_props.update(self._extract_posthog_user_id(node))
            
        elif source == 'custom':
            # Populate extra params defined in custom config as properties
            if self._extra_params:
                for extra in self._extra_params:
                    idx = extra.get('idx')
                    name = extra.get('name')
                    if idx is None or name is None:
                        continue
                    if idx < len(node.args):
                        prop_type = self._extract_property_type(node.args[idx])
                        if prop_type:
                            user_id_props[name] = prop_type
            
        return user_id_props
    
    def _is_non_null_value(self, node: ast.AST) -> bool:
        """Check if a node represents a non-null value."""
        if isinstance(node, ast.Constant):
            return node.value is not None
        elif isinstance(node, ast.Name):
            return True  # Variable reference, assume non-null
        return False
    
    def _extract_amplitude_user_id(self, node: ast.Call) -> EventProperties:
        """Extract user_id from Amplitude BaseEvent call."""
        if len(node.args) < 1 or not isinstance(node.args[0], ast.Call):
            return {}
            
        base_event_call = node.args[0]
        for keyword in base_event_call.keywords:
            if keyword.arg == 'user_id' and self._is_non_null_value(keyword.value):
                return {"user_id": {"type": "string"}}
        return {}
    
    def _extract_posthog_user_id(self, node: ast.Call) -> EventProperties:
        """Extract distinct_id from PostHog call if not anonymous."""
        # Check if event is anonymous by looking for $process_person_profile: False
        props_node = self._get_properties_node(node, 'posthog')
        
        if props_node and isinstance(props_node, ast.Dict):
            for i, key_node in enumerate(props_node.keys):
                if (isinstance(key_node, ast.Constant) and 
                    key_node.value == '$process_person_profile'):
                    value_node = props_node.values[i]
                    if isinstance(value_node, ast.Constant) and value_node.value is False:
                        return {}  # Anonymous event
        
        # Extract distinct_id if not anonymous
        if len(node.args) > 0 and isinstance(node.args[0], ast.Constant):
            distinct_id = node.args[0].value
            if distinct_id:
                return {"distinct_id": {"type": "string"}}
        return {}
    
    def _get_properties_node(self, node: ast.Call, source: str) -> Optional[ast.Dict]:
        """Get the properties dictionary node based on the analytics source."""
        if source in ['segment', 'rudderstack', 'mixpanel']:
            # Properties are in the third argument
            if len(node.args) > 2:
                return node.args[2]
                
        elif source == 'amplitude':
            # Look for event_properties in BaseEvent
            if len(node.args) >= 1 and isinstance(node.args[0], ast.Call):
                base_event_call = node.args[0]
                for keyword in base_event_call.keywords:
                    if keyword.arg == 'event_properties' and isinstance(keyword.value, ast.Dict):
                        return keyword.value
                        
        elif source == 'custom':
            # Use configured indices where possible
            if len(node.args) > self._props_idx and isinstance(node.args[self._props_idx], ast.Dict):
                return node.args[self._props_idx]
            # Fallbacks (legacy)
            if len(node.args) >= 2 and isinstance(node.args[1], ast.Dict):
                return node.args[1]
            
        elif source == 'posthog':
            # Check named parameters first, then positional
            for keyword in node.keywords:
                if keyword.arg == 'properties' and isinstance(keyword.value, ast.Dict):
                    return keyword.value
            if len(node.args) > 2:
                return node.args[2]
                
        elif source == 'snowplow':
            # Handle StructuredEvent pattern
            if len(node.args) >= 1:
                first_arg = node.args[0]
                if isinstance(first_arg, ast.Call) and isinstance(first_arg.func, ast.Name):
                    if _safe_id(first_arg.func) == 'StructuredEvent':
                        # Return None as properties are handled differently for Snowplow
                        return None
                        
        return None
    
    def _extract_dict_properties(self, dict_node: ast.Dict, source: str) -> EventProperties:
        """Extract properties from a dictionary node."""
        properties = {}
        
        for i, key_node in enumerate(dict_node.keys):
            if isinstance(key_node, ast.Constant) and hasattr(key_node, 'value'):
                key = key_node.value
                value_node = dict_node.values[i]
                
                # Special handling for PostHog $set and $set_once
                if source == 'posthog' and key in ['$set', '$set_once']:
                    if isinstance(value_node, ast.Dict):
                        nested_props = self.extract_nested_dict(value_node)
                        for nested_key, nested_value in nested_props.items():
                            properties[f"{key}.{nested_key}"] = nested_value
                    continue
                
                # Skip PostHog internal properties
                if source == 'posthog' and key == '$process_person_profile':
                    continue
                
                # Extract property type
                prop_type = self._extract_property_type(value_node)
                if prop_type:
                    properties[key] = prop_type
                    
        return properties
    
    def _extract_snowplow_properties(self, node: ast.Call) -> EventProperties:
        """Extract properties from Snowplow tracking call."""
        properties = {}
        
        # Pattern: tracker.track(StructuredEvent(...))
        if len(node.args) >= 1:
            first_arg = node.args[0]
            if isinstance(first_arg, ast.Call) and isinstance(first_arg.func, ast.Name):
                if _safe_id(first_arg.func) == 'StructuredEvent':
                    # Extract all keyword arguments except 'action'
                    for keyword in first_arg.keywords:
                        if keyword.arg and keyword.arg != 'action':
                            # Map property_ to property for consistency
                            prop_name = 'property' if keyword.arg == 'property_' else keyword.arg
                            prop_type = self._extract_property_type(keyword.value)
                            if prop_type:
                                properties[prop_name] = prop_type
                                
        return properties
    
    def _extract_property_type(self, value_node: ast.AST) -> Optional[Dict[str, Any]]:
        """Extract the type information for a property value."""
        if isinstance(value_node, ast.Constant):
            value_type = self.get_value_type(value_node.value)
            return {"type": value_type}
            
        elif isinstance(value_node, ast.Name):
            # Check if we know the type of this variable
            var_name = value_node.id
            if var_name in self.var_types:
                var_type = self.var_types[var_name]
                if isinstance(var_type, dict):
                    return var_type
                else:
                    return {"type": var_type}
            else:
                return {"type": "any"}
                
        elif isinstance(value_node, ast.Dict):
            # Nested dictionary
            nested_props = self.extract_nested_dict(value_node)
            return {
                "type": "object",
                "properties": nested_props
            }
            
        elif isinstance(value_node, (ast.List, ast.Tuple)):
            # Array/list/tuple
            item_type = self.infer_sequence_item_type(value_node)
            return {
                "type": "array",
                "items": item_type
            }
            
        return None
    
    def infer_sequence_item_type(self, seq_node: Union[ast.List, ast.Tuple]) -> Dict[str, str]:
        """
        Analyze a sequence (list or tuple) to determine the type of its items.
        
        Args:
            seq_node: The list or tuple AST node
            
        Returns:
            Dictionary representing the item type
        """
        if not hasattr(seq_node, 'elts') or not seq_node.elts:
            return {"type": "any"}
        
        # Get types of all elements
        element_types = []
        for element in seq_node.elts:
            if isinstance(element, ast.Constant):
                element_types.append(self.get_value_type(element.value))
            elif isinstance(element, ast.Name):
                if element.id in self.var_types:
                    var_type = self.var_types[element.id]
                    element_types.append(var_type if isinstance(var_type, str) else "any")
                else:
                    element_types.append("any")
            elif isinstance(element, ast.Dict):
                element_types.append("object")
            elif isinstance(element, (ast.List, ast.Tuple)):
                element_types.append("array")
            else:
                element_types.append("any")
        
        # Determine the common type
        unique_types = set(element_types)
        
        if len(unique_types) == 1:
            return {"type": element_types[0]}
        elif unique_types <= {"number", "string"}:
            # Common mixed case - numbers and strings
            return {"type": "string"}
        elif unique_types <= {"number", "boolean"}:
            # Numbers and booleans
            return {"type": "number"}
        else:
            # Mixed types
            return {"type": "any"}
    
    def extract_nested_dict(self, dict_node: ast.Dict) -> EventProperties:
        """
        Extract properties from a nested dictionary.
        
        Args:
            dict_node: The dictionary AST node
            
        Returns:
            Dictionary of properties with their types
        """
        nested_props = {}
        
        for i, key_node in enumerate(dict_node.keys):
            if isinstance(key_node, ast.Constant) and hasattr(key_node, 'value'):
                key = key_node.value
                value_node = dict_node.values[i]
                
                prop_type = self._extract_property_type(value_node)
                if prop_type:
                    nested_props[key] = prop_type
                    
        return nested_props
    
    def get_value_type(self, value: Any) -> str:
        """
        Determine the JSON Schema type for a Python value.
        
        Args:
            value: The Python value
            
        Returns:
            String representing the JSON Schema type
        """
        if isinstance(value, bool):
            return "boolean"
        elif isinstance(value, str):
            return "string"
        elif isinstance(value, (int, float)):
            return "number"
        elif value is None:
            return "null"
        return "any"

def analyze_python_code(code: str, filepath: str, custom_config: Optional[any] = None) -> str:
    """
    Analyze Python code for analytics tracking calls.

    The function supports either a single custom configuration object or a list
    of such objects, allowing detection of multiple custom tracking functions
    without parsing the source code multiple times.

    Args:
        code: The Python source code to analyze
        filepath: Path to the file being analyzed
        custom_config: None, a single custom config dict, or a list of configs

    Returns:
        JSON string containing array of tracking events
    """
    try:
        # Parse the Python code only once
        tree = ast.parse(code)

        events: List[AnalyticsEvent] = []

        def run_visitor(cfg: Optional[dict]) -> None:
            vis = TrackingVisitor(filepath, cfg)
            vis.visit(tree)
            events.extend(vis.events)

        # Built-in providers pass (no custom config)
        run_visitor(None)

        # Handle list or single custom configuration
        if custom_config:
            if isinstance(custom_config, list):
                for cfg in custom_config:
                    if cfg:
                        run_visitor(cfg)
            else:
                run_visitor(custom_config)  # single config for backward compat

        # Deduplicate events (source|eventName|line|functionName)
        unique: Dict[str, AnalyticsEvent] = {}
        for evt in events:
            key = f"{evt['source']}|{evt['eventName']}|{evt['line']}|{evt['functionName']}"
            if key not in unique:
                unique[key] = evt

        return json.dumps(list(unique.values()))

    except Exception:
        # Return empty array on failure
        return json.dumps([])

# Command-line interface
if __name__ == "__main__":
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Analyze Python code for analytics tracking calls',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example: %(prog)s myapp.py [--custom-function track_event]"
    )
    parser.add_argument('file', help='Python file to analyze')
    parser.add_argument(
        '-c', '--custom-function',
        help='Name of custom tracking function to detect'
    )
    args = parser.parse_args()
    
    try:
        with open(args.file, 'r') as f:
            code = f.read()
        result = analyze_python_code(code, args.file, args.custom_function)
        print(result)
    except FileNotFoundError:
        print(f"Error: File '{args.file}' not found", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error analyzing file: {str(e)}", file=sys.stderr)
        sys.exit(1)
