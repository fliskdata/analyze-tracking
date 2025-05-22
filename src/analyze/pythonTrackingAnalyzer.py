import ast
import json

class TrackingVisitor(ast.NodeVisitor):
    def __init__(self, filepath):
        self.events = []
        self.filepath = filepath
        self.current_function = 'global'
        self.function_stack = []
        
    def visit_FunctionDef(self, node):
        # Save previous function context
        self.function_stack.append(self.current_function)
        self.current_function = node.name
        # Visit children
        self.generic_visit(node)
        # Restore function context
        self.current_function = self.function_stack.pop()
        
    def visit_ClassDef(self, node):
        # Track class context for methods
        class_name = node.name
        self.function_stack.append(self.current_function)
        self.current_function = class_name
        self.generic_visit(node)
        self.current_function = self.function_stack.pop()
    
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
                        elif isinstance(value_node, ast.Dict):
                            # Nested dictionary
                            nested_props = self.extract_nested_dict(value_node)
                            properties[key] = {
                                "type": "object",
                                "properties": nested_props
                            }
                        elif isinstance(value_node, ast.List):
                            # Array/list
                            properties[key] = {
                                "type": "array",
                                "items": {"type": "any"}
                            }
        except:
            pass
        return properties
    
    def extract_nested_dict(self, dict_node):
        nested_props = {}
        for i, key_node in enumerate(dict_node.keys):
            if isinstance(key_node, ast.Constant) and hasattr(key_node, 'value'):
                key = key_node.value
                value_node = dict_node.values[i]
                
                if isinstance(value_node, ast.Constant):
                    value_type = self.get_value_type(value_node.value)
                    nested_props[key] = {"type": value_type}
                elif isinstance(value_node, ast.Dict):
                    sub_props = self.extract_nested_dict(value_node)
                    nested_props[key] = {
                        "type": "object",
                        "properties": sub_props
                    }
                elif isinstance(value_node, ast.List):
                    nested_props[key] = {
                        "type": "array",
                        "items": {"type": "any"}
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
