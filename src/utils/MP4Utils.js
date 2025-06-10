/**
 * MP4 Utilities for advanced video encoding
 * Similar to MapDirector's client-side MP4 generation approach
 */

export class MP4Utils {
    /**
     * Get the best supported MP4 codec with quality assessment
     */
    static getBestMP4Codec() {
        const codecs = [
            { 
                mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 
                quality: 'high',
                description: 'H.264 Baseline + AAC',
                browserSupport: 'Chrome, Firefox, Safari'
            },
            { 
                mime: 'video/mp4;codecs=avc1.4D401E,mp4a.40.2', 
                quality: 'higher',
                description: 'H.264 Main + AAC',
                browserSupport: 'Chrome, Firefox, Safari'
            },
            { 
                mime: 'video/mp4;codecs=avc1.64001E,mp4a.40.2', 
                quality: 'highest',
                description: 'H.264 High + AAC',
                browserSupport: 'Chrome, Safari'
            },
            { 
                mime: 'video/mp4;codecs=h264', 
                quality: 'medium',
                description: 'H.264 Generic',
                browserSupport: 'Most browsers'
            },
            { 
                mime: 'video/mp4', 
                quality: 'low',
                description: 'Basic MP4',
                browserSupport: 'Basic support'
            }
        ];

        for (const codec of codecs) {
            if (MediaRecorder.isTypeSupported(codec.mime)) {
                console.log(`Selected MP4 codec: ${codec.description} (${codec.quality} quality)`);
                return codec;
            }
        }

        return null;
    }

    /**
     * Check for WebCodecs API support and capabilities
     */
    static async checkWebCodecsSupport() {
        if (!window.VideoEncoder || !window.VideoDecoder) {
            return { supported: false, reason: 'WebCodecs API not available' };
        }

        try {
            // Test H.264 encoder configuration
            const testConfig = {
                codec: 'avc1.42E01E',
                width: 1920,
                height: 1080,
                bitrate: 4000000,
                framerate: 30
            };

            const isConfigSupported = await VideoEncoder.isConfigSupported(testConfig);
            
            return {
                supported: isConfigSupported.supported,
                config: isConfigSupported.config,
                reason: isConfigSupported.supported ? 'WebCodecs H.264 encoder available' : 'H.264 encoder not supported'
            };
        } catch (error) {
            return { 
                supported: false, 
                reason: `WebCodecs test failed: ${error.message}` 
            };
        }
    }

    /**
     * Get optimal recording settings based on device capabilities
     */
    static getOptimalRecordingSettings() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;

        // Determine optimal resolution
        let width, height, bitrate;
        
        if (screenWidth >= 3840) { // 4K screens
            width = 2560;
            height = 1440;
            bitrate = 12000000; // 12 Mbps
        } else if (screenWidth >= 2560) { // 1440p screens
            width = 1920;
            height = 1080;
            bitrate = 8000000; // 8 Mbps
        } else if (screenWidth >= 1920) { // 1080p screens
            width = 1920;
            height = 1080;
            bitrate = 6000000; // 6 Mbps
        } else { // Lower resolution screens
            width = 1280;
            height = 720;
            bitrate = 4000000; // 4 Mbps
        }

        // Adjust for high DPI displays
        if (devicePixelRatio > 1) {
            bitrate = Math.round(bitrate * Math.min(devicePixelRatio, 2)); // Cap at 2x boost
        }

