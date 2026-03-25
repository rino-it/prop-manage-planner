param(
    [string]$msg = "chore: update"
)

git checkout -- prop-manage-planner-main/.env 2>$null
git add -A
git commit -m $msg
git push origin main
