module TestModule
  def send_telemetry(obj)
    data = {
      sectionName: section_name,
      questionnaireName: 'Address',
      registered: obj.user.registered?,
      eligible: !obj.ineligible?,
      nonInteraction: 1
    }

    CustomModule.track(obj.user_id, TrackingHelper::ANSWERED_QUESTION, data)
  end

  def section_name
    'TestModule'
  end
end
