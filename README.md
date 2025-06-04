# 🏃‍♂️ TrailReplay

TrailReplay is a powerful, open-source web application that transforms your GPX trail data into stunning, interactive 3D animations. Create beautiful visual stories of your outdoor adventures with professional-quality video exports, detailed analytics, and rich storytelling features.

## ✨ Core Features

### 📁 **Multi-File Journey Builder**
- **Multiple GPX Upload**: Upload and combine multiple GPX files into a single journey
- **Drag & Drop Interface**: Intuitive file handling with visual feedback
- **Transportation Segments**: Add custom transportation between tracks (car, boat, plane, train, walking)
- **Custom Timing**: Override automatic timing calculations with your own durations
- **Auto-Preview**: Real-time visualization updates as you build your journey

### 🎬 **3D Visualization & Animation**
- **Interactive 3D Maps**: Powered by MapLibre GL JS with smooth animations
- **Multiple Map Styles**: Satellite, terrain, and street view options
- **3D Terrain Rendering**: Dramatic elevation visualization with multiple data sources
- **Customizable Trail Styling**: Custom colors, marker sizes, and visual effects
- **Auto-Follow Camera**: Dynamic camera that follows your animated progress
- **Real-Time Statistics**: Live distance, elevation, and timing data during playback

### 📹 **Professional Video Export**
- **WebM Export**: 30 FPS video recording at 2.5 Mbps bitrate
- **Clean Interface**: UI elements automatically hidden during recording
- **Browser-Native Recording**: Uses MediaRecorder API for optimal performance
- **Optimized for Sharing**: Perfect format for social media and presentations

### 📝 **Rich Storytelling Features**
- **Trail Annotations**: Add notes, warnings, photos, and points of interest
- **Dynamic Icon Changes**: Change activity icons during animation (perfect for triathlons!)
- **Timeline Editor**: Visual timeline with drag-to-reorder functionality
- **Icon Library**: Extensive collection of activity and location icons
- **Custom Descriptions**: Add context and stories to specific trail moments

### 🗺️ **Advanced Map Features**
- **Multiple Terrain Sources**: Mapzen Terrarium and OpenTopography SRTM data
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Real-Time Map Controls**: Zoom, pan, and style switching during animation
- **Watermark Support**: Branded logo overlay for professional presentations
- **Live Stats Overlay**: Real-time performance metrics display

### 🌍 **Multi-Language Support**
- **English & Spanish**: Full translation support with automatic detection
- **Extensible**: Easy to add new languages
- **Cultural Adaptation**: Localized date, time, and measurement formats

## 🚀 Quick Start

### Option 1: Try the Examples
1. Visit the [Tutorial Page](tutorial.html) for comprehensive guides and examples
2. Download sample GPX files for running, cycling, hiking, or multi-sport activities
3. Follow the step-by-step tutorial to explore all features

### Option 2: Use Your Own Data
1. **Upload GPX Files**: Drag & drop your GPX files or click "Choose Files"
2. **Build Your Journey**: Arrange tracks and add transportation segments
3. **Customize**: Choose map style, colors, and animation settings
4. **Animate**: Click Play to watch your trail come to life
5. **Export**: Save as video to share your adventure

## 🛠️ Development Setup

### Prerequisites
- Node.js 16+ and npm/yarn
- Modern web browser (Chrome 80+, Firefox 75+, Safari 14+, Edge 80+)

### Installation
```bash
git clone https://github.com/yourusername/trail-replay.git
cd trail-replay
npm install
npm run dev
```

### Building for Production
```bash
npm run build
```

## 📖 Complete Feature Guide

### 🧩 Journey Builder
The Journey Builder is the heart of TrailReplay, allowing you to create complex multi-activity journeys:

- **Track Management**: Upload, reorder, and manage multiple GPX files
- **Transportation Modes**: Add segments between activities (🚗 car, ⛵ boat, ✈️ plane, 🚂 train, 🚶‍♂️ walk)
- **Custom Timing**: Override automatic calculations with your preferred durations
- **Visual Timeline**: Drag-and-drop timeline editor with real-time preview
- **Auto-Synchronization**: All timing displays stay synchronized across the interface

### 🎨 Visualization Customization
Make your trail uniquely yours:

- **Map Styles**: 
  - 🛰️ **Satellite**: High-resolution satellite imagery
  - 🗻 **Terrain**: Topographic maps with elevation shading  
  - 🗺️ **Street**: Detailed street-level mapping
- **3D Terrain**: Enable dramatic elevation visualization
- **Trail Styling**: Custom colors, marker sizes, background circles
- **Activity Icons**: 100+ icons across categories (activities, transportation, landmarks, weather)
- **Auto-Follow**: Camera automatically tracks animated marker

### 📝 Advanced Storytelling
Tell rich stories with your trail data:

- **Trail Annotations**: 
  - Add titles and descriptions to specific points
  - Choose from preset icons (📍 📸 ⚠️ 🏔️ 💧 🌳 🏠 ⭐)
  - Automatic display during animation playback
  - Click to jump to specific moments
- **Icon Timeline**:
  - Change activity icons during animation
  - Perfect for triathlons, adventure races, weather changes
  - Visual markers on progress bar
  - Edit and delete functionality

### 🎥 Video Export System
Professional-quality video creation:

- **Format**: WebM with VP9 codec for optimal web compatibility
- **Quality**: 30 FPS at 2.5 Mbps for smooth, high-quality output
- **Clean Recording**: UI elements automatically hidden during export
- **Performance**: Optimized recording process with map tile pre-loading
- **Tips for Best Results**: 
  - Wait for map tiles to fully load
  - Use slower animation speeds for smoother recordings
  - Close other browser tabs during export

