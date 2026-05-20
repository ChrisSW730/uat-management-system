function New-Jwt {
    param (
        [string]$username,
        [string]$displayName,
        [string]$role,
        [string]$secretKey = "DEV_ONLY_SUPER_SECRET_CHANGE_ME_1234567890",
        [string]$issuer = "UATSystem",
        [string]$audience = "UATSystem"
    )

    $header = @{ alg = "HS256"; typ = "JWT" } | ConvertTo-Json -Compress
    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
    $headerEncoded = [Convert]::ToBase64String($headerBytes).Replace('+', '-').Replace('/', '_').Replace('=', '')

    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $exp = $now + (2 * 3600)

    $payload = @{
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" = $username
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name" = $username
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role" = $role
        "display_name" = $displayName
        "iss" = $issuer
        "aud" = $audience
        "exp" = $exp
        "iat" = $now
        "nbf" = $now
    } | ConvertTo-Json -Compress
    $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $payloadEncoded = [Convert]::ToBase64String($payloadBytes).Replace('+', '-').Replace('/', '_').Replace('=', '')

    $signatureSource = "$headerEncoded.$payloadEncoded"
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($secretKey)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $keyBytes
    $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($signatureSource))
    $signatureEncoded = [Convert]::ToBase64String($signatureBytes).Replace('+', '-').Replace('/', '_').Replace('=', '')

    return "$headerEncoded.$payloadEncoded.$signatureEncoded"
}

$testerToken = New-Jwt -username "tester@nomail.com" -displayName "Tester" -role "Tester"
$leadToken = New-Jwt -username "lead@nomail.com" -displayName "Test Lead" -role "Test Lead"

$apiUrl = "http://localhost:5176"
$apiProcess = $null

try {
    Invoke-WebRequest -Uri "$apiUrl/health" -Method Get -ErrorAction Stop | Out-Null
    Write-Host "API is already running."
} catch {
    Write-Host "Starting API..."
    $apiProcess = Start-Process dotnet -ArgumentList "run", "--urls", $apiUrl -WorkingDirectory "C:\Users\chris.ng\UATSystem\UATSystem.API" -PassThru
    $startWait = Get-Date
    while ($true) {
        try {
            Invoke-WebRequest -Uri "$apiUrl/api/users" -Method Get -Headers @{Authorization="Bearer $testerToken"} -ErrorAction Stop | Out-Null
            Write-Host "API started."
            break
        } catch {
            if ((Get-Date) -gt $startWait.AddSeconds(60)) {
                throw "API failed to start within 60 seconds."
            }
            Start-Sleep -Seconds 2
        }
    }
}

$testerHeaders = @{ Authorization = "Bearer $testerToken"; "Content-Type" = "application/json" }
$leadHeaders = @{ Authorization = "Bearer $leadToken"; "Content-Type" = "application/json" }

# Test Runs Comments
try {
    $runs = Invoke-RestMethod -Uri "$apiUrl/api/testruns" -Method Get -Headers $testerHeaders
    if ($runs.Count -eq 0 -or $runs[0].entries.Count -eq 0) {
        Write-Host "SKIP: No test runs or entries found."
    } else {
        $runId = $runs[0].id
        $testCaseId = $runs[0].entries[0].testCaseId
        $msg = "Comment at " + (Get-Date).ToString("yyyyMMddHHmmss")
        
        $postComment = Invoke-RestMethod -Uri "$apiUrl/api/testruns/$runId/entries/$testCaseId/comments" -Method Post -Headers $testerHeaders -Body ($msg | ConvertTo-Json)
        
        $runDetails = Invoke-RestMethod -Uri "$apiUrl/api/testruns/$runId" -Method Get -Headers $leadHeaders
        $entry = $runDetails.entries | Where-Object { $_.testCaseId -eq $testCaseId }
        $comment = $entry.comments | Where-Object { $_.text -eq $msg }
        
        if ($comment -and $comment.author -eq "Tester") {
            Write-Host "PASS: TestRun Comment created and verified. ID: $($comment.id), Author: $($comment.author)"
            $delResp = Invoke-WebRequest -Uri "$apiUrl/api/testruns/$runId/entries/$testCaseId/comments/$($comment.id)" -Method Delete -Headers $leadHeaders
            if ($delResp.StatusCode -eq 204) {
                 Write-Host "PASS: TestRun Comment deleted. Status: 204"
            } else {
                 Write-Host "FAIL: TestRun Comment deletion returned $($delResp.StatusCode)"
            }
        } else {
            Write-Host "FAIL: TestRun Comment not found or author mismatch."
        }
    }
} catch {
    Write-Host "ERROR in Test Runs section: $_"
}

# Defects Comments
try {
    $defects = Invoke-RestMethod -Uri "$apiUrl/api/defects" -Method Get -Headers $testerHeaders
    if ($defects.Count -eq 0) {
        Write-Host "SKIP: No defects found."
    } else {
        $defectId = $defects[0].id
        $msg = "Defect Comment at " + (Get-Date).ToString("yyyyMMddHHmmss")
        
        $postComment = Invoke-RestMethod -Uri "$apiUrl/api/defects/$defectId/comments" -Method Post -Headers $testerHeaders -Body ($msg | ConvertTo-Json)
        
        $defectsLead = Invoke-RestMethod -Uri "$apiUrl/api/defects" -Method Get -Headers $leadHeaders
        $defectDetails = $defectsLead | Where-Object { $_.id -eq $defectId }
        $comment = $defectDetails.comments | Where-Object { $_.text -eq $msg }

        if ($comment -and $comment.author -eq "Tester") {
            Write-Host "PASS: Defect Comment created and verified. ID: $($comment.id), Author: $($comment.author)"
            $delResp = Invoke-WebRequest -Uri "$apiUrl/api/defects/$defectId/comments/$($comment.id)" -Method Delete -Headers $leadHeaders
            if ($delResp.StatusCode -eq 204) {
                 Write-Host "PASS: Defect Comment deleted. Status: 204"
            } else {
                 Write-Host "FAIL: Defect Comment deletion returned $($delResp.StatusCode)"
            }
        } else {
            Write-Host "FAIL: Defect Comment not found or author mismatch."
        }
    }
} catch {
    Write-Host "ERROR in Defects section: $_"
}

if ($apiProcess) {
    Stop-Process $apiProcess
    Write-Host "API stopped."
}
