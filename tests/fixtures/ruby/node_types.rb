# frozen_string_literal: true

module NodeTypesExample
  def unless_example(flag)
    unless flag
      CustomModule.track('user1', 'UnlessEvent', { a: 1 })
    end
  end

  def while_example
    i = 0
    while i < 1
      CustomModule.track('user1', 'WhileEvent', { b: 2 })
      i += 1
    end
  end
end

for x in [1, 2]
  CustomModule.track('user1', 'ForEvent', { c: 3 })
end

begin
  raise 'error'
rescue
  CustomModule.track('user1', 'RescueEvent', { d: 4 })
ensure
  CustomModule.track('user1', 'EnsureEvent', { e: 5 })
end

lambda_example = -> {
  CustomModule.track('user1', 'LambdaEvent', { f: 6 })
}

["hi", CustomModule.track('user1', 'ArrayEvent', { g: 7 })]

CustomModule.track('user1', 'AndEvent', { h: 8 }) && true
false || CustomModule.track('user1', 'OrEvent', { i: 9 })

string = "test \\#{CustomModule.track('user1', 'InterpolationEvent', { j: 10 })}"
