def user_registration
  actor_data = {
    createdByAdminEmail: 'admin@example.com',
    _email: 'user@example.com',
    emailOptIn: true
  }.compact

  TrackingModule.track(
    123,
    'RegisteredUser',
    actor_data
  )
end
