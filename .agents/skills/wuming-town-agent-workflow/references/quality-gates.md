# Quality gates

Before review request:

- acceptance criteria addressed
- required checks run and recorded
- tests added for behavior or regression
- relevant docs and schemas updated
- no unexplained performance regression
- task report exists

Before verification:

- independent reviewer inspected real diff and evidence
- no unresolved high or medium findings
- persistence/determinism/security impact considered

Before integration:

- branch rebased or conflicts resolved intentionally
- full applicable CI gate passes
- integration report includes commit and performance/save impact
