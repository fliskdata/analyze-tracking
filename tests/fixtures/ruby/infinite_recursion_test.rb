# Test case for infinite recursion bug
# This file contains complex nested structures that trigger the generic fallback
# mechanism in AST traversal and could cause infinite loops without proper safeguards

class ComplexNestedClass
  # Deep nesting with various control structures
  def complex_method(param)
    result = case param
             when :option_a
               begin
                 loop do
                   next if rand > 0.5
                   break if rand > 0.8
                   
                   # Tracking call buried deep in nested structure
                   CustomModule.track('user123', 'DeepNestedEvent', {
                     level: 'deep',
                     iteration: rand(100)
                   })
                 end
               rescue StandardError => e
                 retry if e.class == RuntimeError
                 raise
               end
             when :option_b
               # Complex conditional with nested blocks
               if defined?(SomeConstant)
                 proc do |x|
                   lambda do |y|
                     [1, 2, 3].each_with_object({}) do |item, hash|
                       hash[item] = yield(item) if block_given?
                       
                       # Another tracking call in nested lambda
                       CustomModule.track('user456', 'LambdaEvent', {
                         item: item,
                         hash_size: hash.size
                       })
                     end
                   end
                 end
               end
             else
               # Deeply nested hash and array structures
               {
                 level1: {
                   level2: {
                     level3: [
                       { nested: true },
                       -> { CustomModule.track('user789', 'ArrayLambdaEvent', { deeply_nested: true }) }
                     ]
                   }
                 }
               }
             end
    
    # Complex string interpolation that could cause parsing issues
    complex_string = "Result: #{result.inspect} - #{
      begin
        CustomModule.track('user000', 'InterpolationEvent', {
          result_type: result.class.name,
          timestamp: Time.now.to_i
        })
        'tracked'
      rescue
        'failed'
      end
    }"
    
    result
  end
  
  # Method with complex pattern matching (if supported)
  def pattern_matching_method(data)
    case data
    in { type: 'user', id: String => user_id, metadata: Hash => meta }
      CustomModule.track(user_id, 'PatternMatchEvent', meta)
    in Array => items if items.length > 5
      items.each_with_index do |item, index|
        CustomModule.track("bulk_user_#{index}", 'BulkEvent', { item: item })
      end
    else
      CustomModule.track('unknown', 'FallbackEvent', { data: data })
    end
  end
end

# Module with complex metaprogramming that could cause traversal issues
module MetaProgrammingModule
  def self.included(base)
    base.extend(ClassMethods)
    base.class_eval do
      define_method :dynamic_tracker do |event_name|
        CustomModule.track(self.class.name.downcase, event_name, {
          generated_at: __FILE__,
          line: __LINE__
        })
      end
    end
  end
  
  module ClassMethods
    def create_tracking_method(method_name)
      define_method(method_name) do
        CustomModule.track('class_method', method_name.to_s, {
          method_type: 'dynamic',
          class: self.class.name
        })
      end
    end
  end
end

# Class that includes the complex module
class ComplexIncludingClass
  include MetaProgrammingModule
  
  create_tracking_method(:dynamic_event)
  
  def test_method
    dynamic_tracker('DynamicEvent')
  end
end 