module TelemetryHelper
  FINISHED_SECTION = '_FinishedSection'.freeze
end

module ConstantEventExample
  def send_event(kase)
    data = { foo: 'bar' }
    CustomModule.track(kase.id, TelemetryHelper::FINISHED_SECTION, data)
  end
end 