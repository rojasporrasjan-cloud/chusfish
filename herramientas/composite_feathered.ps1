Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Collections.Generic;

public class ImageProcessor {
    public static void BlurMask(float[,] mask, int width, int height, int radius) {
        float[,] temp = new float[width, height];
        
        // Horizontal blur
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float sum = 0;
                int count = 0;
                for (int k = -radius; k <= radius; k++) {
                    int nx = x + k;
                    if (nx >= 0 && nx < width) {
                        sum += mask[nx, y];
                        count++;
                    }
                }
                temp[x, y] = sum / count;
            }
        }
        
        // Vertical blur
        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                float sum = 0;
                int count = 0;
                for (int k = -radius; k <= radius; k++) {
                    int ny = y + k;
                    if (ny >= 0 && ny < height) {
                        sum += temp[x, ny];
                        count++;
                    }
                }
                mask[x, y] = sum / count;
            }
        }
    }

    public static void CompositeFeathered(string fgPath, string bgPath, string outPath, int tolerance, int blurRadius) {
        using (Bitmap fg = new Bitmap(fgPath))
        using (Bitmap bgImg = new Bitmap(bgPath)) {
            Bitmap bg = new Bitmap(bgImg, fg.Width, fg.Height); // Resize BG to match FG
            Bitmap result = new Bitmap(fg.Width, fg.Height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
            
            float[,] mask = new float[fg.Width, fg.Height];
            bool[,] visited = new bool[fg.Width, fg.Height];
            
            // Initialize mask to 1.0 (foreground)
            for (int x=0; x<fg.Width; x++)
                for (int y=0; y<fg.Height; y++)
                    mask[x,y] = 1.0f;
            
            Color bgColor = fg.GetPixel(0, 0);
            Queue<Point> q = new Queue<Point>();
            q.Enqueue(new Point(0, 0));
            q.Enqueue(new Point(fg.Width - 1, 0));
            q.Enqueue(new Point(0, fg.Height - 1));
            q.Enqueue(new Point(fg.Width - 1, fg.Height - 1));
            
            // Flood fill background
            while (q.Count > 0) {
                Point p = q.Dequeue();
                if (p.X < 0 || p.X >= fg.Width || p.Y < 0 || p.Y >= fg.Height) continue;
                if (visited[p.X, p.Y]) continue;
                visited[p.X, p.Y] = true;
                
                Color c = fg.GetPixel(p.X, p.Y);
                int rDiff = c.R - bgColor.R;
                int gDiff = c.G - bgColor.G;
                int bDiff = c.B - bgColor.B;
                
                if (Math.Sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff) <= tolerance) {
                    mask[p.X, p.Y] = 0.0f; // Background
                    
                    q.Enqueue(new Point(p.X + 1, p.Y));
                    q.Enqueue(new Point(p.X - 1, p.Y));
                    q.Enqueue(new Point(p.X, p.Y + 1));
                    q.Enqueue(new Point(p.X, p.Y - 1));
                }
            }
            
            // Blur the mask for feathered edges
            BlurMask(mask, fg.Width, fg.Height, blurRadius);
            
            // Composite
            for (int x = 0; x < fg.Width; x++) {
                for (int y = 0; y < fg.Height; y++) {
                    Color fgC = fg.GetPixel(x, y);
                    Color bgC = bg.GetPixel(x, y);
                    float a = mask[x, y];
                    
                    int r = (int)(fgC.R * a + bgC.R * (1 - a));
                    int g = (int)(fgC.G * a + bgC.G * (1 - a));
                    int b = (int)(fgC.B * a + bgC.B * (1 - a));
                    
                    result.SetPixel(x, y, Color.FromArgb(255, r, g, b));
                }
            }
            
            result.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
        }
    }
}
"@ -ReferencedAssemblies "System.Drawing"

$bgPath = "C:\Users\rojas\.gemini\antigravity-ide\brain\c2f5fd62-7a52-493e-9e0e-4422ef709d8d\marinado_bg_1780018275509.png"
$inDir = ".\nuevos_productos"
$outDir = ".\nuevos_productos_feathered"

if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$files = Get-ChildItem -Path $inDir -Filter "*.jpg"
foreach ($file in $files) {
    $outPath = Join-Path $outDir ($file.BaseName + ".png")
    Write-Host "Procesando difuminado: $($file.Name)..."
    [ImageProcessor]::CompositeFeathered($file.FullName, $bgPath, $outPath, 15, 12)
}
Write-Host "Composición finalizada."
