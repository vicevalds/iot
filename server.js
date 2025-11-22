const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configurar multer para manejar archivos en memoria
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  }
});

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Función para reproducir audio en Linux
function playAudio(audioBuffer, mimetype) {
  return new Promise((resolve, reject) => {
    // Crear archivo temporal
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    let extension = 'webm';
    let playerCommand = 'paplay'; // PulseAudio player por defecto
    
    // Determinar extensión y comando según el tipo MIME
    if (mimetype.includes('webm')) {
      extension = 'webm';
    } else if (mimetype.includes('mp3')) {
      extension = 'mp3';
    } else if (mimetype.includes('wav')) {
      extension = 'wav';
      playerCommand = 'paplay'; // paplay soporta wav directamente
    } else if (mimetype.includes('ogg')) {
      extension = 'ogg';
    }

    // Si es webm u otro formato que paplay no soporta directamente, usar ffplay
    if (extension === 'webm' || extension === 'mp3' || extension === 'ogg') {
      playerCommand = 'ffplay';
    }

    const tempFilePath = path.join(tempDir, `audio_${timestamp}.${extension}`);
    
    // Escribir buffer a archivo temporal
    fs.writeFileSync(tempFilePath, audioBuffer);

    // Reproducir audio
    let player;
    
    if (playerCommand === 'ffplay') {
      // ffplay reproduce automáticamente y no bloquea
      player = spawn('ffplay', [
        '-autoexit',
        '-nodisp',
        '-loglevel', 'quiet',
        tempFilePath
      ]);
    } else {
      // paplay para wav
      player = spawn('paplay', [tempFilePath]);
    }

    let errorOutput = '';

    player.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    player.on('close', (code) => {
      // Eliminar archivo temporal después de reproducir
      setTimeout(() => {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }, 1000);

      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Error al reproducir audio: ${errorOutput || 'Código de salida ' + code}`));
      }
    });

    player.on('error', (err) => {
      // Eliminar archivo temporal en caso de error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      reject(new Error(`Error al ejecutar el reproductor de audio: ${err.message}. Asegúrate de tener ${playerCommand} instalado.`));
    });
  });
}

// Endpoint POST para recibir y reproducir audio
app.post('/api/audio/play', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se recibió ningún archivo de audio' 
      });
    }

    const audioBuffer = req.file.buffer;
    const mimetype = req.file.mimetype;

    console.log(`Reproduciendo audio: ${req.file.originalname} (${mimetype}, ${audioBuffer.length} bytes)`);

    // Reproducir audio
    await playAudio(audioBuffer, mimetype);

    res.json({ 
      success: true, 
      message: 'Audio reproducido exitosamente',
      filename: req.file.originalname,
      size: audioBuffer.length,
      mimetype: mimetype
    });

  } catch (error) {
    console.error('Error al reproducir audio:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Ruta catch-all para SPA (solo si existe el directorio dist)
app.get('*', (req, res) => {
  const distPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    res.sendFile(distPath);
  } else {
    res.status(404).json({ 
      message: 'Frontend no construido. Ejecuta "npm run build" primero.' 
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${port}`);
  console.log(`Endpoint para reproducir audio: POST http://0.0.0.0:${port}/api/audio/play`);
});

