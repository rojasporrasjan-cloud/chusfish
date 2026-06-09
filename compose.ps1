Add-Type -AssemblyName System.Drawing

$bgPath = "C:\Users\rojas\.gemini\antigravity-ide\brain\c2f5fd62-7a52-493e-9e0e-4422ef709d8d\marinado_bg_1780018275509.png"
$sourceDir = ".\nuevos_productos_sin_fondo"
$outDir = ".\nuevos_productos_compuestos"

if (!(Test-Path -Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$bgImg = [System.Drawing.Image]::FromFile($bgPath)
$bgWidth = $bgImg.Width
$bgHeight = $bgImg.Height

$files = Get-ChildItem -Path $sourceDir -Filter "*.png"

foreach ($file in $files) {
    Write-Host "Procesando $($file.Name)..."
    $fgImg = [System.Drawing.Image]::FromFile($file.FullName)
    
    # Crear un nuevo bitmap con las dimensiones del fondo
    $bmp = New-Object System.Drawing.Bitmap($bgWidth, $bgHeight)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Alta calidad
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Dibujar fondo
    $g.DrawImage($bgImg, 0, 0, $bgWidth, $bgHeight)
    
    # Calcular tamaño de la imagen frontal para que quepa bien (dejando un margen)
    $margin = [math]::Round($bgWidth * 0.15) # 15% de margen
    $targetWidth = $bgWidth - ($margin * 2)
    $targetHeight = $bgHeight - ($margin * 2)
    
    # Mantener aspecto
    $ratio = [math]::Min($targetWidth / $fgImg.Width, $targetHeight / $fgImg.Height)
    $newW = [math]::Round($fgImg.Width * $ratio)
    $newH = [math]::Round($fgImg.Height * $ratio)
    
    # Centrar
    $posX = [math]::Round(($bgWidth - $newW) / 2)
    $posY = [math]::Round(($bgHeight - $newH) / 2)
    
    $g.DrawImage($fgImg, $posX, $posY, $newW, $newH)
    
    $outPath = Join-Path $outDir $file.Name
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $bmp.Dispose()
    $fgImg.Dispose()
}

$bgImg.Dispose()
Write-Host "Composición finalizada."
