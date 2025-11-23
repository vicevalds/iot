import React, { useState } from 'react';
import RecordButton from './components/RecordButton';

function App() {
  const [loading, setLoading] = useState(false);
  const [serverLog, setServerLog] = useState(null);
  const [responseAudioUrl, setResponseAudioUrl] = useState(null);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);

  const handleRecordingComplete = async (audioBlob) => {
    console.log('📼 [App] Grabación completada');
    console.log('📊 [App] Tamaño del audio:', audioBlob.size, 'bytes');
    console.log('📊 [App] Tipo MIME:', audioBlob.type);

    // Validación adicional de seguridad
    if (!audioBlob || audioBlob.size === 0) {
      console.error('❌ [App] Blob inválido o vacío');
      alert('Error: Audio inválido. Por favor, intenta grabar nuevamente.');
      return;
    }

    setLoading(true);

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎙️ [App] INICIANDO ENVÍO DE AUDIO');
    console.log('═══════════════════════════════════════════════════');

    const formData = new FormData();
    // Usar 'file' como clave para coincidir con el endpoint del servidor
    // NOTA: El servidor puede requerir MP3. Si WebM no funciona, necesitaremos
    // implementar conversión usando ffmpeg.wasm o enviar al servidor para conversión.
    formData.append('file', audioBlob, 'recording.webm');

    console.log('📦 [App] FormData creado:');
    console.log('   └─ Clave: "file"');
    console.log('   └─ Nombre archivo: "recording.webm"');
    console.log('   └─ Tamaño: ' + audioBlob.size + ' bytes (' + (audioBlob.size / 1024).toFixed(2) + ' KB)');
    console.log('   └─ Tipo MIME: ' + audioBlob.type);
    console.log('');
    console.log('🚀 [App] Enviando petición HTTP POST...');
    console.log('🌐 [App] Endpoint: https://app.vicevalds.dev/api/agent/process-audio');
    console.log('📤 [App] Content-Type: multipart/form-data');
    console.log('⏳ [App] Esperando respuesta del servidor...');

    try {
      const response = await fetch('https://app.vicevalds.dev/api/agent/process-audio', {
        method: 'POST',
        body: formData,
      });

      console.log('');
      console.log('📡 [App] ¡Respuesta recibida del servidor!');
      console.log('   ├─ Status Code: ' + response.status);
      console.log('   ├─ Status Text: ' + response.statusText);
      console.log('   └─ Headers Content-Type: ' + response.headers.get('content-type'));

      if (response.ok) {
        console.log('');
        console.log('✅ [App] Respuesta exitosa (2xx)');
        console.log('📥 [App] Parseando JSON...');
        const data = await response.json();
        console.log('📊 [App] Datos recibidos:', data);
        console.log('   ├─ Keys:', Object.keys(data).join(', '));
        if (data.response_audio_url) {
          console.log('   └─ Audio de respuesta: ✓ Disponible');
        } else {
          console.log('   └─ Audio de respuesta: ✗ No disponible');
        }

        // Manejar el audio de respuesta si existe
        if (data.response_audio_url) {
          console.log('');
          console.log('───────────────────────────────────────────────────');
          console.log('🎵 [App] PROCESANDO AUDIO DE RESPUESTA');
          console.log('───────────────────────────────────────────────────');

          const fullAudioUrl = `https://app.vicevalds.dev${data.response_audio_url}`;
          console.log('🔗 [App] URL del audio:', fullAudioUrl);

          setResponseAudioUrl(fullAudioUrl);

          // Descargar y reproducir automáticamente
          try {
            console.log('⬇️ [App] Iniciando descarga del audio...');
            const audioResponse = await fetch(fullAudioUrl);

            console.log('📡 [App] Respuesta de descarga:');
            console.log('   ├─ Status: ' + audioResponse.status + ' ' + audioResponse.statusText);
            console.log('   ├─ Content-Type: ' + audioResponse.headers.get('content-type'));
            console.log('   └─ Content-Length: ' + audioResponse.headers.get('content-length') + ' bytes');

            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();
              console.log('');
              console.log('✅ [App] Audio descargado exitosamente');
              console.log('   ├─ Tamaño: ' + audioBlob.size + ' bytes (' + (audioBlob.size / 1024).toFixed(2) + ' KB)');
              console.log('   └─ Tipo: ' + audioBlob.type);

              // Crear URL local para reproducir
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);

              console.log('🔊 [App] Objeto Audio creado');
              console.log('   └─ Iniciando reproducción...');

              audio.onloadedmetadata = () => {
                console.log('📊 [App] Metadata del audio cargada:');
                console.log('   ├─ Duración: ' + audio.duration.toFixed(2) + ' segundos');
                console.log('   └─ Ready State: ' + audio.readyState);
              };

              audio.onplay = () => {
                console.log('');
                console.log('▶️ [App] ¡Reproducción iniciada!');
                setIsPlayingResponse(true);
              };

              audio.onended = () => {
                console.log('⏹️ [App] Reproducción finalizada');
                console.log('🧹 [App] Liberando recursos...');
                setIsPlayingResponse(false);
                URL.revokeObjectURL(audioUrl);
                console.log('✅ [App] Recursos liberados');
                console.log('═══════════════════════════════════════════════════');
              };

              audio.onerror = (e) => {
                console.error('');
                console.error('❌ [App] Error durante la reproducción');
                console.error('   ├─ Error:', e);
                console.error('   └─ Audio error code:', audio.error ? audio.error.code : 'unknown');
                setIsPlayingResponse(false);
                URL.revokeObjectURL(audioUrl);
                console.log('═══════════════════════════════════════════════════');
              };

              audio.play().catch(err => {
                console.error('❌ [App] Error al iniciar reproducción:', err);
              });
            } else {
              console.error('');
              console.error('❌ [App] Error al descargar audio');
              console.error('   ├─ Status: ' + audioResponse.status);
              console.error('   └─ Status Text: ' + audioResponse.statusText);
              console.log('═══════════════════════════════════════════════════');
            }
          } catch (audioError) {
            console.error('');
            console.error('❌ [App] Excepción procesando audio de respuesta');
            console.error('   ├─ Error:', audioError.message);
            console.error('   └─ Stack:', audioError.stack);
            console.log('═══════════════════════════════════════════════════');
          }
        }

        // Mostrar log en UI después de 2 segundos
        setTimeout(() => {
          setServerLog({
            timestamp: new Date().toISOString(),
            response: {
              success: true,
              status: response.status,
              statusText: response.statusText,
              body: JSON.stringify(data),
            },
          });
        }, 2000);
      } else {
        console.log('');
        console.warn('⚠️ [App] Respuesta no exitosa del servidor');
        console.warn('   ├─ Status: ' + response.status);
        console.warn('   └─ Status Text: ' + response.statusText);

        // Intentar leer el cuerpo de la respuesta para obtener más detalles
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.warn('📄 [App] Cuerpo de la respuesta:', errorBody);
        } catch (e) {
          console.warn('⚠️ [App] No se pudo leer el cuerpo de la respuesta');
        }

        console.log('═══════════════════════════════════════════════════');

        // Mostrar log de error en UI después de 2 segundos
        setTimeout(() => {
          setServerLog({
            timestamp: new Date().toISOString(),
            response: {
              success: false,
              status: response.status,
              statusText: response.statusText,
              error: errorBody || 'Error desconocido del servidor',
            },
          });
        }, 2000);
      }
    } catch (error) {
      console.error('');
      console.error('❌ [App] EXCEPCIÓN AL SUBIR LA GRABACIÓN');
      console.error('   ├─ Nombre: ' + error.name);
      console.error('   ├─ Mensaje: ' + error.message);
      console.error('   └─ Stack: ' + error.stack);
      console.log('═══════════════════════════════════════════════════');

      // Mostrar log de excepción en UI después de 2 segundos
      setTimeout(() => {
        setServerLog({
          timestamp: new Date().toISOString(),
          response: {
            success: false,
            error: `${error.name}: ${error.message}`,
          },
        });
      }, 2000);
    } finally {
      console.log('🏁 [App] Proceso finalizado');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray1">
      {/* Botón fijo en el centro del viewport */}
      <div className="fixed inset-0 flex-center pointer-events-none">
        <div className="pointer-events-auto">
          <RecordButton onRecordingComplete={handleRecordingComplete} />
        </div>
      </div>

      {loading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 text-center text-gray11 bg-gray3 px-4 py-2 rounded-8 shadow-lg border border-gray5">
          Subiendo grabación...
        </div>
      )}

      {isPlayingResponse && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 text-center text-blue-500 bg-gray3 px-4 py-2 rounded-8 shadow-lg border border-blue-500 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Reproduciendo respuesta...
        </div>
      )}

      {/* Log sutil del servidor */}
      {serverLog && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto">
          <div className="bg-gray2 border border-gray4 rounded-8 p-3 shadow-lg text-12 font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray11 text-10">
                {new Date(serverLog.timestamp).toLocaleTimeString('es-ES')}
              </span>
              <button
                onClick={() => setServerLog(null)}
                className="text-gray9 hover:text-gray11 text-14 leading-none px-2"
              >
                ×
              </button>
            </div>
            <div className="text-gray12">
              {serverLog.response.success ? (
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>
                    Servidor externo: {serverLog.response.status} {serverLog.response.statusText}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-red-500">✗</span>
                  <span>
                    Error: {serverLog.response.error ||
                           `${serverLog.response.status} ${serverLog.response.statusText}` ||
                           'Error desconocido'}
                  </span>
                </div>
              )}
              {serverLog.response.body && (
                <div className="mt-1 text-gray10 text-10 truncate">
                  {serverLog.response.body}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

