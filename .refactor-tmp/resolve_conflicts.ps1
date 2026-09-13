$ErrorActionPreference = 'Stop'

$conflictedFiles = @(
    'CHANGELOG.md',
    'README.md',
    'index.html',
    'plugins/README.md',
    'plugins/nai-batch-updater.js'
)

foreach ($relativePath in $conflictedFiles) {
    $fullPath = Join-Path $PSScriptRoot '..' $relativePath
    $lines = [System.IO.File]::ReadAllLines($fullPath)
    $result = [System.Collections.Generic.List[string]]::new()
    $state = 'normal'

    foreach ($line in $lines) {
        if ($line.StartsWith('<<<<<<< ')) {
            if ($state -ne 'normal') { throw "Nested conflict in $relativePath" }
            $state = 'ours'
            continue
        }
        if ($line -eq '=======') {
            if ($state -ne 'ours') { throw "Unexpected separator in $relativePath" }
            $state = 'theirs'
            continue
        }
        if ($line.StartsWith('>>>>>>> ')) {
            if ($state -ne 'theirs') { throw "Unexpected conflict end in $relativePath" }
            $state = 'normal'
            continue
        }
        if ($state -ne 'theirs') {
            $result.Add($line)
        }
    }

    if ($state -ne 'normal') { throw "Unclosed conflict in $relativePath" }
    [System.IO.File]::WriteAllLines($fullPath, $result, [System.Text.UTF8Encoding]::new($false))
}
