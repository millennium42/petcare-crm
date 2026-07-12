$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$wslRepo = (& wsl.exe -d Ubuntu -e wslpath -a $repo).Trim()
if (-not $wslRepo) { throw 'Could not resolve the repository path in WSL.' }
& wsl.exe -d Ubuntu -e bash -lc "cd '$wslRepo' && bash scripts/validate.sh"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
