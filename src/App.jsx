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
    const formData = new FormData();
    // Usar 'file' como clave para coincidir con el endpoint del servidor
    // NOTA: El servidor puede requerir MP3. Si WebM no funciona, necesitaremos
    // implementar conversión usando ffmpeg.wasm o enviar al servidor para conversión.
    formData.append('file', audioBlob, 'recording.webm');

    console.log('🚀 [App] Enviando audio al servidor...');
    console.log('🌐 [App] Endpoint:', 'https://app.vicevalds.dev/api/agent/process-audio');
    console.log('📊 [App] Formato de audio:', audioBlob.type);

    try {
      const response = await fetch('https://app.vicevalds.dev/api/agent/process-audio', {
        method: 'POST',
        body: formData,
      });

      console.log('📡 [App] Respuesta recibida');
      console.log('📊 [App] Status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [App] Respuesta exitosa del servidor:', data);

        // Manejar el audio de respuesta si existe
        if (data.response_audio_url) {
          const fullAudioUrl = `https://app.vicevalds.dev${data.response_audio_url}`;
          console.log('🎵 [App] Audio de respuesta disponible:', fullAudioUrl);

          setResponseAudioUrl(fullAudioUrl);

          // Descargar y reproducir automáticamente
          try {
            console.log('⬇️ [App] Descargando audio de respuesta...');
            const audioResponse = await fetch(fullAudioUrl);

            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();
              console.log('✅ [App] Audio descargado:', audioBlob.size, 'bytes');

              // Crear URL local para reproducir
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);

              audio.onplay = () => {
                console.log('▶️ [App] Reproduciendo audio de respuesta');
                setIsPlayingResponse(true);
              };

              audio.onended = () => {
                console.log('⏹️ [App] Audio de respuesta finalizado');
                setIsPlayingResponse(false);
                URL.revokeObjectURL(audioUrl);
              };

              audio.onerror = (e) => {
                console.error('❌ [App] Error al reproducir audio:', e);
                setIsPlayingResponse(false);
                URL.revokeObjectURL(audioUrl);
              };

              audio.play();
            } else {
              console.error('❌ [App] Error al descargar audio:', audioResponse.status);
            }
          } catch (audioError) {
            console.error('❌ [App] Error procesando audio de respuesta:', audioError);
          }
        }

        setServerLog({
          timestamp: new Date().toISOString(),
          response: {
            success: true,
            status: response.status,
            statusText: response.statusText,
            body: JSON.stringify(data),
          },
        });
      } else {
        console.warn('⚠️ [App] Respuesta no exitosa del servidor');
        console.warn('📊 [App] Status:', response.status, response.statusText);

        // Intentar leer el cuerpo de la respuesta para obtener más detalles
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.warn('📄 [App] Cuerpo de la respuesta:', errorBody);
        } catch (e) {
          console.warn('⚠️ [App] No se pudo leer el cuerpo de la respuesta');
        }

        setServerLog({
          timestamp: new Date().toISOString(),
          response: {
            success: false,
            status: response.status,
            statusText: response.statusText,
            error: errorBody || 'Error desconocido del servidor',
          },
        });
      }
    } catch (error) {
      console.error('❌ [App] Error al subir la grabación:', error);
      console.error('📊 [App] Nombre del error:', error.name);
      console.error('📊 [App] Mensaje:', error.message);
      console.error('📊 [App] Stack:', error.stack);

      setServerLog({
        timestamp: new Date().toISOString(),
        response: {
          success: false,
          error: `${error.name}: ${error.message}`,
        },
      });
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

