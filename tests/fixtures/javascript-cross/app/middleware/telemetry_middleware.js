import { TELEMETRY_EVENTS } from 'lib/constants';

function getTelemetryService() {
  return {
    track: (_evt, _props) => {}
  };
}

export function beforePanelChange(sectionName) {
  getTelemetryService().track(TELEMETRY_EVENTS.FINISHED_SECTION, {
    SectionName: sectionName,
  });
}

export function afterPanelChange(panelName, sectionName) {
  getTelemetryService().track(TELEMETRY_EVENTS.VIEWED_QUESTION, {
    QuestionName: panelName,
    SectionName: sectionName
  });
}


