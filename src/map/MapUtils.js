/**
 * MapUtils - Utility functions for map calculations and conversions
 */

export class MapUtils {
    /**
     * Calculate distance between two geographic points using Haversine formula
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convert longitude to tile coordinate
     */
    static lngToTile(lng, zoom) {
        return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    }

    /**
     * Convert latitude to tile coordinate
     */
    static latToTile(lat, zoom) {
        return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    }

    /**
     * Convert tile coordinate to longitude
     */
    static tileToLng(x, zoom) {
        return x / Math.pow(2, zoom) * 360 - 180;
    }

    /**
     * Convert tile coordinate to latitude
     */
    static tileToLat(y, zoom) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
        return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    /**
     * Decode elevation from Terrarium DEM RGB values
     * @param {number} r - Red channel (0-255)
     * @param {number} g - Green channel (0-255)
     * @param {number} b - Blue channel (0-255)
     * @returns {number} Elevation in meters
     */
    static decodeTerrariumElevation(r, g, b) {
        // Terrarium format: elevation = (Red * 256 + Green + Blue / 256) - 32768
        return (r * 256 + g + b / 256) - 32768;
    }

    /**
     * Find the closest point on a track to a given click point
     */
    static findClosestPointProgress(clickPoint, trackPoints) {
        if (!trackPoints || trackPoints.length === 0) return 0;

        let minDistance = Infinity;
        let closestIndex = 0;
        
        for (let i = 0; i < trackPoints.length; i++) {
            const point = trackPoints[i];
            const distance = this.calculateDistance(
                clickPoint.lat, clickPoint.lng,
                point.lat, point.lon
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }
        
        return closestIndex / (trackPoints.length - 1);
    }

    /**
     * Calculate unique tiles for a route at a given zoom level
     */
    static calculateUniqueTilesForRoute(route, zoom, tileSize = 256) {
        const tiles = new Set();
        
        route.forEach(point => {
            const x = this.lngToTile(point[0], zoom);
            const y = this.latToTile(point[1], zoom);
            tiles.add(`${x},${y}`);
        });
        
        return Array.from(tiles).map(tile => {
            const [x, y] = tile.split(',').map(Number);
            return { x, y, z: zoom };
        });
    }
} 