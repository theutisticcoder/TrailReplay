// Simple translation system
export const translations = {
    en: {
        subtitle: "Visualize your GPX trails in 3D",
        upload: {
            title: "Upload GPX File",
            description: "Drag & drop your GPX file or click to browse",
            button: "Choose File"
        },
        controls: {
            activity: "Activity Type:",
            terrain: "Terrain Style:",
            totalTime: "Total Time:",
            pathColor: "Path Color:",
            markerSize: "Marker Size:",
            currentIcon: "Current Icon:",
            changeIcon: "Change",
            autoFollow: "Auto Follow:",
            showCircle: "Show Circle:",
            play: "▶️ Play",
            pause: "⏸️ Pause",
            reset: "🔄 Reset",
            addIconChange: "🔄 Add Icon Change",
            addAnnotation: "📍 Add Note",
            export: "📹 Export Video"
        },
        iconSelection: {
            title: "Select Icon"
        },
        iconChange: {
            title: "Add Icon Change",
            instruction: "Click on the map or progress bar to set the position where the icon should change.",
            newIcon: "New Icon:"
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
            speed: "Avg Speed"
        },
        messages: {
            fileLoaded: "GPX file loaded successfully!",
            fileError: "Error loading GPX file. Please try again.",
            noTrackPoints: "No track points found in GPX file.",
            exportStarted: "Video export started...",
            exportComplete: "Video export completed!",
            annotationAdded: "Annotation added successfully!",
            iconChangeAdded: "Icon change added successfully!",
            clickMapToAnnotate: "Click on the map to add an annotation at that location",
            clickMapForIconChange: "Click on the map or progress bar to set where the icon should change"
        }
    },
    es: {
        subtitle: "Visualiza tus rutas GPX en 3D",
        upload: {
            title: "Subir Archivo GPX",
            description: "Arrastra y suelta tu archivo GPX o haz clic para buscar",
            button: "Elegir Archivo"
        },
        controls: {
            activity: "Tipo de Actividad:",
            terrain: "Estilo de Terreno:",
            totalTime: "Tiempo Total:",
            pathColor: "Color del Sendero:",
            markerSize: "Tamaño del Marcador:",
            currentIcon: "Icono Actual:",
            changeIcon: "Cambiar",
            autoFollow: "Seguir Automáticamente:",
            showCircle: "Mostrar Círculo:",
            play: "▶️ Reproducir",
            pause: "⏸️ Pausar",
            reset: "🔄 Reiniciar",
            addIconChange: "🔄 Añadir Cambio de Icono",
            addAnnotation: "📍 Añadir Nota",
            export: "📹 Exportar Video"
        },
        iconSelection: {
            title: "Seleccionar Icono"
        },
        iconChange: {
            title: "Añadir Cambio de Icono",
            instruction: "Haz clic en el mapa o barra de progreso para establecer donde el icono debería cambiar.",
            newIcon: "Nuevo Icono:"
        },
        iconChanges: {
            title: "Cronología de Cambios de Icono"
        },
        annotations: {
            title: "Anotaciones del Sendero",
            addTitle: "Añadir Anotación",
            clickToAdd: "Haz clic en el mapa para añadir una anotación",
            noAnnotations: "No se han añadido anotaciones aún"
        },
        stats: {
            title: "Estadísticas de la Ruta",
            distance: "Distancia Total",
            duration: "Duración",
            elevation: "Ganancia de Elevación",
            speed: "Velocidad Promedio"
        },
        messages: {
            fileLoaded: "¡Archivo GPX cargado exitosamente!",
            fileError: "Error al cargar el archivo GPX. Inténtalo de nuevo.",
            noTrackPoints: "No se encontraron puntos de seguimiento en el archivo GPX.",
            exportStarted: "Exportación de video iniciada...",
            exportComplete: "¡Exportación de video completada!",
            annotationAdded: "¡Anotación añadida exitosamente!",
            iconChangeAdded: "¡Cambio de icono añadido exitosamente!",
            clickMapToAnnotate: "Haz clic en el mapa para añadir una anotación en esa ubicación",
            clickMapForIconChange: "Haz clic en el mapa o barra de progreso para establecer donde el icono debería cambiar"
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