        return {
            width,
            height,
            bitrate,
            framerate: 30,
            devicePixelRatio,
            keyFrameInterval: 30
        };
    }

    /**
     * Create optimized MediaRecorder options
     */
    static createMediaRecorderOptions(codec, settings) {
        const options = {
            mimeType: codec.mime,
            bitsPerSecond: settings.bitrate
        };

        // Add video-specific options if supported
        if (codec.mime.includes('avc1')) {
            options.videoBitsPerSecond = Math.round(settings.bitrate * 0.9); // 90% for video
            options.audioBitsPerSecond = Math.round(settings.bitrate * 0.1); // 10% for audio
        }

        return options;
    }

    /**
     * Validate browser compatibility for MP4 recording
     */
    static validateBrowserCompatibility() {
        const userAgent = navigator.userAgent;
        const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
        const isFirefox = userAgent.includes('Firefox');
        const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
        const isEdge = userAgent.includes('Edg');

        const compatibility = {
            browser: isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : isEdge ? 'Edge' : 'Unknown',
            mp4Support: false,
            webCodecsSupport: false,
            canvasRecording: false,
            recommendations: []
        };

        // Check MediaRecorder support
        if (window.MediaRecorder) {
            compatibility.canvasRecording = true;
            
            // Check MP4 support
            const mp4Codec = this.getBestMP4Codec();
            if (mp4Codec) {
                compatibility.mp4Support = true;
            } else {
                compatibility.recommendations.push('MP4 recording not supported, WebM will be used instead');
            }
        } else {
            compatibility.recommendations.push('MediaRecorder API not supported');
        }

        // Check WebCodecs support
        if (window.VideoEncoder && window.VideoDecoder) {
            compatibility.webCodecsSupport = true;
        } else {
            compatibility.recommendations.push('WebCodecs API not available (Chrome 94+ required for advanced features)');
        }

        // Browser-specific recommendations
        if (isChrome) {
            if (!compatibility.mp4Support) {
                compatibility.recommendations.push('Update Chrome to latest version for MP4 support');
            }
        } else if (isFirefox) {
            compatibility.recommendations.push('Firefox has limited MP4 MediaRecorder support, WebM recommended');
        } else if (isSafari) {
            compatibility.recommendations.push('Safari MP4 support varies by version, test before use');
        }

        return compatibility;
    }

    /**
     * Generate filename with metadata
     */
    static generateFilename(prefix = 'trail-replay', extension = 'mp4', includeTimestamp = true) {
        let filename = prefix;
        
        if (includeTimestamp) {
            const now = new Date();
            const timestamp = now.toISOString()
                .slice(0, 19)
                .replace(/:/g, '-')
                .replace('T', '_');
            filename += `_${timestamp}`;
        }
        
        return `${filename}.${extension}`;
    }

    /**
     * Calculate estimated file size
     */
    static estimateFileSize(durationSeconds, bitrate) {
        // Convert bitrate (bits per second) to bytes per second, then to total bytes
        const bytesPerSecond = bitrate / 8;
        const totalBytes = bytesPerSecond * durationSeconds;
        
        // Add 10% overhead for container and metadata
        const estimatedBytes = totalBytes * 1.1;
        
        return {
            bytes: Math.round(estimatedBytes),
            mb: Math.round(estimatedBytes / (1024 * 1024) * 100) / 100,
            displaySize: this.formatFileSize(estimatedBytes)
        };
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024 * 10) / 10 + ' KB';
        if (bytes < 1024 * 1024 * 1024) return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB';
        return Math.round(bytes / (1024 * 1024 * 1024) * 10) / 10 + ' GB';
    }

    /**
     * Create a blob URL with automatic cleanup
     */
    static createBlobURL(chunks, mimeType, autoCleanupMs = 30000) {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Auto cleanup after specified time
        if (autoCleanupMs > 0) {
            setTimeout(() => {
                try {
                    URL.revokeObjectURL(url);
                    console.log('Auto-cleaned blob URL');
                } catch (error) {
                    console.warn('Error cleaning up blob URL:', error);
                }
            }, autoCleanupMs);
        }
        
        return { blob, url, size: blob.size };
    }

    /**
     * Download blob with progress indication
     */
    static downloadBlob(blob, filename, onProgress = null) {
        return new Promise((resolve, reject) => {
            try {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                
                document.body.appendChild(a);
                
                // Simulate download progress if callback provided
                if (onProgress) {
                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += 10;
                        onProgress(progress);
                        if (progress >= 100) {
                            clearInterval(interval);
                        }
                    }, 50);
                }
                
                a.click();
                document.body.removeChild(a);
                
                // Cleanup URL after delay
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    resolve();
                }, 1000);
                
            } catch (error) {
                reject(error);
            }
        });
    }
} 