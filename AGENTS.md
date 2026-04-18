## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Agents rules

- don't override current `oxfrm` and `oxlint` configurations.
- don't disable any oxlint rules, unless:
  - the rule is not applicable to the current task
  - fixing the rule would require a change in logic and/or functionality
  - there are mismatches between libraries inferred types
- prefer React.use\* over useState, useEffect, etc.

## Final step

When finishing editing, deleting or adding any file, make sure to update the skill
`skills/etherna-sdk-js/*` with the new changes.
