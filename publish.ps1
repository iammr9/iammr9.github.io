# Publishes the bio page to https://iammr9.github.io
# Stamps a new version on style.css / config.js / script.js so browsers fetch the new files
# instead of the copy they cached (GitHub Pages lets browsers keep files for 10 minutes).
#   powershell -ExecutionPolicy Bypass -File publish.ps1 "what changed"
param([string]$Message = 'Update bio page')
Set-Location $PSScriptRoot
$v = Get-Date -Format 'yyyyMMddHHmmss'
$path = Join-Path $PSScriptRoot 'index.html'
$html = [IO.File]::ReadAllText($path)
$html = [regex]::Replace($html, '(style\.css|config\.js|script\.js)(\?v=\d+)?', "`$1?v=$v")
[IO.File]::WriteAllText($path, $html, (New-Object Text.UTF8Encoding $false))
git add -A
git commit -q -m $Message
git push -q 2>&1 | Out-Null
Write-Host "Published version $v. Live at https://iammr9.github.io in about 30 seconds."
