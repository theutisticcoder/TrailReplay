# 🏃‍♂️ Trail Replay

Trail Replay is a simple, open-source web application for visualizing GPX trail data in 3D. Upload your GPX files and get beautiful animated trail visualizations with customizable activity icons and terrain styles.

## ✨ Features

- **GPX File Upload**: Drag & drop or browse to upload GPX trail files
- **3D Visualization**: Interactive map visualization using MapLibre GL JS
- **Activity Types**: Support for running, cycling, swimming, triathlon, and hiking with custom icons
- **Terrain Styles**: Multiple map styles including satellite, terrain, outdoors, and street views
- **Animation Controls**: Play, pause, reset, and adjust animation speed
- **Trail Statistics**: View distance, duration, elevation gain, and average speed
- **Video Export**: Export trail animations as video files (basic implementation)
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Multi-language**: Support for English and Spanish with automatic detection
- **Open Source**: Built with open-source technologies and completely free

## 🛠️ Technology Stack

- **MapLibre GL JS**: Open-source mapping library for interactive maps
- **Three.js**: 3D graphics library for enhanced visualizations
- **SRTM Data**: Elevation data for terrain processing
- **Turf.js**: Geospatial analysis for distance and elevation calculations
- **Vite**: Fast build tool and development server
- **Vanilla JavaScript**: No heavy frameworks, lightweight and fast

## 🚀 Quick Start

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/trail-replay.git
cd trail-replay
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment.

## 📖 How to Use

1. **Upload GPX File**: 
   - Drag and drop a GPX file onto the upload area, or
   - Click "Choose File" to browse and select a GPX file

2. **Customize Visualization**:
   - Select activity type (running, cycling, swimming, triathlon, hiking)
   - Choose terrain style (satellite, terrain, outdoors, streets)
   - Adjust animation speed using the slider

3. **Control Animation**:
   - Click ▶️ Play to start the trail animation
   - Click ⏸️ Pause to pause the animation
   - Click 🔄 Reset to return to the beginning
   - Click 📹 Export to save animation as video

4. **View Statistics**:
   - Total distance covered
   - Duration of the activity
   - Elevation gain
   - Average speed

## 🌍 Supported Formats

- **GPX Files**: Standard GPS Exchange Format files
- **Track Points**: Latitude, longitude, elevation, and timestamp data
- **Multiple Tracks**: Support for files with multiple track segments

## 🎨 Customization

### Activity Icons

The app automatically detects activity types and shows appropriate icons:
- 🏃‍♂️ Running
- 🚴‍♂️ Cycling  
- 🏊‍♂️ Swimming
- 🏆 Triathlon (multi-sport)
- 🥾 Hiking

### Map Styles

Choose from different map styles:
- **Satellite**: High-resolution satellite imagery
- **Terrain**: Topographic maps with elevation shading
- **Outdoors**: Optimized for outdoor activities
- **Streets**: Detailed street-level mapping

## 🔧 Development

### Project Structure

```
trail-replay/
├── src/
│   ├── main.js          # Main application logic
│   ├── gpxParser.js     # GPX file parsing and processing
│   ├── mapRenderer.js   # Map rendering and animation
│   ├── translations.js  # Multi-language support
│   └── styles.css       # Application styling
├── index.html           # Main HTML file
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
└── README.md           # This file
```

### Adding New Languages

1. Add translations to `src/translations.js`:
```javascript
fr: {
    subtitle: "Visualisez vos traces GPX en 3D",
    // ... other translations
}
```

2. Add language option to the language switcher in `src/main.js`

### Custom Map Sources

To add new map tile sources, modify the `initializeMap()` method in `src/mapRenderer.js`:

```javascript
sources: {
    'custom-source': {
        type: 'raster',
        tiles: ['https://your-tile-server/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© Your Attribution'
    }
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. Follow the existing code style
2. Add comments for complex functionality
3. Test your changes on different screen sizes
4. Ensure responsive design principles are maintained
5. Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MapLibre GL JS** for the amazing mapping capabilities
- **OpenStreetMap** contributors for the map data
- **Three.js** community for 3D graphics support
- **Turf.js** for geospatial calculations
- All the open-source contributors who make projects like this possible

## 🐛 Known Issues

- Video export currently provides static frames (full video export would require additional libraries)
- SRTM data integration is simplified (full integration would require backend services)
- Large GPX files (>1000 points) may affect performance

## 🚀 Future Enhancements

- [ ] Full video export with MP4 encoding
- [ ] Real-time SRTM elevation data integration
- [ ] Support for multiple GPX files comparison
- [ ] Advanced statistics and analytics


---

Made with ❤️ for the outdoor community. Happy trails! 🌲 