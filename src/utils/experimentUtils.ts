import { Reservation, ExperimentDetails } from '../types';

/**
 * Normalises whatever experiment details a reservation actually carries.
 *
 * This used to keyword-match the subject line and invent a plausible materials
 * list, group count and worksheet quantity for any reservation that had none.
 * Those invented numbers flowed straight into the admin statistics, the CSV
 * export and the printed requisition form, so the technician was preparing
 * chemicals nobody had asked for. Missing data now reads as missing.
 */
export function getEffectiveExperimentDetails(res: Reservation): ExperimentDetails {
  const details = res.experimentDetails;

  return {
    experimentName: details?.experimentName?.trim() || res.subject?.trim() || '',
    materialsNeeded: details?.materialsNeeded?.trim() || '',
    numberOfGroups: details?.numberOfGroups ?? 0,
    needsTechSupport: details?.needsTechSupport ?? false,
    safetyItems: details?.safetyItems ?? [],
    techNotes: details?.techNotes?.trim() || '',
    needsPrintedWorksheets: details?.needsPrintedWorksheets ?? false,
    worksheetCopies: details?.needsPrintedWorksheets ? details?.worksheetCopies ?? 0 : 0,
    fileName: details?.fileName || '',
    fileUrl: details?.fileUrl || ''
  };
}

export const NOT_SPECIFIED = 'Not specified';