### 📊 Analytics & Statistics
Comprehensive trail analytics:

- **Real-Time Stats**: Distance and elevation update during animation
- **Journey Totals**: Complete distance, elevation gain, and duration
- **Segment Breakdown**: Individual statistics for each track
- **Live Overlay**: Optional floating stats panel during animation
- **Export Data**: All statistics included in video exports

## 🔧 Technical Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Mapping**: MapLibre GL JS for 3D mapping and animations
- **3D Graphics**: Three.js for enhanced visualizations
- **Video**: MediaRecorder API for browser-native recording
- **Geospatial**: Turf.js for distance calculations and spatial analysis
- **Build Tool**: Vite for fast development and optimized builds

### Data Processing
- **GPX Parsing**: Custom parser supporting tracks, segments, and waypoints
- **Timing Calculation**: Smart algorithms for realistic animation timing
- **Elevation Data**: Integration with Mapzen and OpenTopography APIs
- **Coordinate System**: WGS84 with proper projection handling

### Performance Features
- **Client-Side Processing**: All data stays in your browser
- **Web Workers**: Background processing for large files
- **Efficient Rendering**: Optimized WebGL rendering pipeline
- **Memory Management**: Smart cleanup for long animations

## 🔒 Privacy & Security

- **🛡️ Client-Side Only**: All processing happens in your browser
- **🔐 No Data Upload**: Your GPX files never leave your device
- **👁️ No Tracking**: No analytics, cookies, or user tracking
- **📖 Open Source**: All code is publicly available and auditable
- **🌐 Offline Capable**: Works without internet once loaded (except map tiles)

## 🌍 Browser Compatibility

| Browser | Version | Features |
|---------|---------|----------|
| Chrome | 80+ | ✅ Full support including video export |
| Firefox | 75+ | ✅ Full support including video export |
| Safari | 14+ | ⚠️ Basic features (limited video export) |
| Edge | 80+ | ✅ Full support including video export |

## 🤝 Contributing

We welcome contributions! Here are ways you can help:

### Development
- 🐛 **Bug Reports**: Submit detailed bug reports with reproduction steps
- 💡 **Feature Requests**: Suggest new features or improvements
- 🔧 **Code Contributions**: Submit pull requests with new features or fixes
- 📝 **Documentation**: Help improve documentation and tutorials

### Localization
- 🌍 **New Languages**: Add translations in `src/translations.js`
- 🔤 **Improve Translations**: Enhance existing translations
- 🏛️ **Cultural Adaptation**: Help with cultural customizations

### Testing
- 🧪 **Beta Testing**: Test new features and report issues
- 📱 **Device Testing**: Test on different devices and browsers
- 🗺️ **Map Testing**: Test with different GPX files and regions

## 📂 Project Structure

```
trail-replay/
├── src/
│   ├── main.js              # Main application logic & UI management
│   ├── gpxParser.js         # GPX file parsing and processing
│   ├── mapRenderer.js       # Map rendering, animation & 3D graphics
│   ├── journeyBuilder.js    # Multi-track journey management
│   ├── translations.js      # Multi-language support
│   └── styles.css          # Application styling & responsive design
├── images/
│   ├── logo.svg            # Main application logo
│   └── logohorizontal.svg  # Horizontal logo for watermarks
├── index.html              # Main application page
├── tutorial.html           # Comprehensive tutorial & examples
├── package.json            # Dependencies and build scripts
├── vite.config.js         # Build configuration
└── README.md              # This documentation
```

## 🔮 Roadmap & Future Features

### v1.0
- [ ] **Enhanced Video Export**: MP4 format with ffmpeg.wasm
- [ ] **Photo Integration**: Sync photos with GPS locations
- [ ] **No gpx route builder**: Add a route between two points
- [ ] **Strava Integration**: Sync with Strava
- [ ] **Social Sharing**: Direct sharing to social media platforms
- [ ] **Route Planning**: Draw routes directly on the map


### Medium Term (v1.5)
- [ ] **Have an account with projects**: Save your journeys to your account
- [ ] **Advanced Analytics**: Heart rate, pace, and power data visualization
- [ ] **Weather Integration**: Historical weather data overlay

### Long Term (v2.0)
- [ ] **Cloud Sync**: Optional cloud storage for journeys
- [ ] **Community Features**: Share and discover public journeys
- [ ] **Advanced 3D**: Terrain textures and environmental effects
- [ ] **VR/AR Support**: Virtual and augmented reality viewing
- [ ] **API Platform**: REST API for third-party integrations


## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MapLibre GL JS** - Open-source mapping that makes this possible
- **OpenStreetMap** - The collaborative mapping project powering our maps
- **Three.js** - 3D graphics library enabling stunning visualizations
- **Turf.js** - Geospatial analysis toolkit
- **Mapzen & OpenTopography** - Elevation data providers
- **The Open Source Community** - For tools, libraries, and inspiration

---

**Made with ❤️ for the outdoor community. Happy trails! 🌲**

*TrailReplay: Where every trail tells a story*

## Internationalization (i18n)

TrailReplay supports English and Spanish. The language is auto-detected from your browser, and you can switch it at any time using the language selector in the header. All major UI elements, including the journey timing panel and journey update messages, are now fully translated.

## Support the Project

If you enjoy using TrailReplay and want to support its development, you can now [☕ Buy me a coffee](https://ko-fi.com/alexalmansa)!

<a href="https://ko-fi.com/alexalmansa" target="_blank" rel="noopener noreferrer"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

Thank you for your support! 
