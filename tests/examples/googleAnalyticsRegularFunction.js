function trackEvent() {
        gtag('event', 'conversion', {
          'send_to': 'AW-XXXXXXX/XXXXXXXXXX',
          'value': 1.0,
          'currency': 'USD'
        });
      };
trackEvent();