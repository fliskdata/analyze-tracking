module ExternalConstantExample
  def trigger
    CustomModule.track(123, TelemetryHelper::EXTERNAL_SECTION, {})
  end
end 