Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Collections.Generic;

public class ImageProcessor {
    public static void RemoveBackground(string inputPath, string outputPath, int tolerance) {
        using (Bitmap bmp = new Bitmap(inputPath)) {
            Bitmap newBmp = new Bitmap(bmp.Width, bmp.Height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(newBmp)) {
                g.DrawImage(bmp, 0, 0);
            }
            
            Color bgColor = newBmp.GetPixel(0, 0);
            bool[,] visited = new bool[newBmp.Width, newBmp.Height];
            Queue<Point> q = new Queue<Point>();
            
            q.Enqueue(new Point(0, 0));
            q.Enqueue(new Point(newBmp.Width - 1, 0));
            q.Enqueue(new Point(0, newBmp.Height - 1));
            q.Enqueue(new Point(newBmp.Width - 1, newBmp.Height - 1));
            
            while (q.Count > 0) {
                Point p = q.Dequeue();
                if (p.X < 0 || p.X >= newBmp.Width || p.Y < 0 || p.Y >= newBmp.Height) continue;
                if (visited[p.X, p.Y]) continue;
                
                Color c = newBmp.GetPixel(p.X, p.Y);
                int rDiff = c.R - bgColor.R;
                int gDiff = c.G - bgColor.G;
                int bDiff = c.B - bgColor.B;
                
                if (Math.Sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff) <= tolerance) {
                    newBmp.SetPixel(p.X, p.Y, Color.Transparent);
                    visited[p.X, p.Y] = true;
                    
                    q.Enqueue(new Point(p.X + 1, p.Y));
                    q.Enqueue(new Point(p.X - 1, p.Y));
                    q.Enqueue(new Point(p.X, p.Y + 1));
                    q.Enqueue(new Point(p.X, p.Y - 1));
                }
            }
            
            newBmp.Save(outputPath, System.Drawing.Imaging.ImageFormat.Png);
        }
    }
}
"@ -ReferencedAssemblies "System.Drawing"

$inDir = ".\nuevos_productos"
$outDir = ".\nuevos_productos_sin_fondo_v2"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$files = Get-ChildItem -Path $inDir -Filter "*.jpg"
foreach ($file in $files) {
    $outFile = Join-Path $outDir ($file.BaseName + ".png")
    Write-Host "Procesando con menos tolerancia: $($file.Name)..."
    [ImageProcessor]::RemoveBackground($file.FullName, $outFile, 15) # Tolerancia baja
}
Write-Host "¡Proceso terminado!"
