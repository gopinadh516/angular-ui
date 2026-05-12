export interface ArFollowupListSummary {
  listNumber: number;
  listName: string;
  currentOwner?: string | null;
  assignedTo?: string | null;
  selectedAssignee?: string | null;
  listAction?: string | null;
  filterSummary?: string | null;

  totalClaimCount: number;
  workedCount?: number | null;

  // New backend field:
  // Untouched = no status/action saved even once
  untouchedCount?: number | null;

  // Existing field:
  // For Followup = show_ara = 1 count
  arFollowupCount: number;

  codingAssistanceCount: number;
  paymentAssistanceCount: number;
  chargeAssistanceCount: number;
  clientAssistanceCount: number;

  visibleClaimCount?: number | null;
}

export interface RevMaxUserDTO {
  email: string;
  fullName: string;
  status: number;
}