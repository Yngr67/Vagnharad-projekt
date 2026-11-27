export type ParsedActivity = {
  activityCode: string;
  name: string;
  wbsPath: string[];
  remainingDays: number | null;
  startDate: string | null;
  finishDate: string | null;
  startActual: boolean;
  finishActual: boolean;
  constrained: boolean;
  isMilestone: boolean;
};

export type ParsedSchedule = {
  projectCode: string;
  dataDate: string;
  baselineName: string | null;
  printDate: string | null;
  activities: ParsedActivity[];
  unparsedLines: string[];
};
