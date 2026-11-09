# Tạo audio mẫu cho Speaking bằng giọng tổng hợp của Windows (System.Speech).
# Ghi kèm vị trí từng từ (mili giây) để chia cụm và tô sáng khi shadowing.
#   powershell -ExecutionPolicy Bypass -File scripts/make-sample-audio.ps1 -OutDir .run/audio -Voice "Microsoft Zira Desktop"
param(
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Voice = "Microsoft Zira Desktop",
  [Parameter(Mandatory = $true)][string]$InputJson
)
Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$items = Get-Content -Raw -Encoding UTF8 $InputJson | ConvertFrom-Json
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($item in $items) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SelectVoice($Voice)
  $synth.Rate = [int]$item.rate
  $script:words = New-Object System.Collections.ArrayList
  $synth.add_SpeakProgress({ param($s, $e) [void]$script:words.Add(@{ ms = [int]$e.AudioPosition.TotalMilliseconds; pos = $e.CharacterPosition; len = $e.CharacterCount; text = $e.Text }) })
  $wav = Join-Path $OutDir ($item.key + ".wav")
  $synth.SetOutputToWaveFile($wav, $fmt)
  $synth.Speak([string]$item.text)
  $synth.SetOutputToNull()
  $synth.Dispose()
  $script:words | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 (Join-Path $OutDir ($item.key + ".words.json"))
  Write-Output "ok $($item.key)"
}
