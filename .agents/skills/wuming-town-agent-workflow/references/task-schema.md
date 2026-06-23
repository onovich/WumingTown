# Task schema summary

Required fields:

- id, title, summary, state
- ownerRole, reviewerRole
- dependsOn[]
- docs[]
- acceptance[]
- requiredChecks[]
- branch
- createdAt, updatedAt, history[]

Optional runtime fields:

- claimedBy, threadLabel, reportPath, review, integration, blocker

Do not manually mutate a task state unless repairing a corrupted coordination file. Use taskctl to preserve history and messages.
