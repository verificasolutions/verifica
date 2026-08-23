param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$OutputDir = "data/receita-cnpj/qualified",
  [string]$Cnaes = "4520001,4520002,4520003,4520004,4520005,4520006,4520007,4520008,4543900",
  [string]$Uf = "",
  [int]$BatchSize = 50,
  [int]$Limit = 1000,
  [int]$RecentMonths = 36
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$targetCnaes = @{}
$Cnaes.Split(",") | ForEach-Object {
  $value = ($_ -replace "\D", "")
  if ($value) { $targetCnaes[$value] = $true }
}

$accountingTerms = @("contab", "contabil", "contador", "contabilidade", "escritorio", "fiscal", "assessoria", "assessor", "consultoria", "consult", "bpo")
$genericEmailTerms = @("admin", "adm", "financeiro", "faturamento", "nfe", "nf-e", "fiscal")
$freeDomains = @("gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br", "terra.com.br", "bol.com.br", "uol.com.br")

$rawHeaders = @(
  "cnpj_basico", "cnpj_ordem", "cnpj_dv", "identificador_matriz_filial", "nome_fantasia",
  "situacao_cadastral", "data_situacao_cadastral", "motivo_situacao_cadastral", "nome_cidade_exterior",
  "pais", "data_inicio_atividade", "cnae_principal", "cnae_secundaria", "tipo_logradouro",
  "logradouro", "numero", "complemento", "bairro", "cep", "uf", "municipio_codigo",
  "ddd1", "telefone1", "ddd2", "telefone2", "ddd_fax", "fax", "email", "situacao_especial",
  "data_situacao_especial"
)

function ConvertTo-AsciiLower([string]$Value) {
  if (-not $Value) { return "" }
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object Text.StringBuilder
  foreach ($char in $normalized.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }
  return $builder.ToString().ToLowerInvariant().Trim()
}

function Split-CsvLine([string]$Line) {
  $values = New-Object Collections.Generic.List[string]
  $current = New-Object Text.StringBuilder
  $quoted = $false
  for ($i = 0; $i -lt $Line.Length; $i++) {
    $char = $Line[$i]
    $next = if ($i + 1 -lt $Line.Length) { $Line[$i + 1] } else { [char]0 }
    if ($char -eq '"' -and $quoted -and $next -eq '"') {
      [void]$current.Append('"')
      $i++
      continue
    }
    if ($char -eq '"') {
      $quoted = -not $quoted
      continue
    }
    if ($char -eq ';' -and -not $quoted) {
      $values.Add($current.ToString().Trim())
      $current.Clear() | Out-Null
      continue
    }
    [void]$current.Append($char)
  }
  $values.Add($current.ToString().Trim())
  return $values.ToArray()
}

function Escape-Csv([string]$Value) {
  $safe = if ($null -eq $Value) { "" } else { $Value }
  return '"' + ($safe -replace '"', '""') + '"'
}

function Digits([string]$Value) {
  if (-not $Value) { return "" }
  return ($Value -replace "\D", "")
}

function Get-RowValue($Row, [string[]]$Keys) {
  foreach ($key in $Keys) {
    if ($Row.ContainsKey($key) -and $Row[$key]) { return [string]$Row[$key] }
  }
  return ""
}

function Format-DateReceita([string]$Value) {
  $digits = Digits $Value
  if ($digits.Length -ne 8) { return "" }
  return "$($digits.Substring(0,4))-$($digits.Substring(4,2))-$($digits.Substring(6,2))"
}

function Is-Recent([string]$Date, [int]$Months) {
  if (-not $Date) { return $false }
  $parsed = [datetime]::MinValue
  if (-not [datetime]::TryParse($Date, [ref]$parsed)) { return $false }
  return $parsed -ge (Get-Date).AddMonths(-1 * $Months)
}

function Test-Mobile([string]$Phone) {
  $digits = Digits $Phone
  return $digits.Length -ge 12 -and $digits.Substring($digits.Length - 9, 1) -eq "9"
}

function Test-CorporateEmail([string]$Email) {
  if (-not $Email -or -not $Email.Contains("@")) { return $false }
  $domain = (ConvertTo-AsciiLower ($Email.Split("@")[-1]))
  return $domain.Contains(".") -and -not $freeDomains.Contains($domain)
}

