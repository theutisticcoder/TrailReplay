// Simple translation system
export const translations = {
    en: {
        subtitle: "Replay the story your trails told",
        upload: {
            title: "Upload GPX Files",
            description: "Drag your GPX file here — we'll do the rest",
            button: "Choose Files"
        },
        controls: {
            activity: "Activity Type:",
            terrain: "Terrain Style:",
            totalTime: "Total Time:",
            pathColor: "Trail Color",
            markerSize: "Marker Size",
            currentIcon: "Current Icon",
            changeIcon: "Change",
            autoFollow: "Auto Follow",
            showCircle: "Show Circle",
            play: "Play",
            pause: "Pause",
            reset: "Reset",
            addIconChange: "🔄 Add Icon Change",
            addAnnotation: "📍 Add Note",
            export: "📹 Export Video",
            autoZoom: "Auto Zoom",
            terrain3d: "3D Terrain",
            terrainSource: "Elevation Data",
            showStats: "Live Stats"
        },
        iconSelection: {
            title: "Select Icon"
        },
        iconChange: {
            title: "Add Icon Change",
            instruction: "Click on the map or progress bar to set the position where the icon should change.",
            newIcon: "New Icon"
        },
        iconChanges: {
            title: "Icon Changes Timeline"
        },
        annotations: {
            title: "Trail Annotations",
            addTitle: "Add Annotation",
            clickToAdd: "Click on the map to add an annotation",
            noAnnotations: "No annotations added yet"
        },
        stats: {
            title: "Trail Statistics",
            distance: "Total Distance",
            duration: "Duration",
            elevation: "Elevation Gain",
            speed: "Avg Speed",
            currentDistance: "Distance",
            currentElevation: "Elevation",
            currentSpeed: "Speed"
        },
        messages: {
            fileLoaded: "GPX file loaded successfully!",
            fileError: "Error loading GPX file. Please try again.",
            noTrackPoints: "No track points found in GPX file.",
            exportStarted: "Starting video export...",
            exportComplete: "Video export complete!",
            annotationAdded: "Trail annotation added",
            iconChangeAdded: "Icon change added",
            clickMapToAnnotate: "Click on the map to add an annotation",
            clickMapForIconChange: "Click on the map to add an icon change",
            noTrackForExport: "No track loaded. Please load a GPX file before exporting.",
            mediaDeviceNotSupported: "Video recording is not supported by your browser.",
            mapNotReady: "Map is not ready for video export.",
            exportVideoPrepare: "Preparing video export. Please wait...",
            exportVideoRecording: "Recording animation... Please wait until complete.",
            exportError: "Error during video export"
        },
        journey: {
            title: "Journey Builder",
            tracks: "Uploaded Tracks",
            segments: "Journey Segments",
            autoUpdating: "Auto-updating journey...",
            journeyUpdated: "Journey updated!",
            noTracks: "Upload GPX files to start building your journey",
            addTransportation: "Add transportation between tracks"
        }
    },
    es: {
        subtitle: "Revive la historia que contaron tus senderos",
        upload: {
            title: "Subir Archivos GPX",
            description: "Arrastra tu archivo GPX aquí — nosotros nos encargamos del resto",
            button: "Elegir Archivos"
        },
        controls: {
            activity: "Tipo de Actividad:",
            terrain: "Estilo de Terreno:",
            totalTime: "Tiempo Total:",
            pathColor: "Color del Sendero",
            markerSize: "Tamaño del Marcador",
            currentIcon: "Icono Actual",
            changeIcon: "Cambiar",
            autoFollow: "Seguimiento Automático",
            showCircle: "Mostrar Círculo",
            play: "Reproducir",
            pause: "Pausar",
            reset: "Reiniciar",
            addIconChange: "🔄 Cambiar Icono",
            addAnnotation: "📍 Añadir Nota",
            export: "📹 Exportar Video",
            autoZoom: "Auto Zoom",
            terrain3d: "Terreno 3D",
            terrainSource: "Datos de Elevación",
            showStats: "Estadísticas en Vivo"
        },
        iconSelection: {
            title: "Seleccionar Icono"
        },
        iconChange: {
            title: "Añadir Cambio de Icono",
            instruction: "Haz clic en el mapa o en la barra de progreso para establecer la posición donde debe cambiar el icono.",
            newIcon: "Nuevo Icono"
        },
        iconChanges: {
            title: "Cronología de Cambios de Icono"
        },
        annotations: {
            title: "Anotaciones del Sendero",
            addTitle: "Añadir Anotación"
        },
        stats: {
            title: "Estadísticas del Sendero",
            distance: "Distancia Total",
            elevation: "Ganancia de Elevación",
            currentDistance: "Distancia",
            currentElevation: "Elevación"
        },
        messages: {
            clickMapToAnnotate: "Haz clic en el mapa para añadir una anotación",
            clickMapForIconChange: "Haz clic en el mapa para añadir un cambio de icono",
            annotationAdded: "Anotación del sendero añadida",
            iconChangeAdded: "Cambio de icono añadido",
            exportStarted: "Iniciando exportación de video...",
            exportComplete: "¡Exportación de video completada!",
            noTrackForExport: "No hay ninguna ruta cargada. Carga un archivo GPX antes de exportar.",
            mediaDeviceNotSupported: "La grabación de video no es compatible con tu navegador.",
            mapNotReady: "El mapa no está listo para exportar el video.",
            exportVideoPrepare: "Preparando la exportación del video. Por favor espera...",
            exportVideoRecording: "Grabando animación... Por favor espera hasta que termine.",
            exportError: "Error durante la exportación del video"
        },
        journey: {
            title: "Constructor de Viajes",
            tracks: "Rutas Subidas",
            segments: "Segmentos del Viaje"
        }
    }
};

let currentLanguage = 'en';

export function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        updatePageTranslations();
    }
}

export function t(key) {
    const keys = key.split('.');
    let value = translations[currentLanguage];
    
    for (const k of keys) {
        value = value?.[k];
    }
    
    return value || key;
}

function updatePageTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        if (translation) {
            element.textContent = translation;
        }
    });
}

// Auto-detect browser language
export function initializeTranslations() {
    const browserLang = navigator.language.slice(0, 2);
    setLanguage(translations[browserLang] ? browserLang : 'en');
} 