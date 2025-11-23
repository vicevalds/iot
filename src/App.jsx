import React, { useState } from 'react';
import RecordButton from './components/RecordButton';

function App() {
  const [loading, setLoading] = useState(false);
  const [responseAudioUrl, setResponseAudioUrl] = useState(null);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);

  const handleRecordingComplete = async (audioBlob) => {
    // Validación adicional de seguridad
    if (!audioBlob || audioBlob.size === 0) {
      alert('Error: Audio inválido. Por favor, intenta grabar nuevamente.');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    // IMPORTANTE: El servidor vicevalds espera el campo 'file' (no 'audio')
    formData.append('file', audioBlob, 'recording.webm');

    try {
      // Enviar audio al servidor vicevalds para procesamiento
      const response = await fetch('https://app.vicevalds.dev/api/agent/process-audio', {
        method: 'POST',
        body: formData,
        // No establecer Content-Type manualmente, el navegador lo hará con boundary
      });

      if (response.ok) {
        const data = await response.json();

        // Manejar el audio de respuesta del servidor vicevalds
        if (data.response_audio_url) {
          const fullAudioUrl = `https://app.vicevalds.dev${data.response_audio_url}`;
          setResponseAudioUrl(fullAudioUrl);

          // Descargar el audio de respuesta y enviarlo al servidor local para reproducción
          try {
            const audioResponse = await fetch(fullAudioUrl);

            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();

              // Enviar el audio al servidor local para reproducción en los parlantes
              const localFormData = new FormData();
              localFormData.append('audio', audioBlob, 'response.webm');

              setIsPlayingResponse(true);

              const localResponse = await fetch('/api/audio/play', {
                method: 'POST',
                body: localFormData,
              });

              if (localResponse.ok) {
                const localData = await localResponse.json();
                // Notificar éxito completo
                alert('✅ ÉXITO!\n\nEl audio fue:\n1. Enviado a vicevalds ✓\n2. Procesado correctamente ✓\n3. Reproducido en los parlantes ✓');
              } else {
                const errorText = await localResponse.text();
                alert(`⚠️ Audio procesado por vicevalds pero hubo un error al reproducir:\n\nStatus: ${localResponse.status}\nDetalles: ${errorText}`);
              }

              setIsPlayingResponse(false);
            }
          } catch (audioError) {
            setIsPlayingResponse(false);
          }
        }
      } else {
        // Intentar leer el cuerpo de la respuesta para obtener más detalles
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch (e) {
          // Ignorar error al leer respuesta
        }

        // Alerta al usuario
        alert(`❌ Error del servidor vicevalds:\n\nStatus: ${response.status} ${response.statusText}\n\nDetalles: ${errorBody || 'Sin detalles adicionales'}\n\nPor favor, verifica que el servidor vicevalds esté funcionando correctamente.`);
      }
    } catch (error) {
      // Determinar el tipo de error
      let errorMessage = '';
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = `❌ ERROR DE CONEXIÓN\n\nNo se pudo conectar al servidor vicevalds.\n\nPosibles causas:\n• El servidor está apagado o no responde\n• Problema de red o firewall\n• URL incorrecta\n• Problema CORS\n\nURL intentada: https://app.vicevalds.dev/api/agent/process-audio\n\nPor favor, verifica que el servidor vicevalds esté funcionando.`;
      } else {
        errorMessage = `❌ ERROR AL ENVIAR AUDIO\n\nError: ${error.name}\nMensaje: ${error.message}\n\nPor favor, intenta nuevamente.`;
      }

      alert(errorMessage);
    } finally {
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
          Enviando a vicevalds...
        </div>
      )}

      {isPlayingResponse && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 text-center text-blue-500 bg-gray3 px-4 py-2 rounded-8 shadow-lg border border-blue-500 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Reproduciendo en parlantes...
        </div>
      )}
    </div>
  );
}

export default App;