function Qualify-Row($Row) {
  $cnpj = Digits (Get-RowValue $Row @("cnpj", "CNPJ", "cnpj_completo"))
  if ($cnpj.Length -ne 14) {
    $cnpj = "{0}{1}{2}" -f (Digits (Get-RowValue $Row @("cnpj_basico"))).PadLeft(8, "0"), (Digits (Get-RowValue $Row @("cnpj_ordem"))).PadLeft(4, "0"), (Digits (Get-RowValue $Row @("cnpj_dv"))).PadLeft(2, "0")
  }

  $status = Digits (Get-RowValue $Row @("situacao_cadastral"))
  $isActive = -not $status -or $status -eq "02" -or $status -eq "2"
  $cnaePrincipal = Digits (Get-RowValue $Row @("cnae_principal"))
  $cnaeSecundaria = ((Get-RowValue $Row @("cnae_secundaria")).Split(",") | ForEach-Object { Digits $_ } | Where-Object { $_ }) -join ","
  $hasTargetCnae = $targetCnaes.ContainsKey($cnaePrincipal)
  if (-not $hasTargetCnae) {
    foreach ($cnae in $cnaeSecundaria.Split(",")) {
      if ($targetCnaes.ContainsKey($cnae)) { $hasTargetCnae = $true; break }
    }
  }

  $ddd1 = Digits (Get-RowValue $Row @("ddd1"))
  $phone1 = Digits (Get-RowValue $Row @("telefone1"))
  $ddd2 = Digits (Get-RowValue $Row @("ddd2"))
  $phone2 = Digits (Get-RowValue $Row @("telefone2"))
  $phone = ""
  if ($ddd1 -and $phone1) { $phone = "55$ddd1$phone1" }
  elseif ($ddd2 -and $phone2) { $phone = "55$ddd2$phone2" }

  $email = (Get-RowValue $Row @("email")).ToLowerInvariant()
  $hasPhone = [bool]$phone
  $hasEmail = [bool]$email
  $mobile = Test-Mobile $phone
  $corporateEmail = Test-CorporateEmail $email
  $openedAt = Format-DateReceita (Get-RowValue $Row @("data_inicio_atividade"))
  $recent = Is-Recent $openedAt $RecentMonths

  $searchText = ConvertTo-AsciiLower "$email $(Get-RowValue $Row @("nome_fantasia")) $(Get-RowValue $Row @("razao_social")) $(Get-RowValue $Row @("logradouro"))"
  $accountingEvidence = ""
  foreach ($term in $accountingTerms) {
    if ($searchText.Contains($term)) { $accountingEvidence = $term; break }
  }
  $genericEvidence = ""
  $emailText = ConvertTo-AsciiLower $email
  foreach ($term in $genericEmailTerms) {
    if ($emailText.Contains($term)) { $genericEvidence = $term; break }
  }

  $quality = "D_SEM_CONTATO"
  if ($hasPhone -and $hasEmail) { $quality = "A_TELEFONE_E_EMAIL" }
  elseif ($hasPhone) { $quality = "B_SO_TELEFONE" }
  elseif ($hasEmail) { $quality = "C_SO_EMAIL" }

  $role = "sem_sinal_claro"
  if ($accountingEvidence) { $role = "possivel_contador" }
  elseif ($hasPhone -or $hasEmail) { $role = "provavel_empresa" }

  $risk = "baixo"
  if (-not $hasPhone -and -not $hasEmail) { $risk = "alto" }
  elseif ($accountingEvidence -or (-not $mobile -and -not $corporateEmail -and $genericEvidence)) { $risk = "medio" }

  $channel = "baixa_prioridade"
  if ($role -eq "possivel_contador") { $channel = "abordagem_contador_parceiro" }
  elseif ($hasPhone) { $channel = "whatsapp_primeiro_email_de_apoio" }
  elseif ($hasEmail) { $channel = "email_primeiro" }

  $score = 0
  if ($hasTargetCnae) { $score += 35 }
  if ($isActive) { $score += 20 }
  if ($hasPhone -and $hasEmail) { $score += 18 }
  elseif ($hasPhone) { $score += 12 }
  elseif ($hasEmail) { $score += 7 }
  if ($mobile) { $score += 10 }
  if ($corporateEmail) { $score += 7 }
  if ($recent) { $score += 10 }
  if ($role -eq "possivel_contador") { $score -= 12 }
  if ($risk -eq "alto") { $score -= 25 }
  if (-not $hasTargetCnae) { $score -= 30 }
  $score = [Math]::Max(0, [Math]::Min(100, $score))

  $tier = "D"
  if ($score -ge 75) { $tier = "A" }
  elseif ($score -ge 55) { $tier = "B" }
  elseif ($score -ge 35) { $tier = "C" }

  $evidence = ""
  if ($accountingEvidence) { $evidence = "termo de contabilidade: $accountingEvidence" }
  elseif ($genericEvidence) { $evidence = "email generico: $genericEvidence" }

  return [ordered]@{
    cnpj = $cnpj
    nome_fantasia = Get-RowValue $Row @("nome_fantasia")
    data_inicio_atividade = (Digits (Get-RowValue $Row @("data_inicio_atividade")))
    cnae_principal = $cnaePrincipal
    cnae_secundaria = $cnaeSecundaria
    uf = Get-RowValue $Row @("uf")
    municipio_codigo = Get-RowValue $Row @("municipio_codigo")
    bairro = Get-RowValue $Row @("bairro")
    cep = Get-RowValue $Row @("cep")
    endereco = ((Get-RowValue $Row @("tipo_logradouro")) + " " + (Get-RowValue $Row @("logradouro")) + " " + (Get-RowValue $Row @("numero")) + " " + (Get-RowValue $Row @("complemento"))).Trim()
    ddd1 = $ddd1
    telefone1 = $phone1
    ddd2 = $ddd2
    telefone2 = $phone2
    email = $email
    qualidade_contato = $quality
    contact_risk_level = $risk
    contact_role_hint = $role
    contact_evidence = $evidence
    recommended_channel = $channel
    lead_score_receita = [string]$score
    lead_tier = $tier
    _is_active = $isActive
    _has_target_cnae = $hasTargetCnae
    _has_contact = ($hasPhone -or $hasEmail)
  }
}

