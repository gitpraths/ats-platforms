/**
 * Job status transition validation.
 *
 * Valid transitions:
 *   draft      → published
 *   published  → draft | archived
 *   archived   → published
 */

const TRANSITIONS = {
  draft:     ["published"],
  published: ["draft", "archived"],
  archived:  ["published"],
};

/**
 * Validates that a job status transition is allowed.
 *
 * @param {string} currentStatus - The job's current status.
 * @param {string} nextStatus    - The requested new status.
 * @throws {Error} with `.status = 422` if the transition is invalid.
 */
export function validateJobStatusTransition(currentStatus, nextStatus) {
  const allowed = TRANSITIONS[currentStatus];
  if (!allowed) {
    const err = new Error(`Unknown current status: "${currentStatus}".`);
    err.status = 422;
    throw err;
  }
  if (!allowed.includes(nextStatus)) {
    const err = new Error(
      `Cannot transition job from "${currentStatus}" to "${nextStatus}". ` +
      `Allowed transitions from "${currentStatus}": ${allowed.join(", ")}.`
    );
    err.status = 422;
    throw err;
  }
}

/**
 * Returns the list of statuses that a job can transition to from its current status.
 *
 * @param {string} currentStatus
 * @returns {string[]}
 */
export function allowedNextStatuses(currentStatus) {
  return TRANSITIONS[currentStatus] ?? [];
}
