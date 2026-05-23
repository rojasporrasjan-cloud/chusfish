$port = 5000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "Servidor corriendo en http://localhost:$port/" -ForegroundColor Green
    Write-Host "Presiona Ctrl+C para detener el servidor en la terminal." -ForegroundColor Yellow
    
    # Abrir el navegador automáticamente
    Start-Process "http://localhost:$port/"
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        # Redirigir / a /index.html
        if ($path -eq "/" -or $path -eq "") { 
            $path = "index.html" 
        } elseif ($path.StartsWith("/")) {
            $path = $path.Substring(1)
        }
        
        $localPath = Join-Path (Get-Location).Path $path
        
        if (Test-Path $localPath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentLength64 = $content.Length
            
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".gif"  { "image/gif" }
                ".svg"  { "image/svg+xml" }
                ".json" { "application/json; charset=utf-8" }
                ".pdf"  { "application/pdf" }
                ".mp4"  { "video/mp4" }
                ".webm" { "video/webm" }
                default { "application/octet-stream" }
            }
            $response.ContentType = $contentType
            $response.StatusCode = 200
            
            try {
                $response.OutputStream.Write($content, 0, $content.Length)
            } catch {
                # Ignorar errores de conexión interrumpida
            }
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    Write-Host "El servidor se detuvo o ocurrió un error." -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