function Get-InputReader([string]$Path) {
  if ($Path.ToLowerInvariant().EndsWith(".zip")) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Path))
    $entry = $zip.Entries | Sort-Object Length -Descending | Select-Object -First 1
    $stream = $entry.Open()
    return @{ Reader = [IO.StreamReader]::new($stream, [Text.Encoding]::GetEncoding("ISO-8859-1")); Stream = $stream; Zip = $zip }
  }
  $reader = [IO.StreamReader]::new((Resolve-Path $Path), [Text.Encoding]::GetEncoding("ISO-8859-1"))
  return @{ Reader = $reader; Stream = $null; Zip = $null }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$inputReader = Get-InputReader $SourcePath
$reader = $inputReader.Reader
$results = New-Object Collections.Generic.List[object]
$lineNumber = 0
$headers = $null

try {
  while (($line = $reader.ReadLine()) -ne $null) {
    $lineNumber++
    if (-not $line.Trim()) { continue }
    $values = Split-CsvLine $line

    if ($lineNumber -eq 1) {
      $first = ($values -join ";").ToLowerInvariant()
      if ($first.Contains("cnpj") -or $first.Contains("nome_fantasia")) {
        $headers = $values | ForEach-Object { (ConvertTo-AsciiLower $_).Replace(" ", "_") }
        continue
      }
      $headers = $rawHeaders
    }

    $row = @{}
    for ($i = 0; $i -lt $headers.Count; $i++) {
      $row[$headers[$i]] = if ($i -lt $values.Count) { $values[$i] } else { "" }
    }

    $qualified = Qualify-Row $row
    if (-not $qualified._is_active) { continue }
    if (-not $qualified._has_target_cnae) { continue }
    if (-not $qualified._has_contact) { continue }
    if ($Uf -and $qualified.uf.ToUpperInvariant() -ne $Uf.ToUpperInvariant()) { continue }

    $results.Add($qualified)
    if ($Limit -gt 0 -and $results.Count -ge $Limit) { break }
  }
}
finally {
  $reader.Dispose()
  if ($inputReader.Stream) { $inputReader.Stream.Dispose() }
  if ($inputReader.Zip) { $inputReader.Zip.Dispose() }
}

$sorted = $results | Sort-Object @{ Expression = { [int]$_["lead_score_receita"] }; Descending = $true }, @{ Expression = { $_["contact_risk_level"] }; Ascending = $true }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$headersOut = @("cnpj","nome_fantasia","data_inicio_atividade","cnae_principal","cnae_secundaria","uf","municipio_codigo","bairro","cep","endereco","ddd1","telefone1","ddd2","telefone2","email","qualidade_contato","contact_risk_level","contact_role_hint","contact_evidence","recommended_channel","lead_score_receita","lead_tier")
$allPath = Join-Path $OutputDir "leads_qualificados_$timestamp.csv"

function Write-LeadsCsv($Items, [string]$Path) {
  $writer = [IO.StreamWriter]::new($Path, $false, [Text.UTF8Encoding]::new($true))
  try {
    $writer.WriteLine(($headersOut | ForEach-Object { Escape-Csv $_ }) -join ";")
    foreach ($item in $Items) {
      $writer.WriteLine(($headersOut | ForEach-Object { Escape-Csv ([string]$item[$_]) }) -join ";")
    }
  }
  finally {
    $writer.Dispose()
  }
}

Write-LeadsCsv $sorted $allPath

$batchNumber = 1
for ($offset = 0; $offset -lt $sorted.Count; $offset += $BatchSize) {
  $batch = $sorted | Select-Object -Skip $offset -First $BatchSize
  if (-not $batch) { break }
  $batchPath = Join-Path $OutputDir ("carga_{0:000}_$timestamp.csv" -f $batchNumber)
  Write-LeadsCsv $batch $batchPath
  $batchNumber++
}

$byTier = $sorted | Group-Object { $_["lead_tier"] } | ForEach-Object { "$($_.Name):$($_.Count)" }
$byRole = $sorted | Group-Object { $_["contact_role_hint"] } | ForEach-Object { "$($_.Name):$($_.Count)" }
Write-Host "Leads qualificados: $($sorted.Count)"
Write-Host "Arquivo completo: $allPath"
Write-Host "Cargas geradas: $($batchNumber - 1)"
Write-Host "Tiers: $($byTier -join ', ')"
Write-Host "Tipos contato: $($byRole -join ', ')"
