import ast
import json

class TrackingVisitor(ast.NodeVisitor):
    def __init__(self, filepath):
        self.events = []
        self.filepath = filepath
        self.current_function = 'global'
        self.function_stack = []
        # Track variable types in the current scope
        self.var_types = {}
        # Stack of variable type scopes
        self.var_types_stack = []
        
    def visit_FunctionDef(self, node):
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
    
    def extract_type_annotation(self, annotation):
        """Extract type information from a type annotation node"""
        if isinstance(annotation, ast.Name):
            # Simple types like int, str, bool
            type_name = annotation.id
            if type_name == 'int' or type_name == 'float':
                return 'number'
            elif type_name == 'str':
                return 'string'
            elif type_name == 'bool':
                return 'boolean'
            elif type_name == 'None' or type_name == 'NoneType':
                return 'null'
            # Could add more type mappings here
        elif isinstance(annotation, ast.Subscript):
            # Handle generic types like List[int], Dict[str, int]
            if hasattr(annotation.value, 'id'):
                container_type = annotation.value.id
                if container_type in ('List', 'Tuple', 'Set', 'list', 'tuple', 'set'):
                    # Try to get the type parameter
                    if isinstance(annotation.slice, ast.Name):
                        element_type = self.extract_type_annotation(annotation.slice)
                        return {
                            'type': 'array',
                            'items': {'type': element_type}
                        }
                    return 'array'
                elif container_type in ('Dict', 'dict'):
                    return 'object'
        # Default for unknown or complex types
        return 'any'
    
    def visit_AnnAssign(self, node):
        """Visit variable assignments with type annotations"""
        if isinstance(node.target, ast.Name) and node.annotation:
            # Store the type annotation for this variable
            self.var_types[node.target.id] = self.extract_type_annotation(node.annotation)
        self.generic_visit(node)
    
    def visit_Assign(self, node):
        """Visit regular assignments to track simple type inferences"""
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            var_name = node.targets[0].id
            # Try to infer type from literal values
            if isinstance(node.value, ast.Constant):
                self.var_types[var_name] = self.get_value_type(node.value.value)
        self.generic_visit(node)
        
    def visit_ClassDef(self, node):
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
    
    def visit_Call(self, node):
        # Check for analytics tracking calls
        source = self.detect_source(node)
        if source:
            event_name = self.extract_event_name(node, source)
            if event_name:
                properties = self.extract_properties(node, source)
                self.events.append({
                    "eventName": event_name,
                    "source": source,
                    "properties": properties,
                    "filePath": self.filepath,
                    "line": node.lineno,
                    "functionName": self.current_function
                })
        
        # Continue visiting child nodes
        self.generic_visit(node)
    
    def detect_source(self, node):
        # Check for analytics tracking libraries
        if isinstance(node.func, ast.Attribute):
            if hasattr(node.func.value, 'id'):
                obj_id = node.func.value.id
                method_name = node.func.attr
                
                # Segment analytics
                if obj_id == 'analytics' and method_name == 'track':
                    return 'segment'
                # Mixpanel
                if obj_id == 'mixpanel' and method_name == 'track':
                    return 'mixpanel'
                # Amplitude
                if obj_id == 'amplitude' and method_name == 'track':
                    return 'amplitude'
                # Rudderstack
                if obj_id == 'rudderanalytics' and method_name == 'track':
                    return 'rudderstack'
                # mParticle
                if obj_id == 'mParticle' and method_name == 'logEvent':
                    return 'mparticle'
                # PostHog
                if obj_id == 'posthog' and method_name == 'capture':
                    return 'posthog'
                # Pendo
                if obj_id == 'pendo' and method_name == 'track':
                    return 'pendo'
                # Heap
                if obj_id == 'heap' and method_name == 'track':
                    return 'heap'
        
        # Check for Snowplow struct event patterns
        if isinstance(node.func, ast.Name) and node.func.id in ['trackStructEvent', 'buildStructEvent']:
            return 'snowplow'
        
        # Check for Snowplow's snowplow('trackStructEvent', {...}) pattern
        if isinstance(node.func, ast.Name) and node.func.id == 'snowplow':
            if len(node.args) >= 1 and isinstance(node.args[0], ast.Constant):
                if node.args[0].value == 'trackStructEvent':
                    return 'snowplow'
        
        return None
    
    def extract_event_name(self, node, source):
        try:
            if source in ['segment', 'mixpanel', 'amplitude', 'rudderstack', 'pendo', 'heap']:
                # Standard format: library.track('event_name', {...})
                if len(node.args) >= 1 and isinstance(node.args[0], ast.Constant):
                    return node.args[0].value
            
            elif source == 'mparticle':
                # mParticle: mParticle.logEvent('event_name', {...})
                if len(node.args) >= 1 and isinstance(node.args[0], ast.Constant):
                    return node.args[0].value
            
            elif source == 'posthog':
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
            
            elif source == 'snowplow':
                # Snowplow struct events use 'action' as the event name
                if len(node.args) >= 1:
                    # Handle different snowplow call patterns
                    props_node = None
                    
                    # Direct trackStructEvent/buildStructEvent call
                    if isinstance(node.func, ast.Name) and node.func.id in ['trackStructEvent', 'buildStructEvent']:
                        if len(node.args) >= 1:
                            props_node = node.args[0]
                    
                    # snowplow('trackStructEvent', {...}) pattern
                    elif isinstance(node.func, ast.Name) and node.func.id == 'snowplow':
                        if len(node.args) >= 2:
                            props_node = node.args[1]
                    
                    # Extract 'action' from properties
                    if props_node and isinstance(props_node, ast.Dict):
                        for i, key_node in enumerate(props_node.keys):
                            if isinstance(key_node, ast.Constant) and key_node.value == 'action':
                                value_node = props_node.values[i]
                                if isinstance(value_node, ast.Constant):
                                    return value_node.value
        except:
            pass
        return None
    
    def extract_properties(self, node, source):
        properties = {}
        try:
            props_node = None
            
            # Get the properties object based on source
            if source in ['segment', 'mixpanel', 'amplitude', 'rudderstack', 'mparticle', 'pendo', 'heap']:
                # Standard format: library.track('event_name', {properties})
                if len(node.args) > 1:
                    props_node = node.args[1]
            
            elif source == 'posthog':
                # PostHog has multiple formats
                is_anonymous = False
                distinct_id = None
                
                # Check for properties in named parameters first
                for keyword in node.keywords:
                    if keyword.arg == 'properties' and isinstance(keyword.value, ast.Dict):
                        props_node = keyword.value
                        
                        # Check if event is anonymous
                        for i, key_node in enumerate(props_node.keys):
                            if (isinstance(key_node, ast.Constant) and 
                                key_node.value == '$process_person_profile'):
                                value_node = props_node.values[i]
                                if (isinstance(value_node, ast.Constant) and 
                                    value_node.value is False):
                                    is_anonymous = True
                
                # If no named properties, check positional args (third arg)
                if props_node is None and len(node.args) > 2:
                    props_node = node.args[2]
                
                # Add distinct_id as property if it exists and event is not anonymous
                if not is_anonymous and len(node.args) > 0 and isinstance(node.args[0], ast.Constant):
                    distinct_id = node.args[0].value
                    if distinct_id:
                        properties["distinct_id"] = {"type": "string"}
            
            elif source == 'snowplow':
                # For Snowplow struct events
                if isinstance(node.func, ast.Name) and node.func.id in ['trackStructEvent', 'buildStructEvent']:
                    if len(node.args) >= 1:
                        props_node = node.args[0]
                
                # snowplow('trackStructEvent', {...}) pattern
                elif isinstance(node.func, ast.Name) and node.func.id == 'snowplow':
                    if len(node.args) >= 2:
                        props_node = node.args[1]
            
            # Extract properties from the dictionary
            if props_node and isinstance(props_node, ast.Dict):
                for i, key_node in enumerate(props_node.keys):
                    if isinstance(key_node, ast.Constant) and hasattr(key_node, 'value'):
                        key = key_node.value
                        value_node = props_node.values[i]
                        
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
                        
                        # Handle different value types
                        if isinstance(value_node, ast.Constant):
                            value_type = self.get_value_type(value_node.value)
                            properties[key] = {"type": value_type}
                        elif isinstance(value_node, ast.Name):
                            # Check if we know the type of this variable
                            var_name = value_node.id
                            if var_name in self.var_types:
                                properties[key] = {"type": self.var_types[var_name]}
                            else:
                                properties[key] = {"type": "any"}
                        elif isinstance(value_node, ast.Dict):
                            # Nested dictionary
                            nested_props = self.extract_nested_dict(value_node)
                            properties[key] = {
                                "type": "object",
                                "properties": nested_props
                            }
                        elif isinstance(value_node, ast.List) or isinstance(value_node, ast.Tuple):
                            # Array/list/tuple
                            item_type = self.infer_sequence_item_type(value_node)
                            properties[key] = {
                                "type": "array",
                                "items": item_type
                            }
        except:
            pass
        return properties
    
    def infer_sequence_item_type(self, seq_node):
        """Analyze a sequence (list or tuple) to determine the type of its items"""
        if not hasattr(seq_node, 'elts') or not seq_node.elts:
            return {"type": "any"}
        
        # Get types of all elements
        element_types = []
        for element in seq_node.elts:
            if isinstance(element, ast.Constant):
                element_types.append(self.get_value_type(element.value))
            elif isinstance(element, ast.Name):
                if element.id in self.var_types:
                    element_types.append(self.var_types[element.id])
                else:
                    element_types.append("any")
            elif isinstance(element, ast.Dict):
                element_types.append("object")
            elif isinstance(element, ast.List) or isinstance(element, ast.Tuple):
                element_types.append("array")
            else:
                element_types.append("any")
        
        # Check if all elements are the same type
        if len(set(element_types)) == 1:
            return {"type": element_types[0]}
        
        # Check if all types are either number or string (common mixed case)
        if set(element_types) <= {"number", "string"}:
            return {"type": "string"}
        
        # Check if all types are either number or boolean
        if set(element_types) <= {"number", "boolean"}:
            return {"type": "number"}
        
        # Otherwise, it's a mixed type array
        return {"type": "any"}
    
    def extract_nested_dict(self, dict_node):
        nested_props = {}
        for i, key_node in enumerate(dict_node.keys):
            if isinstance(key_node, ast.Constant) and hasattr(key_node, 'value'):
                key = key_node.value
                value_node = dict_node.values[i]
                
                if isinstance(value_node, ast.Constant):
                    value_type = self.get_value_type(value_node.value)
                    nested_props[key] = {"type": value_type}
                elif isinstance(value_node, ast.Name):
                    # Check if we know the type of this variable
                    var_name = value_node.id
                    if var_name in self.var_types:
                        nested_props[key] = {"type": self.var_types[var_name]}
                    else:
                        nested_props[key] = {"type": "any"}
                elif isinstance(value_node, ast.Dict):
                    sub_props = self.extract_nested_dict(value_node)
                    nested_props[key] = {
                        "type": "object",
                        "properties": sub_props
                    }
                elif isinstance(value_node, ast.List) or isinstance(value_node, ast.Tuple):
                    # Array/list/tuple
                    item_type = self.infer_sequence_item_type(value_node)
                    nested_props[key] = {
                        "type": "array",
                        "items": item_type
                    }
        return nested_props
    
    def get_value_type(self, value):
        if isinstance(value, str):
            return "string"
        elif isinstance(value, (int, float)):
            return "number"
        elif isinstance(value, bool):
            return "boolean"
        elif value is None:
            return "null"
        return "any"

def analyze_python_code(code, filepath):
    # Parse the Python code
    tree = ast.parse(code)
    visitor = TrackingVisitor(filepath)
    visitor.visit(tree)
    
    # Return events as JSON
    return json.dumps(visitor.events) 

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python pythonTrackingAnalyzer.py <python_file>")
        sys.exit(1)
        
    filepath = sys.argv[1]
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        result = analyze_python_code(code, filepath)
        print(result)
    except FileNotFoundError:
        print(f"Error: File '{filepath}' not found")
        sys.exit(1)
    except Exception as e:
        print(f"Error analyzing file: {str(e)}")
        sys.exit(1)
