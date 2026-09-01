# Continuous integration

`github-actions-ci.yml` is the CI pipeline for this repository (frontend typecheck/test/build and
worker typecheck/test). It is kept here rather than in `.github/workflows/` because the automation
account that opened the pull request is not permitted to create workflow files.

To enable it, a repository maintainer only needs to move it into place and commit:

```bash
mkdir -p .github/workflows
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "Enable CI workflow"
```
