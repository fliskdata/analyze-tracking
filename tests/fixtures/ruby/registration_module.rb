module User
  module Registration
    def post_registration(case: nil)
      context_case = case || OpenStruct.new(kind: 'TestCase')

      case context_case.kind
      when 'TestCase'
        # Tracking event that was previously missed
        CustomModule.track(id, 'BecameLead', {
          leadType: 'EMAIL_CAPTURED',
          nonInteraction: 1
        })
      when 'OtherKind'
        # no-op
      else
        # nothing
      end
    end
  end
end
